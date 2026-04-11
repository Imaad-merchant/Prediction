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
import type { PricePoint } from "@/lib/types";

function formatTimestamp(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { t: number } }>;
}) {
  if (!active || !payload?.[0]) return null;
  const d = new Date(payload[0].payload.t * 1000);
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400">
        {d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
      <p className="text-cyan-400 font-semibold mt-1">
        {(payload[0].value * 100).toFixed(1)}%
      </p>
    </div>
  );
}

export default function PriceChart({ data }: { data: PricePoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-500 text-sm">
        No price history available
      </div>
    );
  }

  // Downsample if too many points
  const maxPoints = 200;
  const step = Math.max(1, Math.floor(data.length / maxPoints));
  const chartData = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis
          dataKey="t"
          tickFormatter={formatTimestamp}
          stroke="#4b5563"
          tick={{ fill: "#6b7280", fontSize: 11 }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 1]}
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          stroke="#4b5563"
          tick={{ fill: "#6b7280", fontSize: 11 }}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="p"
          stroke="#06b6d4"
          strokeWidth={2}
          fill="url(#priceGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
