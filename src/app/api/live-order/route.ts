import { NextResponse } from "next/server";
import { placeLiveOrder } from "@/lib/polymarket-clob";

export const maxDuration = 30;

/**
 * Place a single real Polymarket order. Requires LIVE_ENABLED=true env var
 * to prevent accidental activation. Requires a confirm token from the client.
 */
export async function POST(req: Request) {
  try {
    if (process.env.LIVE_ENABLED !== "true") {
      return NextResponse.json(
        {
          error:
            "LIVE_ENABLED is not set to 'true' in env vars. Refusing to place real orders.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { tokenId, side, price, size, confirm } = body;

    if (confirm !== "I UNDERSTAND THIS IS REAL MONEY") {
      return NextResponse.json(
        {
          error:
            "Missing confirmation token. Pass confirm='I UNDERSTAND THIS IS REAL MONEY' in the request body.",
        },
        { status: 400 }
      );
    }

    if (!tokenId || !side || price == null || !size) {
      return NextResponse.json(
        { error: "tokenId, side (BUY|SELL), price, size are all required" },
        { status: 400 }
      );
    }

    if (price <= 0 || price >= 1) {
      return NextResponse.json({ error: "price must be between 0 and 1" }, { status: 400 });
    }

    if (size <= 0 || size > 10000) {
      return NextResponse.json(
        { error: "size must be > 0 and <= 10000 (safety cap)" },
        { status: 400 }
      );
    }

    const result = await placeLiveOrder({
      tokenId: String(tokenId),
      side: side === "BUY" ? "BUY" : "SELL",
      price: Number(price),
      size: Number(size),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.errorMsg || "Order rejected", data: result }, { status: 400 });
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Order placement failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
