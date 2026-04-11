"use client";

import type { PortfolioState, TradingConfig } from "@/lib/types";
import { DollarSign, TrendingUp, Target, BarChart3, TrendingDown, ShieldAlert } from "lucide-react";

interface PortfolioOverviewProps {
  portfolio: PortfolioState;
  config: TradingConfig;
}

export default function PortfolioOverview({ portfolio, config }: PortfolioOverviewProps) {
  const totalReturn = ((portfolio.totalValue - config.bankroll) / config.bankroll) * 100;
  const totalPnl = portfolio.realizedPnl + portfolio.unrealizedPnl;

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
      label: "Total P&L",
      value: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`,
      sub: `Realized: $${portfolio.realizedPnl.toFixed(2)}`,
      subColor: "text-gray-500",
      icon: TrendingUp,
      iconColor: totalPnl >= 0 ? "text-emerald-400" : "text-red-400",
      valueColor: totalPnl >= 0 ? "text-emerald-400" : "text-red-400",
    },
    {
      label: "Win Rate",
      value: `${portfolio.winRate}%`,
      sub: `${portfolio.winningTrades}W / ${portfolio.losingTrades}L`,
      subColor: "text-gray-500",
      icon: Target,
      iconColor: portfolio.winRate >= 60 ? "text-emerald-400" : portfolio.winRate >= 40 ? "text-amber-400" : "text-red-400",
    },
    {
      label: "Trades",
      value: `${portfolio.totalTrades}`,
      sub: `${portfolio.totalTrades - portfolio.winningTrades - portfolio.losingTrades} open`,
      subColor: "text-gray-500",
      icon: BarChart3,
      iconColor: "text-purple-400",
    },
    {
      label: "Max Drawdown",
      value: `${portfolio.maxDrawdown.toFixed(1)}%`,
      sub: `Cash: $${portfolio.cashBalance.toFixed(2)}`,
      subColor: "text-gray-500",
      icon: portfolio.maxDrawdown > 10 ? ShieldAlert : TrendingDown,
      iconColor: portfolio.maxDrawdown > 10 ? "text-red-400" : portfolio.maxDrawdown > 5 ? "text-amber-400" : "text-gray-500",
    },
  ];

  return (
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
  );
}
