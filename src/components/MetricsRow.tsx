"use client";

import { BarChart3, Droplets, Activity, Clock } from "lucide-react";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { MarketDataResponse } from "@/lib/types";

interface MetricsRowProps {
  volume: number;
  volume24hr: number;
  endDate: string;
  metrics: MarketDataResponse["metrics"];
}

export default function MetricsRow({ volume, volume24hr, endDate, metrics }: MetricsRowProps) {
  const spreadColor = metrics.spreadScore === "Tight" ? "success" : metrics.spreadScore === "Normal" ? "warning" : "destructive";
  const liqColor = metrics.liquidityScore === "High" ? "success" : metrics.liquidityScore === "Medium" ? "warning" : "destructive";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-800">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
          <BarChart3 className="w-3 h-3" />
          Total Volume
        </div>
        <p className="text-lg font-bold text-white">{formatCurrency(volume)}</p>
        {volume24hr > 0 && (
          <p className="text-xs text-gray-500 mt-0.5">24h: {formatCurrency(volume24hr)}</p>
        )}
      </div>

      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-800">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
          <Droplets className="w-3 h-3" />
          Liquidity
        </div>
        <p className="text-lg font-bold text-white">{formatCurrency(metrics.totalLiquidity)}</p>
        <Badge variant={liqColor} className="mt-1 text-[10px]">{metrics.liquidityScore}</Badge>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-800">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
          <Activity className="w-3 h-3" />
          Spread
        </div>
        <p className="text-lg font-bold text-white">{(metrics.spread * 100).toFixed(2)}c</p>
        <Badge variant={spreadColor} className="mt-1 text-[10px]">{metrics.spreadScore}</Badge>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-800">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
          <Clock className="w-3 h-3" />
          Resolution
        </div>
        <p className="text-lg font-bold text-white">{timeAgo(endDate)}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {new Date(endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}
