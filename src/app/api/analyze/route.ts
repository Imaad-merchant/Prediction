import { NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 30;

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

   STRATEGY SCORING — You MUST score each strategy individually before forming your bias.
   For each strategy, assign: BULLISH (+1), NEUTRAL (0), or BEARISH (-1), then sum for consensus.

   Score these 10 strategies:
   1. HURST REGIME: ${stockData.indicators?.hurst?.regime}. If trending → trust breakout strategies. If mean-reverting → trust reversal strategies. Score the regime's implication for the market question.
   2. TURTLE (Dennis): Signal=${stockData.indicators?.turtle?.signal}. Price vs 20d high ($${stockData.indicators?.turtle?.donchianHigh20}) and 10d low ($${stockData.indicators?.turtle?.donchianLow10}). Long entry = +1, exit = -1, neutral = 0.
   3. DUAL THRUST (Chalek): Signal=${stockData.indicators?.dualThrust?.signal}. Buy line $${stockData.indicators?.dualThrust?.buyLine}, sell line $${stockData.indicators?.dualThrust?.sellLine}. Long = +1, short = -1.
   4. R-BREAKER (Saidenberg): Signal=${stockData.indicators?.rBreaker?.signal}. Pivot $${stockData.indicators?.rBreaker?.pivot}. Breakout long = +1, breakout short = -1, reversal zones = mixed.
   5. DYNAMIC BREAKOUT (Pruitt): Signal=${stockData.indicators?.dynamicBreakout?.signal}. Adaptive ${stockData.indicators?.dynamicBreakout?.lookback}d channel. Breakout long = +1, short = -1.
   6. BOLLINGER BANDS: Signal=${stockData.indicators?.bollingerSignal}. Oversold/long reversal = +1, overbought/short reversal = -1. Squeeze = amplify next signal.
   7. MA CROSS: ${stockData.indicators?.maCross}. Golden cross = +1, death cross = -1, bullish aligned = +0.5, bearish aligned = -0.5.
   8. MACD CROSS: ${stockData.indicators?.macdCross}. Bullish cross = +1, bearish cross = -1.
   9. RSI MOMENTUM: RSI=${stockData.indicators?.rsi14}. Oversold (<30) = +1 (bounce likely). Overbought (>70) = -1 (pullback likely). 30-70 = score by direction.
   10. VOLUME: Ratio=${stockData.indicators?.volumeRatio}x. If > 1.5 and price rising = confirms bull (+0.5). If > 1.5 and price falling = confirms bear (-0.5). Weak volume = reduce conviction.

   CONSENSUS BIAS FORMULA:
   Sum all 10 scores → Strategy Score (range -10 to +10).
   - Score >= +4: STRONG BULLISH bias → increase probability estimate
   - Score +2 to +3: MODERATE BULLISH
   - Score -1 to +1: MIXED/NEUTRAL → low confidence, favor market price
   - Score -2 to -3: MODERATE BEARISH
   - Score <= -4: STRONG BEARISH bias → decrease probability estimate

   You MUST include your strategy scorecard in the response under "reasoning.strategyScorecard" as an array of {strategy, signal, score} objects, plus "strategyConsensus" with the total score and bias label.

   ICT OVERLAY: After scoring, apply ICT concepts (fair value gaps, order blocks, liquidity sweeps) as a final confirmation or contradiction of the consensus.
` : ""}
4. KEY FACTORS: List 3-6 specific factors, each marked as supporting (FOR) or opposing (AGAINST) the outcome, with weight (HIGH/MEDIUM/LOW). Use specific facts, not generalities. ${stockData ? "Include at least 3 factors from the strategy scorecard — cite the specific strategy score." : ""}

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
    "uncertainties": ["uncertainty 1", "uncertainty 2"],
    "strategyScorecard": [
      { "strategy": "Turtle", "signal": "signal description", "score": 0 },
      { "strategy": "Dual Thrust", "signal": "signal description", "score": 0 }
    ],
    "strategyConsensus": {
      "totalScore": 0,
      "bias": "STRONG BULLISH" | "MODERATE BULLISH" | "NEUTRAL" | "MODERATE BEARISH" | "STRONG BEARISH",
      "summary": "1-sentence consensus explanation"
    }
  },
  "riskAssessment": {
    "liquidityRisk": "Low" | "Medium" | "High",
    "timingRisk": "description of timing risk",
    "marketEfficiency": "description of market efficiency"
  },
  "summary": "2-3 sentence conclusion with actionable insight. MUST reference the strategy consensus bias and score."
}

IMPORTANT: If stock/futures data is provided, the "strategyScorecard" and "strategyConsensus" fields are REQUIRED. Score ALL 10 strategies. The consensus bias MUST directly influence your predictedProbability — don't ignore it.`;

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
