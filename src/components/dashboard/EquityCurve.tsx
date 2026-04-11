"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

interface EquityCurveProps {
  data: Array<{ timestamp: string; value: number }>;
  bankroll: number;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { timestamp: string } }>;
}) {
  if (!active || !payload?.[0]) return null;
  const d = new Date(payload[0].payload.timestamp);
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400">
        {d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
      </p>
      <p className="text-cyan-400 font-semibold mt-1">${payload[0].value.toFixed(2)}</p>
    </div>
  );
}

export default function EquityCurve({ data, bankroll }: EquityCurveProps) {
  if (data.length < 2) {
    return (
      <div className="h-[200px] flex items-center justify-center text-gray-500 text-sm">
        Run some trades to see your equity curve
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.1 || 10;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(v: string) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          stroke="#4b5563"
          tick={{ fill: "#6b7280", fontSize: 10 }}
          tickLine={false}
        />
        <YAxis
          domain={[min - pad, max + pad]}
          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
          stroke="#4b5563"
          tick={{ fill: "#6b7280", fontSize: 10 }}
          tickLine={false}
          width={55}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={bankroll} stroke="#4b5563" strokeDasharray="4 4" label="" />
        <Area type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2} fill="url(#equityGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
