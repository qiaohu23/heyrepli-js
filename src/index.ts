/**
 * HeyRepli SDK - Official JavaScript/TypeScript client.
 *
 * Covers all 13 HeyRepli MCP tools + 5 Open REST endpoints.
 *
 * Usage:
 *   import { HeyRepli } from "heyrepli";
 *   const hr = new HeyRepli({ apiKey: process.env.HEYREPLI_API_KEY! });
 *   const transcript = await hr.youtube.transcript("dQw4w9WgXcQ");
 *
 * Get an API key at: https://app.heyrepli.com/dashboard/settings/account
 */

const DEFAULT_BASE_URL = "https://api.heyrepli.com";
const DEFAULT_TIMEOUT_MS = 30000;

export interface HeyRepliOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class HeyRepliError extends Error {
  constructor(public code: string, message: string, public status?: number, public details?: unknown) {
    super(message);
    this.name = "HeyRepliError";
  }
}

class McpClient {
  private opts: Required<Omit<HeyRepliOptions, "fetchImpl">>;
  private fetchFn: typeof fetch;

  constructor(opts: HeyRepliOptions) {
    this.opts = {
      apiKey: opts.apiKey,
      baseUrl: opts.baseUrl ?? DEFAULT_BASE_URL,
      timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };
    this.fetchFn = opts.fetchImpl ?? fetch;
  }

