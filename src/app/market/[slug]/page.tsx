"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import type { Market, MarketDataResponse, AnalysisResult, OpportunityScore as OpportunityScoreType } from "@/lib/types";
import { calculateOpportunityScore } from "@/lib/scoring";
import { formatCurrency, timeAgo, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PriceChart from "@/components/PriceChart";
import DepthChart from "@/components/DepthChart";
import OrderBookTable from "@/components/OrderBookTable";
import MetricsRow from "@/components/MetricsRow";
import SuperforecasterPanel from "@/components/SuperforecasterPanel";
import OpportunityScoreDisplay from "@/components/OpportunityScore";
import ResearchPanel from "@/components/ResearchPanel";
import {
  Loader2,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  RefreshCw,
  ExternalLink,
  Newspaper,
} from "lucide-react";

type Tab = "overview" | "orderbook" | "analysis" | "research";

export default function MarketDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [market, setMarket] = useState<Market | null>(null);
  const [marketData, setMarketData] = useState<MarketDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Fetch market info by ID
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/market", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: slug }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setMarket(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load market");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  // Fetch orderbook + price history when market loads
  useEffect(() => {
    if (!market?.tokens?.[0]?.token_id) return;
    fetchMarketData();
  }, [market]);

  const fetchMarketData = async () => {
    if (!market?.tokens?.[0]?.token_id) return;
    setLoadingData(true);
    try {
      const res = await fetch("/api/market-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId: market.tokens[0].token_id }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMarketData(json.data);
    } catch {
      // Silently fail — market data is supplementary
    } finally {
      setLoadingData(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400 mb-4">{error || "Market not found"}</p>
        <Link href="/" className="text-cyan-400 hover:text-cyan-300 underline text-sm">
          Back to markets
        </Link>
      </div>
    );
  }

  const isBinary = market.outcomes.length === 2 &&
    market.outcomes[0].toLowerCase() === "yes" &&
    market.outcomes[1].toLowerCase() === "no";
  const yesPrice = market.outcomePrices[0] || 0;
  const noPrice = market.outcomePrices[1] || 0;
  const yesPct = Math.round(yesPrice * 100);
  const noPct = Math.round(noPrice * 100);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "orderbook", label: "Order Book", icon: BookOpen },
    { id: "analysis", label: "AI Analysis", icon: Brain },
    { id: "research", label: "Research", icon: Newspaper },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-cyan-400 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to markets
      </Link>

      {/* Header */}
      <div className="flex gap-4 mb-6">
        {market.image && (
          <img src={market.image} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
        )}
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white mb-1">{market.question}</h1>
          {market.description && (
            <p className="text-sm text-gray-400 line-clamp-2 mb-2">{market.description}</p>
          )}
          <div className="flex items-center gap-3 text-sm">
            {market.category && <Badge variant="outline">{market.category}</Badge>}
            <span className="text-gray-500">Ends {formatDate(market.endDate)}</span>
            <a
              href={`https://polymarket.com/market/${market.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
            >
              Polymarket <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Price Display */}
      {isBinary ? (
        <div className="flex items-center gap-4 mb-6 p-4 bg-gray-900 rounded-xl border border-gray-800">
          <div className="flex-1">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-gray-500 mb-1">YES</p>
                <p className="text-3xl font-bold text-emerald-400">{yesPct}c</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">NO</p>
                <p className="text-3xl font-bold text-red-400">{noPct}c</p>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500 rounded-l-full transition-all" style={{ width: `${yesPct}%` }} />
              <div className="h-full bg-red-500 rounded-r-full transition-all" style={{ width: `${noPct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Yes {yesPct}%</span>
              <span>No {noPct}%</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Volume</p>
            <p className="text-lg font-semibold text-white">{formatCurrency(market.volume)}</p>
          </div>
        </div>
      ) : (
        <div className="mb-6 bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">{market.outcomes.length} Outcomes</p>
            <p className="text-xs text-gray-500">Volume: <span className="text-white font-semibold">{formatCurrency(market.volume)}</span></p>
          </div>
          <div className="space-y-2">
            {market.outcomes.map((outcome, i) => {
              const price = market.outcomePrices[i] || 0;
              const pct = Math.round(price * 100);
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-gray-300 w-32 truncate font-medium" title={outcome}>
                    {outcome}
                  </span>
                  <div className="flex-1 h-6 bg-gray-800 rounded-full overflow-hidden relative">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        backgroundColor: pct >= 50 ? "#10b981" : pct >= 20 ? "#06b6d4" : "#6b7280",
                      }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-white">
                      {pct}%
                    </span>
                  </div>
                  <span className="text-sm font-mono text-gray-400 w-12 text-right">{pct}c</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-800 pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? "text-cyan-400 border-b-2 border-cyan-400 bg-gray-900/50"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Metrics */}
          {marketData && (
            <MetricsRow
              volume={market.volume}
              volume24hr={market.volume24hr}
              endDate={market.endDate}
              metrics={marketData.metrics}
            />
          )}

          {/* Price History */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-300">Price History (YES)</h3>
              <Button variant="ghost" size="sm" onClick={fetchMarketData} disabled={loadingData}>
                <RefreshCw className={`w-3 h-3 mr-1 ${loadingData ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            {loadingData ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              </div>
            ) : (
              <PriceChart data={marketData?.priceHistory || []} />
            )}
          </div>
        </div>
      )}

      {activeTab === "orderbook" && (
        <div className="space-y-6">
          {loadingData ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          ) : marketData ? (
            <>
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Depth Chart</h3>
                <DepthChart
                  bids={marketData.orderbook.bids}
                  asks={marketData.orderbook.asks}
                />
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Order Book</h3>
                <OrderBookTable
                  bids={marketData.orderbook.bids}
                  asks={marketData.orderbook.asks}
                  spread={marketData.orderbook.spread}
                  midPrice={marketData.orderbook.midPrice}
                />
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-gray-500">
              Order book data unavailable for this market.
            </div>
          )}
        </div>
      )}

      {activeTab === "analysis" && (
        <div className="space-y-6">
          <SuperforecasterPanel
            market={market}
            liquidity={marketData?.metrics?.totalLiquidity || market.liquidity}
          />
        </div>
      )}

      {activeTab === "research" && (
        <div className="space-y-6">
          <ResearchPanel question={market.question} />
        </div>
      )}
    </div>
  );
}
