import { NextResponse } from "next/server";
import { loadServerStore, saveServerStore, isBlobConfigured } from "@/lib/server-store";

export const maxDuration = 60;

/**
 * Vercel Cron entry point. Runs the auto-trade pipeline using server-side state.
 *
 * Schedule (configured in vercel.json):
 *   - Hobby plan: once per day max (Vercel limit)
 *   - Pro plan: every 5 minutes (recommended)
 *
 * For sub-5-minute runs you'd need Vercel Queues or an external scheduler
 * pinging this endpoint.
 *
 * Authentication: Vercel automatically signs cron requests with a header.
 * For public security, also requires CRON_SECRET env var.
 */
export async function GET(req: Request) {
  // Verify request comes from Vercel Cron
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured. Set it in Vercel env vars to enable cron." },
      { status: 503 }
    );
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isBlobConfigured()) {
    return NextResponse.json(
      {
        error:
          "Vercel Blob not configured. Create a Blob store in Vercel Dashboard → Storage to enable autonomous trading.",
      },
      { status: 503 }
    );
  }

  try {
    const store = await loadServerStore();

    // Hit the existing auto-trade endpoint with our server-side store
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const res = await fetch(`${baseUrl}/api/auto-trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store }),
    });
    const json = await res.json();

    if (json.error) {
      return NextResponse.json({ error: json.error }, { status: 500 });
    }

    // Persist updated store
    if (json.data?.store) {
      await saveServerStore(json.data.store);
    }

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      newTrades: json.data?.newTrades?.length ?? 0,
      settledTrades: json.data?.settledTrades?.length ?? 0,
      stoppedTrades: json.data?.stoppedTrades?.length ?? 0,
      tradesAnalyzed: json.data?.tradesAnalyzed ?? 0,
      opportunitiesFound: json.data?.opportunitiesFound ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Cron run failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
