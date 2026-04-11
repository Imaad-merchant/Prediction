export interface Market {
  id: string;
  question: string;
  slug: string;
  description: string;
  outcomes: string[];
  outcomePrices: number[];
  volume: number;
  volume24hr: number;
  liquidity: number;
  endDate: string;
  image: string;
  active: boolean;
  closed: boolean;
  conditionId: string;
  tokens: MarketToken[];
  category?: string;
}

export interface MarketToken {
  token_id: string;
  outcome: string;
  price: number;
}

export interface OrderLevel {
  price: number;
  size: number;
}

export interface OrderBook {
  bids: OrderLevel[];
  asks: OrderLevel[];
  spread: number;
  midPrice: number;
  totalBidLiquidity: number;
  totalAskLiquidity: number;
}

export interface PricePoint {
  t: number;
  p: number;
}

export interface MarketDataResponse {
  orderbook: OrderBook;
  priceHistory: PricePoint[];
  metrics: {
    liquidityScore: "High" | "Medium" | "Low";
    spreadScore: "Tight" | "Normal" | "Wide";
    totalLiquidity: number;
    spread: number;
  };
}

export interface KeyFactor {
  factor: string;
  direction: "for" | "against";
  weight: "high" | "medium" | "low";
}

export interface AnalysisResult {
  predictedProbability: number;
  confidence: "High" | "Medium" | "Low";
  recommendation: "BUY YES" | "BUY NO" | "HOLD" | "AVOID";
  edge: number;
  reasoning: {
    decomposition: string[];
    baseRate: string;
    keyFactors: KeyFactor[];
    newsContext: string;
    uncertainties: string[];
    strategyScorecard?: Array<{ strategy: string; signal: string; score: number }>;
    strategyConsensus?: {
      totalScore: number;
      bias: string;
      summary: string;
    };
  };
  riskAssessment: {
    liquidityRisk: "Low" | "Medium" | "High";
    timingRisk: string;
    marketEfficiency: string;
  };
  summary: string;
  positionSizing?: {
    direction: "bullish" | "bearish" | "neutral";
    materiality: number;
    suggestedSize: number;
    maxBuyPrice: number;
    kellyFraction: number;
    dollarEdge: number;
    profitPerShare: number;
  };
}

export interface Opportunity {
  id: string;
  question: string;
  slug: string;
  image: string;
  endDate: string;
  gammaProbability: number;
  realAskPrice: number;
  profitPerShare: number;
  edge: number;
  volume: number;
  liquidity: number;
  hoursLeft: number;
  side: "YES" | "NO";
  tokenId: string;
  riskLevel: "Low" | "Medium" | "High";
}

export interface Signal {
  id: string;
  timestamp: string;
  marketId: string;
  question: string;
  predictedProbability: number;
  marketPrice: number;
  edge: number;
  recommendation: string;
  confidence: string;
  summary: string;
  suggestedSize?: number;
}

export interface ResearchItem {
  title: string;
  url: string;
  source: string;
  snippet: string;
  publishedAt?: string;
}

// === Trading Dashboard Types ===

export interface TradingConfig {
  bankroll: number;
  maxBetSize: number;
  dailyLossLimit: number;
  mode: "paper" | "live";
  isRunning: boolean;
  lastRunAt: string | null;
}

export interface Trade {
  id: string;
  marketId: string;
  question: string;
  side: "YES" | "NO";
  shares: number;
  entryPrice: number;
  exitPrice: number | null;
  pnl: number | null;
  pnlPercent: number | null;
  status: "open" | "settled_win" | "settled_loss" | "stopped_out";
  confidence: string;
  edge: number;
  strategyScore: number | null;
  tokenId: string;
  endDate: string;
  enteredAt: string;
  settledAt: string | null;
}

export interface PortfolioState {
  totalValue: number;
  cashBalance: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  maxDrawdown: number;
  equityCurve: Array<{ timestamp: string; value: number }>;
}

export interface TradesStore {
  config: TradingConfig;
  portfolio: PortfolioState;
  trades: Trade[];
}

export interface OpportunityScore {
  overall: number;
  edgeScore: number;
  liquidityScore: number;
  spreadScore: number;
  volumeScore: number;
  confidenceScore: number;
  label: string;
  color: string;
}
