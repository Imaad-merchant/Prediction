import { NextResponse } from "next/server";
import { deriveApiCredentials } from "@/lib/polymarket-clob";

export const maxDuration = 30;

/**
 * One-time setup: derives L2 API creds by signing an EIP-712 message with
 * the wallet private key, then returns them so the user can save them as
 * Vercel env vars.
 *
 * SECURITY: requires an INIT_SECRET env var to prevent random callers.
 */
export async function POST(req: Request) {
  try {
    const { secret } = await req.json().catch(() => ({}));
    const expectedSecret = process.env.INIT_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json(
        { error: "Forbidden. Set INIT_SECRET in Vercel env vars and pass it in the request body." },
        { status: 403 }
      );
    }

    const creds = await deriveApiCredentials();
    return NextResponse.json({
      data: {
        walletAddress: creds.walletAddress,
        // Echo back so the user can copy them into Vercel env vars
        POLYMARKET_API_KEY: creds.apiKey,
        POLYMARKET_API_SECRET: creds.apiSecret,
        POLYMARKET_API_PASSPHRASE: creds.apiPassphrase,
        instructions:
          "Copy these values into your Vercel env vars, then redeploy. " +
          "Do NOT share these values with anyone.",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Init failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
