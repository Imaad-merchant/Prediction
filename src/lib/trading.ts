import type {
  Trade,
  TradingConfig,
  PortfolioState,
  TradesStore,
  Opportunity,
  AnalysisResult,
  SlippageEstimate,
  OrderLevel,
  ExitReason,
} from "./types";

// === Default Config ===

export function defaultTradesStore(): TradesStore {
  return {
    config: {
      bankroll: 1000,
      maxBetSize: 25,
      dailyLossLimit: 100,
      mode: "paper",
      isRunning: false,
      lastRunAt: null,
      strategy: "combined",
      maxPositions: 10,
      capitalSplitPercent: 0.2,
      stopLossPercent: 40,
      slippageTolerancePercent: 5,
      takerFeePercent: 2,
      minConfidence: 0.5,
      minEdge: 2,
      maxPositionPercent: 5,
      takeProfitPercent: 80,
      portfolioStopPercent: 15,
      timeExitHours: 24,
      minAskSize: 500,
      marketFilter: "all",
    },
    portfolio: {
      totalValue: 1000,
      cashBalance: 1000,
      unrealizedPnl: 0,
      realizedPnl: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      maxDrawdown: 0,
      equityCurve: [],
    },
    trades: [],
  };
}

// === Edge Score Calculation ===

export function calculateEdgeScore(
  modelProbability: number,
  marketImpliedProbability: number,
  liquidityScore: number
): number {
  return Math.round((modelProbability - marketImpliedProbability) * liquidityScore * 1000) / 1000;
}

// === Slippage Estimation ===

export function estimateSlippage(
  asks: OrderLevel[],
  capitalUsd: number
): SlippageEstimate {
  if (!asks.length || capitalUsd <= 0) {
    return { vwap: 0, bestPrice: 0, slippagePercent: 100, fillRatio: 0, unfilledUsd: capitalUsd, liquidityOk: false };
  }

  const sorted = [...asks].sort((a, b) => a.price - b.price);
  const bestPrice = sorted[0].price;

  let filled = 0;
  let totalCost = 0;
  let remaining = capitalUsd;

  for (const level of sorted) {
    const levelValue = level.price * level.size;
    if (levelValue >= remaining) {
      const sharesToFill = remaining / level.price;
      totalCost += sharesToFill * level.price;
      filled += sharesToFill;
      remaining = 0;
      break;
    } else {
      totalCost += levelValue;
      filled += level.size;
      remaining -= levelValue;
    }
  }

  const vwap = filled > 0 ? totalCost / filled : bestPrice;
  const slippagePercent = bestPrice > 0 ? ((vwap - bestPrice) / bestPrice) * 100 : 0;
  const fillRatio = capitalUsd > 0 ? (capitalUsd - remaining) / capitalUsd : 0;

  return {
    vwap,
    bestPrice,
    slippagePercent: Math.round(slippagePercent * 100) / 100,
    fillRatio: Math.round(fillRatio * 100) / 100,
    unfilledUsd: Math.round(remaining * 100) / 100,
    liquidityOk: fillRatio >= 0.95 && slippagePercent < 5,
  };
}

// === Position Sizing (quarter-Kelly + 5% hard cap) ===

export function calculatePositionSize(
  cashBalance: number,
  edge: number,
  config: TradingConfig,
  portfolioValue: number
): number {
  const capitalSplitMax = cashBalance * config.capitalSplitPercent;
  const hardCap = portfolioValue * (config.maxPositionPercent / 100);
  const kellyFraction = 0.25;
  const kellySize = cashBalance * (Math.abs(edge) / 100) * kellyFraction;
  const size = Math.min(kellySize, capitalSplitMax, config.maxBetSize, hardCap);
  return Math.max(Math.round(size * 100) / 100, 1);
}

// === Trade Decision ===

