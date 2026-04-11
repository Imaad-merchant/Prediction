import { NextResponse } from "next/server";

const CLOB_API = "https://clob.polymarket.com";

export const maxDuration = 15;

export async function POST(req: Request) {
  try {
    const { tokenIds } = await req.json();
    if (!Array.isArray(tokenIds) || tokenIds.length === 0) {
      return NextResponse.json({ data: {} });
    }

    // Fetch all prices in parallel
    const results = await Promise.allSettled(
      tokenIds.map(async (tokenId: string) => {
        const res = await fetch(`${CLOB_API}/price?token_id=${tokenId}&side=buy`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return { tokenId, price: null };
        const data = await res.json();
        return { tokenId, price: parseFloat(data.price) || null };
      })
    );

    const prices: Record<string, number | null> = {};
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        prices[r.value.tokenId] = r.value.price;
      }
    }

    return NextResponse.json({ data: prices });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch prices";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
