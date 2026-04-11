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

4. KEY FACTORS: List 3-6 specific factors, each marked as supporting (FOR) or opposing (AGAINST) the outcome, with weight (HIGH/MEDIUM/LOW). Use specific facts, not generalities.

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
