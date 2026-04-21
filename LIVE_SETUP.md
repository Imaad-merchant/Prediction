# PolyPredict Live Trading Setup

> ⚠️ **READ THIS ENTIRELY BEFORE PROCEEDING.** Live mode uses real money. The system can and will lose funds. Only enable after 30+ days of successful paper trading.

## Before you start

1. **Jurisdiction check** — Polymarket is geoblocked in the US due to CFTC enforcement. Check the terms for your country.
2. **Run paper mode for at least 30 days** — verify your realized P&L, drawdown, and win rate are actually profitable after fees and realistic slippage. If paper doesn't work, real money won't either.
3. **Start small** — your first live deposit should be **$100 max**, not your whole bankroll.

## Prerequisites

1. A fresh Polygon EOA wallet (create one in MetaMask; do **not** use your main wallet).
2. **USDC.e** (bridged USDC) on Polygon, not native USDC. You can:
   - Deposit via Polymarket's card onramp at https://polymarket.com
   - Bridge from Ethereum L1 with https://wallet.polygon.technology
3. A small amount of MATIC for gas on the wallet (~$2 worth is plenty).
4. **Approve Polymarket** to spend your USDC.e — the easiest way is to make one tiny trade manually on polymarket.com. That sets all the needed allowances (CTF Exchange, Neg Risk CTF Exchange, Neg Risk Adapter).

## Step 1 · Vercel environment variables

Add these in your Vercel project settings (**Production** environment):

| Variable | Value |
|---|---|
| `POLYMARKET_PRIVATE_KEY` | `0x...` — your Polygon wallet private key |
| `INIT_SECRET` | Any long random string you pick. Used to gate the credential-derivation endpoint. |
| `LIVE_ENABLED` | Leave **unset** for now. Only set to `true` after you've finished setup + tested. |

**Security notes:**
- Never commit these to Git.
- Never paste your private key into a chat or screenshot.
- Consider creating the wallet specifically for this bot — don't reuse your main wallet.
- Set up a Vercel-specific read-only token for this wallet if possible (use limited USDC balance).

Redeploy after setting env vars: `vercel --prod`

## Step 2 · Derive API credentials

Open your deployed dashboard → "Live Trading (Disabled)" panel → click **Setup**.

1. You'll see **Step 1 · Wallet & Balance**. Click **Refresh**. It should show your wallet address and USDC balance. If it errors, your `POLYMARKET_PRIVATE_KEY` is wrong or missing.
2. Go to **Step 2 · Derive API Credentials**. Paste your `INIT_SECRET` and click **Derive**.
3. Copy the three output values:
   - `POLYMARKET_API_KEY`
   - `POLYMARKET_API_SECRET`
   - `POLYMARKET_API_PASSPHRASE`
4. Add all three to Vercel env vars (Production).
5. Redeploy: `vercel --prod`.

## Step 3 · Verify (still paper)

After redeploying, hit the balance refresh again. The **Polymarket Allowance** line should match your balance. If it's lower, go to polymarket.com and make one $1 trade to set allowances, then refresh.

## Step 4 · Enable live orders

Only do this after steps 1-3 complete successfully.

1. In Vercel, set `LIVE_ENABLED=true`.
2. Redeploy: `vercel --prod`.
3. Open the dashboard → Live Mode Panel → **Enable Live Mode**. Confirm the prompts.
4. The mode toggle flips. **All future auto-trades will place real orders on Polymarket.**

## Turning it off

Click **Switch Back to Paper Mode** in the Live Mode Panel, or unset `LIVE_ENABLED` in Vercel and redeploy. Your open Polymarket positions stay open — the bot just stops placing new orders.

## How trades are placed

In live mode, every trade the bot decides to enter:

1. Calculates position size (quarter-Kelly, capped at 5% of portfolio)
2. Estimates slippage on the orderbook
3. Calls `/api/live-order` with `confirm="I UNDERSTAND THIS IS REAL MONEY"`
4. Polymarket CLOB signs the order with your wallet and submits it on-chain
5. On success, the position is recorded in localStorage the same way paper trades are

Exit logic (stop-loss, take-profit, time-exit) currently runs against the **paper store only**. To exit a live position, either:
- Wait for settlement at the resolution date (Polymarket auto-redeems winning tokens)
- Manually close via polymarket.com

**Important limitation:** The paper store's stop-loss firing does NOT cancel or close your live position. Live exits need separate integration (see Roadmap below).

## Limits & safeguards

- `size` cap per order: 10,000 shares
- `price` range: 0.02 to 0.999 (hard-coded)
- Only `GTC` (good-till-cancelled) limit orders — no market orders
- Auto-trade loop: 5 min between runs, 3 trades max per run
- Portfolio stop: no new entries if unrealized P&L drops below -15%

## Roadmap (not yet built)

These are NOT wired to live mode yet. To fully automate live trading:

- **Live exit execution** — when SL/TP/time-exit fires, place a SELL order on Polymarket via `/api/live-order` with side=SELL
- **Position reconciliation** — query on-chain balances via `ConditionalTokens` contract to verify actual holdings match the paper store
- **Redemption** — after a market resolves, call `redeemPositions` to convert winning conditional tokens to USDC
- **Fill monitoring** — poll `/api/live-positions` to detect partial fills and adjust the paper store

Until these are built, live mode will **only enter positions**. Exits have to be manual.

## Monitoring

- Dashboard's Active Positions component shows your paper positions with live prices
- `/api/live-balance` — current USDC balance + allowance
- `/api/live-positions` — open orders + recent trades from Polymarket
- Check `vercel logs` for server-side errors
