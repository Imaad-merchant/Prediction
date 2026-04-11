"use client";

import { useState } from "react";
import type { TradingConfig } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Play, RotateCcw, Loader2 } from "lucide-react";

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

  const handleSave = () => {
    onConfigUpdate({
      bankroll: Number(bankroll) || 1000,
      maxBetSize: Number(maxBet) || 25,
      dailyLossLimit: Number(dailyLimit) || 100,
    });
    setShowSettings(false);
  };

  const handleReset = () => {
    if (confirm("Reset all trades and start fresh?")) {
      onReset(Number(bankroll) || 1000, Number(maxBet) || 25, Number(dailyLimit) || 100);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Bankroll: <span className="text-white font-semibold">${config.bankroll}</span></span>
            <span className="text-gray-700">|</span>
            <span>Max Bet: <span className="text-white">${config.maxBetSize}</span></span>
            <span className="text-gray-700">|</span>
            <span>Daily Limit: <span className="text-white">${config.dailyLossLimit}</span></span>
          </div>
          <Badge variant="outline" className="text-[10px]">Paper Mode</Badge>
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
        <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-3 gap-3">
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
          <div className="col-span-3 flex justify-end">
            <Button size="sm" onClick={handleSave}>Save Settings</Button>
          </div>
        </div>
      )}
    </div>
  );
}
