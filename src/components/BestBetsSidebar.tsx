"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Opportunity } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Loader2, Flame, Clock, TrendingUp } from "lucide-react";

export default function BestBetsSidebar() {
  const [bets, setBets] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/opportunities")
      .then((r) => r.json())
      .then((json) => setBets((json.data || []).slice(0, 8)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="border border-gray-800 rounded-xl bg-gray-900/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-white">Best Bets Ending Soon</h3>
      </div>
      <p className="text-[10px] text-gray-600 mb-3">
        High-certainty markets with profit on settlement
      </p>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
        </div>
      ) : bets.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-6">No opportunities right now</p>
      ) : (
        <div className="space-y-2">
          {bets.map((bet) => (
            <Link key={bet.id} href={`/market/${bet.id}`}>
              <div className="p-2.5 rounded-lg hover:bg-gray-800/60 transition-colors cursor-pointer border border-transparent hover:border-gray-700">
                <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                  {bet.question}
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {bet.hoursLeft < 1
                        ? `${Math.round(bet.hoursLeft * 60)}m`
                        : bet.hoursLeft < 24
                        ? `${bet.hoursLeft.toFixed(0)}h`
                        : `${(bet.hoursLeft / 24).toFixed(0)}d`}
                    </span>
                    <Badge
                      variant={bet.riskLevel === "Low" ? "success" : bet.riskLevel === "Medium" ? "warning" : "destructive"}
                      className="text-[9px] px-1 py-0"
                    >
                      {bet.riskLevel}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">
                      +{(bet.profitPerShare * 100).toFixed(0)}c
                    </span>
                    <span className="text-gray-600">@{(bet.realAskPrice * 100).toFixed(0)}c</span>
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
