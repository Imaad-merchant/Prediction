"use client";

import { useEffect, useState } from "react";
import type { BtcSignal } from "@/lib/types";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";

export default function BtcSignalWidget() {
  const [signal, setSignal] = useState<BtcSignal | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchSignal = async () => {
      try {
        const res = await fetch("/api/btc-signal?horizon=5");
        const json = await res.json();
        if (!cancelled) {
          if (json.error) setErr(json.error);
          else {
            setSignal(json.data);
            setErr(null);
          }
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "failed");
      }
    };
    fetchSignal();
    const id = setInterval(fetchSignal, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (err) {
    return (
      <div className="bg-gray-900 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">
        BTC signal error: {err}
      </div>
    );
  }

  if (!signal) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-500">
        Loading BTC signal…
      </div>
    );
  }

  const upProb = signal.predictedUpProbability * 100;
  const bias = upProb >= 55 ? "up" : upProb <= 45 ? "down" : "flat";
  const biasColor =
    bias === "up" ? "text-emerald-400" : bias === "down" ? "text-red-400" : "text-gray-400";
  const BiasIcon = bias === "up" ? TrendingUp : bias === "down" ? TrendingDown : Minus;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-gray-300">BTC Signal Engine</h3>
        </div>
        <span className="text-[10px] text-gray-500">Updates every 30s · 5min horizon</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        <div>
          <p className="text-[10px] text-gray-500 uppercase">BTC Price</p>
          <p className="text-white font-mono text-sm">${signal.currentPrice.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase">p(UP) Next 5min</p>
          <p className={`font-mono text-sm font-bold ${biasColor}`}>{upProb.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase">Momentum</p>
          <p className={`font-mono text-sm flex items-center gap-1 ${biasColor}`}>
            <BiasIcon className="w-3 h-3" />
            {signal.momentum}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase">RSI(14)</p>
          <p
            className={`font-mono text-sm ${
              signal.rsi14 < 30 ? "text-emerald-400" : signal.rsi14 > 70 ? "text-red-400" : "text-gray-300"
            }`}
          >
            {signal.rsi14.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase">Confidence</p>
          <p className="font-mono text-sm text-cyan-400">{(signal.confidence * 100).toFixed(0)}%</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-4 gap-2 text-[10px]">
        <div>
          <span className="text-gray-500">1m: </span>
          <span className={signal.priceChange1m >= 0 ? "text-emerald-400" : "text-red-400"}>
            {signal.priceChange1m >= 0 ? "+" : ""}
            {signal.priceChange1m.toFixed(3)}%
          </span>
        </div>
        <div>
          <span className="text-gray-500">5m: </span>
          <span className={signal.priceChange5m >= 0 ? "text-emerald-400" : "text-red-400"}>
            {signal.priceChange5m >= 0 ? "+" : ""}
            {signal.priceChange5m.toFixed(2)}%
          </span>
        </div>
        <div>
          <span className="text-gray-500">15m: </span>
          <span className={signal.priceChange15m >= 0 ? "text-emerald-400" : "text-red-400"}>
            {signal.priceChange15m >= 0 ? "+" : ""}
            {signal.priceChange15m.toFixed(2)}%
          </span>
        </div>
        <div>
          <span className="text-gray-500">1h: </span>
          <span className={signal.priceChange1h >= 0 ? "text-emerald-400" : "text-red-400"}>
            {signal.priceChange1h >= 0 ? "+" : ""}
            {signal.priceChange1h.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}
