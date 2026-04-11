"use client";

import Link from "next/link";
import type { Trade } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Clock, Shield, Target, Zap, TrendingUp, TrendingDown } from "lucide-react";
import { timeAgo } from "@/lib/utils";

interface ActivePositionsProps {
  trades: Trade[];
  livePrices: Record<string, number | null>;
  takerFeePercent: number;
}

export default function ActivePositions({ trades, livePrices, takerFeePercent }: ActivePositionsProps) {
  const openTrades = trades.filter((t) => t.status === "open");

  if (openTrades.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">
        No open positions. Run auto-trade to find opportunities.
      </p>
    );
  }

  const totalCost = openTrades.reduce((sum, t) => sum + t.entryPrice * t.shares + t.entryFee, 0);
  const totalLiveValue = openTrades.reduce((sum, t) => {
    const price = livePrices[t.tokenId] ?? t.entryPrice;
    return sum + price * t.shares;
  }, 0);
  const totalUnrealizedPnl = totalLiveValue - totalCost;

  return (
    <div>
      <div className="space-y-1.5">
        {openTrades.map((trade) => {
          const cost = trade.entryPrice * trade.shares + trade.entryFee;
          const livePrice = livePrices[trade.tokenId];
          const hasLivePrice = livePrice != null;
          const currentValue = hasLivePrice ? livePrice * trade.shares : null;
          const unrealizedPnl = currentValue !== null ? currentValue - cost : null;
          const unrealizedPnlPercent = unrealizedPnl !== null && cost > 0
            ? (unrealizedPnl / cost) * 100
            : null;

          return (
            <Link key={trade.id} href={`/market/${trade.marketId}`}>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/60 transition-colors border border-gray-800 hover:border-gray-700">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{trade.question}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <Badge variant="default" className="text-[10px]">{trade.side}</Badge>
                    <span>{trade.shares} shares @ {(trade.entryPrice * 100).toFixed(0)}c</span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {timeAgo(trade.endDate)}
                    </span>
                    {trade.strategy === "settlement_arbitrage" ? (
                      <Badge variant="outline" className="text-[9px] border-cyan-800 text-cyan-400">
                        <Target className="w-2.5 h-2.5 mr-0.5" />Arb
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] border-purple-800 text-purple-400">
                        <Zap className="w-2.5 h-2.5 mr-0.5" />Expiry
                      </Badge>
                    )}
                    {trade.stopLossPrice && (
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <Shield className="w-3 h-3" />
                        SL {(trade.stopLossPrice * 100).toFixed(0)}c
                      </span>
                    )}
                  </div>
                </div>

                {/* Live Price + P&L */}
                <div className="text-right flex-shrink-0 min-w-[100px]">
                  {hasLivePrice ? (
                    <>
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-xs text-gray-500">Now:</span>
                        <span className="text-sm text-white font-mono">{(livePrice * 100).toFixed(1)}c</span>
                      </div>
                      {unrealizedPnl !== null && (
                        <div className={`flex items-center justify-end gap-0.5 text-xs font-mono font-bold ${
                          unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {unrealizedPnl >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnl.toFixed(2)}
                          <span className="text-[10px] font-normal ml-0.5">
                            ({unrealizedPnlPercent !== null ? `${unrealizedPnlPercent >= 0 ? "+" : ""}${unrealizedPnlPercent.toFixed(1)}%` : ""})
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-white font-mono">${cost.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">
                        Edge: {trade.edge > 0 ? "+" : ""}{trade.edge.toFixed(1)}pp
                      </p>
                    </>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Summary */}
      <div className="flex justify-between text-xs text-gray-500 mt-3 pt-2 border-t border-gray-800">
        <span>{openTrades.length} open position{openTrades.length !== 1 ? "s" : ""}</span>
        <div className="flex items-center gap-3">
          <span>Invested: <span className="text-white font-mono">${totalCost.toFixed(2)}</span></span>
          {Object.keys(livePrices).length > 0 && (
            <span>
              Unrealized:{" "}
              <span className={`font-mono font-bold ${totalUnrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {totalUnrealizedPnl >= 0 ? "+" : ""}${totalUnrealizedPnl.toFixed(2)}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
