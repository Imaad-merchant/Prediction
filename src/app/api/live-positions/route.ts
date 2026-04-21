import { NextResponse } from "next/server";
import { getLiveOpenOrders, getLiveTrades } from "@/lib/polymarket-clob";

export const maxDuration = 15;

/** Returns both open orders (unfilled) and recent trades (filled). */
export async function GET() {
  try {
    const [openOrdersRes, trades] = await Promise.allSettled([
      getLiveOpenOrders(),
      getLiveTrades(100),
    ]);

    return NextResponse.json({
      data: {
        openOrders:
          openOrdersRes.status === "fulfilled" ? openOrdersRes.value : { error: "failed" },
        trades: trades.status === "fulfilled" ? trades.value : [],
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Positions fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
