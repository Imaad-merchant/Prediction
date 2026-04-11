import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { TradesStore, Opportunity, AnalysisResult, Trade, OrderLevel } from "@/lib/types";
import {
  defaultTradesStore,
  calculatePortfolioStats,
  calculatePositionSize,
  shouldTakeTrade,
  simulateTradeEntry,
  checkSettlement,
  checkStopLoss,
  estimateSlippage,
  passesSlippageGate,
  scoreSettlementArbitrage,
} from "@/lib/trading";

const DATA_DIR = process.env.VERCEL
  ? join("/tmp", "data")
  : join(process.cwd(), "data");
const TRADES_FILE = join(DATA_DIR, "trades.json");

const CLOB_API = "https://clob.polymarket.com";

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
  const url = new URL(req.url);
  return url.origin;
}

// Fetch orderbook asks for slippage estimation
async function fetchAsks(tokenId: string): Promise<OrderLevel[]> {
  try {
    const res = await fetch(`${CLOB_API}/book?token_id=${tokenId}`);
    if (!res.ok) return [];
    const book = await res.json();
    return (book.asks || [])
      .map((a: Record<string, string>) => ({
        price: parseFloat(a.price),
        size: parseFloat(a.size),
      }))
      .sort((a: OrderLevel, b: OrderLevel) => a.price - b.price);
  } catch {
    return [];
  }
}

// Fetch current price for stop-loss checks
async function fetchCurrentPrice(tokenId: string): Promise<number | null> {
  try {
    const res = await fetch(`${CLOB_API}/price?token_id=${tokenId}&side=buy`);
    if (!res.ok) return null;
    const data = await res.json();
    return parseFloat(data.price) || null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const BASE_URL = getBaseUrl(req);

  try {
    const store = await readStore();
    const config = store.config;
    const newTrades: Trade[] = [];
    const settledTrades: Trade[] = [];
    const stoppedTrades: Trade[] = [];
    let tradesAnalyzed = 0;

    // Step 1: Check stop-losses on open positions
    if (config.stopLossPercent > 0) {
      for (let i = 0; i < store.trades.length; i++) {
        if (store.trades[i].status !== "open") continue;
        const currentPrice = await fetchCurrentPrice(store.trades[i].tokenId);
        if (currentPrice !== null) {
          const updated = checkStopLoss(store.trades[i], currentPrice, config);
          if (updated.status === "stopped_out") {
            store.trades[i] = updated;
            stoppedTrades.push(updated);
          }
        }
      }
    }

    // Step 2: Check/settle expired positions (with fee accounting)
    for (let i = 0; i < store.trades.length; i++) {
      if (store.trades[i].status === "open") {
        const updated = checkSettlement(store.trades[i], config.takerFeePercent);
        if (updated.status !== "open") {
          store.trades[i] = updated;
          settledTrades.push(updated);
        }
      }
    }

    // Step 3: Recalculate portfolio after settlements + stop-losses
    store.portfolio = calculatePortfolioStats(store.trades, config);

    // Count open positions
    const openPositionCount = store.trades.filter((t) => t.status === "open").length;

    // Step 4: Scan for new opportunities
    let opportunities: Opportunity[] = [];
    try {
      const oppRes = await fetch(`${BASE_URL}/api/opportunities`);
      const oppJson = await oppRes.json();
      opportunities = oppJson.data || [];
    } catch {
      // Opportunities fetch failed
    }

    // Step 5: Score and filter by strategy
    type ScoredOpp = Opportunity & {
      strategyType: "expiry_convergence" | "settlement_arbitrage";
      arbScore?: number;
    };

    const scoredOpps: ScoredOpp[] = [];

    for (const opp of opportunities) {
      // Skip if already have a position
      if (store.trades.find((t) => t.marketId === opp.id && t.status === "open")) continue;

      if (config.strategy === "settlement_arbitrage" || config.strategy === "combined") {
        // Settlement arbitrage: high-price tokens near resolution
        const arb = scoreSettlementArbitrage(
          opp.realAskPrice,
          opp.hoursLeft,
          config.takerFeePercent
        );
        if (arb.viable) {
          scoredOpps.push({
            ...opp,
            strategyType: "settlement_arbitrage",
            arbScore: arb.confidence,
            edge: arb.netEdge,
          });
        }
      }

      if (config.strategy === "expiry_convergence" || config.strategy === "combined") {
        // Expiry convergence: existing strategy (lower price, higher edge)
        if (opp.realAskPrice < 0.95 && opp.profitPerShare > 0.02) {
          scoredOpps.push({
            ...opp,
            strategyType: "expiry_convergence",
          });
        }
      }
    }

    // Sort: settlement arb by confidence, expiry by profit
    scoredOpps.sort((a, b) => {
      if (a.strategyType === "settlement_arbitrage" && b.strategyType === "settlement_arbitrage") {
        return (b.arbScore ?? 0) - (a.arbScore ?? 0);
      }
      return b.profitPerShare - a.profitPerShare;
    });

    // Step 6: Analyze and execute top candidates
    let tradesThisRun = 0;
    const maxTradesPerRun = 3;

    for (const opp of scoredOpps.slice(0, 8)) {
      if (tradesThisRun >= maxTradesPerRun) break;
      if (openPositionCount + tradesThisRun >= config.maxPositions) break;
      if (store.portfolio.cashBalance < 1) break;

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

        // Should we take this trade?
        const decision = shouldTakeTrade(
          analysis,
          config,
          store.portfolio,
          openPositionCount + tradesThisRun
        );
        if (!decision.take) continue;

        // Position sizing
        const betDollars = calculatePositionSize(
          store.portfolio.cashBalance,
          analysis.edge,
          config
        );

        // Slippage gate: fetch orderbook and estimate fill quality
        const asks = await fetchAsks(opp.tokenId);
        const slippage = estimateSlippage(asks, betDollars);
        const slippageCheck = passesSlippageGate(slippage, config);
        if (!slippageCheck.pass) continue;

        // Use VWAP as effective entry price if available
        const effectivePrice = slippage.vwap > 0 ? slippage.vwap : opp.realAskPrice;
        const shares = Math.floor(betDollars / effectivePrice);
        if (shares < 1) continue;

        // Create trade with fees and stop-loss
        const trade = simulateTradeEntry(
          { ...opp, realAskPrice: effectivePrice },
          analysis,
          shares,
          config,
          slippage.slippagePercent,
          opp.strategyType ?? "expiry_convergence"
        );
        store.trades.unshift(trade);
        newTrades.push(trade);
        tradesThisRun++;

        // Update portfolio
        store.portfolio = calculatePortfolioStats(store.trades, config);
      } catch {
        // Analysis failed for this opportunity
      }
    }

    // Final portfolio recalculation
    store.portfolio = calculatePortfolioStats(store.trades, config);
    store.config.lastRunAt = new Date().toISOString();
    await writeStore(store);

    return NextResponse.json({
      data: {
        newTrades,
        settledTrades,
        stoppedTrades,
        portfolio: store.portfolio,
        tradesAnalyzed,
        opportunitiesFound: opportunities.length,
        strategiesUsed: {
          settlementArbitrage: scoredOpps.filter((o) => o.strategyType === "settlement_arbitrage").length,
          expiryConvergence: scoredOpps.filter((o) => o.strategyType === "expiry_convergence").length,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto-trade failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
