import { NextResponse } from "next/server";

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

export async function GET() {
  try {
    // Fetch active markets ending soon, sorted by volume
    const params = new URLSearchParams({
      closed: "false",
      active: "true",
      limit: "100",
      order: "volume",
      ascending: "false",
    });

    const res = await fetch(`${GAMMA_API}/markets?${params}`);
    if (!res.ok) throw new Error(`Gamma API error: ${res.status}`);
    const markets = await res.json();

    const now = Date.now();
    const maxHours = 72;
    const opportunities = [];

    for (const m of markets) {
      try {
        const endDate = m.endDate || m.end_date_iso;
        if (!endDate) continue;

        const endTime = new Date(endDate).getTime();
        const hoursLeft = (endTime - now) / (1000 * 60 * 60);
        if (hoursLeft <= 0 || hoursLeft > maxHours) continue;

        const outcomePrices = typeof m.outcomePrices === "string"
          ? JSON.parse(m.outcomePrices)
          : m.outcomePrices || [];

        const clobTokenIds = typeof m.clobTokenIds === "string"
          ? JSON.parse(m.clobTokenIds)
          : m.clobTokenIds || [];

        if (outcomePrices.length < 2 || clobTokenIds.length < 2) continue;

        const yesProb = Number(outcomePrices[0]);
        const noProb = Number(outcomePrices[1]);

        // Find the high-certainty side
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

        // Walk the CLOB orderbook to get the real ask price
        let realAskPrice = gammaProbability;
        try {
          const bookRes = await fetch(`${CLOB_API}/book?token_id=${tokenId}`);
          if (bookRes.ok) {
            const book = await bookRes.json();
            const asks = (book.asks || [])
              .map((a: Record<string, string>) => ({ price: parseFloat(a.price), size: parseFloat(a.size) }))
              .sort((a: { price: number }, b: { price: number }) => a.price - b.price);

            if (asks.length > 0) {
              realAskPrice = asks[0].price;
            }
          }
        } catch {
          // Use gamma probability as fallback
        }

        // Skip if no profit margin (auto-trading-agent pattern: MAX_BUY_PRICE = 0.99)
        if (realAskPrice >= 0.99) continue;

        const profitPerShare = 1.0 - realAskPrice;
        const edge = profitPerShare / realAskPrice;
        const volume = Number(m.volume || 0);
        const liquidity = Number(m.liquidity || 0);

        // Minimum volume filter (pipeline pattern)
        if (volume < 500) continue;

        let riskLevel: "Low" | "Medium" | "High";
        if (hoursLeft < 4 && profitPerShare > 0.03) riskLevel = "Low";
        else if (hoursLeft < 24 && profitPerShare > 0.02) riskLevel = "Medium";
        else riskLevel = "High";

        opportunities.push({
          id: String(m.id),
          question: String(m.question || ""),
          slug: String(m.slug || m.id),
          image: String(m.image || ""),
          endDate: String(endDate),
          gammaProbability: Math.round(gammaProbability * 100) / 100,
          realAskPrice: Math.round(realAskPrice * 1000) / 1000,
          profitPerShare: Math.round(profitPerShare * 1000) / 1000,
          edge: Math.round(edge * 1000) / 1000,
          volume,
          liquidity,
          hoursLeft: Math.round(hoursLeft * 10) / 10,
          side,
          tokenId,
          riskLevel,
        });
      } catch {
        continue;
      }
    }

    // Sort by edge descending
    opportunities.sort((a, b) => b.profitPerShare - a.profitPerShare);

    return NextResponse.json({ data: opportunities.slice(0, 20) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to scan opportunities";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
