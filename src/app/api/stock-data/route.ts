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

  // === QUANTRESEARCH STRATEGIES ===

  // 1. TURTLE TRADING (Richard Dennis) — Donchian Channel breakout
  const turtleLong = 20;
  const turtleShort = 10;
  const donchianHigh20 = highs.length >= turtleLong ? Math.max(...highs.slice(-turtleLong)) : null;
  const donchianLow10 = lows.length >= turtleShort ? Math.min(...lows.slice(-turtleShort)) : null;
  let turtleSignal = "neutral";
  if (donchianHigh20 && lastClose >= donchianHigh20) turtleSignal = "long_entry";
  else if (donchianLow10 && lastClose <= donchianLow10) turtleSignal = "exit_long";
  const turtleUnitSize = lastATR && lastATR > 0 ? round(lastClose * 0.01 / lastATR) : null; // 1% risk per ATR unit

  // 2. DUAL THRUST (Michael Chalek) — Range breakout
  const dtN = 4;
  let dualThrustSignal = "neutral";
  let dtBuyLine: number | null = null;
  let dtSellLine: number | null = null;
  if (candles.length > dtN) {
    const dtSlice = candles.slice(-dtN - 1, -1);
    const dtHH = Math.max(...dtSlice.map((c) => c.high));
    const dtHC = Math.max(...dtSlice.map((c) => c.close));
    const dtLC = Math.min(...dtSlice.map((c) => c.close));
    const dtLL = Math.min(...dtSlice.map((c) => c.low));
    const dtRange = Math.max(dtHH - dtLC, dtHC - dtLL);
    const todayOpen = candles[candles.length - 1].open;
    dtBuyLine = round(todayOpen + 0.5 * dtRange);
    dtSellLine = round(todayOpen - 0.5 * dtRange);
    if (lastClose > (dtBuyLine ?? Infinity)) dualThrustSignal = "long";
    else if (lastClose < (dtSellLine ?? -Infinity)) dualThrustSignal = "short";
  }

  // 3. R-BREAKER (Richard Saidenberg) — Pivot-based 7-level strategy
  let rBreaker = null;
  if (candles.length >= 2) {
    const yH = candles[candles.length - 2].high;
    const yL = candles[candles.length - 2].low;
    const yC = candles[candles.length - 2].close;
    const pivot = (yH + yL + yC) / 3;
    const bBreak = yH + 2 * (pivot - yL);     // buy breakout
    const sSetup = pivot + (yH - yL);          // sell setup (resistance)
    const sEnter = 2 * pivot - yL;             // sell enter
    const bEnter = 2 * pivot - yH;             // buy enter
    const bSetup = pivot - (yH - yL);          // buy setup (support)
    const sBreak = yL - 2 * (yH - pivot);     // sell breakout

    let rSignal = "neutral";
    if (lastClose > bBreak) rSignal = "breakout_long";
    else if (lastClose < sBreak) rSignal = "breakout_short";
    else if (lastClose > sSetup && lastClose < sEnter) rSignal = "reversal_short_zone";
    else if (lastClose < bSetup && lastClose > bEnter) rSignal = "reversal_long_zone";

    rBreaker = {
      pivot: round(pivot),
      buyBreak: round(bBreak),
      sellBreak: round(sBreak),
      sellSetup: round(sSetup),
      sellEnter: round(sEnter),
      buyEnter: round(bEnter),
      buySetup: round(bSetup),
      signal: rSignal,
    };
  }

  // 4. BOLLINGER BAND STRATEGY — Mean reversion signals
  let bbSignal = "neutral";
  if (lastBBUpper && lastBBLower) {
    const prevClose = closes[closes.length - 2];
    if (lastClose > (lastBBLower ?? 0) && prevClose < (lastBBLower ?? 0)) bbSignal = "long_reversal";
    else if (lastClose < (lastBBUpper ?? 0) && prevClose > (lastBBUpper ?? 0)) bbSignal = "short_reversal";
    else if (lastClose > (lastBBUpper ?? 0)) bbSignal = "overbought";
    else if (lastClose < (lastBBLower ?? 0)) bbSignal = "oversold";
    // Squeeze detection
    const bbWidth = lastBBUpper && lastBBLower ? (lastBBUpper - lastBBLower) / ((lastBBUpper + lastBBLower) / 2) : 0;
    if (bbWidth < 0.03) bbSignal += "_squeeze";
  }

  // 5. HURST EXPONENT — Mean reversion vs trend detection
  let hurstExponent: number | null = null;
  let hurstRegime = "unknown";
  if (closes.length >= 100) {
    const logPrices = closes.slice(-100).map(Math.log);
    const lags = Array.from({ length: 20 }, (_, i) => i + 2);
    const taus: number[] = [];
    for (const lag of lags) {
      const diffs = logPrices.slice(lag).map((v, i) => v - logPrices[i]);
      const variance = diffs.reduce((a, d) => a + d * d, 0) / diffs.length;
      taus.push(Math.sqrt(Math.sqrt(variance)));
    }
    // Linear regression on log-log
    const logLags = lags.map(Math.log);
    const logTaus = taus.map(Math.log);
    const n = logLags.length;
    const sumX = logLags.reduce((a, b) => a + b, 0);
    const sumY = logTaus.reduce((a, b) => a + b, 0);
    const sumXY = logLags.reduce((a, x, i) => a + x * logTaus[i], 0);
    const sumX2 = logLags.reduce((a, x) => a + x * x, 0);
    hurstExponent = round((n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) * 2);
    if (hurstExponent !== null) {
      if (hurstExponent < 0.4) hurstRegime = "mean_reverting";
      else if (hurstExponent > 0.6) hurstRegime = "trending";
      else hurstRegime = "random_walk";
    }
  }

  // 6. DYNAMIC BREAKOUT II (George Pruitt) — Adaptive Donchian
  let dynamicBreakout = null;
  if (candles.length >= 25) {
    let lookback = 20;
    const todayVol = std(closes.slice(-lookback));
    const yesterdayVol = std(closes.slice(-lookback - 1, -1));
    if (yesterdayVol > 0) {
      const deltaVol = (todayVol / yesterdayVol - 1);
      lookback = Math.min(60, Math.max(20, Math.round(lookback * (1 + deltaVol))));
    }
    const dbHH = Math.max(...highs.slice(-lookback));
    const dbLL = Math.min(...lows.slice(-lookback));
    const dbMa = closes.slice(-lookback).reduce((a, b) => a + b, 0) / lookback;
    const dbStd = std(closes.slice(-lookback));
    const dbUpper = dbMa + 2 * dbStd;
    const dbLower = dbMa - 2 * dbStd;
    let dbSignal = "neutral";
    if (lastClose > dbHH && lastClose > dbUpper) dbSignal = "breakout_long";
    else if (lastClose < dbLL && lastClose < dbLower) dbSignal = "breakout_short";
    dynamicBreakout = {
      lookback,
      channelHigh: round(dbHH),
      channelLow: round(dbLL),
      bbUpper: round(dbUpper),
      bbLower: round(dbLower),
      signal: dbSignal,
    };
  }

  // 7. MA CROSS signals
  let maCrossSignal = "neutral";
  if (sma20.length >= 2 && sma50.length >= 2) {
    const prev20 = sma20[sma20.length - 2];
    const prev50 = sma50[sma50.length - 2];
    if (lastSMA20 && lastSMA50 && prev20 && prev50) {
      if (prev20 <= prev50 && lastSMA20 > lastSMA50) maCrossSignal = "golden_cross";
      else if (prev20 >= prev50 && lastSMA20 < lastSMA50) maCrossSignal = "death_cross";
      else if (lastSMA20 > lastSMA50) maCrossSignal = "bullish_aligned";
      else maCrossSignal = "bearish_aligned";
    }
  }

  // 8. MACD cross signal
  let macdCrossSignal = "neutral";
  if (macdData.macdLine.length >= 2 && macdData.signal.length >= 2) {
    const prevMACD = macdData.macdLine[macdData.macdLine.length - 2];
    const prevSignal = macdData.signal[macdData.signal.length - 2];
    if (lastMACD !== null && lastSignal !== null && prevMACD !== null && prevSignal !== null) {
      if (prevMACD <= prevSignal && lastMACD > lastSignal) macdCrossSignal = "bullish_cross";
      else if (prevMACD >= prevSignal && lastMACD < lastSignal) macdCrossSignal = "bearish_cross";
      else if (lastMACD > 0) macdCrossSignal = "bullish";
      else macdCrossSignal = "bearish";
    }
  }

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
      // QuantResearch Strategies
      turtle: {
        donchianHigh20: round(donchianHigh20),
        donchianLow10: round(donchianLow10),
        signal: turtleSignal,
        unitSize: turtleUnitSize,
      },
      dualThrust: {
        buyLine: dtBuyLine,
        sellLine: dtSellLine,
        signal: dualThrustSignal,
      },
      rBreaker,
      bollingerSignal: bbSignal,
      hurst: {
        exponent: hurstExponent,
        regime: hurstRegime,
      },
      dynamicBreakout,
      maCross: maCrossSignal,
      macdCross: macdCrossSignal,
    },
  };
}

function std(data: number[]): number {
  if (data.length < 2) return 0;
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  return Math.sqrt(data.reduce((a, v) => a + (v - mean) ** 2, 0) / data.length);
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
