"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { OrderLevel } from "@/lib/types";

interface DepthChartProps {
  bids: OrderLevel[];
  asks: OrderLevel[];
}

function buildDepthData(bids: OrderLevel[], asks: OrderLevel[]) {
  const sortedBids = [...bids].sort((a, b) => b.price - a.price);
  const sortedAsks = [...asks].sort((a, b) => a.price - b.price);

  const data: Array<{ price: number; bidDepth: number | null; askDepth: number | null }> = [];

  let cumBid = 0;
  for (const bid of sortedBids.reverse()) {
    cumBid += bid.size;
    data.push({ price: bid.price, bidDepth: cumBid, askDepth: null });
  }

  let cumAsk = 0;
  for (const ask of sortedAsks) {
    cumAsk += ask.size;
    data.push({ price: ask.price, bidDepth: null, askDepth: cumAsk });
  }

  data.sort((a, b) => a.price - b.price);
  return data;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; payload: { price: number } }>;
}) {
  if (!active || !payload?.[0]) return null;
  const item = payload[0];
  const side = item.dataKey === "bidDepth" ? "Bid" : "Ask";
  const color = side === "Bid" ? "#10b981" : "#ef4444";
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400">Price: {(item.payload.price * 100).toFixed(1)}c</p>
      <p style={{ color }} className="font-semibold mt-1">
        {side} Depth: {item.value.toFixed(0)} shares
      </p>
    </div>
  );
}

export default function DepthChart({ bids, asks }: DepthChartProps) {
  const data = buildDepthData(bids, asks);

  if (data.length === 0) {
    return (
      <div className="h-[250px] flex items-center justify-center text-gray-500 text-sm">
        No orderbook data available
      </div>
    );
  }

  // Compute domains from actual data
  const prices = data.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const pricePad = (maxPrice - minPrice) * 0.05 || 0.01;

  const maxDepth = Math.max(
    ...data.map((d) => d.bidDepth ?? 0),
    ...data.map((d) => d.askDepth ?? 0),
    1
  );

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <defs>
          <linearGradient id="bidGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="askGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis
          dataKey="price"
          type="number"
          domain={[minPrice - pricePad, maxPrice + pricePad]}
          tickFormatter={(v: number) => `${(v * 100).toFixed(0)}c`}
          stroke="#4b5563"
          tick={{ fill: "#6b7280", fontSize: 11 }}
          tickLine={false}
        />
        <YAxis
          domain={[0, Math.ceil(maxDepth * 1.1)]}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${v}`}
          stroke="#4b5563"
          tick={{ fill: "#6b7280", fontSize: 11 }}
          tickLine={false}
          width={50}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="stepAfter"
          dataKey="bidDepth"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#bidGrad)"
          connectNulls={false}
        />
        <Area
          type="stepAfter"
          dataKey="askDepth"
          stroke="#ef4444"
          strokeWidth={2}
          fill="url(#askGrad)"
          connectNulls={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
