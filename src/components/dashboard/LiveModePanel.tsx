"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TradingConfig } from "@/lib/types";
import { ShieldAlert, Wallet, CheckCircle2, XCircle, Loader2, AlertTriangle, Key, Eye, EyeOff } from "lucide-react";

interface LiveBalanceData {
  usdcBalance: number;
  usdcAllowance: number;
  walletAddress: string;
}

interface LiveModePanelProps {
  config: TradingConfig;
  onModeChange: (mode: "paper" | "live") => void;
}

export default function LiveModePanel({ config, onModeChange }: LiveModePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [balance, setBalance] = useState<LiveBalanceData | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [initSecret, setInitSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [initResult, setInitResult] = useState<Record<string, string> | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);

  const isLive = config.mode === "live";

  const fetchBalance = useCallback(async () => {
    setLoadingBalance(true);
    setBalanceError(null);
    try {
      const res = await fetch("/api/live-balance");
      const json = await res.json();
      if (json.error) {
        setBalanceError(json.error);
        setBalance(null);
      } else {
        setBalance(json.data);
      }
    } catch (e) {
      setBalanceError(e instanceof Error ? e.message : "Failed to fetch balance");
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  useEffect(() => {
    if (expanded) fetchBalance();
  }, [expanded, fetchBalance]);

  const handleInit = async () => {
    if (!initSecret) {
      setInitError("Enter your INIT_SECRET");
      return;
    }
    setInitLoading(true);
    setInitError(null);
    setInitResult(null);
    try {
      const res = await fetch("/api/live-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: initSecret }),
      });
      const json = await res.json();
      if (json.error) {
        setInitError(json.error);
      } else {
        setInitResult(json.data);
        fetchBalance();
      }
    } catch (e) {
      setInitError(e instanceof Error ? e.message : "Init failed");
    } finally {
      setInitLoading(false);
    }
  };

  const handleSwitchToLive = async () => {
    const confirmed = confirm(
      "⚠️ You are about to switch to LIVE MODE.\n\n" +
        "This will place REAL orders on Polymarket using your wallet's USDC.\n" +
        "Paper trading will stop.\n\n" +
        "Confirm your balance is correct and you understand the risks. " +
        "Continue?"
    );
    if (!confirmed) return;

    const confirmText = prompt(
      "Type 'GO LIVE' to confirm switching to real-money trading:"
    );
    if (confirmText !== "GO LIVE") {
      alert("Confirmation text didn't match. Staying in paper mode.");
      return;
    }

    setSwitchingMode(true);
    onModeChange("live");
    setTimeout(() => setSwitchingMode(false), 500);
  };

  const handleSwitchToPaper = () => {
    if (confirm("Switch back to paper mode? Your live positions on Polymarket stay open but the auto-trader will stop placing new real orders.")) {
      onModeChange("paper");
    }
  };

  return (
    <div className={`rounded-xl border ${isLive ? "border-red-500/50 bg-red-500/5" : "border-gray-800 bg-gray-900"}`}>
      {/* Header row */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {isLive ? (
            <ShieldAlert className="w-5 h-5 text-red-400" />
          ) : (
            <Wallet className="w-5 h-5 text-gray-500" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">
                {isLive ? "LIVE MODE" : "Live Trading (Disabled)"}
              </span>
              {isLive ? (
                <Badge variant="outline" className="text-[9px] border-red-500/50 text-red-400 bg-red-500/10">
                  <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse mr-1" />
                  REAL MONEY
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[9px]">Paper</Badge>
              )}
            </div>
            <p className="text-[11px] text-gray-500">
              {isLive
                ? "Auto-trader is placing real Polymarket orders"
                : "Connect wallet to enable real trading"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-xs"
        >
          {expanded ? "Hide" : "Setup"}
        </Button>
      </div>

      {/* Expanded setup panel */}
      {expanded && (
        <div className="border-t border-gray-800 p-4 space-y-4">
          {/* Step 1: Balance check */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-300">Step 1 · Wallet & Balance</p>
              <Button variant="ghost" size="sm" onClick={fetchBalance} disabled={loadingBalance} className="text-[10px] h-6">
                {loadingBalance ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
              </Button>
            </div>
            {balance ? (
              <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Wallet:</span>
                  <span className="text-white font-mono">{balance.walletAddress.slice(0, 6)}...{balance.walletAddress.slice(-4)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">USDC Balance:</span>
                  <span className="text-emerald-400 font-mono font-bold">${balance.usdcBalance.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Polymarket Allowance:</span>
                  <span className={`font-mono ${balance.usdcAllowance >= balance.usdcBalance ? "text-emerald-400" : "text-amber-400"}`}>
                    ${balance.usdcAllowance.toFixed(2)}
                  </span>
                </div>
                {balance.usdcAllowance < balance.usdcBalance && (
                  <div className="flex items-center gap-1.5 pt-1.5 mt-1 border-t border-gray-700 text-amber-400">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    <span className="text-[10px]">
                      Allowance below balance. Approve Polymarket on polymarket.com first.
                    </span>
                  </div>
                )}
              </div>
            ) : balanceError ? (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{balanceError}</span>
              </div>
            ) : (
              <p className="text-[11px] text-gray-500">Click Refresh to check wallet.</p>
            )}
          </div>

          {/* Step 2: Initialize API creds */}
          <div>
            <p className="text-xs font-semibold text-gray-300 mb-2">Step 2 · Derive API Credentials (one-time)</p>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={initSecret}
                    onChange={(e) => setInitSecret(e.target.value)}
                    placeholder="INIT_SECRET (from your Vercel env vars)"
                    className="w-full px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <Button size="sm" onClick={handleInit} disabled={initLoading} className="text-xs">
                  {initLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Key className="w-3 h-3 mr-1" />Derive</>}
                </Button>
              </div>
              {initError && (
                <p className="text-[10px] text-red-400">{initError}</p>
              )}
              {initResult && (
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/30 text-[10px] font-mono space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-sans font-bold mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Credentials derived — copy into Vercel env vars:
                  </div>
                  <div><span className="text-gray-500">POLYMARKET_API_KEY=</span><span className="text-white">{initResult.POLYMARKET_API_KEY}</span></div>
                  <div><span className="text-gray-500">POLYMARKET_API_SECRET=</span><span className="text-white">{initResult.POLYMARKET_API_SECRET}</span></div>
                  <div><span className="text-gray-500">POLYMARKET_API_PASSPHRASE=</span><span className="text-white">{initResult.POLYMARKET_API_PASSPHRASE}</span></div>
                  <p className="text-[10px] text-amber-400 mt-2 font-sans">
                    ⚠️ Save these to Vercel now, then redeploy. You won't see them again after closing this page.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Switch mode */}
          <div>
            <p className="text-xs font-semibold text-gray-300 mb-2">Step 3 · Activate Live Trading</p>
            {isLive ? (
              <Button
                onClick={handleSwitchToPaper}
                disabled={switchingMode}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white text-xs"
              >
                Switch Back to Paper Mode
              </Button>
            ) : (
              <Button
                onClick={handleSwitchToLive}
                disabled={!balance || switchingMode}
                className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 text-xs"
              >
                <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                Enable Live Mode (Real Money)
              </Button>
            )}
            <p className="text-[10px] text-gray-500 mt-2">
              Requires LIVE_ENABLED=true in Vercel env vars. Auto-trader will place real Polymarket orders
              based on your strategy settings. Start with a small balance.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
