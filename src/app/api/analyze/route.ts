import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const {
      question,
      currentYesPrice,
      currentNoPrice,
      volume,
      liquidity,
      endDate,
      description,
      category,
      stockData,
    } = await req.json();

    if (!question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Set OPENAI_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const today = new Date().toISOString().split("T")[0];

    const systemPrompt = `You are an elite Superforecaster, trained in the methodology of Philip Tetlock's Good Judgment Project. You estimate probabilities for prediction market questions with calibrated confidence.

Today's date: ${today}

METHODOLOGY - Follow these steps IN ORDER:

1. DECOMPOSITION: Break the question into 2-4 independent sub-questions whose answers would determine the outcome. List each sub-question.

2. BASE RATE: Identify the relevant reference class. What is the historical base rate for similar events? Start with the base rate as your initial estimate.

3. EVIDENCE GATHERING: Consider all available evidence:
   - Current market price (${currentYesPrice}c YES) represents crowd wisdom
   - Market volume ($${volume}) indicates attention/information
   - Time until resolution (${endDate})
   ${description ? `- Description: ${description}` : ""}
${stockData ? `
3b. QUANTITATIVE ANALYSIS (Stock/Futures Data Provided):
   You have real market data. Perform a full quant analysis using these strategies:

   TECHNICAL INDICATORS PROVIDED:
   - Price: $${stockData.indicators?.lastClose} | SMA20: $${stockData.indicators?.sma20} | SMA50: $${stockData.indicators?.sma50}
   - EMA12: $${stockData.indicators?.ema12} | EMA26: $${stockData.indicators?.ema26}
   - RSI(14): ${stockData.indicators?.rsi14} | ATR(14): $${stockData.indicators?.atr14}
   - VWAP: $${stockData.indicators?.vwap} | Z-Score from VWAP: ${stockData.indicators?.zScore}
   - Bollinger Bands: Upper $${stockData.indicators?.bbUpper} | Lower $${stockData.indicators?.bbLower}
   - MACD: ${stockData.indicators?.macd} | Signal: ${stockData.indicators?.macdSignal}
   - Volume: ${stockData.indicators?.volume} (${stockData.indicators?.volumeRatio}x avg)
   - Changes: 1d ${stockData.indicators?.change1dPct}% | 5d ${stockData.indicators?.change5dPct}% | 20d ${stockData.indicators?.change20dPct}%
   - Trend: ${stockData.indicators?.trend}
   - Support: ${stockData.indicators?.support?.join(', ')} | Resistance: ${stockData.indicators?.resistance?.join(', ')}

   QUANTRESEARCH STRATEGY SIGNALS:
   - TURTLE TRADING: Donchian 20d High $${stockData.indicators?.turtle?.donchianHigh20} | 10d Low $${stockData.indicators?.turtle?.donchianLow10} | Signal: ${stockData.indicators?.turtle?.signal} | Unit Size: ${stockData.indicators?.turtle?.unitSize}
   - DUAL THRUST: Buy Line $${stockData.indicators?.dualThrust?.buyLine} | Sell Line $${stockData.indicators?.dualThrust?.sellLine} | Signal: ${stockData.indicators?.dualThrust?.signal}
   - R-BREAKER: Pivot $${stockData.indicators?.rBreaker?.pivot} | Buy Break $${stockData.indicators?.rBreaker?.buyBreak} | Sell Break $${stockData.indicators?.rBreaker?.sellBreak} | Buy Setup $${stockData.indicators?.rBreaker?.buySetup} | Sell Setup $${stockData.indicators?.rBreaker?.sellSetup} | Signal: ${stockData.indicators?.rBreaker?.signal}
   - BOLLINGER STRATEGY: ${stockData.indicators?.bollingerSignal}
   - HURST EXPONENT: ${stockData.indicators?.hurst?.exponent} → Regime: ${stockData.indicators?.hurst?.regime} (< 0.4 = mean reverting, > 0.6 = trending)
   - DYNAMIC BREAKOUT II: Adaptive lookback ${stockData.indicators?.dynamicBreakout?.lookback}d | Channel $${stockData.indicators?.dynamicBreakout?.channelLow}-$${stockData.indicators?.dynamicBreakout?.channelHigh} | Signal: ${stockData.indicators?.dynamicBreakout?.signal}
   - MA CROSS: ${stockData.indicators?.maCross} (golden_cross = very bullish, death_cross = very bearish)
   - MACD CROSS: ${stockData.indicators?.macdCross}

   STRATEGIES TO APPLY (in order of importance):
   a) HURST REGIME: Is this market mean-reverting or trending? This determines which strategies to trust most. Mean-reverting → favor Bollinger/R-Breaker reversals. Trending → favor Turtle/Dual Thrust breakouts.
   b) TURTLE TRADING (Richard Dennis): If price broke above 20d high = strong trend entry. If below 10d low = exit. Use ATR for position sizing.
   c) DUAL THRUST (Michael Chalek): Range breakout — if price above buy line = bullish breakout, below sell line = bearish breakdown.
   d) R-BREAKER (Saidenberg, top 10 strategy 15 years): 7-level pivot system. Breakout long above buy break, breakout short below sell break. Reversals in setup zones.
   e) DYNAMIC BREAKOUT II (Pruitt): Adaptive Donchian with volatility-adjusted lookback. Confirmed with Bollinger breakout.
   f) BOLLINGER BANDS: Mean reversion from bands. Squeeze = big move incoming. Overbought/oversold near bands.
   g) MA CROSS: Golden cross (SMA20 > SMA50) = bullish regime. Death cross = bearish.
   h) MOMENTUM: RSI overbought (>70) or oversold (<30)? MACD cross direction confirms or contradicts trend.
   i) VOLUME CONFIRMATION: Volume ratio > 1.5 = strong conviction behind the move.
   j) ICT CONCEPTS: Fair value gaps, order blocks, liquidity sweeps from price action context.

   IMPORTANT: Synthesize ALL strategy signals into a consensus view. If 5+ strategies agree on direction, weight heavily. If strategies conflict, note the disagreement and reduce confidence.
