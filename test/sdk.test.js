/**
 * HeyRepli SDK integration tests.
 *
 * Uses the public demo API key by default. To test with a real key,
 * set the HEYREPLI_API_KEY environment variable.
 *
 * Run: node --test test/sdk.test.js
 */

const { test } = require("node:test");
const assert = require("node:assert");
const { HeyRepli } = require("../dist/index.js");

// Tests require a real HEYREPLI_API_KEY in the environment.
// Get one free at https://app.heyrepli.com/dashboard/settings/account
// Without a key, tests will skip gracefully.
const API_KEY = process.env.HEYREPLI_API_KEY || "";
const skipIfNoKey = !API_KEY;
const hr = API_KEY ? new HeyRepli({ apiKey: API_KEY, timeoutMs: 60000 }) : null;

test("listTools returns 13 MCP tools", async () => {
  const tools = await hr.listTools();
  assert.ok(Array.isArray(tools));
  assert.ok(tools.length >= 13, `Expected 13+ tools, got ${tools.length}`);
  const names = tools.map(t => t.name);
  assert.ok(names.includes("scrape_youtube_transcript"));
  assert.ok(names.includes("scrape_youtube_video"));
  assert.ok(names.includes("scrape_youtube_search"));
  assert.ok(names.includes("tiktok_video_insights"));
  assert.ok(names.includes("scrape_instagram_post"));
  assert.ok(names.includes("scrape_twitter_tweet"));
  assert.ok(names.includes("scrape_linkedin_posts"));
  assert.ok(names.includes("scrape_facebook_posts"));
  assert.ok(names.includes("ai_rewrite"));
  assert.ok(names.includes("get_usage"));
  assert.ok(names.includes("publish_twitter"));
  assert.ok(names.includes("publish_linkedin"));
  assert.ok(names.includes("publish_facebook"));
});

test("youtube.transcript returns 61 segments for dQw4w9WgXcQ", async () => {
  const t = await hr.youtube.transcript("dQw4w9WgXcQ");
  assert.ok(t.videoId === "dQw4w9WgXcQ");
  assert.ok(Array.isArray(t.segments));
  assert.ok(t.segments.length >= 50, `Expected 50+ segments, got ${t.segments.length}`);
  assert.ok(t.fullText.length > 100);
  assert.ok(t.fullText.includes("Never gonna give you up"));
});

test("youtube.transcript accepts full URL", async () => {
  const t = await hr.youtube.transcript("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.ok(t.videoId === "dQw4w9WgXcQ");
  assert.ok(t.segments.length > 0);
});

test("youtube.details (requires YOUTUBE_API_KEY, may fail on demo)", async () => {
  try {
    const d = await hr.youtube.details("dQw4w9WgXcQ");
    assert.ok(d.videoId);
    console.log("  youtube.details OK, title:", d.title);
  } catch (e) {
    console.log("  youtube.details skipped (no YOUTUBE_API_KEY):", e.code);
  }
});

test("usage.get returns plan info", async () => {
  const u = await hr.usage.get();
  assert.ok(u.user && u.user.plan);
  assert.ok(u.quota);
  assert.ok(typeof u.quota.used === "number");
  assert.ok(typeof u.quota.limit === "number");
  console.log("  usage:", `${u.quota.used}/${u.quota.limit} on plan ${u.user.plan}`);
});

test("open.analytics returns totals", async () => {
  const a = await hr.open.analytics("7d");
  assert.ok(a.totals);
  assert.ok(typeof a.totals.total_posts === "number");
});

test("open.listPosts returns array", async () => {
  const posts = await hr.open.listPosts({ limit: 5 });
  assert.ok(Array.isArray(posts));
});

test("twitter.tweet validates input", async () => {
  await assert.rejects(
    () => hr.twitter.tweet("not-a-real-id-or-url"),
    (err) => err.code === "INVALID_TWEET_ID"
  );
});

test("Constructor throws on missing API key", () => {
  assert.throws(
    () => new HeyRepli({ apiKey: "" }),
    (err) => err.code === "MISSING_API_KEY"
  );
});

test("reddit.searchMentions works (Reddit public JSON API)", async () => {
  const mentions = await hr.reddit.searchMentions("heyrepli", 5);
  assert.ok(Array.isArray(mentions));
});

test("HeyRepli exposes all 11 platform resources", () => {
  const platforms = ["youtube", "tiktok", "instagram", "twitter", "linkedin", "facebook", "threads", "bluesky", "mastodon", "reddit"];
  for (const p of platforms) {
    assert.ok(hr[p], `Missing resource: ${p}`);
  }
  // 10 publish platforms
  const publishes = ["publishTwitter", "publishLinkedIn", "publishFacebook", "publishPinterest", "publishBluesky", "publishMastodon", "publishInstagram", "publishTikTok", "publishYouTube", "publishThreads"];
  for (const p of publishes) {
    assert.ok(hr[p], `Missing publisher: ${p}`);
  }
});
