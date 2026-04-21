import { NextResponse } from "next/server";
import { computeBtcSignal } from "@/lib/btc-signal";

export const maxDuration = 15;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const horizon = Number(url.searchParams.get("horizon") || "5"); // default 5 min
    const signal = await computeBtcSignal(Math.max(1, Math.min(horizon, 60)));
    return NextResponse.json({ data: signal });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "BTC signal failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { horizonMinutes } = await req.json().catch(() => ({}));
    const horizon = Number(horizonMinutes || 5);
    const signal = await computeBtcSignal(Math.max(1, Math.min(horizon, 60)));
    return NextResponse.json({ data: signal });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "BTC signal failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
