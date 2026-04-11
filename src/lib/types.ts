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
  };
  riskAssessment: {
    liquidityRisk: "Low" | "Medium" | "High";
    timingRisk: string;
    marketEfficiency: string;
  };
  summary: string;
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
