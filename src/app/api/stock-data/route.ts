import { NextResponse } from "next/server";

interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function computeIndicators(candles: Candle[]) {
  if (candles.length < 2) return { candles, indicators: {} };

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);

  // SMA
  const sma = (data: number[], period: number) => {
    const result: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { result.push(null); continue; }
      const slice = data.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
    return result;
  };

  // EMA
  const ema = (data: number[], period: number) => {
    const result: (number | null)[] = [];
    const k = 2 / (period + 1);
    let prev: number | null = null;
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { result.push(null); continue; }
      if (prev === null) {
        prev = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
      } else {
        prev = data[i] * k + prev * (1 - k);
      }
      result.push(prev);
    }
    return result;
  };

  // RSI
  const rsi = (data: number[], period: number = 14) => {
    const result: (number | null)[] = [null];
    const gains: number[] = [];
    const losses: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
      if (i < period) { result.push(null); continue; }
      const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      if (avgLoss === 0) { result.push(100); continue; }
      const rs = avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
    return result;
  };

  // VWAP (cumulative)
  const vwap = () => {
    const result: number[] = [];
    let cumVP = 0;
    let cumVol = 0;
    for (let i = 0; i < candles.length; i++) {
      const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
      cumVP += tp * candles[i].volume;
      cumVol += candles[i].volume;
      result.push(cumVol > 0 ? cumVP / cumVol : tp);
    }
    return result;
  };

  // ATR
  const atr = (period: number = 14) => {
    const result: (number | null)[] = [null];
    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trs.push(tr);
      if (i < period) { result.push(null); continue; }
      result.push(trs.slice(i - period, i).reduce((a, b) => a + b, 0) / period);
    }
    return result;
  };

  // Bollinger Bands
  const bollinger = (period: number = 20, mult: number = 2) => {
    const mid = sma(closes, period);
    const upper: (number | null)[] = [];
    const lower: (number | null)[] = [];
    for (let i = 0; i < closes.length; i++) {
      if (mid[i] === null) { upper.push(null); lower.push(null); continue; }
      const slice = closes.slice(i - period + 1, i + 1);
      const std = Math.sqrt(slice.reduce((a, v) => a + (v - mid[i]!) ** 2, 0) / period);
      upper.push(mid[i]! + mult * std);
      lower.push(mid[i]! - mult * std);
    }
    return { upper, mid, lower };
  };

  // MACD
  const macd = () => {
    const ema12 = ema(closes, 12);
    const ema26 = ema(closes, 26);
    const macdLine: (number | null)[] = [];
    for (let i = 0; i < closes.length; i++) {
      if (ema12[i] === null || ema26[i] === null) { macdLine.push(null); continue; }
      macdLine.push(ema12[i]! - ema26[i]!);
    }
    const validMacd = macdLine.filter((v) => v !== null) as number[];
    const signalRaw = ema(validMacd, 9);
    const signal: (number | null)[] = [];
    let idx = 0;
    for (let i = 0; i < macdLine.length; i++) {
      if (macdLine[i] === null) { signal.push(null); continue; }
      signal.push(signalRaw[idx] ?? null);
      idx++;
    }
    return { macdLine, signal };
  };

  // Support/Resistance (simple pivot points)
  const pivotPoints = () => {
    if (candles.length < 5) return { support: [], resistance: [] };
    const recent = candles.slice(-20);
    const sortedLows = [...recent].sort((a, b) => a.low - b.low);
    const sortedHighs = [...recent].sort((a, b) => b.high - a.high);
    return {
      support: [sortedLows[0]?.low, sortedLows[1]?.low].filter(Boolean),
      resistance: [sortedHighs[0]?.high, sortedHighs[1]?.high].filter(Boolean),
    };
  };

  const lastClose = closes[closes.length - 1];
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const rsi14 = rsi(closes, 14);
  const atr14 = atr(14);
  const vwapValues = vwap();
  const bb = bollinger(20, 2);
  const macdData = macd();
  const pivots = pivotPoints();

  const lastSMA20 = sma20[sma20.length - 1];
  const lastSMA50 = sma50[sma50.length - 1];
  const lastRSI = rsi14[rsi14.length - 1];
  const lastATR = atr14[atr14.length - 1];
  const lastVWAP = vwapValues[vwapValues.length - 1];
  const lastBBUpper = bb.upper[bb.upper.length - 1];
  const lastBBLower = bb.lower[bb.lower.length - 1];
  const lastMACD = macdData.macdLine[macdData.macdLine.length - 1];
  const lastSignal = macdData.signal[macdData.signal.length - 1];

  // Avg volume
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(volumes.length, 20);
  const lastVolume = volumes[volumes.length - 1];
  const volumeRatio = lastVolume / (avgVolume || 1);

  // Price changes
  const change1d = candles.length >= 2 ? lastClose - closes[closes.length - 2] : 0;
  const change1dPct = candles.length >= 2 ? (change1d / closes[closes.length - 2]) * 100 : 0;
  const change5d = candles.length >= 6 ? lastClose - closes[closes.length - 6] : 0;
  const change5dPct = candles.length >= 6 ? (change5d / closes[closes.length - 6]) * 100 : 0;
  const change20d = candles.length >= 21 ? lastClose - closes[closes.length - 21] : 0;
  const change20dPct = candles.length >= 21 ? (change20d / closes[closes.length - 21]) * 100 : 0;

  // Trend determination
  let trend = "neutral";
  if (lastSMA20 && lastSMA50) {
    if (lastClose > lastSMA20 && lastSMA20 > lastSMA50) trend = "bullish";
    else if (lastClose < lastSMA20 && lastSMA20 < lastSMA50) trend = "bearish";
  }

  // Z-score from VWAP
  const zScore = lastATR && lastATR > 0 ? (lastClose - lastVWAP) / lastATR : 0;

  return {
    candles,
    indicators: {
      lastClose: round(lastClose),
      sma20: round(lastSMA20),
      sma50: round(lastSMA50),
      ema12: round(ema12[ema12.length - 1]),
      ema26: round(ema26[ema26.length - 1]),
      rsi14: round(lastRSI),
      atr14: round(lastATR),
      vwap: round(lastVWAP),
      bbUpper: round(lastBBUpper),
      bbLower: round(lastBBLower),
      macd: round(lastMACD),
      macdSignal: round(lastSignal),
      volume: lastVolume,
      avgVolume: Math.round(avgVolume),
      volumeRatio: round(volumeRatio),
      change1d: round(change1d),
      change1dPct: round(change1dPct),
      change5d: round(change5d),
      change5dPct: round(change5dPct),
      change20d: round(change20d),
      change20dPct: round(change20dPct),
      trend,
      zScore: round(zScore),
      support: pivots.support.map((v) => round(v)),
      resistance: pivots.resistance.map((v) => round(v)),
    },
  };
}

function round(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return Math.round(v * 100) / 100;
}

export async function POST(req: Request) {
  try {
    const { symbol, range = "3mo", interval = "1d" } = await req.json();
    if (!symbol) {
      return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    }

    // Fetch from Yahoo Finance
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Yahoo Finance error: ${res.status}` }, { status: 400 });
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      return NextResponse.json({ error: "No data found for symbol" }, { status: 404 });
    }

    const meta = result.meta;
    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.open?.[i] == null) continue;
      candles.push({
        date: new Date(timestamps[i] * 1000).toISOString().split("T")[0],
        open: quote.open[i],
        high: quote.high[i],
        low: quote.low[i],
        close: quote.close[i],
        volume: quote.volume[i] || 0,
      });
    }

    const analysis = computeIndicators(candles);

    return NextResponse.json({
      data: {
        symbol: meta.symbol,
        name: meta.shortName || meta.longName || meta.symbol,
        currency: meta.currency,
        exchange: meta.exchangeName,
        marketState: meta.marketState,
        regularMarketPrice: meta.regularMarketPrice,
        previousClose: meta.previousClose,
        ...analysis,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch stock data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
