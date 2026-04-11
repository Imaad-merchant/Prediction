"use client";

import { useState } from "react";
import Link from "next/link";
import type { Trade } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Filter = "all" | "open" | "settled";

export default function TradeHistory({ trades }: { trades: Trade[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = trades.filter((t) => {
    if (filter === "open") return t.status === "open";
    if (filter === "settled") return t.status !== "open";
    return true;
  });

  const statusBadge = (status: Trade["status"]) => {
    switch (status) {
      case "open": return <Badge variant="default">Open</Badge>;
      case "settled_win": return <Badge variant="success">Won</Badge>;
      case "settled_loss": return <Badge variant="destructive">Lost</Badge>;
      case "stopped_out": return <Badge variant="warning">Stopped</Badge>;
    }
  };

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {(["all", "open", "settled"] as Filter[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter(f)}
            className="text-xs capitalize"
          >
            {f} {f === "all" ? `(${trades.length})` : f === "open" ? `(${trades.filter((t) => t.status === "open").length})` : `(${trades.filter((t) => t.status !== "open").length})`}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No trades yet</p>
      ) : (
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
          {filtered.map((trade) => (
            <Link key={trade.id} href={`/market/${trade.marketId}`}>
              <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-800/50 transition-colors text-xs border border-transparent hover:border-gray-700">
                <div className="flex-1 min-w-0">
                  <p className="text-gray-300 truncate">{trade.question}</p>
                  <p className="text-gray-600 mt-0.5">
                    {new Date(trade.enteredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 w-14">
                  <p className="text-gray-400">{trade.side}</p>
                  <p className="text-gray-500">{trade.shares}sh</p>
                </div>
                <div className="text-right flex-shrink-0 w-16">
                  <p className="text-gray-300 font-mono">{(trade.entryPrice * 100).toFixed(0)}c</p>
                  {trade.exitPrice !== null && (
                    <p className="text-gray-500 font-mono">{(trade.exitPrice * 100).toFixed(0)}c</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0 w-16">
                  {trade.pnl !== null ? (
                    <p className={`font-mono font-bold ${trade.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                    </p>
                  ) : (
                    <p className="text-gray-600">—</p>
                  )}
                </div>
                <div className="flex-shrink-0">{statusBadge(trade.status)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
