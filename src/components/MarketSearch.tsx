"use client";

import { Search, TrendingUp, Droplets, Clock, Timer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  { label: "All", slug: "" },
  { label: "Politics", slug: "politics" },
  { label: "Crypto", slug: "crypto" },
  { label: "Sports", slug: "sports" },
  { label: "Finance", slug: "finance" },
  { label: "Science", slug: "science" },
  { label: "Tech", slug: "tech" },
  { label: "Pop Culture", slug: "pop-culture" },
  { label: "Business", slug: "business" },
  { label: "World", slug: "world" },
];

const SORT_OPTIONS = [
  { value: "volume", label: "Volume", icon: TrendingUp },
  { value: "liquidity", label: "Liquidity", icon: Droplets },
  { value: "endDate", label: "Ending Soon", icon: Clock },
];

const TIME_FILTERS = [
  { label: "All", days: 0 },
  { label: "24h", days: 1 },
  { label: "3d", days: 3 },
  { label: "7d", days: 7 },
  { label: "18d", days: 18 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

interface MarketSearchProps {
  query: string;
  onQueryChange: (q: string) => void;
  category: string;
  onCategoryChange: (c: string) => void;
  sortBy: string;
  onSortChange: (s: string) => void;
  maxDays: number;
  onMaxDaysChange: (d: number) => void;
  onSearch: () => void;
}

export default function MarketSearch({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  sortBy,
  onSortChange,
  maxDays,
  onMaxDaysChange,
  onSearch,
}: MarketSearchProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search prediction markets..."
            className="pl-9"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
          />
        </div>
        <Button onClick={onSearch}>Search</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.slug}
            variant={category === cat.slug ? "default" : "outline"}
            size="sm"
            onClick={() => onCategoryChange(cat.slug)}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex gap-1.5 items-center">
          {SORT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <Button
                key={opt.value}
                variant={sortBy === opt.value ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onSortChange(opt.value)}
                className="text-xs"
              >
                <Icon className="w-3 h-3 mr-1" />
                {opt.label}
              </Button>
            );
          })}
        </div>

        <div className="h-4 w-px bg-gray-700" />

        <div className="flex gap-1 items-center">
          <Timer className="w-3 h-3 text-gray-500 mr-1" />
          {TIME_FILTERS.map((tf) => (
            <button
              key={tf.days}
              onClick={() => onMaxDaysChange(tf.days)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                maxDays === tf.days
                  ? "bg-cyan-600/20 text-cyan-400"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
