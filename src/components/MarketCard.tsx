"use client";

import Link from "next/link";
import type { Market } from "@/lib/types";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Clock, BarChart3 } from "lucide-react";

export default function MarketCard({ market }: { market: Market }) {
  const isBinary =
    market.outcomes.length === 2 &&
    market.outcomes[0].toLowerCase() === "yes" &&
    market.outcomes[1].toLowerCase() === "no";

  const yesPrice = market.outcomePrices[0] || 0;
  const noPrice = market.outcomePrices[1] || 0;
  const yesPct = Math.round(yesPrice * 100);
  const noPct = Math.round(noPrice * 100);

  // For multi-outcome, find the top outcomes sorted by price
  const sortedOutcomes = market.outcomes
    .map((name, i) => ({ name, price: market.outcomePrices[i] || 0 }))
    .sort((a, b) => b.price - a.price);

  return (
    <Link href={`/market/${market.id}`}>
      <div className="group border border-gray-800 rounded-xl bg-gray-900 hover:bg-gray-800/80 hover:border-gray-700 transition-all p-4 cursor-pointer">
        <div className="flex gap-3">
          {market.image && (
            <img
              src={market.image}
              alt=""
              className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-100 line-clamp-2 group-hover:text-white">
              {market.question}
            </h3>
          </div>
        </div>

        {isBinary ? (
          <>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 rounded-l-full transition-all"
                  style={{ width: `${yesPct}%` }}
                />
                <div
                  className="h-full bg-red-500 rounded-r-full transition-all"
                  style={{ width: `${noPct}%` }}
                />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-semibold">Yes {yesPct}%</span>
                <span className="text-red-400 font-semibold">No {noPct}%</span>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-3 space-y-1">
            {sortedOutcomes.slice(0, 4).map((o, i) => {
              const pct = Math.round(o.price * 100);
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400 w-20 truncate" title={o.name}>{o.name}</span>
                  <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        backgroundColor: i === 0 ? "#10b981" : i === 1 ? "#06b6d4" : "#6b7280",
                      }}
                    />
                  </div>
                  <span className="text-gray-300 font-mono w-8 text-right">{pct}c</span>
                </div>
              );
            })}
            {sortedOutcomes.length > 4 && (
              <p className="text-[10px] text-gray-600">+{sortedOutcomes.length - 4} more</p>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3" />
            <span>{formatCurrency(market.volume)}</span>
          </div>
          {market.endDate && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{timeAgo(market.endDate)}</span>
            </div>
          )}
          {market.category && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {market.category}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