` : ""}
4. KEY FACTORS: List 3-6 specific factors, each marked as supporting (FOR) or opposing (AGAINST) the outcome, with weight (HIGH/MEDIUM/LOW). Use specific facts, not generalities. ${stockData ? "Include at least 2 factors from the quantitative analysis above." : ""}

5. ADJUSTMENT: Starting from the base rate, adjust up or down based on each factor. Show your reasoning for each adjustment. Avoid anchoring too heavily to the current market price -- the market can be wrong.

6. FINAL PROBABILITY: State your probability estimate (0-100). Then assess your confidence in this estimate (High/Medium/Low) based on information quality and uncertainty.

7. RECOMMENDATION: Compare your probability to the market price.
   - If |your_estimate - market_price| > 10 points AND confidence is High: recommend BUY YES (if yours > market) or BUY NO (if yours < market)
   - If |edge| is 5-10 points: HOLD (interesting but not compelling)
   - If |edge| < 5 points OR confidence is Low OR liquidity < $10,000: AVOID

   Also assess:
   - Liquidity risk: flag if total liquidity < $10,000
   - Timing risk: flag if market ends within 24 hours (high variance)
   - Market efficiency: is this market likely well-arbitraged?

Return ONLY valid JSON with this exact structure:
{
  "predictedProbability": <number 0-100>,
  "confidence": "High" | "Medium" | "Low",
  "recommendation": "BUY YES" | "BUY NO" | "HOLD" | "AVOID",
  "edge": <number, your_probability minus market_price in percentage points>,
  "reasoning": {
    "decomposition": ["sub-question 1", "sub-question 2", ...],
    "baseRate": "description of base rate analysis",
    "keyFactors": [
      { "factor": "specific factor", "direction": "for" | "against", "weight": "high" | "medium" | "low" }
    ],
    "newsContext": "relevant current events and information",
    "uncertainties": ["uncertainty 1", "uncertainty 2"]
  },
  "riskAssessment": {
    "liquidityRisk": "Low" | "Medium" | "High",
    "timingRisk": "description of timing risk",
    "marketEfficiency": "description of market efficiency"
  },
  "summary": "2-3 sentence conclusion with actionable insight"
}`;

    const userPrompt = `Evaluate this prediction market:

Question: ${question}
Current YES price: ${currentYesPrice}c (implies ${currentYesPrice}% probability)
Current NO price: ${currentNoPrice}c
24h Volume: $${volume}
Total Liquidity: $${liquidity}
Resolution Date: ${endDate}
${description ? `Description: ${description}` : ""}
${category ? `Category: ${category}` : ""}

Apply the Superforecaster methodology and provide your calibrated probability estimate.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Empty response from OpenAI" }, { status: 500 });
    }

    const result = JSON.parse(content);
    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
