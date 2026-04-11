"use client";

import { Search, TrendingUp, Droplets, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  "All",
  "Politics",
  "Crypto",
  "Sports",
  "Science",
  "Finance",
  "Tech",
  "Culture",
];

const SORT_OPTIONS = [
  { value: "volume", label: "Volume", icon: TrendingUp },
  { value: "liquidity", label: "Liquidity", icon: Droplets },
  { value: "endDate", label: "Ending Soon", icon: Clock },
];

interface MarketSearchProps {
  query: string;
  onQueryChange: (q: string) => void;
  category: string;
  onCategoryChange: (c: string) => void;
  sortBy: string;
  onSortChange: (s: string) => void;
  onSearch: () => void;
}

export default function MarketSearch({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  sortBy,
  onSortChange,
  onSearch,
}: MarketSearchProps) {
  return (
    <div className="space-y-4">
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
            key={cat}
            variant={category === cat ? "default" : "outline"}
            size="sm"
            onClick={() => onCategoryChange(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      <div className="flex gap-2">
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
    </div>
  );
}
