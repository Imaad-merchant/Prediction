"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Opportunity } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Loader2, RefreshCw, Zap, Clock, TrendingUp, AlertTriangle } from "lucide-react";

export default function OpportunityScanner() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/opportunities");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setOpportunities(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { scan(); }, []);

  const riskColor = { Low: "success", Medium: "warning", High: "destructive" } as const;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <p className="text-sm text-gray-400">Scanning markets for opportunities...</p>
        <p className="text-xs text-gray-600">Walking CLOB orderbooks for real prices</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400 mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={scan}>Retry</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-white">Expiry Convergence Opportunities</h2>
          <Badge variant="outline" className="text-xs">{opportunities.length} found</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={scan} disabled={loading}>
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />
          Rescan
        </Button>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        High-certainty markets ending soon where the price hasn&apos;t converged to $1.00 yet.
        Profit = $1.00 - ask price per share on settlement.
      </p>

      {opportunities.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-600" />
          No opportunities found right now. Markets are efficiently priced.
        </div>
      ) : (
        <div className="space-y-2">
          {opportunities.map((opp) => (
            <Link key={opp.id} href={`/market/${opp.id}`}>
              <div className="border border-gray-800 rounded-lg bg-gray-900 hover:bg-gray-800/80 hover:border-gray-700 transition-all p-4 cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-200 line-clamp-1">{opp.question}</h3>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {opp.hoursLeft < 1 ? `${Math.round(opp.hoursLeft * 60)}m` : `${opp.hoursLeft.toFixed(1)}h`} left
                      </span>
                      <span>Vol: {formatCurrency(opp.volume)}</span>
                      <Badge variant={riskColor[opp.riskLevel]} className="text-[10px]">
                        {opp.riskLevel} Risk
                      </Badge>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 space-y-1">
                    <div className="flex items-center gap-2 justify-end">
                      <Badge variant="success" className="text-xs">
                        BUY {opp.side}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-400">
                      Ask: <span className="text-white font-mono">{(opp.realAskPrice * 100).toFixed(1)}c</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs justify-end">
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">
                        +{(opp.profitPerShare * 100).toFixed(1)}c/share
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