export function shouldTakeTrade(
  analysis: AnalysisResult,
  config: TradingConfig,
  portfolio: PortfolioState,
  openPositionCount: number,
  edgeScore: number
): { take: boolean; reason: string } {
  if (openPositionCount >= config.maxPositions) {
    return { take: false, reason: `Max positions reached (${config.maxPositions})` };
  }

  // Portfolio-level stop: pause if unrealized PnL < -X%
  const unrealizedPnlPercent = portfolio.totalValue > 0
    ? ((portfolio.totalValue - config.bankroll) / config.bankroll) * 100
    : 0;
  if (unrealizedPnlPercent < -config.portfolioStopPercent) {
    return { take: false, reason: `Portfolio stop: ${unrealizedPnlPercent.toFixed(1)}% < -${config.portfolioStopPercent}%` };
  }

  if (analysis.recommendation === "HOLD" || analysis.recommendation === "AVOID") {
    return { take: false, reason: `Recommendation is ${analysis.recommendation}` };
  }

  // Skip minEdge check if edgeScore already signals structural convergence (>=0.05)
  // This allows high-probability settlement/expiry plays that GPT anchors to market price
  if (Math.abs(analysis.edge) < config.minEdge && edgeScore < 0.05) {
    return { take: false, reason: `Edge too small (${analysis.edge.toFixed(1)}pp < ${config.minEdge}pp, score ${edgeScore.toFixed(3)})` };
  }

  // Edge score threshold: 0.01 (calibrated edge already discounted by confidence + liquidity)
  if (edgeScore < 0.01) {
    return { take: false, reason: `Edge score too low (${edgeScore.toFixed(3)} < 0.01)` };
  }

  const confidenceMap: Record<string, number> = { High: 1, Medium: 0.6, Low: 0.3 };
  const confScore = confidenceMap[analysis.confidence] ?? 0;
  if (confScore < config.minConfidence) {
    return { take: false, reason: `Confidence too low (${analysis.confidence})` };
  }

  if (portfolio.realizedPnl < 0 && Math.abs(portfolio.realizedPnl) >= config.dailyLossLimit) {
    return { take: false, reason: `Daily loss limit hit` };
  }

  return { take: true, reason: `Edge ${analysis.edge.toFixed(1)}pp, ${analysis.confidence} confidence, score ${edgeScore.toFixed(3)}` };
}

// === Slippage Gate ===

export function passesSlippageGate(
  slippage: SlippageEstimate,
  config: TradingConfig
): { pass: boolean; reason: string } {
  if (slippage.slippagePercent > config.slippageTolerancePercent) {
    return { pass: false, reason: `Slippage ${slippage.slippagePercent.toFixed(1)}% > tolerance ${config.slippageTolerancePercent}%` };
  }
  if (slippage.fillRatio < 0.8) {
    return { pass: false, reason: `Insufficient liquidity (fill ratio: ${(slippage.fillRatio * 100).toFixed(0)}%)` };
  }
  return { pass: true, reason: "OK" };
}

// === Settlement Arbitrage Scoring ===

