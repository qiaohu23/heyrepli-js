# HeyRepli JavaScript SDK

[![npm version](https://img.shields.io/npm/v/heyrepli.svg)](https://www.npmjs.com/package/heyrepli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

Official JavaScript/TypeScript SDK for the [HeyRepli](https://heyrepli.com) social media API. Scrape 6 platforms, AI rewrite content, publish to Twitter/LinkedIn/Facebook — all through one API key.

## Why HeyRepli?

- **6 scraping tools**: YouTube (transcript + metadata + search), TikTok, Instagram, Twitter/X, LinkedIn, Facebook
- **AI rewrite**: 5 styles x 3 LLM providers (DeepSeek V4 / Kimi K3 / Grok 4.6)
- **3 publish tools**: Twitter, LinkedIn, Facebook (OAuth via HeyRepli dashboard)
- **5 Open REST endpoints**: list/create posts, schedule, mentions, analytics
- **MCP server**: 13 tools, JSON-RPC 2.0 protocol
- **Free tier**: 50 AI replies + 5 rewrites + 10 scheduled posts/month

## Install

```bash
npm install heyrepli
```


## Quickstart (5 minutes)

```typescript
import { HeyRepli } from "heyrepli";

const hr = new HeyRepli({
  apiKey: process.env.HEYREPLI_API_KEY!,
});

// 1. Scrape a YouTube transcript (no API key required)
const transcript = await hr.youtube.transcript("dQw4w9WgXcQ");
console.log(transcript.fullText.slice(0, 100));

// 2. AI rewrite for a Twitter voice
const rewrite = await hr.ai.rewrite({
  text: "just shipped our SDK, would love feedback",
  style: "promo",
  platform: "twitter",
});

// 3. Check usage quota
const usage = await hr.usage.get();
console.log(`${usage.quota.used}/${usage.quota.limit} on plan ${usage.user.plan}`);
```

Get an API key: [https://app.heyrepli.com/dashboard/settings/account](https://app.heyrepli.com/dashboard/settings/account)


## 3 Real Examples

### Example 1: YouTube transcript -> AI rewrite for Twitter

```typescript
const transcript = await hr.youtube.transcript("dQw4w9WgXcQ");
const tweet = await hr.ai.rewrite({
  text: transcript.fullText.slice(0, 500),
  style: "funny",
  platform: "twitter",
});
console.log(tweet.rewritten);
```

### Example 2: TikTok/IG/Twitter content aggregation

```typescript
const [tiktok, ig, tweet] = await Promise.all([
  hr.tiktok.insights("https://www.tiktok.com/@user/video/123"),
  hr.instagram.post("https://www.instagram.com/p/abc"),
  hr.twitter.tweet("1234567890"),
]);
console.log({ tiktok, ig, tweet });
```

### Example 3: Schedule a post

```typescript
const scheduled = await hr.open.schedulePost({
  platform: "twitter",
  content: "Hello world!",
  scheduled_at: "2026-09-28T09:00:00Z",
});
console.log("scheduled:", scheduled);
```


## API Reference

### Resources

| Resource | Methods |
|---|---|
|  | , ,  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  | , , , ,  |

See [src/index.ts](src/index.ts) for full TypeScript types.

## Requirements

- Node.js >= 18 (uses global  + )
- An HeyRepli API key

## Configuration

```typescript
new HeyRepli({
  apiKey: "...",
  baseUrl: "...",
  timeoutMs: 30000,
  fetchImpl: customFetch,
});
```

## Error Handling

```typescript
import { HeyRepliError } from "heyrepli";

try {
  await hr.youtube.transcript("bad-id");
} catch (e) {
  if (e instanceof HeyRepliError) {
    console.error(`HeyRepli ${e.code}: ${e.message} (HTTP ${e.status})`);
  } else {
    throw e;
  }
}
```

## Testing

```bash
npm test
```

Uses the public demo key () by default. Override with  to test with your real key.

## Related Packages

- [heyrepli-examples](https://github.com/qiaohu23/heyrepli-examples) — n8n, Make, Python, OpenClaw examples

## License

MIT
