import type { Trade, TradingConfig, PortfolioState, TradesStore, Opportunity, AnalysisResult } from "./types";

export function defaultTradesStore(): TradesStore {
  return {
    config: {
      bankroll: 1000,
      maxBetSize: 25,
      dailyLossLimit: 100,
      mode: "paper",
      isRunning: false,
      lastRunAt: null,
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

export function calculatePositionSize(
  cashBalance: number,
  edge: number,
  maxBetSize: number
): number {
  const kellyFraction = 0.25;
  const raw = cashBalance * (Math.abs(edge) / 100) * kellyFraction;
  return Math.min(Math.max(Math.round(raw * 100) / 100, 1), maxBetSize);
}

export function shouldTakeTrade(
  analysis: AnalysisResult,
  config: TradingConfig,
  portfolio: PortfolioState
): { take: boolean; reason: string } {
  if (analysis.recommendation === "HOLD" || analysis.recommendation === "AVOID") {
    return { take: false, reason: `Recommendation is ${analysis.recommendation}` };
  }
  if (Math.abs(analysis.edge) < 5) {
    return { take: false, reason: `Edge too small (${analysis.edge.toFixed(1)}pp)` };
  }
  if (analysis.confidence === "Low") {
    return { take: false, reason: "Low confidence" };
  }

  // Check daily loss limit
  const today = new Date().toISOString().split("T")[0];
  const todayLosses = portfolio.realizedPnl < 0 ? Math.abs(portfolio.realizedPnl) : 0;
  if (todayLosses >= config.dailyLossLimit) {
    return { take: false, reason: `Daily loss limit hit ($${todayLosses.toFixed(2)})` };
  }

  // Check cash
  const posSize = calculatePositionSize(portfolio.cashBalance, analysis.edge, config.maxBetSize);
  if (posSize > portfolio.cashBalance) {
    return { take: false, reason: `Insufficient cash ($${portfolio.cashBalance.toFixed(2)})` };
  }

  return { take: true, reason: `Edge ${analysis.edge.toFixed(1)}pp, ${analysis.confidence} confidence` };
}

export function simulateTradeEntry(
  opp: Opportunity,
  analysis: AnalysisResult,
  shares: number
): Trade {
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
  };
}

export function checkSettlement(trade: Trade): Trade {
  if (trade.status !== "open") return trade;

  const now = Date.now();
  const endTime = new Date(trade.endDate).getTime();

  // Not yet expired
  if (now < endTime) return trade;

  // Simulate settlement: high-probability side wins ~90% of the time
  // For paper trading, we use entryPrice as proxy for probability
  const winProbability = trade.entryPrice;
  const won = Math.random() < winProbability;

  if (won) {
    const exitPrice = 1.0;
    const pnl = (exitPrice - trade.entryPrice) * trade.shares;
    return {
      ...trade,
      exitPrice,
      pnl: Math.round(pnl * 100) / 100,
      pnlPercent: Math.round(((exitPrice - trade.entryPrice) / trade.entryPrice) * 10000) / 100,
      status: "settled_win",
      settledAt: new Date().toISOString(),
    };
  } else {
    const exitPrice = 0;
    const pnl = -trade.entryPrice * trade.shares;
    return {
      ...trade,
      exitPrice,
      pnl: Math.round(pnl * 100) / 100,
      pnlPercent: -100,
      status: "settled_loss",
      settledAt: new Date().toISOString(),
    };
  }
}

export function calculatePortfolioStats(
  trades: Trade[],
  config: TradingConfig
): PortfolioState {
  let cashBalance = config.bankroll;
  let realizedPnl = 0;
  let unrealizedPnl = 0;
  let winningTrades = 0;
  let losingTrades = 0;

  const equityCurve: Array<{ timestamp: string; value: number }> = [
    { timestamp: new Date(Date.now() - 86400000).toISOString(), value: config.bankroll },
  ];

  // Sort trades by entry time
  const sorted = [...trades].sort(
    (a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime()
  );

  for (const trade of sorted) {
    const cost = trade.entryPrice * trade.shares;

    if (trade.status === "open") {
      cashBalance -= cost;
      // Estimate current value at entry price (no live price update in paper mode)
      unrealizedPnl += 0; // flat until settlement
    } else if (trade.status === "settled_win") {
      const profit = trade.pnl ?? 0;
      realizedPnl += profit;
      winningTrades++;
      if (trade.settledAt) {
        equityCurve.push({
          timestamp: trade.settledAt,
          value: config.bankroll + realizedPnl,
        });
      }
    } else if (trade.status === "settled_loss" || trade.status === "stopped_out") {
      const loss = trade.pnl ?? 0;
      realizedPnl += loss;
      losingTrades++;
      if (trade.settledAt) {
        equityCurve.push({
          timestamp: trade.settledAt,
          value: config.bankroll + realizedPnl,
        });
      }
    }
  }

  // Cash = bankroll + realized P&L - cost of open positions
  const openCost = trades
    .filter((t) => t.status === "open")
    .reduce((sum, t) => sum + t.entryPrice * t.shares, 0);
  cashBalance = config.bankroll + realizedPnl - openCost;

  const totalValue = cashBalance + openCost + unrealizedPnl;
  const totalSettled = winningTrades + losingTrades;
  const winRate = totalSettled > 0 ? Math.round((winningTrades / totalSettled) * 1000) / 10 : 0;

  // Max drawdown
  let peak = config.bankroll;
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    if (point.value > peak) peak = point.value;
    const dd = ((peak - point.value) / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Add current value to curve
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
