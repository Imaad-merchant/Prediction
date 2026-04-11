import { NextResponse } from "next/server";
import type { TradesStore, Opportunity, AnalysisResult, CalibrationResult, Trade, OrderLevel } from "@/lib/types";
import {
  defaultTradesStore,
  calculatePortfolioStats,
  calculatePositionSize,
  calculateEdgeScore,
  shouldTakeTrade,
  simulateTradeEntry,
  checkSettlement,
  checkStopLoss,
  checkTakeProfit,
  checkTimeExit,
  estimateSlippage,
  passesSlippageGate,
  scoreSettlementArbitrage,
} from "@/lib/trading";

export const maxDuration = 60;

const CLOB_API = "https://clob.polymarket.com";

function getBaseUrl(req: Request): string {
  const url = new URL(req.url);
  return url.origin;
}

async function fetchAsks(tokenId: string): Promise<OrderLevel[]> {
  try {
    const res = await fetch(`${CLOB_API}/book?token_id=${tokenId}`, {
      signal: AbortSignal.timeout(3000),
    });
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

async function fetchCurrentPrice(tokenId: string): Promise<number | null> {
  try {
    const res = await fetch(`${CLOB_API}/price?token_id=${tokenId}&side=buy`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parseFloat(data.price) || null;
  } catch {
    return null;
  }
}

function detectCategory(question: string): string {
  const q = question.toLowerCase();
  if (/trump|biden|election|democrat|republican|congress|senate|governor|vote/.test(q)) return "politics";
  if (/bitcoin|btc|eth|solana|crypto|xrp|token|defi/.test(q)) return "crypto";
  if (/nba|nfl|mlb|nhl|soccer|football|tennis|golf|masters|pga|ufc/.test(q)) return "sports";
  if (/spy|nasdaq|stock|s&p|market|fed|rate|gdp|inflation|price of/.test(q)) return "finance";
  if (/weather|temperature|rain|snow/.test(q)) return "weather";
  if (/ai|openai|google|apple|meta|microsoft|tech/.test(q)) return "tech";
  return "other";
}

function createArbAnalysis(
  opp: Opportunity,
  arbScore: ReturnType<typeof scoreSettlementArbitrage>
): AnalysisResult {
  return {
    predictedProbability: opp.gammaProbability * 100,
    confidence: arbScore.confidence > 0.7 ? "High" : "Medium",
    recommendation: "BUY YES",
    edge: arbScore.netEdge,
    reasoning: {
      decomposition: [`Settlement arb: buy at ${(opp.realAskPrice * 100).toFixed(1)}c, redeem at $1`],
      baseRate: `Market at ${(opp.gammaProbability * 100).toFixed(0)}% with ${opp.hoursLeft.toFixed(1)}h left`,
      keyFactors: [
        { factor: `Net edge ${arbScore.netEdge.toFixed(1)}% after 2% fee`, direction: "for", weight: "high" },
        { factor: `${opp.hoursLeft.toFixed(1)} hours to resolution`, direction: "for", weight: "medium" },
      ],
      newsContext: "Settlement arbitrage — near-certain market",
      uncertainties: ["Market could resolve unexpectedly against majority"],
    },
    riskAssessment: {
      liquidityRisk: opp.liquidity > 10000 ? "Low" : "Medium",
      timingRisk: `${opp.hoursLeft.toFixed(1)}h to close`,
      marketEfficiency: "High probability priced in",
    },
    summary: `Settlement arb: ${arbScore.netEdge.toFixed(1)}% net edge, ${(arbScore.confidence * 100).toFixed(0)}% confidence`,
    positionSizing: {
      direction: "bullish",
      materiality: arbScore.confidence,
      suggestedSize: 10,
      maxBuyPrice: 0.99,
      kellyFraction: 0.25,
      dollarEdge: arbScore.netEdge / 100,
      profitPerShare: 1 - opp.realAskPrice,
    },
  };
}

export async function POST(req: Request) {
  const BASE_URL = getBaseUrl(req);

  try {
    // Accept store from client (localStorage) — no file I/O
    const body = await req.json();
    const store: TradesStore = body.store || defaultTradesStore();
    const config = store.config;
    const newTrades: Trade[] = [];
    const settledTrades: Trade[] = [];
    const stoppedTrades: Trade[] = [];
    let tradesAnalyzed = 0;

    // Step 1: Check stop-losses, take-profits, and time-exits in PARALLEL
    const openTrades = store.trades.filter((t) => t.status === "open");
    if (openTrades.length > 0) {
      const priceChecks = await Promise.allSettled(
        openTrades.map((t) => fetchCurrentPrice(t.tokenId))
      );
      for (let i = 0; i < openTrades.length; i++) {
        const result = priceChecks[i];
        const price = result.status === "fulfilled" ? result.value : null;
        if (price === null) continue;
        const idx = store.trades.findIndex((t) => t.id === openTrades[i].id);
        if (idx === -1) continue;

        let updated = store.trades[idx];
        // Check stop-loss
        updated = checkStopLoss(updated, price, config);
        // Check take-profit
        if (updated.status === "open") updated = checkTakeProfit(updated, price, config);
        // Check time-based exit
        if (updated.status === "open") updated = checkTimeExit(updated, price, config);

        if (updated.status !== "open") {
          store.trades[idx] = updated;
          stoppedTrades.push(updated);
        }
      }
    }

    // Step 2: Settle expired positions
    for (let i = 0; i < store.trades.length; i++) {
      if (store.trades[i].status === "open") {
        const updated = checkSettlement(store.trades[i], config.takerFeePercent);
        if (updated.status !== "open") {
          store.trades[i] = updated;
          settledTrades.push(updated);
        }
      }
    }

    // Step 3: Recalculate portfolio
    store.portfolio = calculatePortfolioStats(store.trades, config);
    const openPositionCount = store.trades.filter((t) => t.status === "open").length;

    // Step 4: Scan opportunities
    let opportunities: Opportunity[] = [];
    try {
      const oppRes = await fetch(`${BASE_URL}/api/opportunities`, {
        signal: AbortSignal.timeout(15000),
      });
      const oppJson = await oppRes.json();
      opportunities = oppJson.data || [];
    } catch (e) {
      console.error("Opportunities fetch failed:", e);
    }

    // Step 5: Score and categorize
    type ScoredOpp = Opportunity & {
      strategyType: "expiry_convergence" | "settlement_arbitrage";
      arbData?: ReturnType<typeof scoreSettlementArbitrage>;
    };

    const scoredOpps: ScoredOpp[] = [];

    for (const opp of opportunities) {
      if (store.trades.find((t) => t.marketId === opp.id && t.status === "open"))
        continue;

      if (config.strategy === "settlement_arbitrage" || config.strategy === "combined") {
        const arb = scoreSettlementArbitrage(
          opp.realAskPrice,
          opp.hoursLeft,
          config.takerFeePercent
        );
        if (arb.viable) {
          scoredOpps.push({
            ...opp,
            strategyType: "settlement_arbitrage",
            arbData: arb,
            edge: arb.netEdge,
          });
          continue;
        }
      }

      if (config.strategy === "expiry_convergence" || config.strategy === "combined") {
        if (opp.profitPerShare > 0.02) {
          scoredOpps.push({ ...opp, strategyType: "expiry_convergence" });
        }
      }
    }

    scoredOpps.sort((a, b) => {
      if (a.arbData && b.arbData) return b.arbData.confidence - a.arbData.confidence;
      if (a.arbData) return -1;
      if (b.arbData) return 1;
      return b.profitPerShare - a.profitPerShare;
    });

    // Step 6: Execute trades
    let tradesThisRun = 0;
    const maxTradesPerRun = 3;

    for (const opp of scoredOpps.slice(0, 5)) {
      if (tradesThisRun >= maxTradesPerRun) break;
      if (openPositionCount + tradesThisRun >= config.maxPositions) break;
      if (store.portfolio.cashBalance < 1) break;

      tradesAnalyzed++;

      try {
        let analysis: AnalysisResult;
        let edgeScore: number;

        if (opp.strategyType === "settlement_arbitrage" && opp.arbData) {
          // Settlement arb: synthetic analysis, no GPT call needed
          analysis = createArbAnalysis(opp, opp.arbData);
          const modelProb = analysis.predictedProbability / 100;
          const marketProb = opp.gammaProbability;
          const liqScore = Math.min(opp.liquidity / 10000, 1);
          edgeScore = calculateEdgeScore(modelProb, marketProb, liqScore);
        } else {
          // Expiry convergence: use calibration engine with evidence pipeline
          const calibrateRes = await fetch(`${BASE_URL}/api/calibrate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: opp.question,
              category: detectCategory(opp.question),
              marketPrice: opp.gammaProbability,
              volume: Math.round(opp.volume),
              liquidity: Math.round(opp.liquidity),
              endDate: opp.endDate,
            }),
            signal: AbortSignal.timeout(25000),
          });
          const calibrateJson = await calibrateRes.json();
          if (calibrateJson.error) continue;
          const cal: CalibrationResult = calibrateJson.data;

          // New edge formula: raw_edge * confidence_discount * liquidity_discount
          const calibratedEdge = cal.edge * cal.confidence_discount * cal.liquidity_discount;
          edgeScore = Math.round(calibratedEdge * 1000) / 1000;

          // Convert CalibrationResult → AnalysisResult for downstream compatibility
          const edgePp = cal.edge * 100; // convert to percentage points
          analysis = {
            predictedProbability: cal.calibrated_p * 100,
            confidence: cal.confidence_discount >= 0.7 ? "High" : cal.confidence_discount >= 0.5 ? "Medium" : "Low",
            recommendation: Math.abs(edgePp) > 10 && cal.confidence_discount >= 0.5
              ? (edgePp > 0 ? "BUY YES" : "BUY NO")
              : Math.abs(edgePp) > 5 ? "HOLD" : "AVOID",
            edge: Math.round(edgePp * 10) / 10,
            reasoning: {
              decomposition: [`Calibrated from ${cal.source_count} source(s)`],
              baseRate: `Sources ${cal.sources_agree ? "agree" : "disagree"} — confidence discount: ${cal.confidence_discount}`,
              keyFactors: [
                { factor: `Calibrated probability: ${(cal.calibrated_p * 100).toFixed(1)}%`, direction: cal.edge > 0 ? "for" : "against", weight: "high" },
                { factor: `Key risk: ${cal.key_risk}`, direction: "against", weight: "medium" },
                { factor: `Liquidity discount: ${cal.liquidity_discount.toFixed(2)}`, direction: cal.liquidity_discount > 0.5 ? "for" : "against", weight: "low" },
              ],
              newsContext: cal.reasoning,
              uncertainties: [cal.key_risk],
            },
            riskAssessment: {
              liquidityRisk: cal.liquidity_discount > 0.7 ? "Low" : cal.liquidity_discount > 0.4 ? "Medium" : "High",
              timingRisk: `${opp.hoursLeft.toFixed(1)}h to resolution`,
              marketEfficiency: cal.sources_agree ? "Sources corroborate market" : "Sources diverge from market",
            },
            summary: `${cal.reasoning} [Edge: ${(cal.edge * 100).toFixed(1)}pp × ${cal.confidence_discount} conf × ${cal.liquidity_discount.toFixed(2)} liq = ${(calibratedEdge * 100).toFixed(1)}pp net]`,
          };
        }

        const decision = shouldTakeTrade(
          analysis,
          config,
          store.portfolio,
          openPositionCount + tradesThisRun,
          edgeScore
        );
        if (!decision.take) continue;

        const betDollars = calculatePositionSize(
          store.portfolio.cashBalance,
          analysis.edge,
          config,
          store.portfolio.totalValue
        );

        const asks = await fetchAsks(opp.tokenId);
        const slippage = estimateSlippage(asks, betDollars);
        const slippageCheck = passesSlippageGate(slippage, config);
        if (!slippageCheck.pass) continue;

        const effectivePrice = slippage.vwap > 0 ? slippage.vwap : opp.realAskPrice;
        const shares = Math.floor(betDollars / effectivePrice);
        if (shares < 1) continue;

        const trade = simulateTradeEntry(
          { ...opp, realAskPrice: effectivePrice },
          analysis,
          shares,
          config,
          slippage.slippagePercent,
          opp.strategyType,
          edgeScore
        );
        store.trades.unshift(trade);
        newTrades.push(trade);
        tradesThisRun++;

        store.portfolio = calculatePortfolioStats(store.trades, config);
      } catch (e) {
        console.error(`Trade analysis failed for ${opp.question}:`, e);
      }
    }

    // Final state
    store.portfolio = calculatePortfolioStats(store.trades, config);
    store.config.lastRunAt = new Date().toISOString();

    return NextResponse.json({
      data: {
        store, // Return full store for client to persist
        newTrades,
        settledTrades,
        stoppedTrades,
        tradesAnalyzed,
        opportunitiesFound: opportunities.length,
        strategiesUsed: {
          settlementArbitrage: scoredOpps.filter(
            (o) => o.strategyType === "settlement_arbitrage"
          ).length,
          expiryConvergence: scoredOpps.filter(
            (o) => o.strategyType === "expiry_convergence"
          ).length,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto-trade failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
