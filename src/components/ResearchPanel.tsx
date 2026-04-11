"use client";

import { useState } from "react";
import type { ResearchItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ExternalLink, Newspaper } from "lucide-react";

export default function ResearchPanel({ question }: { question: string }) {
  const [results, setResults] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runResearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResults(json.data || []);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setLoading(false);
    }
  };

  if (!searched && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Newspaper className="w-16 h-16 text-gray-700" />
        <h3 className="text-lg font-medium text-gray-400">News & Social Research</h3>
        <p className="text-sm text-gray-500 text-center max-w-md">
          Search Google News and Reddit for recent coverage related to this market.
          Uses the last30days multi-source research pattern.
        </p>
        <Button onClick={runResearch} size="lg">
          <Search className="w-4 h-4 mr-2" />
          Research This Market
        </Button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
        <p className="text-sm text-gray-400">Searching news sources and Reddit...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">
          {results.length} sources found
        </h3>
        <Button variant="outline" size="sm" onClick={runResearch} disabled={loading}>
          <Search className="w-3 h-3 mr-1" />
          Re-search
        </Button>
      </div>

      {results.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No recent coverage found for this market topic.
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((item, i) => (
            <a
              key={i}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block border border-gray-800 rounded-lg p-3 hover:bg-gray-800/50 hover:border-gray-700 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-200 line-clamp-2">
                    {item.title}
                  </h4>
                  {item.snippet !== item.title && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.snippet}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className="text-[10px]">{item.source}</Badge>
                    {item.publishedAt && (
                      <span className="text-[10px] text-gray-600">
                        {new Date(item.publishedAt).toLocaleDateString("en-US", {
                          month: "short", day: "numeric"
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-600 flex-shrink-0 mt-1" />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
