// Multi-source evidence pipeline for calibrated probability estimation

export interface EvidenceSource {
  name: string;
  probability: number | null;
  confidence: number; // 0-1
  dataPoints: string[];
  stale: boolean;
}

export interface EvidencePacket {
  question: string;
  category: string;
  resolutionCriteria: string;
  sources: EvidenceSource[];
  calibratedProbability: number | null;
  sourcesAgree: boolean;
  sourceCount: number;
  marketPrice: number;
  rawEdge: number | null;
}

// === CoinGecko: Crypto price data + momentum ===

export async function fetchCryptoEvidence(question: string): Promise<EvidenceSource | null> {
  const q = question.toLowerCase();

  // Map question keywords to CoinGecko IDs
  const cryptoMap: Record<string, { id: string; symbol: string }> = {
    bitcoin: { id: "bitcoin", symbol: "BTC" },
    btc: { id: "bitcoin", symbol: "BTC" },
    ethereum: { id: "ethereum", symbol: "ETH" },
    eth: { id: "ethereum", symbol: "ETH" },
    solana: { id: "solana", symbol: "SOL" },
    xrp: { id: "ripple", symbol: "XRP" },
    dogecoin: { id: "dogecoin", symbol: "DOGE" },
    cardano: { id: "cardano", symbol: "ADA" },
    zcash: { id: "zcash", symbol: "ZEC" },
  };

  let match: { id: string; symbol: string } | null = null;
  for (const [keyword, data] of Object.entries(cryptoMap)) {
    if (q.includes(keyword)) { match = data; break; }
  }
  if (!match) return null;

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${match.id}?localization=false&tickers=false&community_data=false&developer_data=false`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();

    const price = data.market_data?.current_price?.usd;
    const change24h = data.market_data?.price_change_percentage_24h;
    const change7d = data.market_data?.price_change_percentage_7d;
    const change30d = data.market_data?.price_change_percentage_30d;
    const ath = data.market_data?.ath?.usd;
    const atl = data.market_data?.atl?.usd;

    // Extract target price from question (e.g. "reach $100", "dip to $1700")
    const priceMatch = q.match(/\$([0-9,]+(?:\.\d+)?)/);
    const targetPrice = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, "")) : null;

    let probability: number | null = null;
    const dataPoints: string[] = [
      `${match.symbol} current price: $${price?.toFixed(2)}`,
      `24h change: ${change24h?.toFixed(1)}%`,
      `7d change: ${change7d?.toFixed(1)}%`,
      `30d change: ${change30d?.toFixed(1)}%`,
    ];

    if (targetPrice && price) {
      const isReachQuestion = /reach|above|over|hit|surpass/.test(q);
      const isDipQuestion = /dip|below|under|drop|fall/.test(q);
      const percentAway = ((targetPrice - price) / price) * 100;

      if (isReachQuestion) {
        // Probability of reaching target: based on distance and momentum
        if (percentAway <= 0) probability = 0.90; // already above
        else if (percentAway < 5) probability = 0.50 + (change7d ?? 0) * 0.02;
        else if (percentAway < 20) probability = 0.25 + (change30d ?? 0) * 0.01;
        else probability = 0.10;
      } else if (isDipQuestion) {
        if (percentAway >= 0) probability = 0.90; // already below
        else if (Math.abs(percentAway) < 5) probability = 0.40 - (change7d ?? 0) * 0.02;
        else if (Math.abs(percentAway) < 20) probability = 0.20 - (change30d ?? 0) * 0.01;
        else probability = 0.08;
      }

      if (probability !== null) {
        probability = Math.max(0.02, Math.min(0.98, probability));
      }
      dataPoints.push(`Target: $${targetPrice} (${percentAway >= 0 ? "+" : ""}${percentAway.toFixed(1)}% from current)`);
    }

    return {
      name: "CoinGecko",
      probability,
      confidence: probability !== null ? 0.6 : 0.3,
      dataPoints,
      stale: false,
    };
  } catch {
    return null;
  }
}

// === Manifold Markets: Cross-market probability ===

export async function fetchManifoldEvidence(question: string): Promise<EvidenceSource | null> {
  try {
    // Search Manifold for similar markets
    const searchTerms = question
      .replace(/will |on polymarket|by |on |the /gi, "")
      .slice(0, 100);

    const res = await fetch(
      `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(searchTerms)}&limit=3`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const markets = await res.json();

    if (!Array.isArray(markets) || markets.length === 0) return null;

    // Use the best matching market
    const best = markets[0];
    const prob = best.probability;
    if (typeof prob !== "number") return null;

    const dataPoints = [
      `Manifold market: "${best.question}"`,
      `Manifold probability: ${(prob * 100).toFixed(0)}%`,
      `Volume: $${Math.round(best.volume || 0)}`,
      `Traders: ${best.uniqueBettorCount || 0}`,
    ];

    return {
      name: "Manifold Markets",
      probability: prob,
      confidence: (best.uniqueBettorCount || 0) > 20 ? 0.7 : 0.4,
      dataPoints,
      stale: false,
    };
  } catch {
    return null;
  }
}

// === Stale Market Detection ===

export function detectStaleMarket(
  lastTradeTime: string | null,
  currentPrice: number
): { isStale: boolean; hoursSinceUpdate: number } {
  if (!lastTradeTime) return { isStale: false, hoursSinceUpdate: 0 };
  const hours = (Date.now() - new Date(lastTradeTime).getTime()) / (1000 * 60 * 60);
  return {
    isStale: hours > 48,
    hoursSinceUpdate: Math.round(hours * 10) / 10,
  };
}

// === Aggregate Evidence ===

export function aggregateEvidence(
  sources: EvidenceSource[],
  marketPrice: number
): { calibratedProbability: number; sourcesAgree: boolean; confidenceDiscount: number } {
  const validSources = sources.filter((s) => s.probability !== null && !s.stale);

  if (validSources.length === 0) {
    return { calibratedProbability: marketPrice, sourcesAgree: false, confidenceDiscount: 0.3 };
  }

  // Weighted average by confidence
  let weightedSum = 0;
  let weightTotal = 0;
  for (const s of validSources) {
    weightedSum += (s.probability ?? 0) * s.confidence;
    weightTotal += s.confidence;
  }
  const calibratedProbability = weightTotal > 0 ? weightedSum / weightTotal : marketPrice;

  // Check if sources agree (all within 15% of each other)
  const probs = validSources.map((s) => s.probability ?? 0);
  const maxP = Math.max(...probs);
  const minP = Math.min(...probs);
  const sourcesAgree = (maxP - minP) < 0.15;

  // Confidence discount: 1.0 if 3+ sources agree, 0.7 if 2, 0.4 if just GPT
  let confidenceDiscount = 0.4;
  if (validSources.length >= 3 && sourcesAgree) confidenceDiscount = 1.0;
  else if (validSources.length >= 2 && sourcesAgree) confidenceDiscount = 0.7;
  else if (validSources.length >= 2) confidenceDiscount = 0.6;

  return {
    calibratedProbability: Math.max(0.02, Math.min(0.98, calibratedProbability)),
    sourcesAgree,
    confidenceDiscount,
  };
}

// === Liquidity Discount ===

export function calculateLiquidityDiscount(volume: number, maxVolume: number = 500000): number {
  if (volume <= 0) return 0.1;
  return Math.max(0.1, Math.min(1.0, Math.log(volume) / Math.log(maxVolume)));
}

// === Market Selection Filter ===

export function passesMarketSelection(
  hoursToResolution: number,
  volume: number,
  sourceCount: number,
  questionType: string
): { pass: boolean; reason: string } {
  // Skip 30+ day markets (edge decays)
  if (hoursToResolution > 720) {
    return { pass: false, reason: "Market resolves > 30 days out" };
  }

  // Skip pure sentiment markets
  if (/tweet|post.*about|mention|say.*about/i.test(questionType)) {
    return { pass: false, reason: "Pure sentiment market (no base rate)" };
  }

  // Require at least 2 independent sources (1 = just GPT)
  if (sourceCount < 1) {
    return { pass: false, reason: `Only ${sourceCount} data source(s), need 2+` };
  }

  // Focus on $100–$500k volume (enough liquidity, not over-arbitraged)
  if (volume < 100) {
    return { pass: false, reason: `Volume too low ($${volume})` };
  }

  return { pass: true, reason: "Passes selection criteria" };
}

// === Build Full Evidence Packet ===

export async function buildEvidencePacket(
  question: string,
  category: string,
  marketPrice: number,
  volume: number,
  liquidity: number,
  endDate: string
): Promise<EvidencePacket> {
  const sources: EvidenceSource[] = [];

  // Fetch evidence from relevant sources in parallel
  const fetches: Promise<EvidenceSource | null>[] = [];

  // Always try Manifold for cross-market calibration
  fetches.push(fetchManifoldEvidence(question));

  // Category-specific sources
  if (category === "crypto") {
    fetches.push(fetchCryptoEvidence(question));
  }

  const results = await Promise.allSettled(fetches);
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      sources.push(r.value);
    }
  }

  const { calibratedProbability, sourcesAgree } = aggregateEvidence(sources, marketPrice);
  const rawEdge = calibratedProbability !== null
    ? calibratedProbability - marketPrice
    : null;

  return {
    question,
    category,
    resolutionCriteria: question, // Will be parsed by GPT
    sources,
    calibratedProbability,
    sourcesAgree,
    sourceCount: sources.filter((s) => s.probability !== null).length,
    marketPrice,
    rawEdge,
  };
}
