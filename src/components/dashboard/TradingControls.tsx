"use client";

import { useState } from "react";
import type { TradingConfig } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Play, RotateCcw, Loader2, Shield, Zap, Target } from "lucide-react";

interface TradingControlsProps {
  config: TradingConfig;
  onConfigUpdate: (config: Partial<TradingConfig>) => void;
  onRunAutoTrade: () => void;
  onReset: (bankroll: number, maxBet: number, dailyLimit: number) => void;
  autoTrading: boolean;
}

export default function TradingControls({
  config,
  onConfigUpdate,
  onRunAutoTrade,
  onReset,
  autoTrading,
}: TradingControlsProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [bankroll, setBankroll] = useState(String(config.bankroll));
  const [maxBet, setMaxBet] = useState(String(config.maxBetSize));
  const [dailyLimit, setDailyLimit] = useState(String(config.dailyLossLimit));
  const [strategy, setStrategy] = useState(config.strategy || "combined");
  const [maxPositions, setMaxPositions] = useState(String(config.maxPositions ?? 5));
  const [capitalSplit, setCapitalSplit] = useState(String((config.capitalSplitPercent ?? 0.2) * 100));
  const [stopLoss, setStopLoss] = useState(String(config.stopLossPercent ?? 15));
  const [slippageTolerance, setSlippageTolerance] = useState(String(config.slippageTolerancePercent ?? 5));
  const [minEdge, setMinEdge] = useState(String(config.minEdge ?? 3));

  const handleSave = () => {
    onConfigUpdate({
      bankroll: Number(bankroll) || 1000,
      maxBetSize: Number(maxBet) || 25,
      dailyLossLimit: Number(dailyLimit) || 100,
      strategy: strategy as TradingConfig["strategy"],
      maxPositions: Number(maxPositions) || 5,
      capitalSplitPercent: (Number(capitalSplit) || 20) / 100,
      stopLossPercent: Number(stopLoss) || 0,
      slippageTolerancePercent: Number(slippageTolerance) || 5,
      minEdge: Number(minEdge) || 3,
    });
    setShowSettings(false);
  };

  const handleReset = () => {
    if (confirm("Reset all trades and start fresh?")) {
      onReset(Number(bankroll) || 1000, Number(maxBet) || 25, Number(dailyLimit) || 100);
    }
  };

  const strategyLabel = {
    expiry_convergence: "Expiry",
    settlement_arbitrage: "Arb",
    combined: "Combined",
  }[config.strategy || "combined"];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Bankroll: <span className="text-white font-semibold">${config.bankroll}</span></span>
            <span className="text-gray-700">|</span>
            <span>Max Bet: <span className="text-white">${config.maxBetSize}</span></span>
            <span className="text-gray-700">|</span>
            <span>Positions: <span className="text-white">{config.maxPositions ?? 5}</span></span>
          </div>
          <Badge variant="outline" className="text-[10px]">Paper Mode</Badge>
          <Badge variant="outline" className="text-[10px] border-cyan-800 text-cyan-400">
            <Zap className="w-2.5 h-2.5 mr-0.5" />
            {strategyLabel}
          </Badge>
          {(config.stopLossPercent ?? 0) > 0 && (
            <Badge variant="outline" className="text-[10px] border-amber-800 text-amber-400">
              <Shield className="w-2.5 h-2.5 mr-0.5" />
              SL {config.stopLossPercent}%
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="w-3.5 h-3.5 mr-1" />
            Settings
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reset
          </Button>
          <Button
            onClick={onRunAutoTrade}
            disabled={autoTrading}
            className={autoTrading ? "bg-gray-700" : "bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"}
          >
            {autoTrading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1.5" />
                Run Auto-Trade
              </>
            )}
          </Button>
        </div>
      </div>

      {config.lastRunAt && (
        <p className="text-[10px] text-gray-600 mt-2">
          Last run: {new Date(config.lastRunAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </p>
      )}

      {showSettings && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          {/* Strategy Selector */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-2 block font-semibold">Strategy</label>
            <div className="flex gap-2">
              {(["combined", "expiry_convergence", "settlement_arbitrage"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStrategy(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    strategy === s
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                      : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {s === "combined" && <Zap className="w-3 h-3" />}
                    {s === "settlement_arbitrage" && <Target className="w-3 h-3" />}
                    {s === "expiry_convergence" && <Shield className="w-3 h-3" />}
                    {s === "combined" ? "Combined" : s === "settlement_arbitrage" ? "Settlement Arb" : "Expiry Convergence"}
                  </div>
                  <p className="text-[9px] text-gray-500 mt-0.5">
                    {s === "combined"
                      ? "Both strategies"
                      : s === "settlement_arbitrage"
                      ? "Buy 98.5c+ near close"
                      : "Buy high-prob markets"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Core Settings */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Bankroll ($)</label>
              <Input value={bankroll} onChange={(e) => setBankroll(e.target.value)} type="number" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Max Bet ($)</label>
              <Input value={maxBet} onChange={(e) => setMaxBet(e.target.value)} type="number" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Daily Loss Limit ($)</label>
              <Input value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} type="number" />
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Max Positions</label>
              <Input value={maxPositions} onChange={(e) => setMaxPositions(e.target.value)} type="number" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Capital Split (%)</label>
              <Input value={capitalSplit} onChange={(e) => setCapitalSplit(e.target.value)} type="number" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Stop-Loss (%)</label>
              <Input value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} type="number" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Slippage Tol (%)</label>
              <Input value={slippageTolerance} onChange={(e) => setSlippageTolerance(e.target.value)} type="number" />
            </div>
          </div>

          {/* Edge Settings */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Min Edge (pp)</label>
              <Input value={minEdge} onChange={(e) => setMinEdge(e.target.value)} type="number" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Taker Fee (%)</label>
              <Input value={String(config.takerFeePercent ?? 2)} disabled className="opacity-50" />
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave}>Save Settings</Button>
          </div>
        </div>
      )}
    </div>
  );
}
