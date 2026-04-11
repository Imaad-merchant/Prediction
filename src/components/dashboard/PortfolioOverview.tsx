"use client";

import type { PortfolioState, TradingConfig } from "@/lib/types";
import { DollarSign, TrendingUp, Target, BarChart3, TrendingDown, ShieldAlert, Wallet, PieChart } from "lucide-react";

interface PortfolioOverviewProps {
  portfolio: PortfolioState;
  config: TradingConfig;
}

export default function PortfolioOverview({ portfolio, config }: PortfolioOverviewProps) {
  const totalReturn = ((portfolio.totalValue - config.bankroll) / config.bankroll) * 100;
  const totalPnl = portfolio.realizedPnl + portfolio.unrealizedPnl;
  const invested = portfolio.totalValue - portfolio.cashBalance;
  const investedPercent = portfolio.totalValue > 0 ? (invested / portfolio.totalValue) * 100 : 0;
  const openCount = portfolio.totalTrades - portfolio.winningTrades - portfolio.losingTrades;

  const cards = [
    {
      label: "Portfolio Value",
      value: `$${portfolio.totalValue.toFixed(2)}`,
      sub: `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(1)}% return`,
      subColor: totalReturn >= 0 ? "text-emerald-400" : "text-red-400",
      icon: DollarSign,
      iconColor: "text-cyan-400",
    },
    {
      label: "Capital Deployed",
      value: `$${invested.toFixed(2)}`,
      sub: `${investedPercent.toFixed(0)}% deployed · $${portfolio.cashBalance.toFixed(2)} cash`,
      subColor: investedPercent > 80 ? "text-amber-400" : "text-gray-500",
      icon: PieChart,
      iconColor: invested > 0 ? "text-cyan-400" : "text-gray-600",
    },
    {
      label: "Total P&L",
      value: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`,
      sub: `Realized: ${portfolio.realizedPnl >= 0 ? "+" : ""}$${portfolio.realizedPnl.toFixed(2)} · Unrealized: ${portfolio.unrealizedPnl >= 0 ? "+" : ""}$${portfolio.unrealizedPnl.toFixed(2)}`,
      subColor: "text-gray-500",
      icon: TrendingUp,
      iconColor: totalPnl >= 0 ? "text-emerald-400" : "text-red-400",
      valueColor: totalPnl >= 0 ? "text-emerald-400" : "text-red-400",
    },
    {
      label: "Win Rate",
      value: `${portfolio.winRate}%`,
      sub: `${portfolio.winningTrades}W / ${portfolio.losingTrades}L · ${openCount} open`,
      subColor: "text-gray-500",
      icon: Target,
      iconColor: portfolio.winRate >= 60 ? "text-emerald-400" : portfolio.winRate >= 40 ? "text-amber-400" : "text-red-400",
    },
    {
      label: "Max Drawdown",
      value: `${portfolio.maxDrawdown.toFixed(1)}%`,
      sub: `${portfolio.totalTrades} total trades`,
      subColor: "text-gray-500",
      icon: portfolio.maxDrawdown > 10 ? ShieldAlert : TrendingDown,
      iconColor: portfolio.maxDrawdown > 10 ? "text-red-400" : portfolio.maxDrawdown > 5 ? "text-amber-400" : "text-gray-500",
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">{card.label}</span>
                <Icon className={`w-4 h-4 ${card.iconColor}`} />
              </div>
              <p className={`text-xl font-bold ${card.valueColor || "text-white"}`}>{card.value}</p>
              <p className={`text-xs mt-1 ${card.subColor}`}>{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Capital allocation bar */}
      {portfolio.totalValue > 0 && (
        <div className="mt-3 bg-gray-900 border border-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span className="flex items-center gap-1"><Wallet className="w-3 h-3" /> Capital Allocation</span>
            <span>${portfolio.totalValue.toFixed(2)} total</span>
          </div>
          <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-cyan-500 transition-all duration-500"
              style={{ width: `${investedPercent}%` }}
            />
            <div
              className="h-full bg-gray-600 transition-all duration-500"
              style={{ width: `${100 - investedPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] mt-1">
            <span className="text-cyan-400">{investedPercent.toFixed(0)}% invested (${invested.toFixed(2)})</span>
            <span className="text-gray-500">{(100 - investedPercent).toFixed(0)}% cash (${portfolio.cashBalance.toFixed(2)})</span>
          </div>
        </div>
      )}
    </div>
  );
}
