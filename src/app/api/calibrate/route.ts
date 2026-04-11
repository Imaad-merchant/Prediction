import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { CalibrationResult } from "@/lib/types";
import {
  buildEvidencePacket,
  calculateLiquidityDiscount,
} from "@/lib/evidence";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const {
      question,
      category,
      marketPrice,
      volume,
      liquidity,
      endDate,
    } = await req.json();

    if (!question || marketPrice == null) {
      return NextResponse.json(
        { error: "question and marketPrice are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Step 1: Gather multi-source evidence
    const evidence = await buildEvidencePacket(
      question,
      category || "other",
      marketPrice,
      volume || 0,
      liquidity || 0,
      endDate || ""
    );

    // Build source summary for the prompt
    const sourceLines = evidence.sources.map((s) => {
      const prob = s.probability !== null
        ? `${(s.probability * 100).toFixed(1)}%`
        : "N/A";
      return `- ${s.name} probability: ${prob} (confidence: ${s.confidence.toFixed(2)})${s.stale ? " [STALE]" : ""}\n  Data: ${s.dataPoints.join("; ")}`;
    });

    const today = new Date().toISOString().split("T")[0];
    const hoursLeft = endDate
      ? ((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60)).toFixed(1)
      : "unknown";

    // Step 2: Structured calibration prompt
    const systemPrompt = `You are a calibration engine for prediction markets. You synthesize multiple data sources into a single calibrated probability estimate.

Today's date: ${today}

RULES:
1. Start from the weighted average of source probabilities, NOT from the market price.
2. If sources agree (within 15pp), weight their consensus heavily.
3. If sources disagree, discount your confidence and lean toward the more reliable source.
4. Apply base rate reasoning: how often do events like this resolve YES historically?
5. Account for time to resolution (${hoursLeft}h left) — shorter timeframes mean less can change.
6. Never output exactly the market price — if you have no edge, say so with edge near 0.
7. Clamp probability between 0.02 and 0.98.

Output ONLY valid JSON. No markdown, no explanation outside JSON.`;

    const userPrompt = `Calibrate this prediction market:

**Question:** ${question}
**Category:** ${category || "other"}
**Current Polymarket price:** ${(marketPrice * 100).toFixed(1)}% (implies market thinks ${(marketPrice * 100).toFixed(1)}% likely)
**Resolution:** ${endDate || "unknown"} (${hoursLeft}h from now)
**Volume:** $${Math.round(volume || 0)}
**Liquidity:** $${Math.round(liquidity || 0)}

**Evidence Sources (${evidence.sourceCount} with probabilities):**
${sourceLines.length > 0 ? sourceLines.join("\n") : "- No external sources returned data"}

**Pre-computed aggregate:** ${evidence.calibratedProbability !== null ? `${(evidence.calibratedProbability * 100).toFixed(1)}%` : "N/A"} (sources ${evidence.sourcesAgree ? "AGREE" : "DISAGREE"})

Given the evidence above, output ONLY this JSON:
{
  "calibrated_p": <float 0.02-0.98, your best probability estimate>,
  "edge": <float, calibrated_p minus market price>,
  "sources_agree": <bool, do sources point the same direction>,
  "key_risk": <string, single biggest risk to this estimate>,
  "reasoning": <string, 2-3 sentence calibration reasoning>
}`;

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Empty response from OpenAI" }, { status: 500 });
    }

    const parsed = JSON.parse(content);

    // Step 3: Apply discounts from evidence pipeline
    const { sourcesAgree } = evidence;
    const validSourceCount = evidence.sources.filter((s) => s.probability !== null && !s.stale).length;

    let confidenceDiscount = 0.4; // just GPT
    if (validSourceCount >= 3 && sourcesAgree) confidenceDiscount = 1.0;
    else if (validSourceCount >= 2 && sourcesAgree) confidenceDiscount = 0.7;
    else if (validSourceCount >= 2) confidenceDiscount = 0.6;
    else if (validSourceCount >= 1) confidenceDiscount = 0.5;

    const liquidityDiscount = calculateLiquidityDiscount(volume || 0);

    const calibratedP = Math.max(0.02, Math.min(0.98, parsed.calibrated_p));
    const rawEdge = calibratedP - marketPrice;

    const result: CalibrationResult = {
      calibrated_p: Math.round(calibratedP * 1000) / 1000,
      edge: Math.round(rawEdge * 1000) / 1000,
      sources_agree: parsed.sources_agree ?? sourcesAgree,
      key_risk: parsed.key_risk || "Unknown",
      confidence_discount: confidenceDiscount,
      liquidity_discount: Math.round(liquidityDiscount * 1000) / 1000,
      source_count: validSourceCount,
      reasoning: parsed.reasoning || "",
    };

    return NextResponse.json({
      data: result,
      evidence: {
        sources: evidence.sources,
        rawAggregate: evidence.calibratedProbability,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calibration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
