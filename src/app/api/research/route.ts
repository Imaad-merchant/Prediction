import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { question } = await req.json();
    if (!question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    // Extract core keywords from the market question for search
    const stopwords = new Set(["will", "the", "be", "by", "on", "in", "a", "an", "to", "of", "is", "at", "for", "and", "or", "not", "this", "that", "it", "as", "with", "from", "has", "have", "was", "were", "been", "being", "do", "does", "did", "can", "could", "would", "should", "may", "might"]);
    const keywords = question
      .replace(/[?!.,]/g, "")
      .split(/\s+/)
      .filter((w: string) => w.length > 2 && !stopwords.has(w.toLowerCase()))
      .slice(0, 8)
      .join(" ");

    // Use multiple search approaches
    const results: Array<{ title: string; url: string; source: string; snippet: string; publishedAt?: string }> = [];

    // Search via Google News RSS (free, no API key)
    try {
      const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(keywords)}&hl=en-US&gl=US&ceid=US:en`;
      const rssRes = await fetch(googleNewsUrl, { signal: AbortSignal.timeout(5000) });
      if (rssRes.ok) {
        const rssText = await rssRes.text();
        // Parse RSS XML manually (simple extraction)
        const items = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];
        for (const item of items.slice(0, 8)) {
          const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "";
          const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || "";
          const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || "";
          const source = item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "Google News";

          if (title && link) {
            results.push({
              title,
              url: link,
              source,
              snippet: title,
              publishedAt: pubDate || undefined,
            });
          }
        }
      }
    } catch {
      // Google News failed, continue
    }

    // Search Reddit (free public JSON API, from last30days pattern)
    try {
      const redditUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(keywords)}&sort=relevance&t=week&limit=5`;
      const redditRes = await fetch(redditUrl, {
        headers: { "User-Agent": "PolyPredict/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (redditRes.ok) {
        const redditData = await redditRes.json();
        const posts = redditData?.data?.children || [];
        for (const post of posts) {
          const d = post.data;
          if (d?.title) {
            results.push({
              title: d.title,
              url: `https://reddit.com${d.permalink}`,
              source: `r/${d.subreddit}`,
              snippet: (d.selftext || d.title).slice(0, 200),
              publishedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : undefined,
            });
          }
        }
      }
    } catch {
      // Reddit failed, continue
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Research failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
