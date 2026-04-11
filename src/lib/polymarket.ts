import type { Market, MarketToken } from "./types";

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

export async function fetchMarkets(params: {
  query?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  category?: string;
}): Promise<Market[]> {
  const { query, limit = 20, offset = 0, sortBy = "volume", category } = params;

  const searchParams = new URLSearchParams({
    closed: "false",
    active: "true",
    limit: String(limit),
    offset: String(offset),
    order: sortBy === "endDate" ? "end_date_iso" : sortBy,
    ascending: sortBy === "endDate" ? "true" : "false",
  });

  if (query) searchParams.set("_q", query);
  if (category) searchParams.set("tag", category);

  const res = await fetch(`${GAMMA_API}/markets?${searchParams}`);
  if (!res.ok) throw new Error(`Gamma API error: ${res.status}`);

  const raw = await res.json();

  return raw.map((m: Record<string, unknown>) => normalizeMarket(m)).filter(Boolean) as Market[];
}

function normalizeMarket(m: Record<string, unknown>): Market | null {
  try {
    const outcomePrices = typeof m.outcomePrices === "string"
      ? JSON.parse(m.outcomePrices as string)
      : m.outcomePrices || [0.5, 0.5];

    const outcomes = typeof m.outcomes === "string"
      ? JSON.parse(m.outcomes as string)
      : m.outcomes || ["Yes", "No"];

    const clobTokenIds = typeof m.clobTokenIds === "string"
      ? JSON.parse(m.clobTokenIds as string)
      : m.clobTokenIds || [];

    const tokens: MarketToken[] = outcomes.map((outcome: string, i: number) => ({
      token_id: clobTokenIds[i] || "",
      outcome,
      price: Number(outcomePrices[i]) || 0,
    }));

    return {
      id: String(m.id || ""),
      question: String(m.question || ""),
      slug: String(m.slug || m.id || ""),
      description: String(m.description || ""),
      outcomes,
      outcomePrices: outcomePrices.map(Number),
      volume: Number(m.volume || 0),
      volume24hr: Number(m.volume24hr || 0),
      liquidity: Number(m.liquidity || 0),
      endDate: String(m.endDate || m.end_date_iso || ""),
      image: String(m.image || ""),
      active: Boolean(m.active),
      closed: Boolean(m.closed),
      conditionId: String(m.conditionId || ""),
      tokens,
      category: String((m.tags as string[])?.[0] || m.category || ""),
    };
  } catch {
    return null;
  }
}

export async function fetchOrderBook(tokenId: string) {
  const res = await fetch(`${CLOB_API}/book?token_id=${tokenId}`);
  if (!res.ok) throw new Error(`CLOB API error: ${res.status}`);
  return res.json();
}

export async function fetchPriceHistory(tokenId: string, fidelity: number = 60) {
  const res = await fetch(
    `${CLOB_API}/prices-history?market=${tokenId}&interval=all&fidelity=${fidelity}`
  );
  if (!res.ok) throw new Error(`CLOB price history error: ${res.status}`);
  return res.json();
}
