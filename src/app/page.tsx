"use client";

import { useState, useEffect, useCallback } from "react";
import type { Market } from "@/lib/types";
import MarketCard from "@/components/MarketCard";
import MarketSearch from "@/components/MarketSearch";
import { Loader2, TrendingUp } from "lucide-react";

export default function HomePage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState("volume");

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query || undefined,
          category: category !== "All" ? category.toLowerCase() : undefined,
          sortBy,
          limit: 30,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMarkets(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load markets");
    } finally {
      setLoading(false);
    }
  }, [query, category, sortBy]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  const handleSearch = () => fetchMarkets();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-bold text-white">Prediction Markets</h1>
        </div>
        <p className="text-gray-400 max-w-2xl">
          Browse live Polymarket prediction markets. Select any market for deep analysis with
          AI-powered Superforecaster probability estimates.
        </p>
      </div>

      {/* Search & Filters */}
      <MarketSearch
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onSearch={handleSearch}
      />

      {/* Markets Grid */}
      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-400 mb-2">{error}</p>
            <button
              onClick={fetchMarkets}
              className="text-sm text-cyan-400 hover:text-cyan-300 underline"
            >
              Try again
            </button>
          </div>
        ) : markets.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            No markets found. Try a different search or category.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {markets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
