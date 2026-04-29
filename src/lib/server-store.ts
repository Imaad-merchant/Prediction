/**
 * Server-side persistent store for the auto-trader's state.
 *
 * Uses Vercel Blob (object storage). The state lives at a single key per user
 * (we use a default 'default' user since this is a single-user dashboard).
 * This lets the Vercel Cron job read/write the trade store independently of
 * the user's browser.
 *
 * Setup: In Vercel Dashboard → Storage → Create Blob Store → it auto-provisions
 * BLOB_READ_WRITE_TOKEN env var. Without that token, falls back to no-op
 * (browser-only mode still works).
 */

import { put, head } from "@vercel/blob";
import type { TradesStore } from "./types";
import { defaultTradesStore } from "./trading";

const STORE_KEY = "polypredict/store-default.json";

export function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/** Load the trade store from Blob. Returns default if not yet written. */
export async function loadServerStore(): Promise<TradesStore> {
  if (!isBlobConfigured()) {
    return defaultTradesStore();
  }
  try {
    const meta = await head(STORE_KEY).catch(() => null);
    if (!meta) return defaultTradesStore();
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) return defaultTradesStore();
    const data = (await res.json()) as TradesStore;
    return data;
  } catch {
    return defaultTradesStore();
  }
}

/** Persist the trade store to Blob. */
export async function saveServerStore(store: TradesStore): Promise<{ url: string } | null> {
  if (!isBlobConfigured()) return null;
  try {
    const result = await put(STORE_KEY, JSON.stringify(store), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { url: result.url };
  } catch (err) {
    console.error("saveServerStore failed:", err);
    return null;
  }
}
