"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Signal } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Radio, Trash2, ArrowLeft } from "lucide-react";

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/signals")
      .then((r) => r.json())
      .then((json) => setSignals(json.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const recColor: Record<string, "success" | "destructive" | "warning" | "outline"> = {
    "BUY YES": "success",
    "BUY NO": "destructive",
    HOLD: "warning",
    AVOID: "outline",
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-cyan-400 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <Radio className="w-6 h-6 text-cyan-400" />
        <h1 className="text-2xl font-bold text-white">Trading Signals</h1>
        <Badge variant="outline">{signals.length} signals</Badge>
      </div>

      <p className="text-sm text-gray-400 mb-6">
        History of all Superforecaster analyses. Each signal shows the AI&apos;s predicted probability,
        edge vs. market price, and recommendation.
      </p>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : signals.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No signals yet. Run a Superforecaster analysis on any market to generate your first signal.
        </div>
      ) : (
        <div className="space-y-3">
          {signals.map((signal) => (
            <Link key={signal.id} href={`/market/${signal.marketId}`}>
              <div className="border border-gray-800 rounded-lg bg-gray-900 hover:bg-gray-800/50 transition-all p-4 cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-200 line-clamp-1">
                      {signal.question}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{signal.summary}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>{new Date(signal.timestamp).toLocaleString()}</span>
                      <span>Confidence: {signal.confidence}</span>
                      {signal.suggestedSize && (
                        <span>Size: ${signal.suggestedSize.toFixed(0)}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 space-y-1">
                    <Badge variant={recColor[signal.recommendation] || "outline"}>
                      {signal.recommendation}
                    </Badge>
                    <div className="text-xs text-gray-400">
                      AI: <span className="text-cyan-400 font-mono">{signal.predictedProbability}%</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      Mkt: <span className="text-white font-mono">{signal.marketPrice}%</span>
                    </div>
                    <div className="text-xs">
                      <span className={signal.edge > 0 ? "text-emerald-400" : "text-red-400"}>
                        {signal.edge > 0 ? "+" : ""}{signal.edge.toFixed(1)}pp edge
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
