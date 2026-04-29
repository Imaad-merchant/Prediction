import { NextResponse } from "next/server";
import { loadServerStore, saveServerStore, isBlobConfigured } from "@/lib/server-store";
import type { TradesStore } from "@/lib/types";

export const maxDuration = 15;

/** GET — load the server-side trade store. */
export async function GET() {
  if (!isBlobConfigured()) {
    return NextResponse.json({ data: null, configured: false });
  }
  try {
    const store = await loadServerStore();
    return NextResponse.json({ data: store, configured: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Load failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST — save the trade store. Body: { store: TradesStore }. */
export async function POST(req: Request) {
  if (!isBlobConfigured()) {
    return NextResponse.json(
      { error: "Vercel Blob not configured" },
      { status: 503 }
    );
  }
  try {
    const body = await req.json();
    const store: TradesStore = body.store;
    if (!store || !store.config || !store.portfolio) {
      return NextResponse.json({ error: "Invalid store payload" }, { status: 400 });
    }
    const result = await saveServerStore(store);
    return NextResponse.json({ data: { saved: !!result, url: result?.url } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
