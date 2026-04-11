import { NextResponse } from "next/server";
import { fetchMarkets } from "@/lib/polymarket";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const markets = await fetchMarkets(body);
    return NextResponse.json({ data: markets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch markets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const markets = await fetchMarkets({ limit: 20, sortBy: "volume" });
    return NextResponse.json({ data: markets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch markets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
