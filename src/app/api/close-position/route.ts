import { NextResponse } from "next/server";
import type { TradesStore } from "@/lib/types";
import { manualCloseTrade, calculatePortfolioStats } from "@/lib/trading";

export async function POST(req: Request) {
  try {
    const { store, tradeId, currentPrice } = await req.json();
    if (!store || !tradeId) {
      return NextResponse.json({ error: "Missing store or tradeId" }, { status: 400 });
    }

    const typedStore = store as TradesStore;
    const idx = typedStore.trades.findIndex((t) => t.id === tradeId);
    if (idx === -1) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    const price = currentPrice || typedStore.trades[idx].entryPrice;
    typedStore.trades[idx] = manualCloseTrade(
      typedStore.trades[idx],
      price,
      typedStore.config.takerFeePercent
    );
    typedStore.portfolio = calculatePortfolioStats(typedStore.trades, typedStore.config);

    return NextResponse.json({ data: { store: typedStore } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to close position";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
