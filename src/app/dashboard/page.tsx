"use client";

import { useState, useEffect, useCallback } from "react";
import type { TradesStore } from "@/lib/types";
import { defaultTradesStore } from "@/lib/trading";
import PortfolioOverview from "@/components/dashboard/PortfolioOverview";
import EquityCurve from "@/components/dashboard/EquityCurve";
import TradeHistory from "@/components/dashboard/TradeHistory";
import ActivePositions from "@/components/dashboard/ActivePositions";
import TradingControls from "@/components/dashboard/TradingControls";
import { Loader2, BarChart2, CheckCircle, AlertTriangle } from "lucide-react";

interface AutoTradeResult {
  newTrades: number;
  settledTrades: number;
  tradesAnalyzed: number;
  opportunitiesFound: number;
}

export default function DashboardPage() {
  const [store, setStore] = useState<TradesStore>(defaultTradesStore());
  const [loading, setLoading] = useState(true);
  const [autoTrading, setAutoTrading] = useState(false);
  const [lastResult, setLastResult] = useState<AutoTradeResult | null>(null);

  const fetchStore = useCallback(async () => {
    try {
      const res = await fetch("/api/trades");
      const json = await res.json();
      if (!json.error) setStore(json.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  const handleConfigUpdate = async (config: Record<string, unknown>) => {
    await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "config", config }),
    });
    fetchStore();
  };

  const handleReset = async (bankroll: number, maxBet: number, dailyLimit: number) => {
    await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "reset", bankroll, maxBetSize: maxBet, dailyLossLimit: dailyLimit }),
    });
    setLastResult(null);
    fetchStore();
  };

  const handleAutoTrade = async () => {
    setAutoTrading(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/auto-trade", { method: "POST" });
      const json = await res.json();
      if (!json.error) {
        setLastResult({
          newTrades: json.data.newTrades?.length || 0,
          settledTrades: json.data.settledTrades?.length || 0,
          tradesAnalyzed: json.data.tradesAnalyzed || 0,
          opportunitiesFound: json.data.opportunitiesFound || 0,
        });
      }
      fetchStore();
    } catch {} finally {
      setAutoTrading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BarChart2 className="w-7 h-7 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Trading Dashboard</h1>
          <p className="text-sm text-gray-500">Paper trading with AI-powered market analysis</p>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6">
        <TradingControls
          config={store.config}
          onConfigUpdate={handleConfigUpdate}
          onRunAutoTrade={handleAutoTrade}
          onReset={handleReset}
          autoTrading={autoTrading}
        />
      </div>

      {/* Last Run Result */}
      {lastResult && (
        <div className="mb-4 p-3 rounded-lg border border-gray-800 bg-gray-900/50 flex items-center gap-3 text-sm">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-gray-300">
            Scanned {lastResult.opportunitiesFound} opportunities, analyzed {lastResult.tradesAnalyzed},
            placed {lastResult.newTrades} new trade{lastResult.newTrades !== 1 ? "s" : ""}.
            {lastResult.settledTrades > 0 && ` Settled ${lastResult.settledTrades} position${lastResult.settledTrades !== 1 ? "s" : ""}.`}
          </span>
        </div>
      )}

      {/* Portfolio Overview */}
      <div className="mb-6">
        <PortfolioOverview portfolio={store.portfolio} config={store.config} />
      </div>

      {/* Equity Curve */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Equity Curve</h3>
        <EquityCurve data={store.portfolio.equityCurve} bankroll={store.config.bankroll} />
      </div>

      {/* Active Positions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Active Positions</h3>
        <ActivePositions trades={store.trades} />
      </div>

      {/* Trade History */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Trade History</h3>
        <TradeHistory trades={store.trades} />
      </div>

      {/* Disclaimer */}
      <div className="mt-6 flex items-start gap-2 text-xs text-gray-600">
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <p>
          Paper trading mode. No real money is being used. Trades are simulated using real market data
          and AI analysis. Settlement assumes high-probability outcomes resolve as expected.
        </p>
      </div>
    </div>
  );
}
