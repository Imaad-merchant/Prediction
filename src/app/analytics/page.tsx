"use client";

import { useState, useEffect, useMemo } from "react";
import type { TradesStore, Trade } from "@/lib/types";
import { defaultTradesStore, calculateSharpeRatio, calculateAvgHoldTime, getBestWorstTrade, getPnlByCategory, getConfusionMatrix, tradesToCSV } from "@/lib/trading";
import { BarChart2, Download, TrendingUp, TrendingDown, Clock, Target, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, CartesianGrid, Cell } from "recharts";

const STORAGE_KEY = "polypredict_trades_store";

function loadStore(): TradesStore {
  if (typeof window === "undefined") return defaultTradesStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultTradesStore();
}

type SortField = "pnl" | "edgeScore" | "holdTime";
type SortDir = "asc" | "desc";

export default function AnalyticsPage() {
  const [store, setStore] = useState<TradesStore>(defaultTradesStore());
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("pnl");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    setStore(loadStore());
    setLoading(false);
  }, []);

  const trades = store.trades;
  const settled = useMemo(() => trades.filter((t) => t.status !== "open"), [trades]);
  const sharpe = useMemo(() => calculateSharpeRatio(trades), [trades]);
  const avgHold = useMemo(() => calculateAvgHoldTime(trades), [trades]);
  const { best, worst } = useMemo(() => getBestWorstTrade(trades), [trades]);
  const catPnl = useMemo(() => getPnlByCategory(trades), [trades]);
  const confusion = useMemo(() => getConfusionMatrix(trades), [trades]);

  // Sorted trade table
  const sortedTrades = useMemo(() => {
    const arr = [...settled];
    arr.sort((a, b) => {
      let va: number, vb: number;
      if (sortField === "pnl") {
        va = a.pnl ?? 0;
        vb = b.pnl ?? 0;
      } else if (sortField === "edgeScore") {
        va = a.edgeScore ?? 0;
        vb = b.edgeScore ?? 0;
      } else {
        va = a.settledAt && a.enteredAt ? new Date(a.settledAt).getTime() - new Date(a.enteredAt).getTime() : 0;
        vb = b.settledAt && b.enteredAt ? new Date(b.settledAt).getTime() - new Date(b.enteredAt).getTime() : 0;
      }
      return sortDir === "desc" ? vb - va : va - vb;
    });
    return arr;
  }, [settled, sortField, sortDir]);

  // Edge vs PnL scatter data
  const scatterData = useMemo(() =>
    settled.map((t) => ({
      edgeScore: t.edgeScore ?? 0,
      pnl: t.pnl ?? 0,
      question: t.question,
      won: (t.pnl ?? 0) >= 0,
    })),
  [settled]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const handleExportCSV = () => {
    const csv = tradesToCSV(trades);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `polypredict_trades_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh] text-gray-400">Loading...</div>;
  }

  if (trades.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <BarChart2 className="w-12 h-12 text-gray-700 mx-auto mb-4" />
        <h2 className="text-xl text-gray-400">No trades yet</h2>
        <p className="text-sm text-gray-600 mt-2">Run auto-trade from the dashboard to generate analytics data.</p>
      </div>
    );
  }

  const totalReturn = store.config.bankroll > 0
    ? ((store.portfolio.totalValue - store.config.bankroll) / store.config.bankroll) * 100
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-7 h-7 text-cyan-400" />
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={handleExportCSV}>
          <Download className="w-4 h-4 mr-1" />
          Export CSV
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Sharpe Ratio", value: sharpe.toFixed(2), icon: Target, color: sharpe > 1 ? "text-emerald-400" : sharpe > 0 ? "text-amber-400" : "text-red-400" },
          { label: "Total Return", value: `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(1)}%`, icon: TrendingUp, color: totalReturn >= 0 ? "text-emerald-400" : "text-red-400" },
          { label: "Max Drawdown", value: `${store.portfolio.maxDrawdown.toFixed(1)}%`, icon: TrendingDown, color: store.portfolio.maxDrawdown > 10 ? "text-red-400" : "text-amber-400" },
          { label: "Win Rate", value: `${store.portfolio.winRate}%`, icon: Target, color: store.portfolio.winRate >= 60 ? "text-emerald-400" : "text-amber-400" },
          { label: "Avg Hold", value: `${avgHold}h`, icon: Clock, color: "text-gray-300" },
          { label: "Trades", value: `${trades.length}`, icon: BarChart2, color: "text-gray-300" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`w-3.5 h-3.5 ${s.color}`} />
                <span className="text-[10px] text-gray-500">{s.label}</span>
              </div>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Equity Curve */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Equity Curve</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={store.portfolio.equityCurve}>
            <defs>
              <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="timestamp" hide />
            <YAxis domain={["auto", "auto"]} hide />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
              labelFormatter={(v) => new Date(v as string).toLocaleDateString()}
              formatter={(v) => [`$${Number(v).toFixed(2)}`, "Value"]}
            />
            <Area type="monotone" dataKey="value" stroke="#06b6d4" fill="url(#eqGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* PnL by Category */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">P&L by Category</h3>
          {Object.keys(catPnl).length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No settled trades</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(catPnl)
                .sort(([, a], [, b]) => b.pnl - a.pnl)
                .map(([cat, data]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="capitalize text-gray-300">{cat}</span>
                      <span className="text-xs text-gray-600">({data.count} trades, {data.winRate}% WR)</span>
                    </div>
                    <span className={`font-mono font-bold ${data.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {data.pnl >= 0 ? "+" : ""}${data.pnl.toFixed(2)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Edge Score vs Actual PnL Scatter */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Edge Score vs P&L</h3>
          {scatterData.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No settled trades</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="edgeScore" type="number" name="Edge Score" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <YAxis dataKey="pnl" type="number" name="PnL" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 11 }}
                  formatter={(v, name) => [name === "pnl" ? `$${Number(v).toFixed(2)}` : Number(v).toFixed(3), name === "pnl" ? "P&L" : "Edge"]}
                />
                <Scatter data={scatterData}>
                  {scatterData.map((entry, i) => (
                    <Cell key={i} fill={entry.won ? "#34d399" : "#f87171"} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Confusion Matrix */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Prediction Accuracy (Confusion Matrix)</h3>
        {settled.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No settled trades</p>
        ) : (
          <div className="space-y-4">
            {/* Overall */}
            <div className="grid grid-cols-2 gap-2 max-w-xs">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
                <p className="text-xs text-emerald-400">True Positive</p>
                <p className="text-2xl font-bold text-emerald-400">{confusion.truePositive}</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                <p className="text-xs text-red-400">False Positive</p>
                <p className="text-2xl font-bold text-red-400">{confusion.falsePositive}</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                <p className="text-xs text-red-400">False Negative</p>
                <p className="text-2xl font-bold text-red-400">{confusion.falseNegative}</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
                <p className="text-xs text-emerald-400">True Negative</p>
                <p className="text-2xl font-bold text-emerald-400">{confusion.trueNegative}</p>
              </div>
            </div>

            {/* By Confidence Tier */}
            <div>
              <p className="text-xs text-gray-500 mb-2">By Confidence Tier</p>
              <div className="grid grid-cols-3 gap-3">
                {(["High", "Medium", "Low"] as const).map((tier) => {
                  const d = confusion.byConfidence[tier];
                  if (!d) return null;
                  const total = d.tp + d.fp + d.tn + d.fn;
                  const accuracy = total > 0 ? ((d.tp + d.tn) / total * 100).toFixed(0) : "—";
                  return (
                    <div key={tier} className="bg-gray-800/50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">{tier}</p>
                      <p className="text-lg font-bold text-white">{accuracy}%</p>
                      <p className="text-[10px] text-gray-600">{total} trades • TP:{d.tp} FP:{d.fp}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trade-by-Trade Breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300">Trade Breakdown</h3>
          <div className="flex gap-1">
            {(["pnl", "edgeScore", "holdTime"] as SortField[]).map((f) => (
              <button
                key={f}
                onClick={() => handleSort(f)}
                className={`flex items-center gap-0.5 px-2 py-1 rounded text-[10px] transition-colors ${
                  sortField === f ? "bg-cyan-500/20 text-cyan-400" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <ArrowUpDown className="w-2.5 h-2.5" />
                {f === "pnl" ? "P&L" : f === "edgeScore" ? "Edge" : "Duration"}
              </button>
            ))}
          </div>
        </div>

        {sortedTrades.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No settled trades yet</p>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {sortedTrades.map((t) => {
              const holdMs = t.settledAt && t.enteredAt
                ? new Date(t.settledAt).getTime() - new Date(t.enteredAt).getTime()
                : 0;
              const holdHours = holdMs / (1000 * 60 * 60);

              return (
                <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 text-xs border border-transparent hover:border-gray-700">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 truncate">{t.question}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-gray-600">
                      <span className="capitalize">{t.category || "other"}</span>
                      <span>{t.exitReason || "—"}</span>
                      <span>{holdHours.toFixed(1)}h</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 w-16">
                    <p className="text-gray-400">ES: {(t.edgeScore ?? 0).toFixed(3)}</p>
                    <p className="text-gray-500">{t.confidence}</p>
                  </div>
                  <div className="text-right flex-shrink-0 w-16">
                    {t.pnl !== null ? (
                      <p className={`font-mono font-bold ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                      </p>
                    ) : (
                      <p className="text-gray-600">—</p>
                    )}
                    {t.pnlPercent !== null && (
                      <p className={`text-[10px] ${(t.pnlPercent ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {(t.pnlPercent ?? 0) >= 0 ? "+" : ""}{t.pnlPercent?.toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
