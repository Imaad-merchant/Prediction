import { NextResponse } from "next/server";

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

// Fetch orderbook with timeout
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

export async function GET() {
  try {
    // Fetch active markets ending soon, sorted by volume
    const params = new URLSearchParams({
      closed: "false",
      active: "true",
      limit: "40",
      order: "volume",
      ascending: "false",
    });

    const res = await fetch(`${GAMMA_API}/markets?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Gamma API error: ${res.status}`);
    const markets = await res.json();

    const now = Date.now();
    const maxHours = 72;

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

    for (const m of markets) {
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

      if (yesProb >= 0.85 && yesProb <= 0.97) {
        side = "YES";
        gammaProbability = yesProb;
        tokenId = clobTokenIds[0];
      } else if (noProb >= 0.85 && noProb <= 0.97) {
        side = "NO";
        gammaProbability = noProb;
        tokenId = clobTokenIds[1];
      } else {
        continue;
      }

      if (!tokenId) continue;

      const volume = Number(m.volume || 0);
      if (volume < 500) continue;

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

    // Fetch CLOB prices in parallel (batches of 8)
    const opportunities = [];
    const batchSize = 8;

    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      const prices = await Promise.allSettled(
        batch.map((c) => fetchAskPrice(c.tokenId, c.gammaProbability))
      );

      for (let j = 0; j < batch.length; j++) {
        const c = batch[j];
        const priceResult = prices[j];
        const realAskPrice =
          priceResult.status === "fulfilled" ? priceResult.value : c.gammaProbability;

        if (realAskPrice >= 0.99) continue;

        const profitPerShare = 1.0 - realAskPrice;
        const edge = profitPerShare / realAskPrice;

        let riskLevel: "Low" | "Medium" | "High";
        if (c.hoursLeft < 4 && profitPerShare > 0.03) riskLevel = "Low";
        else if (c.hoursLeft < 24 && profitPerShare > 0.02) riskLevel = "Medium";
        else riskLevel = "High";

        opportunities.push({
          id: String((c.market as Record<string, unknown>).id),
          question: String((c.market as Record<string, unknown>).question || ""),
          slug: String(
            (c.market as Record<string, unknown>).slug ||
              (c.market as Record<string, unknown>).id
          ),
          image: String((c.market as Record<string, unknown>).image || ""),
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

    return NextResponse.json({ data: opportunities.slice(0, 20) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to scan opportunities";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
