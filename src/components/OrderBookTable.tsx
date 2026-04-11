"use client";

import type { OrderLevel } from "@/lib/types";

interface OrderBookTableProps {
  bids: OrderLevel[];
  asks: OrderLevel[];
  spread: number;
  midPrice: number;
}

export default function OrderBookTable({ bids, asks, spread, midPrice }: OrderBookTableProps) {
  const topBids = [...bids].sort((a, b) => b.price - a.price).slice(0, 10);
  const topAsks = [...asks].sort((a, b) => a.price - b.price).slice(0, 10);
  const maxSize = Math.max(
    ...topBids.map((b) => b.size),
    ...topAsks.map((a) => a.size),
    1
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        {/* Bids */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-2 px-2">
            <span>Price</span>
            <span>Size</span>
          </div>
          {topBids.map((bid, i) => (
            <div key={i} className="relative flex justify-between text-xs py-1 px-2 rounded">
              <div
                className="absolute inset-0 bg-emerald-500/10 rounded"
                style={{ width: `${(bid.size / maxSize) * 100}%` }}
              />
              <span className="relative text-emerald-400 font-mono">
                {(bid.price * 100).toFixed(1)}c
              </span>
              <span className="relative text-gray-400 font-mono">
                {bid.size.toFixed(0)}
              </span>
            </div>
          ))}
        </div>

        {/* Asks */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-2 px-2">
            <span>Price</span>
            <span>Size</span>
          </div>
          {topAsks.map((ask, i) => (
            <div key={i} className="relative flex justify-between text-xs py-1 px-2 rounded">
              <div
                className="absolute inset-0 bg-red-500/10 rounded right-0"
                style={{ width: `${(ask.size / maxSize) * 100}%`, marginLeft: "auto" }}
              />
              <span className="relative text-red-400 font-mono">
                {(ask.price * 100).toFixed(1)}c
              </span>
              <span className="relative text-gray-400 font-mono">
                {ask.size.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-6 text-xs border-t border-gray-800 pt-3">
        <div className="text-gray-500">
          Spread: <span className="text-gray-300 font-mono">{(spread * 100).toFixed(2)}c</span>
        </div>
        <div className="text-gray-500">
          Mid: <span className="text-cyan-400 font-mono">{(midPrice * 100).toFixed(1)}c</span>
        </div>
      </div>
    </div>
  );
}
