"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TradesStore } from "@/lib/types";
import { defaultTradesStore } from "@/lib/trading";
import PortfolioOverview from "@/components/dashboard/PortfolioOverview";
import EquityCurve from "@/components/dashboard/EquityCurve";
import TradeHistory from "@/components/dashboard/TradeHistory";
import ActivePositions from "@/components/dashboard/ActivePositions";
import TradingControls from "@/components/dashboard/TradingControls";
import LiveModePanel from "@/components/dashboard/LiveModePanel";
import BtcSignalWidget from "@/components/dashboard/BtcSignalWidget";
import { getBestWorstTrade } from "@/lib/trading";
import { Loader2, BarChart2, CheckCircle, AlertTriangle, RefreshCw, Trophy, Skull } from "lucide-react";

const STORAGE_KEY = "polypredict_trades_store";

function loadStore(): TradesStore {
  if (typeof window === "undefined") return defaultTradesStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultTradesStore();
}

function saveStore(store: TradesStore) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

interface Rejection {
  question: string;
  reason: string;
  edge?: number;
  edgeScore?: number;
}

interface AutoTradeResult {
  newTrades: number;
  settledTrades: number;
  stoppedTrades: number;
  tradesAnalyzed: number;
  opportunitiesFound: number;
  strategiesUsed?: { settlementArbitrage: number; expiryConvergence: number };
  rejections?: Rejection[];
}

const CONTINUOUS_STORAGE_KEY = "polypredict_continuous_mode";
const AUTO_TRADE_INTERVAL_MS = 5 * 60 * 1000; // 5 min between auto-trade runs

