/**
 * Polymarket CLOB client wrapper — handles real on-chain trading.
 *
 * SECURITY: This module ONLY runs server-side. The private key must be
 * stored in Vercel environment variables, never in client code or localStorage.
 *
 * Required env vars:
 *   POLYMARKET_PRIVATE_KEY   — 0x-prefixed EOA private key for a funded Polygon wallet
 *   POLYMARKET_API_KEY       — set after first /api/live-init call
 *   POLYMARKET_API_SECRET    — set after first /api/live-init call
 *   POLYMARKET_API_PASSPHRASE — set after first /api/live-init call
 */

import { ClobClient, Chain, AssetType, Side, OrderType } from "@polymarket/clob-client";
import { Wallet, TypedDataDomain, TypedDataField } from "ethers";

const CLOB_HOST = "https://clob.polymarket.com";
// EOA signature type per Polymarket docs (self-custodial wallet, not email/magic link)
const SIGNATURE_TYPE_EOA = 0;

/**
 * ClobClient expects an ethers v5-style signer with `_signTypedData` (underscore prefix).
 * ethers v6 renamed this to `signTypedData`. This adapter bridges the two.
 */
function makeClobSigner(privateKey: string) {
  const wallet = new Wallet(privateKey);
  return {
    _signTypedData: (
      domain: TypedDataDomain,
      types: Record<string, TypedDataField[]>,
      value: Record<string, unknown>
    ) => wallet.signTypedData(domain, types, value),
    getAddress: async () => wallet.address,
  };
}

export interface LiveTradeConfig {
  privateKey: string;
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;
}

export interface LiveOrderRequest {
  tokenId: string;
  side: "BUY" | "SELL";
  price: number; // 0..1
  size: number;  // number of conditional tokens
}

export interface LiveOrderResult {
  success: boolean;
  orderID?: string;
  status?: string;
  takingAmount?: string;
  makingAmount?: string;
  transactionsHashes?: string[];
  errorMsg?: string;
}

export interface LiveBalance {
  usdcBalance: number;
  usdcAllowance: number;
  walletAddress: string;
}

/** Read all Polymarket env vars. Throws if PRIVATE_KEY is missing. */
export function readLiveConfig(): LiveTradeConfig {
  const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
  if (!privateKey || !privateKey.startsWith("0x")) {
    throw new Error(
      "POLYMARKET_PRIVATE_KEY not configured. Set it in Vercel env vars before enabling live mode."
    );
  }
  return {
    privateKey,
    apiKey: process.env.POLYMARKET_API_KEY,
    apiSecret: process.env.POLYMARKET_API_SECRET,
    apiPassphrase: process.env.POLYMARKET_API_PASSPHRASE,
  };
}

/** Build a CLOB client. Two flavors: init-mode (no creds yet) and trading-mode (full creds). */
export function buildClobClient(config: LiveTradeConfig): ClobClient {
  const signer = makeClobSigner(config.privateKey);
  const funderAddress = new Wallet(config.privateKey).address;

  if (config.apiKey && config.apiSecret && config.apiPassphrase) {
    return new ClobClient(
      CLOB_HOST,
      Chain.POLYGON,
      signer,
      {
        key: config.apiKey,
        secret: config.apiSecret,
        passphrase: config.apiPassphrase,
      },
      SIGNATURE_TYPE_EOA,
      funderAddress
    );
  }

  // No creds yet — still usable for createOrDeriveApiKey
  return new ClobClient(
    CLOB_HOST,
    Chain.POLYGON,
    signer,
    undefined,
    SIGNATURE_TYPE_EOA,
    funderAddress
  );
}

/** Derive (or retrieve existing) L2 API creds from an EIP-712 signature. One-time setup. */
export async function deriveApiCredentials(): Promise<{
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
  walletAddress: string;
}> {
  const config = readLiveConfig();
  const client = buildClobClient({ privateKey: config.privateKey });
  const creds = await client.createOrDeriveApiKey();
  const wallet = new Wallet(config.privateKey);
  return {
    apiKey: creds.key,
    apiSecret: creds.secret,
    apiPassphrase: creds.passphrase,
    walletAddress: wallet.address,
  };
}

/** Fetch USDC collateral balance + Polymarket allowance. */
export async function getLiveBalance(): Promise<LiveBalance> {
  const config = readLiveConfig();
  if (!config.apiKey) {
    throw new Error("API credentials not set. Run /api/live-init first.");
  }
  const client = buildClobClient(config);
  const wallet = new Wallet(config.privateKey);
  const result = await client.getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
  // Polymarket returns USDC amounts in 6-decimal format
  return {
    usdcBalance: Number(result.balance) / 1e6,
    usdcAllowance: Number(result.allowance) / 1e6,
    walletAddress: wallet.address,
  };
}

/** Update on-chain allowance so Polymarket can spend your USDC / conditional tokens. */
export async function updateAllowances(): Promise<{ ok: boolean }> {
  const config = readLiveConfig();
  if (!config.apiKey) {
    throw new Error("API credentials not set. Run /api/live-init first.");
  }
  const client = buildClobClient(config);
  await client.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL });
  return { ok: true };
}

/** Place a single GTC (Good-Til-Cancelled) limit order. */
export async function placeLiveOrder(order: LiveOrderRequest): Promise<LiveOrderResult> {
  const config = readLiveConfig();
  if (!config.apiKey) {
    return { success: false, errorMsg: "API credentials not set. Run /api/live-init first." };
  }

  const client = buildClobClient(config);
  try {
    // Look up tick size + neg-risk flag (needed for correct order encoding)
    const [tickSizeRaw, negRisk] = await Promise.all([
      client.getTickSize(order.tokenId),
      client.getNegRisk(order.tokenId),
    ]);

    const response = await client.createAndPostOrder(
      {
        tokenID: order.tokenId,
        side: order.side === "BUY" ? Side.BUY : Side.SELL,
        price: order.price,
        size: order.size,
      },
      {
        tickSize: tickSizeRaw,
        negRisk: !!negRisk,
      },
      OrderType.GTC
    );

    return {
      success: !!response?.success || !!response?.orderID,
      orderID: response?.orderID,
      status: response?.status,
      takingAmount: response?.takingAmount,
      makingAmount: response?.makingAmount,
      transactionsHashes: response?.transactionsHashes,
      errorMsg: response?.errorMsg,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown order error";
    return { success: false, errorMsg: msg };
  }
}

/** Fetch currently-open limit orders on Polymarket. */
export async function getLiveOpenOrders() {
  const config = readLiveConfig();
  if (!config.apiKey) {
    throw new Error("API credentials not set.");
  }
  const client = buildClobClient(config);
  return client.getOpenOrders();
}

/** Fetch historical trades for the connected wallet. */
export async function getLiveTrades(limit = 50) {
  const config = readLiveConfig();
  if (!config.apiKey) {
    throw new Error("API credentials not set.");
  }
  const client = buildClobClient(config);
  const trades = await client.getTrades();
  return Array.isArray(trades) ? trades.slice(0, limit) : [];
}

/** Cancel an open order by ID. */
export async function cancelLiveOrder(orderID: string): Promise<{ canceled: boolean }> {
  const config = readLiveConfig();
  if (!config.apiKey) {
    throw new Error("API credentials not set.");
  }
  const client = buildClobClient(config);
  await client.cancelOrder({ orderID });
  return { canceled: true };
}
