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
import { placeLiveOrder } from "@/lib/polymarket-clob";
import { computeBtcSignal, isBtcShortTermMarket } from "@/lib/btc-signal";

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
    const rejections: Array<{ question: string; reason: string; edge?: number; edgeScore?: number }> = [];
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

    // Apply market filter (e.g. BTC hourly only)
    if (config.marketFilter === "btc_hourly") {
      opportunities = opportunities.filter((o) => isBtcShortTermMarket(o.question));
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

      // BTC short-term markets: always route through signal engine (never arb)
      if (isBtcShortTermMarket(opp.question)) {
        scoredOpps.push({ ...opp, strategyType: "expiry_convergence" });
        continue;
      }

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
        // Lower threshold: any market 60%-95% priced with reasonable time is a candidate
        if (opp.gammaProbability >= 0.55 && opp.gammaProbability <= 0.95 && opp.profitPerShare > 0.01) {
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

    // Step 6: Execute trades — analyze up to 8 opportunities to increase hit rate
    let tradesThisRun = 0;
    const maxTradesPerRun = 3;

    for (const opp of scoredOpps.slice(0, 8)) {
      if (tradesThisRun >= maxTradesPerRun) break;
      if (openPositionCount + tradesThisRun >= config.maxPositions) break;
      if (store.portfolio.cashBalance < 1) break;

      tradesAnalyzed++;

      try {
        let analysis: AnalysisResult;
        let edgeScore: number;

        if (opp.strategyType === "settlement_arbitrage" && opp.arbData) {
          // Settlement arb: synthetic analysis, edge score from arb net edge (not model vs market)
          analysis = createArbAnalysis(opp, opp.arbData);
          const liqScore = Math.min(opp.liquidity / 10000, 1);
          // Convert net edge % to 0-1 scale; floor at 0.05 if viable
          edgeScore = Math.max(0.05, (opp.arbData.netEdge / 100) * Math.max(liqScore, 0.3));
          edgeScore = Math.round(edgeScore * 1000) / 1000;
        } else if (isBtcShortTermMarket(opp.question)) {
          // === BTC SHORT-TERM: use quantitative signal engine (Binance klines + TA) ===
          // Parse horizon from market end date (typically 5-min or 1-hour window)
          const horizonMin = Math.max(1, Math.min(60, Math.round(opp.hoursLeft * 60)));
          let signal;
          try {
            signal = await computeBtcSignal(horizonMin);
          } catch (sigErr) {
            rejections.push({
              question: opp.question.slice(0, 80),
              reason: `BTC signal failed: ${sigErr instanceof Error ? sigErr.message : "unknown"}`,
            });
            continue;
          }

          const modelProbYes = signal.predictedUpProbability;
          const marketProbYes = opp.side === "YES" ? opp.gammaProbability : 1 - opp.gammaProbability;

          // Edge signed from BTC-UP perspective; convert to side of the opportunity
          const edgeYesPp = (modelProbYes - marketProbYes) * 100;
          const edgePp = opp.side === "YES" ? edgeYesPp : -edgeYesPp;

          const liqScore = Math.min(opp.liquidity / 5000, 1);
          const calibratedEdge = (edgePp / 100) * signal.confidence * liqScore;
          edgeScore = Math.round(Math.max(Math.abs(calibratedEdge), 0.01) * 1000) / 1000;

          // For BTC hourly: require moderate confidence AND edge ≥ 3pp to trade
          let recommendation: "BUY YES" | "BUY NO" | "HOLD" | "AVOID";
          if (Math.abs(edgePp) >= 3 && signal.confidence >= 0.35) {
            recommendation = edgePp > 0 ? "BUY YES" : "BUY NO";
          } else if (Math.abs(edgePp) >= 1.5) {
            recommendation = "HOLD";
          } else {
            recommendation = "AVOID";
          }

          analysis = {
            predictedProbability: (opp.side === "YES" ? modelProbYes : 1 - modelProbYes) * 100,
            confidence: signal.confidence >= 0.6 ? "High" : signal.confidence >= 0.35 ? "Medium" : "Low",
            recommendation,
            edge: Math.round(edgePp * 10) / 10,
            reasoning: {
              decomposition: [`BTC direction signal (${horizonMin}min horizon)`],
              baseRate: `Momentum: ${signal.momentum}, RSI ${signal.rsi14}, vol ${signal.volumeRatio}x`,
              keyFactors: [
                { factor: `Model p(UP) = ${(modelProbYes * 100).toFixed(1)}% vs market ${(marketProbYes * 100).toFixed(1)}%`, direction: edgePp > 0 ? "for" : "against", weight: "high" },
                { factor: `Signal confidence ${(signal.confidence * 100).toFixed(0)}%`, direction: signal.confidence > 0.5 ? "for" : "against", weight: "medium" },
                { factor: `BTC 5m change ${signal.priceChange5m >= 0 ? "+" : ""}${signal.priceChange5m}%`, direction: signal.priceChange5m > 0 ? "for" : "against", weight: "medium" },
              ],
              newsContext: signal.reasoning.join(" · "),
              uncertainties: ["Short-horizon BTC moves have low R²; market can reverse fast"],
            },
            riskAssessment: {
              liquidityRisk: opp.liquidity > 5000 ? "Low" : opp.liquidity > 1000 ? "Medium" : "High",
              timingRisk: `${horizonMin}min to resolution`,
              marketEfficiency: "BTC short-term is highly efficient; edge requires disciplined filter",
            },
            summary: `BTC ${signal.momentum} @ $${signal.currentPrice} | p(UP)=${(modelProbYes * 100).toFixed(1)}% vs mkt ${(marketProbYes * 100).toFixed(1)}% | edge ${edgePp.toFixed(1)}pp × conf ${signal.confidence.toFixed(2)} × liq ${liqScore.toFixed(2)} = ${(calibratedEdge * 100).toFixed(1)}pp net`,
          };
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

          // Edge formula: raw_edge * confidence_discount * liquidity_discount
          const rawEdgePp = cal.edge * 100; // percentage points
          const calibratedEdge = cal.edge * cal.confidence_discount * cal.liquidity_discount;

          // Structural convergence bonus: markets 60%+ have built-in convergence edge
          // (price tends to → 1 or 0 at settlement) even when GPT anchors to market price
          const hasConvergenceEdge = opp.gammaProbability >= 0.60 && opp.hoursLeft < 336;
          const structuralEdge = (1 - opp.realAskPrice) * 0.5; // half the distance to $1
          const effectiveEdgePp = Math.max(
            Math.abs(rawEdgePp),
            hasConvergenceEdge ? structuralEdge * 100 : 0
          );

          edgeScore = hasConvergenceEdge
            ? Math.max(Math.abs(calibratedEdge), structuralEdge * 0.4)
            : Math.abs(calibratedEdge);
          edgeScore = Math.round(Math.max(edgeScore, 0.02) * 1000) / 1000;

          // Recommendation: favor BUY in convergence zone OR when GPT shows edge
          let recommendation: "BUY YES" | "BUY NO" | "HOLD" | "AVOID";
          if (hasConvergenceEdge && opp.realAskPrice < 0.95) {
            recommendation = opp.side === "YES" ? "BUY YES" : "BUY NO";
          } else if (effectiveEdgePp >= 2 && cal.confidence_discount >= 0.4) {
            recommendation = rawEdgePp > 0 ? "BUY YES" : "BUY NO";
          } else if (effectiveEdgePp >= 1) {
            recommendation = "HOLD";
          } else {
            recommendation = "AVOID";
          }

          analysis = {
            predictedProbability: cal.calibrated_p * 100,
            confidence: cal.confidence_discount >= 0.7 ? "High" : cal.confidence_discount >= 0.5 ? "Medium" : "Low",
            recommendation,
            edge: Math.round(rawEdgePp * 10) / 10,
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
        if (!decision.take) {
          rejections.push({ question: opp.question.slice(0, 80), reason: decision.reason, edge: analysis.edge, edgeScore });
          continue;
        }

        const betDollars = calculatePositionSize(
          store.portfolio.cashBalance,
          analysis.edge,
          config,
          store.portfolio.totalValue
        );

        const asks = await fetchAsks(opp.tokenId);
        const slippage = estimateSlippage(asks, betDollars);
        const slippageCheck = passesSlippageGate(slippage, config);
        if (!slippageCheck.pass) {
          rejections.push({ question: opp.question.slice(0, 80), reason: slippageCheck.reason, edge: analysis.edge, edgeScore });
          continue;
        }

        const effectivePrice = slippage.vwap > 0 ? slippage.vwap : opp.realAskPrice;
        const shares = Math.floor(betDollars / effectivePrice);
        if (shares < 1) {
          rejections.push({ question: opp.question.slice(0, 80), reason: `Position size too small ($${betDollars.toFixed(2)} → 0 shares)`, edge: analysis.edge, edgeScore });
          continue;
        }

        // === LIVE MODE: place real order on Polymarket before recording trade ===
        if (config.mode === "live" && process.env.LIVE_ENABLED === "true") {
          const liveResult = await placeLiveOrder({
            tokenId: opp.tokenId,
            side: "BUY", // always BUY the token (YES or NO) — side in opp is which token to buy
            price: Math.min(effectivePrice * 1.01, 0.999), // pad 1% for fill probability
            size: shares,
          });
          if (!liveResult.success) {
            rejections.push({
              question: opp.question.slice(0, 80),
              reason: `Live order rejected: ${liveResult.errorMsg ?? "unknown"}`,
              edge: analysis.edge,
              edgeScore,
            });
            continue;
          }
          // Live order accepted — use its orderID for tracking
          console.log(`Live order placed: ${liveResult.orderID} for ${opp.question.slice(0, 40)}`);
        }

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
        rejections,
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
