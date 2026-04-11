"use client";

import type { OpportunityScore as OpportunityScoreType } from "@/lib/types";
import { ScoreRing } from "./SuperforecasterPanel";

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-400">{value}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function OpportunityScoreDisplay({ score }: { score: OpportunityScoreType }) {
  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-5">
      <div className="flex items-center gap-5">
        <ScoreRing score={score.overall} size={90} color={score.color} />
        <div className="flex-1 space-y-1">
          <h4 className="text-sm font-semibold" style={{ color: score.color }}>
            {score.label}
          </h4>
          <p className="text-xs text-gray-500">Composite opportunity score</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <ScoreBar label="Edge (40%)" value={score.edgeScore} color="#06b6d4" />
        <ScoreBar label="Liquidity (20%)" value={score.liquidityScore} color="#10b981" />
        <ScoreBar label="Spread (15%)" value={score.spreadScore} color="#8b5cf6" />
        <ScoreBar label="Volume (15%)" value={score.volumeScore} color="#f59e0b" />
        <ScoreBar label="Confidence (10%)" value={score.confidenceScore} color="#ec4899" />
      </div>
    </div>
  );
}
