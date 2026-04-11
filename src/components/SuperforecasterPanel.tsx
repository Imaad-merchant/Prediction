"use client";

import { useState } from "react";
import type { Market, AnalysisResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Shield,
  Target,
} from "lucide-react";

function ScoreRing({ score, size = 120, color = "#06b6d4" }: { score: number; size?: number; color?: string }) {
  const r = size / 2 - 10;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f2937" strokeWidth="8" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <span className="absolute text-2xl font-bold text-white">{score}%</span>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-800 rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-cyan-400" />
          {title}
        </div>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="px-3 pb-3 text-sm text-gray-400">{children}</div>}
    </div>
  );
}

interface SuperforecasterPanelProps {
  market: Market;
  liquidity: number;
}

export default function SuperforecasterPanel({ market, liquidity }: SuperforecasterPanelProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: market.question,
          currentYesPrice: Math.round(market.outcomePrices[0] * 100),
          currentNoPrice: Math.round(market.outcomePrices[1] * 100),
          volume: Math.round(market.volume24hr || market.volume),
          liquidity: Math.round(liquidity),
          endDate: market.endDate,
          description: market.description,
          category: market.category,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setAnalysis(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const recColor: Record<string, string> = {
    "BUY YES": "success",
    "BUY NO": "destructive",
    HOLD: "warning",
    AVOID: "outline",
  };

  const confColor: Record<string, string> = {
    High: "#10b981",
    Medium: "#f59e0b",
    Low: "#ef4444",
  };

  if (!analysis && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Brain className="w-16 h-16 text-gray-700" />
        <h3 className="text-lg font-medium text-gray-400">Superforecaster Analysis</h3>
        <p className="text-sm text-gray-500 text-center max-w-md">
          Run AI-powered analysis using Philip Tetlock&apos;s Superforecaster methodology to get a
          calibrated probability estimate with detailed reasoning.
        </p>
        <Button onClick={runAnalysis} size="lg" className="mt-2">
          <Brain className="w-4 h-4 mr-2" />
          Run Superforecaster Analysis
        </Button>
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
        <p className="text-sm text-gray-400">Analyzing market with Superforecaster methodology...</p>
        <p className="text-xs text-gray-600">Decomposing question, evaluating factors, calibrating probability</p>
      </div>
    );
  }

  if (!analysis) return null;

  const edge = analysis.edge;
  const edgeColor = Math.abs(edge) > 10 ? "#10b981" : Math.abs(edge) > 5 ? "#f59e0b" : "#6b7280";

  return (
    <div className="space-y-4">
      {/* Hero: Probability + Recommendation */}
      <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-gray-800/50 rounded-xl border border-gray-700">
        <ScoreRing
          score={analysis.predictedProbability}
          color={confColor[analysis.confidence] || "#06b6d4"}
        />
        <div className="flex-1 space-y-2 text-center sm:text-left">
          <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
            <Badge variant={recColor[analysis.recommendation] as "success" | "destructive" | "warning" | "outline"}>
              {analysis.recommendation}
            </Badge>
            <Badge variant="outline">
              Confidence: {analysis.confidence}
            </Badge>
          </div>
          <div className="flex items-center gap-1 justify-center sm:justify-start">
            <span className="text-sm text-gray-400">Edge:</span>
            <span className="text-lg font-bold" style={{ color: edgeColor }}>
              {edge > 0 ? "+" : ""}
              {edge.toFixed(1)}pp
            </span>
          </div>
          <p className="text-sm text-gray-300">{analysis.summary}</p>
        </div>
      </div>

      {/* Re-run button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={runAnalysis} disabled={loading}>
          <Brain className="w-3 h-3 mr-1" />
          Re-analyze
        </Button>
      </div>

      {/* Detailed Reasoning */}
      <div className="space-y-2">
        <CollapsibleSection title="Question Decomposition" icon={Target} defaultOpen>
          <ul className="space-y-1 mt-1">
            {analysis.reasoning.decomposition.map((q, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-cyan-400 font-mono text-xs">{i + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>

        <CollapsibleSection title="Base Rate Analysis" icon={Target}>
          <p className="mt-1">{analysis.reasoning.baseRate}</p>
        </CollapsibleSection>

        <CollapsibleSection title="Key Factors" icon={Target} defaultOpen>
          <div className="mt-1 space-y-2">
            {analysis.reasoning.keyFactors.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {f.direction === "for" ? (
                  <ArrowUp className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <ArrowDown className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <span className="flex-1">{f.factor}</span>
                <Badge
                  variant={f.weight === "high" ? "default" : f.weight === "medium" ? "warning" : "outline"}
                  className="text-[10px] flex-shrink-0"
                >
                  {f.weight}
                </Badge>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Current Events Context" icon={Target}>
          <p className="mt-1">{analysis.reasoning.newsContext}</p>
        </CollapsibleSection>

        <CollapsibleSection title="Uncertainties" icon={AlertTriangle}>
          <ul className="mt-1 space-y-1">
            {analysis.reasoning.uncertainties.map((u, i) => (
              <li key={i} className="flex gap-2">
                <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>{u}</span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>

        <CollapsibleSection title="Risk Assessment" icon={Shield}>
          <div className="mt-1 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Liquidity Risk</span>
              <Badge
                variant={
                  analysis.riskAssessment.liquidityRisk === "Low"
                    ? "success"
                    : analysis.riskAssessment.liquidityRisk === "Medium"
                    ? "warning"
                    : "destructive"
                }
              >
                {analysis.riskAssessment.liquidityRisk}
              </Badge>
            </div>
            <div>
              <span className="text-gray-500">Timing:</span>{" "}
              <span className="text-gray-300">{analysis.riskAssessment.timingRisk}</span>
            </div>
            <div>
              <span className="text-gray-500">Market Efficiency:</span>{" "}
              <span className="text-gray-300">{analysis.riskAssessment.marketEfficiency}</span>
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}

export { ScoreRing };