export default function DashboardPage() {
  const [store, setStore] = useState<TradesStore>(defaultTradesStore());
  const [loading, setLoading] = useState(true);
  const [autoTrading, setAutoTrading] = useState(false);
  const [lastResult, setLastResult] = useState<AutoTradeResult | null>(null);
  const [livePrices, setLivePrices] = useState<Record<string, number | null>>({});
  const [lastPriceUpdate, setLastPriceUpdate] = useState<string | null>(null);
  const [continuousMode, setContinuousMode] = useState(false);
  const [nextRunIn, setNextRunIn] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoTradeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAutoTradeRef = useRef<number>(0);
  const autoTradingRef = useRef(false);

  // Load from server store first, fall back to localStorage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/server-store", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.configured && json.data) {
          setStore(json.data);
          setLoading(false);
          return;
        }
      } catch {}
      if (!cancelled) {
        setStore(loadStore());
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Save to localStorage AND server (when configured) on every change
  useEffect(() => {
    if (loading) return;
    saveStore(store);
    fetch("/api/server-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store }),
    }).catch(() => {}); // graceful: server store may not be configured
  }, [store, loading]);

  // Fetch live prices + check exit conditions client-side (SL/TP/time-exit)
  const fetchLivePrices = useCallback(async () => {
    const openTrades = store.trades.filter((t) => t.status === "open");
    if (openTrades.length === 0) return;

    const tokenIds = [...new Set(openTrades.map((t) => t.tokenId))];
    try {
      const res = await fetch("/api/live-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenIds }),
      });
      const json = await res.json();
      if (!json.error && json.data) {
        const prices: Record<string, number | null> = json.data;
        setLivePrices(prices);
        setLastPriceUpdate(new Date().toLocaleTimeString());

        // Client-side exit check: trigger close for SL/TP/time-exit
        for (const t of openTrades) {
          const price = prices[t.tokenId];
          if (price == null) continue;
          const hoursLeft = (new Date(t.endDate).getTime() - Date.now()) / (1000 * 60 * 60);
          const slHit = t.stopLossPrice != null && price <= t.stopLossPrice;
          const tpHit = t.takeProfitPrice != null && price >= t.takeProfitPrice && hoursLeft >= store.config.timeExitHours;
          const timeExit = hoursLeft < store.config.timeExitHours && price > 0.85;
          if (slHit || tpHit || timeExit) {
            try {
              const closeRes = await fetch("/api/close-position", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ store, tradeId: t.id, currentPrice: price }),
              });
              const closeJson = await closeRes.json();
              if (!closeJson.error && closeJson.data?.store) setStore(closeJson.data.store);
            } catch {}
          }
        }
      }
    } catch {}
  }, [store]);

  // Auto-poll prices every 15 seconds
  useEffect(() => {
    fetchLivePrices();
    pollRef.current = setInterval(fetchLivePrices, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchLivePrices]);

  // Calculate live unrealized P&L
  const liveUnrealizedPnl = store.trades
    .filter((t) => t.status === "open")
    .reduce((sum, t) => {
      const currentPrice = livePrices[t.tokenId];
      if (currentPrice == null) return sum;
      const currentValue = currentPrice * t.shares;
      const cost = t.entryPrice * t.shares + t.entryFee;
      return sum + (currentValue - cost);
    }, 0);

  const liveTotalValue = store.portfolio.cashBalance +
    store.trades
      .filter((t) => t.status === "open")
      .reduce((sum, t) => {
        const price = livePrices[t.tokenId] ?? t.entryPrice;
        return sum + price * t.shares;
      }, 0);

  const handleConfigUpdate = (config: Record<string, unknown>) => {
    setStore((prev) => ({
      ...prev,
      config: { ...prev.config, ...config },
    }));
  };

  const handleReset = (bankroll: number, maxBet: number, dailyLimit: number) => {
    const fresh = defaultTradesStore();
    fresh.config.bankroll = bankroll;
    fresh.config.maxBetSize = maxBet;
    fresh.config.dailyLossLimit = dailyLimit;
    setStore(fresh);
    setLastResult(null);
    setLivePrices({});
  };

  const handleClosePosition = async (tradeId: string, currentPrice: number) => {
    try {
      const res = await fetch("/api/close-position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store, tradeId, currentPrice }),
      });
      const json = await res.json();
      if (!json.error && json.data?.store) {
        setStore(json.data.store);
      }
    } catch {}
  };

  const handleAutoTrade = useCallback(async () => {
    if (autoTradingRef.current) return; // prevent re-entry
    autoTradingRef.current = true;
    setAutoTrading(true);
    try {
      const res = await fetch("/api/auto-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store }),
      });
      const json = await res.json();
      if (!json.error && json.data) {
        if (json.data.store) setStore(json.data.store);
        setLastResult({
          newTrades: json.data.newTrades?.length || 0,
          settledTrades: json.data.settledTrades?.length || 0,
          stoppedTrades: json.data.stoppedTrades?.length || 0,
          tradesAnalyzed: json.data.tradesAnalyzed || 0,
          opportunitiesFound: json.data.opportunitiesFound || 0,
          strategiesUsed: json.data.strategiesUsed,
          rejections: json.data.rejections || [],
        });
        setTimeout(fetchLivePrices, 1000);
      }
    } catch {} finally {
      setAutoTrading(false);
      autoTradingRef.current = false;
      lastAutoTradeRef.current = Date.now();
    }
  }, [store, fetchLivePrices]);

  // Continuous mode: load persisted state
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(CONTINUOUS_STORAGE_KEY);
    if (saved === "true") setContinuousMode(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(CONTINUOUS_STORAGE_KEY, String(continuousMode));
  }, [continuousMode]);

  // Continuous auto-trade engine
  useEffect(() => {
    if (!continuousMode) {
      if (autoTradeTimerRef.current) clearInterval(autoTradeTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setNextRunIn(null);
      return;
    }

    // Fire first run immediately if enough time elapsed
    const runIfReady = () => {
      const elapsed = Date.now() - lastAutoTradeRef.current;
      if (elapsed >= AUTO_TRADE_INTERVAL_MS && !autoTradingRef.current) {
        handleAutoTrade();
      }
    };

    runIfReady();
    autoTradeTimerRef.current = setInterval(runIfReady, 10_000);

    countdownRef.current = setInterval(() => {
      const elapsed = Date.now() - lastAutoTradeRef.current;
      const remaining = Math.max(0, Math.ceil((AUTO_TRADE_INTERVAL_MS - elapsed) / 1000));
      setNextRunIn(remaining);
    }, 1000);

    return () => {
      if (autoTradeTimerRef.current) clearInterval(autoTradeTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [continuousMode, handleAutoTrade]);

  const handleToggleContinuous = () => {
    setContinuousMode((m) => !m);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const openCount = store.trades.filter((t) => t.status === "open").length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-7 h-7 text-cyan-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Trading Dashboard</h1>
            <p className="text-sm text-gray-500">Paper trading with AI-powered market analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastPriceUpdate && openCount > 0 && (
            <span className="text-[10px] text-gray-600">
              Prices: {lastPriceUpdate}
            </span>
          )}
          <button
            onClick={fetchLivePrices}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* Live Mode Panel */}
      <div className="mb-4">
        <LiveModePanel
          config={store.config}
          onModeChange={(mode) => handleConfigUpdate({ mode })}
        />
      </div>

      {/* Controls */}
      <div className="mb-6">
        <TradingControls
          config={store.config}
          onConfigUpdate={handleConfigUpdate}
          onRunAutoTrade={handleAutoTrade}
          onReset={handleReset}
          autoTrading={autoTrading}
          continuousMode={continuousMode}
          onToggleContinuous={handleToggleContinuous}
          nextRunIn={nextRunIn}
        />
      </div>

      {/* Last Run Result */}
      {lastResult && (
        <div className="mb-4 space-y-2">
          <div className="p-3 rounded-lg border border-gray-800 bg-gray-900/50 flex items-center gap-3 text-sm">
            <CheckCircle className={`w-4 h-4 flex-shrink-0 ${lastResult.newTrades > 0 ? "text-emerald-400" : "text-amber-400"}`} />
            <span className="text-gray-300">
              Scanned {lastResult.opportunitiesFound} opportunities, analyzed {lastResult.tradesAnalyzed},
              placed <span className={lastResult.newTrades > 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>{lastResult.newTrades}</span> new trade{lastResult.newTrades !== 1 ? "s" : ""}.
              {lastResult.settledTrades > 0 && ` Settled ${lastResult.settledTrades} position${lastResult.settledTrades !== 1 ? "s" : ""}.`}
              {lastResult.stoppedTrades > 0 && ` Stopped out ${lastResult.stoppedTrades} position${lastResult.stoppedTrades !== 1 ? "s" : ""}.`}
              {lastResult.strategiesUsed && (
                <span className="text-gray-500 ml-1">
                  (Arb: {lastResult.strategiesUsed.settlementArbitrage}, Expiry: {lastResult.strategiesUsed.expiryConvergence})
                </span>
              )}
            </span>
          </div>

          {/* Rejection reasons */}
          {lastResult.rejections && lastResult.rejections.length > 0 && (
            <details className="group">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 transition-colors pl-1">
                {lastResult.rejections.length} trade{lastResult.rejections.length !== 1 ? "s" : ""} rejected — click to see why
              </summary>
              <div className="mt-1.5 space-y-1">
                {lastResult.rejections.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-gray-800/30 border border-gray-800 text-xs">
                    <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-gray-400 truncate">{r.question}</p>
                      <p className="text-gray-500">
                        {r.reason}
                        {r.edge != null && <span className="ml-2 text-gray-600">Edge: {r.edge.toFixed(1)}pp</span>}
                        {r.edgeScore != null && <span className="ml-1 text-gray-600">Score: {r.edgeScore.toFixed(3)}</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Best/Worst Trade Bar */}
      {store.trades.filter((t) => t.pnl !== null).length > 0 && (() => {
        const { best, worst } = getBestWorstTrade(store.trades);
        return (
          <div className="mb-4 grid grid-cols-2 gap-3">
            {best && best.pnl !== null && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-800 bg-gray-900/50">
                <Trophy className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-500">Best Trade</p>
                  <p className="text-xs text-gray-300 truncate">{best.question}</p>
                </div>
                <span className="text-sm font-mono font-bold text-emerald-400 ml-auto flex-shrink-0">
                  +${best.pnl.toFixed(2)}
                </span>
              </div>
            )}
            {worst && worst.pnl !== null && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-800 bg-gray-900/50">
                <Skull className="w-4 h-4 text-red-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-500">Worst Trade</p>
                  <p className="text-xs text-gray-300 truncate">{worst.question}</p>
                </div>
                <span className="text-sm font-mono font-bold text-red-400 ml-auto flex-shrink-0">
                  ${worst.pnl.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* BTC Signal Widget — shown when BTC filter is active */}
      {store.config.marketFilter === "btc_hourly" && (
        <div className="mb-4">
          <BtcSignalWidget />
        </div>
      )}

      {/* Portfolio Overview — with live data */}
      <div className="mb-6">
        <PortfolioOverview
          portfolio={{
            ...store.portfolio,
            unrealizedPnl: Math.round(liveUnrealizedPnl * 100) / 100,
            totalValue: Math.round(liveTotalValue * 100) / 100,
          }}
          config={store.config}
        />
      </div>

      {/* Equity Curve */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Equity Curve</h3>
        <EquityCurve data={store.portfolio.equityCurve} bankroll={store.config.bankroll} />
      </div>

      {/* Active Positions — with live prices */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300">Active Positions</h3>
          {openCount > 0 && lastPriceUpdate && (
            <span className="text-[10px] text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <ActivePositions trades={store.trades} livePrices={livePrices} takerFeePercent={store.config.takerFeePercent} onClose={handleClosePosition} />
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
          and AI analysis. Prices update every 30 seconds from Polymarket CLOB.
        </p>
      </div>
    </div>
  );
}
