import { NextResponse } from "next/server";
import type { TradesStore } from "@/lib/types";
import {
  calculatePortfolioStats,
  calculateSharpeRatio,
  calculateAvgHoldTime,
  getBestWorstTrade,
  getPnlByCategory,
  getConfusionMatrix,
} from "@/lib/trading";

export async function POST(req: Request) {
  try {
    const { store } = await req.json();
    if (!store) {
      return NextResponse.json({ error: "Missing store" }, { status: 400 });
    }

    const typedStore = store as TradesStore;
    const portfolio = calculatePortfolioStats(typedStore.trades, typedStore.config);
    const settled = typedStore.trades.filter((t) => t.status !== "open");
    const totalReturn = typedStore.config.bankroll > 0
      ? ((portfolio.totalValue - typedStore.config.bankroll) / typedStore.config.bankroll) * 100
      : 0;

    const { best, worst } = getBestWorstTrade(typedStore.trades);

    return NextResponse.json({
      data: {
        portfolio,
        realizedPnl: portfolio.realizedPnl,
        unrealizedPnl: portfolio.unrealizedPnl,
        winRate: portfolio.winRate,
        totalReturn: Math.round(totalReturn * 100) / 100,
        sharpeRatio: calculateSharpeRatio(typedStore.trades),
        avgHoldTimeHours: calculateAvgHoldTime(typedStore.trades),
        maxDrawdown: portfolio.maxDrawdown,
        bestTrade: best ? { question: best.question, pnl: best.pnl } : null,
        worstTrade: worst ? { question: worst.question, pnl: worst.pnl } : null,
        totalTrades: typedStore.trades.length,
        openPositions: typedStore.trades.filter((t) => t.status === "open").length,
        settledTrades: settled.length,
        pnlByCategory: getPnlByCategory(typedStore.trades),
        confusionMatrix: getConfusionMatrix(typedStore.trades),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compute PnL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
