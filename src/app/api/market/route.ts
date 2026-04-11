import { NextResponse } from "next/server";
import { fetchMarketById } from "@/lib/polymarket";

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const market = await fetchMarketById(id);
    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    return NextResponse.json({ data: market });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch market";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
