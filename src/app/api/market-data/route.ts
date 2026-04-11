import { NextResponse } from "next/server";
import { fetchOrderBook, fetchPriceHistory } from "@/lib/polymarket";

export async function POST(req: Request) {
  try {
    const { tokenId } = await req.json();
    if (!tokenId) {
      return NextResponse.json({ error: "tokenId is required" }, { status: 400 });
    }

    const [orderbookRaw, priceHistoryRaw] = await Promise.all([
      fetchOrderBook(tokenId),
      fetchPriceHistory(tokenId, 60),
    ]);

    const bids = (orderbookRaw.bids || []).map((b: Record<string, string>) => ({
      price: parseFloat(b.price),
      size: parseFloat(b.size),
    }));

    const asks = (orderbookRaw.asks || []).map((a: Record<string, string>) => ({
      price: parseFloat(a.price),
      size: parseFloat(a.size),
    }));

    const bestBid = bids.length > 0 ? Math.max(...bids.map((b: { price: number }) => b.price)) : 0;
    const bestAsk = asks.length > 0 ? Math.min(...asks.map((a: { price: number }) => a.price)) : 1;
    const spread = bestAsk - bestBid;
    const midPrice = (bestAsk + bestBid) / 2;

    const totalBidLiquidity = bids.reduce(
      (sum: number, b: { price: number; size: number }) => sum + b.price * b.size,
      0
    );
    const totalAskLiquidity = asks.reduce(
      (sum: number, a: { price: number; size: number }) => sum + a.price * a.size,
      0
    );
    const totalLiquidity = totalBidLiquidity + totalAskLiquidity;

    let liquidityScore: "High" | "Medium" | "Low";
    if (totalLiquidity >= 50_000) liquidityScore = "High";
    else if (totalLiquidity >= 10_000) liquidityScore = "Medium";
    else liquidityScore = "Low";

    let spreadScore: "Tight" | "Normal" | "Wide";
    if (spread <= 0.02) spreadScore = "Tight";
    else if (spread <= 0.05) spreadScore = "Normal";
    else spreadScore = "Wide";

    const priceHistory = (priceHistoryRaw?.history || []).map(
      (p: Record<string, number>) => ({
        t: p.t,
        p: p.p,
      })
    );

    return NextResponse.json({
      data: {
        orderbook: { bids, asks, spread, midPrice, totalBidLiquidity, totalAskLiquidity },
        priceHistory,
        metrics: { liquidityScore, spreadScore, totalLiquidity, spread },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch market data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