export function scoreSettlementArbitrage(
  price: number,
  hoursLeft: number,
  takerFeePercent: number
): { grossEdge: number; netEdge: number; confidence: number; viable: boolean } {
  const grossEdge = (1 / price - 1) * 100;
  const netEdge = grossEdge - takerFeePercent;
  const priceProximity = Math.min((price - 0.80) / 0.20, 1);
  const timeScore = hoursLeft < 4 ? 1 : hoursLeft < 12 ? 0.8 : hoursLeft < 24 ? 0.6 : hoursLeft < 72 ? 0.5 : 0.35;
  const edgeScore = Math.min(netEdge / 3, 1);
  const confidence = priceProximity * 0.4 + timeScore * 0.35 + edgeScore * 0.25;

  return {
    grossEdge: Math.round(grossEdge * 100) / 100,
    netEdge: Math.round(netEdge * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    // Viable at 0.85+ with any positive net edge (0.85 is ~17.6% gross, ~15.6% net)
    viable: netEdge > 0 && price >= 0.85 && price <= 0.98,
  };
}

// === Trade Entry ===

export function simulateTradeEntry(
  opp: Opportunity,
  analysis: AnalysisResult,
  shares: number,
  config: TradingConfig,
  slippagePercent: number,
  strategy: "expiry_convergence" | "settlement_arbitrage",
  edgeScore: number
): Trade {
  const cost = opp.realAskPrice * shares;
  const entryFee = Math.round(cost * (config.takerFeePercent / 100) * 100) / 100;

  const stopLossPrice = config.stopLossPercent > 0
    ? Math.round(opp.realAskPrice * (1 - config.stopLossPercent / 100) * 1000) / 1000
    : null;

  const takeProfitPrice = config.takeProfitPercent > 0
    ? Math.round(opp.realAskPrice * (1 + config.takeProfitPercent / 100) * 1000) / 1000
    : null;

  // Detect category from question keywords
  const q = opp.question.toLowerCase();
  let category = "other";
  if (/trump|biden|election|democrat|republican|congress|senate|governor|vote/.test(q)) category = "politics";
  else if (/bitcoin|btc|eth|solana|crypto|xrp|token|defi/.test(q)) category = "crypto";
  else if (/nba|nfl|mlb|nhl|soccer|football|tennis|golf|masters|pga|ufc/.test(q)) category = "sports";
  else if (/spy|nasdaq|stock|s&p|market|fed|rate|gdp|inflation|price of/.test(q)) category = "finance";
  else if (/weather|temperature|rain|snow/.test(q)) category = "weather";
  else if (/ai|openai|google|apple|meta|microsoft|tech/.test(q)) category = "tech";

  return {
    id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    marketId: opp.id,
    question: opp.question,
    side: opp.side,
    shares,
    entryPrice: opp.realAskPrice,
    exitPrice: null,
    pnl: null,
    pnlPercent: null,
    status: "open",
    confidence: analysis.confidence,
    edge: analysis.edge,
    strategyScore: analysis.reasoning.strategyConsensus?.totalScore ?? null,
    tokenId: opp.tokenId,
    endDate: opp.endDate,
    enteredAt: new Date().toISOString(),
    settledAt: null,
    strategy,
    entryFee,
    exitFee: null,
    slippageEstimate: slippagePercent,
    stopLossPrice,
    edgeScore,
    reasoning: analysis.summary || "",
    exitReason: null,
    takeProfitPrice,
    category,
    modelProbability: analysis.predictedProbability / 100,
  };
}

// === Exit Helpers ===

function closeTrade(
  trade: Trade,
  exitPrice: number,
  exitReason: ExitReason,
  takerFeePercent: number
): Trade {
  const cost = trade.entryPrice * trade.shares;
  const exitFee = Math.round(exitPrice * trade.shares * (takerFeePercent / 100) * 100) / 100;
  const proceeds = exitPrice * trade.shares - exitFee;
  const pnl = proceeds - cost - trade.entryFee;
  const won = pnl >= 0;

  return {
    ...trade,
    exitPrice,
    exitFee,
    pnl: Math.round(pnl * 100) / 100,
    pnlPercent: Math.round((pnl / (cost + trade.entryFee)) * 10000) / 100,
    status: won ? "settled_win" : (exitReason === "stop_loss" ? "stopped_out" : "settled_loss"),
    settledAt: new Date().toISOString(),
    exitReason,
  };
}

// === Stop-Loss Check ===

export function checkStopLoss(trade: Trade, currentPrice: number, config: TradingConfig): Trade {
  if (trade.status !== "open" || !trade.stopLossPrice || config.stopLossPercent <= 0) return trade;
  if (currentPrice <= trade.stopLossPrice) {
    return closeTrade(trade, currentPrice, "stop_loss", config.takerFeePercent);
  }
  return trade;
}

// === Take-Profit Check ===

export function checkTakeProfit(trade: Trade, currentPrice: number, config: TradingConfig): Trade {
  if (trade.status !== "open" || !trade.takeProfitPrice || config.takeProfitPercent <= 0) return trade;
  if (currentPrice >= trade.takeProfitPrice) {
    // Don't take profit if market resolves within timeExitHours (let it settle)
    const hoursLeft = (new Date(trade.endDate).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursLeft < config.timeExitHours) return trade; // let time-exit handle it
    return closeTrade(trade, currentPrice, "take_profit", config.takerFeePercent);
  }
  return trade;
}

// === Time-Based Exit ===

export function checkTimeExit(trade: Trade, currentPrice: number, config: TradingConfig): Trade {
  if (trade.status !== "open") return trade;
  const hoursLeft = (new Date(trade.endDate).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursLeft < config.timeExitHours && currentPrice > 0.85) {
    return closeTrade(trade, currentPrice, "time_exit", config.takerFeePercent);
  }
  return trade;
}

// === Manual Close ===

export function manualCloseTrade(trade: Trade, currentPrice: number, takerFeePercent: number): Trade {
  if (trade.status !== "open") return trade;
  return closeTrade(trade, currentPrice, "manual", takerFeePercent);
}

// === Settlement ===

export function checkSettlement(trade: Trade, takerFeePercent: number): Trade {
  if (trade.status !== "open") return trade;
  const now = Date.now();
  const endTime = new Date(trade.endDate).getTime();
  if (now < endTime) return trade;

  const winProbability = trade.entryPrice;
  const won = Math.random() < winProbability;

  if (won) {
    return closeTrade(trade, 1.0, "settlement", takerFeePercent);
  } else {
    const cost = trade.entryPrice * trade.shares;
    const pnl = -(cost + trade.entryFee);
    return {
      ...trade,
      exitPrice: 0,
      exitFee: 0,
      pnl: Math.round(pnl * 100) / 100,
      pnlPercent: -100,
      status: "settled_loss",
      settledAt: new Date().toISOString(),
      exitReason: "settlement",
    };
  }
}

// === Portfolio Stats ===

export function calculatePortfolioStats(trades: Trade[], config: TradingConfig): PortfolioState {
  let realizedPnl = 0;
  let winningTrades = 0;
  let losingTrades = 0;

  const equityCurve: Array<{ timestamp: string; value: number }> = [
    { timestamp: new Date(Date.now() - 86400000).toISOString(), value: config.bankroll },
  ];

  const sorted = [...trades].sort(
    (a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime()
  );

  for (const trade of sorted) {
    if (trade.status === "settled_win") {
      realizedPnl += trade.pnl ?? 0;
      winningTrades++;
      if (trade.settledAt) equityCurve.push({ timestamp: trade.settledAt, value: config.bankroll + realizedPnl });
    } else if (trade.status === "settled_loss" || trade.status === "stopped_out") {
      realizedPnl += trade.pnl ?? 0;
      losingTrades++;
      if (trade.settledAt) equityCurve.push({ timestamp: trade.settledAt, value: config.bankroll + realizedPnl });
    }
  }

  const openCost = trades
    .filter((t) => t.status === "open")
    .reduce((sum, t) => sum + t.entryPrice * t.shares + t.entryFee, 0);
  const cashBalance = config.bankroll + realizedPnl - openCost;
  const totalValue = cashBalance + openCost;
  const totalSettled = winningTrades + losingTrades;
  const winRate = totalSettled > 0 ? Math.round((winningTrades / totalSettled) * 1000) / 10 : 0;

  let peak = config.bankroll;
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    if (point.value > peak) peak = point.value;
    const dd = ((peak - point.value) / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  equityCurve.push({ timestamp: new Date().toISOString(), value: totalValue });

  return {
    totalValue: Math.round(totalValue * 100) / 100,
    cashBalance: Math.round(cashBalance * 100) / 100,
    unrealizedPnl: 0,
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    totalTrades: trades.length,
    winningTrades,
    losingTrades,
    winRate,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    equityCurve,
  };
}

// === Analytics Helpers ===

export function calculateSharpeRatio(trades: Trade[]): number {
  const settled = trades.filter((t) => t.pnl !== null);
  if (settled.length < 2) return 0;
  const returns = settled.map((t) => t.pnlPercent ?? 0);
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return Math.round((mean / std) * Math.sqrt(252) * 100) / 100; // annualized
}

export function calculateAvgHoldTime(trades: Trade[]): number {
  const settled = trades.filter((t) => t.settledAt && t.enteredAt);
  if (settled.length === 0) return 0;
  const totalHours = settled.reduce((sum, t) => {
    const hold = (new Date(t.settledAt!).getTime() - new Date(t.enteredAt).getTime()) / (1000 * 60 * 60);
    return sum + hold;
  }, 0);
  return Math.round((totalHours / settled.length) * 10) / 10;
}

export function getBestWorstTrade(trades: Trade[]): { best: Trade | null; worst: Trade | null } {
  const settled = trades.filter((t) => t.pnl !== null);
  if (settled.length === 0) return { best: null, worst: null };
  const best = settled.reduce((a, b) => ((a.pnl ?? 0) > (b.pnl ?? 0) ? a : b));
  const worst = settled.reduce((a, b) => ((a.pnl ?? 0) < (b.pnl ?? 0) ? a : b));
  return { best, worst };
}

export function getPnlByCategory(trades: Trade[]): Record<string, { pnl: number; count: number; winRate: number }> {
  const cats: Record<string, { pnl: number; wins: number; total: number }> = {};
  for (const t of trades.filter((t) => t.pnl !== null)) {
    const cat = t.category || "other";
    if (!cats[cat]) cats[cat] = { pnl: 0, wins: 0, total: 0 };
    cats[cat].pnl += t.pnl ?? 0;
    cats[cat].total++;
    if ((t.pnl ?? 0) > 0) cats[cat].wins++;
  }
  const result: Record<string, { pnl: number; count: number; winRate: number }> = {};
  for (const [cat, data] of Object.entries(cats)) {
    result[cat] = {
      pnl: Math.round(data.pnl * 100) / 100,
      count: data.total,
      winRate: data.total > 0 ? Math.round((data.wins / data.total) * 1000) / 10 : 0,
    };
  }
  return result;
}

export function getConfusionMatrix(trades: Trade[]): {
  truePositive: number; falsePositive: number; trueNegative: number; falseNegative: number;
  byConfidence: Record<string, { tp: number; fp: number; tn: number; fn: number }>;
} {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  const byConf: Record<string, { tp: number; fp: number; tn: number; fn: number }> = {
    High: { tp: 0, fp: 0, tn: 0, fn: 0 },
    Medium: { tp: 0, fp: 0, tn: 0, fn: 0 },
    Low: { tp: 0, fp: 0, tn: 0, fn: 0 },
  };

  for (const t of trades.filter((t) => t.status !== "open")) {
    const predictedYes = t.modelProbability > 0.5;
    const actualYes = t.status === "settled_win";
    const conf = t.confidence || "Medium";
    if (!byConf[conf]) byConf[conf] = { tp: 0, fp: 0, tn: 0, fn: 0 };

    if (predictedYes && actualYes) { tp++; byConf[conf].tp++; }
    else if (predictedYes && !actualYes) { fp++; byConf[conf].fp++; }
    else if (!predictedYes && !actualYes) { tn++; byConf[conf].tn++; }
    else { fn++; byConf[conf].fn++; }
  }

  return { truePositive: tp, falsePositive: fp, trueNegative: tn, falseNegative: fn, byConfidence: byConf };
}

export function tradesToCSV(trades: Trade[]): string {
  const headers = [
    "id", "question", "side", "shares", "entryPrice", "exitPrice", "pnl", "pnlPercent",
    "status", "confidence", "edge", "edgeScore", "strategy", "category",
    "entryFee", "exitFee", "exitReason", "reasoning",
    "enteredAt", "settledAt", "endDate", "modelProbability",
  ];
  const rows = trades.map((t) =>
    headers.map((h) => {
      const val = t[h as keyof Trade];
      if (val === null || val === undefined) return "";
      const str = String(val);
      return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}
