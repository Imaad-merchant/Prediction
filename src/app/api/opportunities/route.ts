import { NextResponse } from "next/server";

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

async function fetchAskPrice(
  tokenId: string,
  fallbackPrice: number
): Promise<number> {
  try {
    const res = await fetch(`${CLOB_API}/book?token_id=${tokenId}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return fallbackPrice;
    const book = await res.json();
    const asks = (book.asks || [])
      .map((a: Record<string, string>) => ({
        price: parseFloat(a.price),
        size: parseFloat(a.size),
      }))
      .sort((a: { price: number }, b: { price: number }) => a.price - b.price);
    return asks.length > 0 ? asks[0].price : fallbackPrice;
  } catch {
    return fallbackPrice;
  }
}

export const maxDuration = 30;

async function fetchGammaMarkets(
  sort: string,
  limit: number
): Promise<Record<string, unknown>[]> {
  try {
    const params = new URLSearchParams({
      closed: "false",
      active: "true",
      limit: String(limit),
      order: sort,
      ascending: "false",
    });
    const res = await fetch(`${GAMMA_API}/markets?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    // Fetch from multiple sort orders in parallel for wider coverage
    const [byVolume, byLiquidity] = await Promise.all([
      fetchGammaMarkets("volume", 60),
      fetchGammaMarkets("liquidity", 60),
    ]);

    // Merge and deduplicate
    const seen = new Set<string>();
    const allMarkets: Record<string, unknown>[] = [];
    for (const m of [...byVolume, ...byLiquidity]) {
      const id = String(m.id);
      if (seen.has(id)) continue;
      seen.add(id);
      allMarkets.push(m);
    }

    const now = Date.now();
    const maxHours = 168; // 7 days

    // Pre-filter candidates before any CLOB calls
    const candidates: Array<{
      market: Record<string, unknown>;
      side: "YES" | "NO";
      gammaProbability: number;
      tokenId: string;
      endDate: string;
      hoursLeft: number;
      volume: number;
      liquidity: number;
    }> = [];

    for (const m of allMarkets) {
      const endDate = (m.endDate || m.end_date_iso) as string;
      if (!endDate) continue;

      const endTime = new Date(endDate).getTime();
      const hoursLeft = (endTime - now) / (1000 * 60 * 60);
      if (hoursLeft <= 0 || hoursLeft > maxHours) continue;

      const outcomePrices =
        typeof m.outcomePrices === "string"
          ? JSON.parse(m.outcomePrices)
          : m.outcomePrices || [];
      const clobTokenIds =
        typeof m.clobTokenIds === "string"
          ? JSON.parse(m.clobTokenIds)
          : m.clobTokenIds || [];

      if (outcomePrices.length < 2 || clobTokenIds.length < 2) continue;

      const yesProb = Number(outcomePrices[0]);
      const noProb = Number(outcomePrices[1]);

      let side: "YES" | "NO";
      let gammaProbability: number;
      let tokenId: string;

      // Wide range: 0.70-0.995
      if (yesProb >= 0.70 && yesProb <= 0.995) {
        side = "YES";
        gammaProbability = yesProb;
        tokenId = clobTokenIds[0];
      } else if (noProb >= 0.70 && noProb <= 0.995) {
        side = "NO";
        gammaProbability = noProb;
        tokenId = clobTokenIds[1];
      } else {
        continue;
      }

      if (!tokenId) continue;

      const volume = Number(m.volume || 0);
      if (volume < 100) continue;

      candidates.push({
        market: m,
        side,
        gammaProbability,
        tokenId,
        endDate,
        hoursLeft,
        volume,
        liquidity: Number(m.liquidity || 0),
      });
    }

    // Sort candidates by probability (highest first) for best arb opportunities
    candidates.sort((a, b) => b.gammaProbability - a.gammaProbability);

    // Fetch CLOB prices in parallel (batches of 10)
    const opportunities = [];
    const batchSize = 10;

    for (let i = 0; i < Math.min(candidates.length, 40); i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      const prices = await Promise.allSettled(
        batch.map((c) => fetchAskPrice(c.tokenId, c.gammaProbability))
      );

      for (let j = 0; j < batch.length; j++) {
        const c = batch[j];
        const priceResult = prices[j];
        const realAskPrice =
          priceResult.status === "fulfilled" ? priceResult.value : c.gammaProbability;

        // Allow up to 0.998 — strategy layer decides profitability
        if (realAskPrice >= 0.998) continue;

        const profitPerShare = 1.0 - realAskPrice;
        const edge = profitPerShare / realAskPrice;

        let riskLevel: "Low" | "Medium" | "High";
        if (c.hoursLeft < 4 && profitPerShare > 0.03) riskLevel = "Low";
        else if (c.hoursLeft < 24 && profitPerShare > 0.02) riskLevel = "Medium";
        else riskLevel = "High";

        opportunities.push({
          id: String(c.market.id),
          question: String(c.market.question || ""),
          slug: String(c.market.slug || c.market.id),
          image: String(c.market.image || ""),
          endDate: c.endDate,
          gammaProbability: Math.round(c.gammaProbability * 100) / 100,
          realAskPrice: Math.round(realAskPrice * 1000) / 1000,
          profitPerShare: Math.round(profitPerShare * 1000) / 1000,
          edge: Math.round(edge * 1000) / 1000,
          volume: c.volume,
          liquidity: c.liquidity,
          hoursLeft: Math.round(c.hoursLeft * 10) / 10,
          side: c.side,
          tokenId: c.tokenId,
          riskLevel,
        });
      }
    }

    opportunities.sort((a, b) => b.profitPerShare - a.profitPerShare);

    return NextResponse.json({ data: opportunities.slice(0, 25) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to scan opportunities";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
