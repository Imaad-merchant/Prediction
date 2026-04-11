import type { AnalysisResult, MarketDataResponse, OpportunityScore } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeEdgeScore(edge: number): number {
  const absEdge = Math.abs(edge);
  if (absEdge < 2) return 0;
  return clamp((absEdge / 20) * 100, 0, 100);
}

function computeLiquidityScore(totalLiquidity: number): number {
  if (totalLiquidity >= 100_000) return 100;
  if (totalLiquidity >= 50_000) return 80;
  if (totalLiquidity >= 10_000) return 60;
  if (totalLiquidity >= 5_000) return 30;
  return 10;
}

function computeSpreadScore(spread: number): number {
  if (spread <= 0.01) return 100;
  if (spread <= 0.02) return 80;
  if (spread <= 0.05) return 50;
  if (spread <= 0.10) return 20;
  return 0;
}

function computeVolumeScore(volume24h: number): number {
  if (volume24h >= 100_000) return 100;
  if (volume24h >= 50_000) return 90;
  if (volume24h >= 10_000) return 70;
  if (volume24h >= 1_000) return 40;
  return 10;
}

function computeConfidenceScore(confidence: string): number {
  if (confidence === "High") return 100;
  if (confidence === "Medium") return 60;
  return 20;
}

export function calculateOpportunityScore(
  analysis: AnalysisResult,
  marketData: MarketDataResponse,
  volume24h: number,
  currentYesPrice: number
): OpportunityScore {
  const edge = analysis.predictedProbability - currentYesPrice * 100;
  const edgeScore = computeEdgeScore(edge);
  const liquidityScore = computeLiquidityScore(marketData.metrics.totalLiquidity);
  const spreadScore = computeSpreadScore(marketData.metrics.spread);
  const volumeScore = computeVolumeScore(volume24h);
  const confidenceScore = computeConfidenceScore(analysis.confidence);

  const overall =
    edgeScore * 0.4 +
    liquidityScore * 0.2 +
    spreadScore * 0.15 +
    volumeScore * 0.15 +
    confidenceScore * 0.1;

  let label: string;
  let color: string;
  if (overall >= 75) {
    label = "Strong Opportunity";
    color = "#10b981";
  } else if (overall >= 55) {
    label = "Moderate Opportunity";
    color = "#3b82f6";
  } else if (overall >= 35) {
    label = "Weak Opportunity";
    color = "#f59e0b";
  } else {
    label = "Poor Opportunity";
    color = "#ef4444";
  }

  return {
    overall: Math.round(overall),
    edgeScore: Math.round(edgeScore),
    liquidityScore: Math.round(liquidityScore),
    spreadScore: Math.round(spreadScore),
    volumeScore: Math.round(volumeScore),
    confidenceScore: Math.round(confidenceScore),
    label,
    color,
  };
}
