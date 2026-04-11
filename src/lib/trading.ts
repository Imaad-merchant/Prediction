import type {
  Trade,
  TradingConfig,
  PortfolioState,
  TradesStore,
  Opportunity,
  AnalysisResult,
  SlippageEstimate,
  OrderLevel,
} from "./types";

// === Default Config (mirrors Polymarket_trader defaults) ===

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
      maxPositions: 5,
      capitalSplitPercent: 0.2,
      stopLossPercent: 15,
      slippageTolerancePercent: 5,
      takerFeePercent: 2,
      minConfidence: 0.5,
      minEdge: 3,
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

// === Slippage Estimation (from Polymarket_trader/utils/slippage.py) ===

export function estimateSlippage(
  asks: OrderLevel[],
  capitalUsd: number
): SlippageEstimate {
  if (!asks.length || capitalUsd <= 0) {
    return {
      vwap: 0,
      bestPrice: 0,
      slippagePercent: 100,
      fillRatio: 0,
      unfilledUsd: capitalUsd,
      liquidityOk: false,
    };
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

// === Position Sizing (quarter-Kelly + capital split cap) ===

export function calculatePositionSize(
  cashBalance: number,
  edge: number,
  config: TradingConfig
): number {
  // Capital split: never risk more than X% of balance per position
  const capitalSplitMax = cashBalance * config.capitalSplitPercent;

  // Quarter-Kelly
  const kellyFraction = 0.25;
  const kellySize = cashBalance * (Math.abs(edge) / 100) * kellyFraction;

  // Take the smallest of: Kelly, capital split, maxBetSize
  const size = Math.min(kellySize, capitalSplitMax, config.maxBetSize);
  return Math.max(Math.round(size * 100) / 100, 1);
}

// === Trade Decision (with configurable thresholds) ===

export function shouldTakeTrade(
  analysis: AnalysisResult,
  config: TradingConfig,
  portfolio: PortfolioState,
  openPositionCount: number
): { take: boolean; reason: string } {
  // Max positions check
  if (openPositionCount >= config.maxPositions) {
    return { take: false, reason: `Max positions reached (${config.maxPositions})` };
  }

  if (analysis.recommendation === "HOLD" || analysis.recommendation === "AVOID") {
    return { take: false, reason: `Recommendation is ${analysis.recommendation}` };
  }

  // Configurable minimum edge
  if (Math.abs(analysis.edge) < config.minEdge) {
    return { take: false, reason: `Edge too small (${analysis.edge.toFixed(1)}pp < ${config.minEdge}pp)` };
  }

  // Configurable confidence threshold
  const confidenceMap: Record<string, number> = { High: 1, Medium: 0.6, Low: 0.3 };
  const confScore = confidenceMap[analysis.confidence] ?? 0;
  if (confScore < config.minConfidence) {
    return { take: false, reason: `Confidence too low (${analysis.confidence})` };
  }

  // Daily loss limit
  if (portfolio.realizedPnl < 0 && Math.abs(portfolio.realizedPnl) >= config.dailyLossLimit) {
    return { take: false, reason: `Daily loss limit hit ($${Math.abs(portfolio.realizedPnl).toFixed(2)})` };
  }

  // Cash check with capital split
  const posSize = calculatePositionSize(portfolio.cashBalance, analysis.edge, config);
  if (posSize > portfolio.cashBalance) {
    return { take: false, reason: `Insufficient cash ($${portfolio.cashBalance.toFixed(2)})` };
  }

  return { take: true, reason: `Edge ${analysis.edge.toFixed(1)}pp, ${analysis.confidence} confidence` };
}

// === Slippage Gate (from Polymarket_trader pre-trade check) ===

export function passesSlippageGate(
  slippage: SlippageEstimate,
  config: TradingConfig
): { pass: boolean; reason: string } {
  if (slippage.slippagePercent > config.slippageTolerancePercent) {
    return {
      pass: false,
      reason: `Slippage ${slippage.slippagePercent.toFixed(1)}% > tolerance ${config.slippageTolerancePercent}%`,
    };
  }
  if (slippage.fillRatio < 0.8) {
    return {
      pass: false,
      reason: `Insufficient liquidity (fill ratio: ${(slippage.fillRatio * 100).toFixed(0)}%)`,
    };
  }
  return { pass: true, reason: "OK" };
}

// === Settlement Arbitrage Scoring (from Polymarket_trader/strategies/settlement_arbitrage) ===

export function scoreSettlementArbitrage(
  price: number,
  hoursLeft: number,
  takerFeePercent: number
): { grossEdge: number; netEdge: number; confidence: number; viable: boolean } {
  const grossEdge = (1 / price - 1) * 100; // e.g. buy at 0.985 → 1.52% gross
  const netEdge = grossEdge - takerFeePercent;

  // Confidence: weighted blend of price proximity, time, edge
  const priceProximity = Math.min((price - 0.95) / 0.05, 1); // higher = closer to $1
  const timeScore = hoursLeft < 4 ? 1 : hoursLeft < 12 ? 0.8 : hoursLeft < 24 ? 0.6 : 0.4;
  const edgeScore = Math.min(netEdge / 3, 1);
  const confidence = priceProximity * 0.4 + timeScore * 0.35 + edgeScore * 0.25;

  return {
    grossEdge: Math.round(grossEdge * 100) / 100,
    netEdge: Math.round(netEdge * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    viable: netEdge > 0 && price >= 0.90 && price <= 0.995,
  };
}

// === Trade Entry (with fees and stop-loss) ===

export function simulateTradeEntry(
  opp: Opportunity,
  analysis: AnalysisResult,
  shares: number,
  config: TradingConfig,
  slippagePercent: number,
  strategy: "expiry_convergence" | "settlement_arbitrage"
): Trade {
  const cost = opp.realAskPrice * shares;
  const entryFee = Math.round(cost * (config.takerFeePercent / 100) * 100) / 100;

  // Stop-loss price: entry price * (1 - stopLossPercent/100)
  const stopLossPrice =
    config.stopLossPercent > 0
      ? Math.round(opp.realAskPrice * (1 - config.stopLossPercent / 100) * 1000) / 1000
      : null;

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
  };
}

// === Stop-Loss Check (from Polymarket_trader main._check_stop_losses) ===

export function checkStopLoss(
  trade: Trade,
  currentPrice: number,
  config: TradingConfig
): Trade {
  if (trade.status !== "open" || !trade.stopLossPrice || config.stopLossPercent <= 0) {
    return trade;
  }

  if (currentPrice <= trade.stopLossPrice) {
    const cost = trade.entryPrice * trade.shares;
    const exitFee = Math.round(currentPrice * trade.shares * (config.takerFeePercent / 100) * 100) / 100;
    const proceeds = currentPrice * trade.shares - exitFee;
    const pnl = proceeds - cost - trade.entryFee;

    return {
      ...trade,
      exitPrice: currentPrice,
      exitFee,
      pnl: Math.round(pnl * 100) / 100,
      pnlPercent: Math.round((pnl / (cost + trade.entryFee)) * 10000) / 100,
      status: "stopped_out",
      settledAt: new Date().toISOString(),
    };
  }

  return trade;
}

// === Settlement (with fee accounting) ===

export function checkSettlement(trade: Trade, takerFeePercent: number): Trade {
  if (trade.status !== "open") return trade;

  const now = Date.now();
  const endTime = new Date(trade.endDate).getTime();
  if (now < endTime) return trade;

  // Simulate: high-probability side wins ~90% of the time
  const winProbability = trade.entryPrice;
  const won = Math.random() < winProbability;

  const cost = trade.entryPrice * trade.shares;

  if (won) {
    const exitPrice = 1.0;
    const exitFee = Math.round(exitPrice * trade.shares * (takerFeePercent / 100) * 100) / 100;
    const proceeds = exitPrice * trade.shares - exitFee;
    const pnl = proceeds - cost - trade.entryFee;
    return {
      ...trade,
      exitPrice,
      exitFee,
      pnl: Math.round(pnl * 100) / 100,
      pnlPercent: Math.round((pnl / (cost + trade.entryFee)) * 10000) / 100,
      status: "settled_win",
      settledAt: new Date().toISOString(),
    };
  } else {
    const exitPrice = 0;
    const pnl = -(cost + trade.entryFee);
    return {
      ...trade,
      exitPrice,
      exitFee: 0,
      pnl: Math.round(pnl * 100) / 100,
      pnlPercent: -100,
      status: "settled_loss",
      settledAt: new Date().toISOString(),
    };
  }
}

// === Portfolio Stats (with total fees tracking) ===

export function calculatePortfolioStats(
  trades: Trade[],
  config: TradingConfig
): PortfolioState {
  let realizedPnl = 0;
  let unrealizedPnl = 0;
  let winningTrades = 0;
  let losingTrades = 0;

  const equityCurve: Array<{ timestamp: string; value: number }> = [
    { timestamp: new Date(Date.now() - 86400000).toISOString(), value: config.bankroll },
  ];

  const sorted = [...trades].sort(
    (a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime()
  );

  for (const trade of sorted) {
    if (trade.status === "open") {
      unrealizedPnl += 0;
    } else if (trade.status === "settled_win") {
      realizedPnl += trade.pnl ?? 0;
      winningTrades++;
      if (trade.settledAt) {
        equityCurve.push({
          timestamp: trade.settledAt,
          value: config.bankroll + realizedPnl,
        });
      }
    } else if (trade.status === "settled_loss" || trade.status === "stopped_out") {
      realizedPnl += trade.pnl ?? 0;
      losingTrades++;
      if (trade.settledAt) {
        equityCurve.push({
          timestamp: trade.settledAt,
          value: config.bankroll + realizedPnl,
        });
      }
    }
  }

  const openCost = trades
    .filter((t) => t.status === "open")
    .reduce((sum, t) => sum + t.entryPrice * t.shares + t.entryFee, 0);
  const cashBalance = config.bankroll + realizedPnl - openCost;

  const totalValue = cashBalance + openCost + unrealizedPnl;
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
    unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    totalTrades: trades.length,
    winningTrades,
    losingTrades,
    winRate,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    equityCurve,
  };
}
