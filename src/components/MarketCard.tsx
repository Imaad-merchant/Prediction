"use client";

import Link from "next/link";
import type { Market } from "@/lib/types";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Clock, BarChart3 } from "lucide-react";

export default function MarketCard({ market }: { market: Market }) {
  const yesPrice = market.outcomePrices[0] || 0;
  const noPrice = market.outcomePrices[1] || 0;
  const yesPct = Math.round(yesPrice * 100);
  const noPct = Math.round(noPrice * 100);

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
