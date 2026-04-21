import { NextResponse } from "next/server";
import { getLiveBalance } from "@/lib/polymarket-clob";

export const maxDuration = 15;

export async function GET() {
  try {
    const balance = await getLiveBalance();
    return NextResponse.json({ data: balance });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Balance fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