  async call<T = any>(tool: string, args: Record<string, any> = {}): Promise<T> {
    const url = `${this.opts.baseUrl}/api/v1/mcp`;
    const body = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: args } };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs);
    try {
      const res = await this.fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": this.opts.apiKey, "User-Agent": "heyrepli-js/0.1.0 (+https://heyrepli.com)" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new HeyRepliError(json.error?.code ?? "HTTP_ERROR", json.error?.message ?? `HTTP ${res.status}`, res.status, json.error?.data);
      }
      const inner = json.result?.content?.[0]?.text;
      if (inner) {
        try { return JSON.parse(inner) as T; } catch { return inner as unknown as T; }
      }
      return json.result as T;
    } finally { clearTimeout(timer); }
  }

  async rest<T = any>(endpoint: string, opts: { method?: string; params?: Record<string, any>; body?: any } = {}): Promise<T> {
    const url = new URL(`${this.opts.baseUrl}/api/v1/open/${endpoint}`);
    if (opts.params) {
      for (const [k, v] of Object.entries(opts.params)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs);
    try {
      const res = await this.fetchFn(url.toString(), {
        method: opts.method ?? "GET",
        headers: { "Content-Type": "application/json", "X-API-Key": this.opts.apiKey, "User-Agent": "heyrepli-js/0.1.0 (+https://heyrepli.com)" },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: ctrl.signal,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new HeyRepliError(json.error?.code ?? "HTTP_ERROR", json.error?.message ?? `HTTP ${res.status}`, res.status, json.error);
      }
      return json.data as T;
    } finally { clearTimeout(timer); }
  }
}


// ============ YouTube ============
export interface YouTubeTranscriptSegment { start: number; dur: number; text: string }
export interface YouTubeTranscript { videoId: string; language: string; segments: YouTubeTranscriptSegment[]; fullText: string; client?: string; attempts?: number }
export interface YouTubeVideoDetails { videoId: string; title: string; description: string; duration: string; viewCount: number; likeCount?: number; channelTitle?: string; publishedAt?: string }
export interface YouTubeSearchResult { items: Array<{ id: { videoId: string }; snippet: { title: string; description?: string; channelTitle?: string; publishedAt?: string } }> }

export class YouTubeResource {
  constructor(private mcp: McpClient) {}
  async transcript(videoIdOrUrl: string): Promise<YouTubeTranscript> {
    return this.mcp.call<YouTubeTranscript>("scrape_youtube_transcript", { videoId: this.normalizeId(videoIdOrUrl) });
  }
  async details(videoIdOrUrl: string): Promise<YouTubeVideoDetails> {
    return this.mcp.call<YouTubeVideoDetails>("scrape_youtube_video", { videoId: this.normalizeId(videoIdOrUrl) });
  }
  async search(query: string, maxResults = 10): Promise<YouTubeSearchResult> {
    return this.mcp.call<YouTubeSearchResult>("scrape_youtube_search", { query, maxResults });
  }
  private normalizeId(idOrUrl: string): string {
    if (/^[a-zA-Z0-9_-]{11}$/.test(idOrUrl)) return idOrUrl;
    const m = idOrUrl.match(/(?:v=|youtu.be\/|\/embed\/|\/v\/)([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    throw new HeyRepliError("INVALID_VIDEO_ID", `Cannot parse video id from: ${idOrUrl}`);
  }
}

// ============ TikTok ============
export interface TikTokVideoInsights {
  videoId?: string; url: string; caption?: string;
  author?: { username?: string; nickname?: string; followerCount?: number };
  viewCount?: number; likeCount?: number; commentCount?: number; shareCount?: number; createdAt?: string;
}

export class TikTokResource {
  constructor(private mcp: McpClient) {}
  async insights(urlOrId: string): Promise<TikTokVideoInsights> {
    return this.mcp.call<TikTokVideoInsights>("tiktok_video_insights", { url: urlOrId });
  }
}

// ============ Instagram ============
export interface InstagramPost {
  url: string; shortcode?: string; caption?: string;
  imageUrl?: string; images?: string[]; videoUrl?: string;
  likeCount?: number; commentCount?: number; timestamp?: string;
  owner?: { username?: string; fullName?: string };
}

export class InstagramResource {
  constructor(private mcp: McpClient) {}
  async post(url: string): Promise<InstagramPost> {
    return this.mcp.call<InstagramPost>("scrape_instagram_post", { url });
  }
}

// ============ Twitter / X ============
export interface Tweet {
  id: string; text: string; authorId?: string; authorUsername?: string; authorName?: string;
  createdAt?: string; metrics?: { likes?: number; retweets?: number; replies?: number; quotes?: number; views?: number };
}

export class TwitterResource {
  constructor(private mcp: McpClient) {}
  async tweet(tweetIdOrUrl: string): Promise<Tweet> {
    return this.mcp.call<Tweet>("scrape_twitter_tweet", { tweetId: this.normalizeId(tweetIdOrUrl) });
  }
  private normalizeId(idOrUrl: string): string {
    if (/^\d{1,20}$/.test(idOrUrl)) return idOrUrl;
    const m = idOrUrl.match(/\/status\/(\d+)/);
    if (m) return m[1];
    throw new HeyRepliError("INVALID_TWEET_ID", `Cannot parse tweet id from: ${idOrUrl}`);
  }
}


// ============ LinkedIn ============
export interface LinkedInPost {
  urn?: string; text?: string; publishedAt?: string;
  likeCount?: number; commentCount?: number; shareCount?: number; url?: string;
}
export interface LinkedInPostsResult { items: LinkedInPost[] }

export class LinkedInResource {
  constructor(private mcp: McpClient) {}
  async posts(username: string, maxPosts = 20): Promise<LinkedInPostsResult> {
    return this.mcp.call<LinkedInPostsResult>("scrape_linkedin_posts", { username, maxPosts });
  }
}

// ============ Facebook ============
export interface FacebookPost {
  id?: string; message?: string; createdAt?: string;
  likeCount?: number; commentCount?: number; shareCount?: number; url?: string;
}
export interface FacebookPostsResult { items: FacebookPost[] }

export class FacebookResource {
  constructor(private mcp: McpClient) {}
  async posts(pageId: string, maxPosts = 20): Promise<FacebookPostsResult> {
    return this.mcp.call<FacebookPostsResult>("scrape_facebook_posts", { pageId, maxPosts });
  }
}

// ============ AI rewrite ============
export type AIStyle = "professional" | "casual" | "funny" | "story" | "promo";
export type AIProvider = "auto" | "deepseek" | "kimi" | "grok";
export type AIPlatform = "twitter" | "linkedin" | "facebook" | "instagram" | "tiktok";

export interface AIRewriteArgs { text: string; style?: AIStyle; provider?: AIProvider; platform?: AIPlatform }
export interface AIRewriteResult { original: string; rewritten: string; style: AIStyle; provider: AIProvider; platform?: AIPlatform; usage?: { tokens?: number } }

export class AIResource {
  constructor(private mcp: McpClient) {}
  async rewrite(args: AIRewriteArgs): Promise<AIRewriteResult> {
    return this.mcp.call<AIRewriteResult>("ai_rewrite", { text: args.text, style: args.style ?? "casual", provider: args.provider ?? "auto", platform: args.platform });
  }
}

// ============ Usage / quota ============
export interface UsageInfo {
  user: { id: string; email: string; plan: string };
  quota: { used: number; limit: number; remaining: number };
}
export class UsageResource {
  constructor(private mcp: McpClient) {}
  async get(): Promise<UsageInfo> {
    return this.mcp.call<UsageInfo>("get_usage", {});
  }
}

// ============ Publish (3 platforms) ============
export interface PublishResult { id: string; url?: string; platform: string; status: "published" | "scheduled" | "failed"; error?: string }

export class PublishTwitter {
  constructor(private mcp: McpClient) {}
  async publish(text: string): Promise<PublishResult> {
    return this.mcp.call<PublishResult>("publish_twitter", { text });
  }
}
export class PublishLinkedIn {
  constructor(private mcp: McpClient) {}
  async publish(text: string): Promise<PublishResult> {
    return this.mcp.call<PublishResult>("publish_linkedin", { text });
  }
}
export class PublishFacebook {
  constructor(private mcp: McpClient) {}
  async publish(text: string): Promise<PublishResult> {
    return this.mcp.call<PublishResult>("publish_facebook", { text });
  }
}


// ============ Open REST helpers ============
export interface PostRecord { id: string; platform: string; content: string; status: string; scheduled_at?: number; published_at?: number; created_at: number }
export interface ReplyRecord { id: string; platform: string; comment_text: string; draft_text: string; status: string; created_at: number }
export interface MentionRecord { id: string; platform: string; author: string; text: string; sentiment?: string; created_at: number }
export interface AnalyticsResult { period: string; totals: { total_posts: number; total_replies: number; total_mentions: number }; rate_limits?: { plan: string; monthly_replies: number } }

export class OpenResource {
  constructor(private mcp: McpClient) {}
  async listPosts(opts: { platform?: string; status?: string; limit?: number } = {}): Promise<PostRecord[]> {
    return this.mcp.rest<PostRecord[]>("posts", { method: "GET", params: opts });
  }
  async createReply(args: { platform: string; comment_text: string; post_id?: string }): Promise<ReplyRecord> {
    return this.mcp.rest<ReplyRecord>("replies", { method: "POST", body: args });
  }
  async schedulePost(args: { platform: string; content: string; scheduled_at: string; link?: string }): Promise<PostRecord> {
    return this.mcp.rest<PostRecord[]>("schedule", { method: "POST", body: args }) as unknown as Promise<PostRecord>;
  }
  async listMentions(limit = 50): Promise<MentionRecord[]> {
    return this.mcp.rest<MentionRecord[]>("mentions", { method: "GET", params: { limit } });
  }
  async analytics(period: "7d" | "30d" | "90d" = "7d"): Promise<AnalyticsResult> {
    return this.mcp.rest<AnalyticsResult>("analytics", { method: "GET", params: { period } });
  }
}

// ============ Threads ============
export interface ThreadsProfile {
  id: string; username: string; name?: string; bio?: string;
  followerCount?: number; profilePicUrl?: string;
}
export interface ThreadsPost {
  id: string; text?: string; mediaType?: string;
  likeCount?: number; replyCount?: number; repostCount?: number;
  timestamp?: string; url?: string;
}
export interface ThreadsPostsResult { items: ThreadsPost[] }

export class ThreadsResource {
  constructor(private mcp: McpClient) {}
  private rest<T>(path: string, params: Record<string, any> = {}): Promise<T> {
    return this.mcp["rest"]<T>(path.replace(/^\/api\/v1\//, ""), { method: "GET", params });
  }
  async profile(username: string): Promise<ThreadsProfile> {
    return this.rest<ThreadsProfile>("/api/v1/threads/profile", { username });
  }
  async posts(username: string, maxPosts = 20): Promise<ThreadsPostsResult> {
    return this.rest<ThreadsPostsResult>("/api/v1/threads/posts", { username, max: maxPosts });
  }
  async post(postIdOrUrl: string): Promise<ThreadsPost> {
    return this.rest<ThreadsPost>("/api/v1/threads/post", { id: postIdOrUrl });
  }
}

// ============ Bluesky ============
export interface BlueskyProfile {
  did: string; handle: string; displayName?: string; description?: string;
  followerCount?: number; followCount?: number; avatar?: string;
}
export interface BlueskyPost {
  uri: string; cid?: string; text?: string; author?: { handle: string; displayName?: string };
  likeCount?: number; repostCount?: number; replyCount?: number;
  indexedAt?: string;
}
export interface BlueskyPostsResult { items: BlueskyPost[] }

export class BlueskyResource {
  constructor(private mcp: McpClient) {}
  private rest<T>(path: string, params: Record<string, any> = {}): Promise<T> {
    return this.mcp["rest"]<T>(path.replace(/^\/api\/v1\//, ""), { method: "GET", params });
  }
  async profile(handle: string): Promise<BlueskyProfile> {
    return this.rest<BlueskyProfile>("/api/v1/bluesky/profile", { handle });
  }
  async posts(handle: string, maxPosts = 20): Promise<BlueskyPostsResult> {
    return this.rest<BlueskyPostsResult>("/api/v1/bluesky/posts", { handle, max: maxPosts });
  }
  async post(uriOrUrl: string): Promise<BlueskyPost> {
    return this.rest<BlueskyPost>("/api/v1/bluesky/post", { uri: uriOrUrl });
  }
}

// ============ Mastodon ============
export interface MastodonProfile {
  id: string; username: string; acct?: string; displayName?: string; bio?: string;
  followerCount?: number; followingCount?: number; avatar?: string; instance?: string;
}
export interface MastodonPost {
  id: string; content?: string; url?: string;
  reblogCount?: number; favouriteCount?: number; replyCount?: number;
  createdAt?: string; language?: string;
}
export interface MastodonPostsResult { items: MastodonPost[] }

export class MastodonResource {
  constructor(private mcp: McpClient) {}
  private rest<T>(path: string, params: Record<string, any> = {}): Promise<T> {
    return this.mcp["rest"]<T>(path.replace(/^\/api\/v1\//, ""), { method: "GET", params });
  }
  async profile(identifier: string): Promise<MastodonProfile> {
    return this.rest<MastodonProfile>("/api/v1/mastodon/profile", { user: identifier });
  }
  async posts(identifier: string, maxPosts = 20): Promise<MastodonPostsResult> {
    return this.rest<MastodonPostsResult>("/api/v1/mastodon/posts", { user: identifier, max: maxPosts });
  }
}

// ============ Reddit (via /api/v1/listen) ============
export interface RedditMention {
  id: string; platform: string; author: string; text: string; url?: string;
  sentiment?: string; subreddit?: string; created_at: number;
}

export class RedditResource {
  constructor(private mcp: McpClient) {}
  /** Search Reddit for a keyword (uses Reddit public JSON API, no OAuth). */
  async searchMentions(keyword: string, limit = 25): Promise<RedditMention[]> {
    return this.mcp["rest"]<RedditMention[]>("mentions", { method: "GET", params: { platform: "reddit", keyword, limit } });
  }
  /** List your tracked Reddit brand mentions. */
  async mentions(limit = 50): Promise<RedditMention[]> {
    return this.mcp["rest"]<RedditMention[]>("mentions", { method: "GET", params: { platform: "reddit", limit } });
  }
}

/**
 * Main HeyRepli SDK client.
 *
 * @example
 * 
 */
// ============ Publish: 10 platforms (all platforms HeyRepli supports) ============
export class PublishPinterest {
  constructor(private mcp: McpClient) {}
  async publish(args: { title?: string; description?: string; link?: string; media_url?: string; board_id?: string }): Promise<PublishResult> {
    return this.mcp.call<PublishResult>("publish_pinterest", args as any);
  }
}
export class PublishBluesky {
  constructor(private mcp: McpClient) {}
  async publish(text: string): Promise<PublishResult> {
    return this.mcp.call<PublishResult>("publish_bluesky", { text });
  }
}
export class PublishMastodon {
  constructor(private mcp: McpClient) {}
  async publish(args: { text: string; instance?: string; visibility?: string }): Promise<PublishResult> {
    return this.mcp.call<PublishResult>("publish_mastodon", args as any);
  }
}
export class PublishInstagram {
  constructor(private mcp: McpClient) {}
  async publish(args: { caption: string; media_url: string }): Promise<PublishResult> {
    return this.mcp.call<PublishResult>("publish_instagram", args as any);
  }
}
export class PublishTikTok {
  constructor(private mcp: McpClient) {}
  async publish(args: { caption: string; video_url: string; privacy?: string }): Promise<PublishResult> {
    return this.mcp.call<PublishResult>("publish_tiktok", args as any);
  }
}
export class PublishYouTube {
  constructor(private mcp: McpClient) {}
  async publish(args: { title: string; description?: string; video_url: string; privacy?: string }): Promise<PublishResult> {
    return this.mcp.call<PublishResult>("publish_youtube", args as any);
  }
}
export class PublishThreads {
  constructor(private mcp: McpClient) {}
  async publish(text: string): Promise<PublishResult> {
    return this.mcp.call<PublishResult>("publish_threads", { text });
  }
}

export class HeyRepli {
  public youtube: YouTubeResource;
  public tiktok: TikTokResource;
  public instagram: InstagramResource;
  public twitter: TwitterResource;
  public linkedin: LinkedInResource;
  public facebook: FacebookResource;
  public threads: ThreadsResource;
  public bluesky: BlueskyResource;
  public mastodon: MastodonResource;
  public reddit: RedditResource;
  public ai: AIResource;
  public usage: UsageResource;
  public publishTwitter: PublishTwitter;
  public publishLinkedIn: PublishLinkedIn;
  public publishFacebook: PublishFacebook;
  public publishPinterest: PublishPinterest;
  public publishBluesky: PublishBluesky;
  public publishMastodon: PublishMastodon;
  public publishInstagram: PublishInstagram;
  public publishTikTok: PublishTikTok;
  public publishYouTube: PublishYouTube;
  public publishThreads: PublishThreads;
  public open: OpenResource;
  private mcp: McpClient;

  constructor(opts: HeyRepliOptions) {
    if (!opts.apiKey) {
      throw new HeyRepliError("MISSING_API_KEY", "apiKey is required. Get one at https://app.heyrepli.com/dashboard/settings/account");
    }
    this.mcp = new McpClient(opts);
    this.youtube = new YouTubeResource(this.mcp);
    this.tiktok = new TikTokResource(this.mcp);
    this.instagram = new InstagramResource(this.mcp);
    this.twitter = new TwitterResource(this.mcp);
    this.linkedin = new LinkedInResource(this.mcp);
    this.facebook = new FacebookResource(this.mcp);
    this.threads = new ThreadsResource(this.mcp);
    this.bluesky = new BlueskyResource(this.mcp);
    this.mastodon = new MastodonResource(this.mcp);
    this.reddit = new RedditResource(this.mcp);
    this.ai = new AIResource(this.mcp);
    this.usage = new UsageResource(this.mcp);
    this.publishTwitter = new PublishTwitter(this.mcp);
    this.publishLinkedIn = new PublishLinkedIn(this.mcp);
    this.publishFacebook = new PublishFacebook(this.mcp);
    this.publishPinterest = new PublishPinterest(this.mcp);
    this.publishBluesky = new PublishBluesky(this.mcp);
    this.publishMastodon = new PublishMastodon(this.mcp);
    this.publishInstagram = new PublishInstagram(this.mcp);
    this.publishTikTok = new PublishTikTok(this.mcp);
    this.publishYouTube = new PublishYouTube(this.mcp);
    this.publishThreads = new PublishThreads(this.mcp);
    this.open = new OpenResource(this.mcp);
  }

  /** List all MCP tools. Useful for discovery. */
  async listTools(): Promise<{ name: string; description: string }[]> {
    const url = `${this.mcp["opts"].baseUrl}/api/v1/mcp`;
    const res = await this.mcp["fetchFn"](url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": this.mcp["opts"].apiKey },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    const j = await res.json();
    return j.result?.tools ?? [];
  }
}

export default HeyRepli;
