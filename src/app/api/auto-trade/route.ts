import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { TradesStore, Opportunity, AnalysisResult, Trade } from "@/lib/types";
import {
  defaultTradesStore,
  calculatePortfolioStats,
  calculatePositionSize,
  shouldTakeTrade,
  simulateTradeEntry,
  checkSettlement,
} from "@/lib/trading";

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

function getBaseUrl(req: Request): string {
  // Use the request's origin so it works on localhost AND Vercel
  const url = new URL(req.url);
  return url.origin;
}

export async function POST(req: Request) {
  const BASE_URL = getBaseUrl(req);
  try {
    const store = await readStore();
    const newTrades: Trade[] = [];
    const settledTrades: Trade[] = [];
    let tradesAnalyzed = 0;

    // Step 1: Check/settle existing open positions
    for (let i = 0; i < store.trades.length; i++) {
      if (store.trades[i].status === "open") {
        const updated = checkSettlement(store.trades[i]);
        if (updated.status !== "open") {
          store.trades[i] = updated;
          settledTrades.push(updated);
        }
      }
    }

    // Step 2: Recalculate portfolio after settlements
    store.portfolio = calculatePortfolioStats(store.trades, store.config);

    // Step 3: Scan for new opportunities
    let opportunities: Opportunity[] = [];
    try {
      const oppRes = await fetch(`${BASE_URL}/api/opportunities`);
      const oppJson = await oppRes.json();
      opportunities = (oppJson.data || []).slice(0, 5);
    } catch {
      // Opportunities fetch failed
    }

    // Step 4: Analyze top candidates and decide
    let tradesThisRun = 0;
    const maxTradesPerRun = 3;

    for (const opp of opportunities) {
      if (tradesThisRun >= maxTradesPerRun) break;
      if (store.portfolio.cashBalance < 1) break;

      // Skip if we already have a position in this market
      const existingPos = store.trades.find(
        (t) => t.marketId === opp.id && t.status === "open"
      );
      if (existingPos) continue;

      tradesAnalyzed++;

      try {
        // Run Superforecaster analysis
        const analyzeRes = await fetch(`${BASE_URL}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: opp.question,
            currentYesPrice: Math.round(opp.gammaProbability * 100),
            currentNoPrice: Math.round((1 - opp.gammaProbability) * 100),
            volume: Math.round(opp.volume),
            liquidity: Math.round(opp.liquidity),
            endDate: opp.endDate,
          }),
        });
        const analyzeJson = await analyzeRes.json();
        if (analyzeJson.error) continue;

        const analysis: AnalysisResult = analyzeJson.data;

        // Check if we should take this trade
        const decision = shouldTakeTrade(analysis, store.config, store.portfolio);
        if (!decision.take) continue;

        // Calculate position size
        const betDollars = calculatePositionSize(
          store.portfolio.cashBalance,
          analysis.edge,
          store.config.maxBetSize
        );
        const shares = Math.floor(betDollars / opp.realAskPrice);
        if (shares < 1) continue;

        // Create trade
        const trade = simulateTradeEntry(opp, analysis, shares);
        store.trades.unshift(trade);
        newTrades.push(trade);
        tradesThisRun++;

        // Update portfolio
        store.portfolio = calculatePortfolioStats(store.trades, store.config);
      } catch {
        // Analysis failed for this opportunity, skip
      }
    }

    // Final portfolio recalculation
    store.portfolio = calculatePortfolioStats(store.trades, store.config);
    store.config.lastRunAt = new Date().toISOString();
    await writeStore(store);

    return NextResponse.json({
      data: {
        newTrades,
        settledTrades,
        portfolio: store.portfolio,
        tradesAnalyzed,
        opportunitiesFound: opportunities.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto-trade failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
