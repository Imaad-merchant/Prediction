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

   STRATEGIES TO APPLY:
   a) TREND ANALYSIS: Is price above/below SMA20 and SMA50? Golden/death cross? EMA alignment?
   b) MOMENTUM: RSI overbought (>70) or oversold (<30)? MACD crossover direction?
   c) VOLATILITY REGIME: ATR level relative to price. Bollinger squeeze or expansion? Are we in high or low vol?
   d) MEAN REVERSION: Z-score from VWAP. If |Z| > 2, mean reversion likely. Price near Bollinger bands?
   e) VOLUME CONFIRMATION: Is volume confirming the move? Volume ratio > 1.5 = strong conviction.
   f) SUPPORT/RESISTANCE: Is price near key levels? Breakout or rejection likely?
   g) ICT CONCEPTS: Look for fair value gaps, order blocks, liquidity sweeps based on the price action.

   Use these quant signals to inform your probability estimate. If the data strongly supports or contradicts the market question, weight it heavily.
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
