import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { TradesStore } from "@/lib/types";
import { defaultTradesStore, calculatePortfolioStats } from "@/lib/trading";

const DATA_DIR = process.env.VERCEL
  ? join("/tmp", "data")
  : join(process.cwd(), "data");
const TRADES_FILE = join(DATA_DIR, "trades.json");

async function readStore(): Promise<TradesStore> {
  try {
    const data = await readFile(TRADES_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return defaultTradesStore();
  }
}

async function writeStore(store: TradesStore) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(TRADES_FILE, JSON.stringify(store, null, 2));
}

export async function GET() {
  const store = await readStore();
  // Recalculate portfolio stats on every read
  store.portfolio = calculatePortfolioStats(store.trades, store.config);
  return NextResponse.json({ data: store });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const store = await readStore();

    if (body.type === "config") {
      store.config = { ...store.config, ...body.config };
    } else if (body.type === "trade") {
      store.trades.unshift(body.trade);
    } else if (body.type === "update_trade") {
      const idx = store.trades.findIndex((t) => t.id === body.trade.id);
      if (idx !== -1) store.trades[idx] = body.trade;
    } else if (body.type === "reset") {
      const fresh = defaultTradesStore();
      fresh.config.bankroll = body.bankroll || 1000;
      fresh.config.maxBetSize = body.maxBetSize || 25;
      fresh.config.dailyLossLimit = body.dailyLossLimit || 100;
      await writeStore(fresh);
      return NextResponse.json({ data: fresh });
    }

    store.portfolio = calculatePortfolioStats(store.trades, store.config);
    await writeStore(store);
    return NextResponse.json({ data: store });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update trades";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
