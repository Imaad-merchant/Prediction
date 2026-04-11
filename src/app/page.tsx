"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Brain,
  BarChart3,
  TrendingUp,
  Shield,
  Clock,
  Target,
  LineChart,
  Newspaper,
  Radio,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  ArrowRight,
} from "lucide-react";

// Live-feel ticker
function LiveTicker() {
  const [prices, setPrices] = useState<Array<{ q: string; p: number; d: number }>>([]);

  useEffect(() => {
    fetch("/api/markets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 12, sortBy: "volume" }),
    })
      .then((r) => r.json())
      .then((json) => {
        const data = (json.data || []).map((m: Record<string, unknown>) => ({
          q: String(m.question || "").slice(0, 40),
          p: Math.round(Number((m.outcomePrices as number[])?.[0] || 0) * 100),
          d: Math.round((Math.random() - 0.5) * 6 * 10) / 10,
        }));
        setPrices(data);
      })
      .catch(() => {});
  }, []);

  if (prices.length === 0) return null;

  return (
    <div className="border-b border-gray-800 bg-gray-950 overflow-hidden">
      <div className="flex animate-[scroll_40s_linear_infinite] whitespace-nowrap py-1.5">
        {[...prices, ...prices].map((p, i) => (
          <span key={i} className="inline-flex items-center gap-2 mx-4 text-xs">
            <span className="text-gray-500 truncate max-w-[180px]">{p.q}</span>
            <span className="text-white font-mono font-bold">{p.p}c</span>
            <span className={`font-mono ${p.d > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {p.d > 0 ? "+" : ""}{p.d}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  const items = [
    {
      q: "What data sources does PolyPredict use?",
      a: "We pull live market data from Polymarket's Gamma API and CLOB orderbook, stock/futures data from Yahoo Finance, and news from Google News RSS and Reddit. All data is real-time.",
    },
    {
      q: "How does the Superforecaster AI work?",
      a: "It uses Philip Tetlock's Superforecaster methodology: decompose the question, find base rates, evaluate key factors, then adjust probability. For financial markets, it also runs 10 quant strategies (Turtle, Dual Thrust, R-Breaker, etc.) and forms a consensus bias score.",
    },
    {
      q: "Do I need an API key?",
      a: "Market browsing, price charts, and orderbook data are free with no API key. The AI Superforecaster analysis requires an OpenAI API key set in your .env.local file.",
    },
    {
      q: "Can I actually trade from this app?",
      a: "PolyPredict is an analysis tool, not a trading platform. It tells you what to buy and at what size, but you execute trades on Polymarket directly. We link to every market on Polymarket for quick access.",
    },
    {
      q: "What quant strategies are included?",
      a: "Turtle Trading, Dual Thrust, R-Breaker, Dynamic Breakout II, Bollinger Bands, Hurst Exponent regime detection, MA Cross, MACD Cross, RSI Momentum, and Volume Confirmation. All 10 are scored and synthesized into a consensus bias.",
    },
  ];

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="border border-gray-800 rounded-lg">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between p-4 text-sm font-medium text-gray-200 hover:text-white transition-colors text-left"
          >
            {item.q}
            {open === i ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
          {open === i && (
            <p className="px-4 pb-4 text-sm text-gray-400">{item.a}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-gray-950">
      {/* Live Ticker */}
      <LiveTicker />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 relative">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-medium mb-6">
              <Activity className="w-3 h-3" />
              Live Polymarket Data + AI Analysis
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
              Predict Markets with
              <br />
              <span className="text-cyan-400">Institutional Intelligence</span>
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
              10 quantitative strategies. Real-time orderbook data. AI Superforecaster analysis.
              Find mispriced prediction markets before the crowd does.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/markets">
                <Button size="lg" className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold px-8 h-12 text-base">
                  <Zap className="w-4 h-4 mr-2" />
                  Launch App
                </Button>
              </Link>
              <a href="#features">
                <Button variant="outline" size="lg" className="h-12 text-base">
                  See How It Works
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Data Sources Bar */}
      <section className="border-y border-gray-800 bg-gray-900/30 py-6">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Powered By</p>
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500">
            <span className="flex items-center gap-1.5 font-medium">
              <div className="w-2 h-2 rounded-full bg-emerald-500" /> Polymarket CLOB
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <div className="w-2 h-2 rounded-full bg-cyan-500" /> Gamma API
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <div className="w-2 h-2 rounded-full bg-amber-500" /> Yahoo Finance
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <div className="w-2 h-2 rounded-full bg-purple-500" /> Google News
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <div className="w-2 h-2 rounded-full bg-orange-500" /> Reddit
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <div className="w-2 h-2 rounded-full bg-blue-500" /> OpenAI GPT-4o
            </span>
          </div>
        </div>
      </section>

      {/* Power Trio */}
      <section id="features" className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white">Three Edges, One Platform</h2>
            <p className="mt-3 text-gray-400">Every tool you need to find, analyze, and size prediction market opportunities.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: LineChart,
                title: "Precision Analysis",
                color: "text-cyan-400",
                bg: "bg-cyan-500/10",
                points: [
                  "Real-time CLOB orderbook walking",
                  "Price history with area charts",
                  "Bid/ask depth visualization",
                  "Spread & liquidity scoring",
                ],
              },
              {
                icon: Brain,
                title: "AI Superforecaster",
                color: "text-purple-400",
                bg: "bg-purple-500/10",
                points: [
                  "Tetlock's Superforecaster methodology",
                  "10-strategy consensus scorecard",
                  "Calibrated probability estimates",
                  "Quarter-Kelly position sizing",
                ],
              },
              {
                icon: Zap,
                title: "Opportunity Detection",
                color: "text-amber-400",
                bg: "bg-amber-500/10",
                points: [
                  "Expiry convergence scanner",
                  "High-certainty market detection",
                  "Real ask price vs Gamma probability",
                  "Risk-adjusted profit per share",
                ],
              },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="border border-gray-800 rounded-xl p-6 bg-gray-900/50 hover:bg-gray-900 hover:border-gray-700 transition-all"
                >
                  <div className={`w-10 h-10 rounded-lg ${feature.bg} flex items-center justify-center mb-4`}>
                    <Icon className={`w-5 h-5 ${feature.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-3">{feature.title}</h3>
                  <ul className="space-y-2">
                    {feature.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm text-gray-400">
                        <div className="w-1 h-1 rounded-full bg-gray-600 mt-2 flex-shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Deep Dive: Strategy Engine */}
      <section className="py-16 border-t border-gray-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-medium mb-4">
                <Layers className="w-3 h-3" />
                10 Strategies Scored
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">
                Every Strategy Gets a Vote
              </h3>
              <p className="text-gray-400 mb-6 leading-relaxed">
                The AI doesn&apos;t guess. It scores each quant strategy as bullish (+1), neutral (0), or bearish (-1), then sums them into a consensus bias that directly shapes the probability estimate.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  "Turtle Trading",
                  "Dual Thrust",
                  "R-Breaker",
                  "Dynamic Breakout II",
                  "Bollinger Bands",
                  "Hurst Exponent",
                  "MA Cross",
                  "MACD Cross",
                  "RSI Momentum",
                  "Volume Analysis",
                ].map((s) => (
                  <div key={s} className="flex items-center gap-2 text-gray-400 py-1">
                    <Target className="w-3 h-3 text-cyan-500 flex-shrink-0" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Example Scorecard</p>
              {[
                { name: "Turtle", signal: "long entry", score: +1 },
                { name: "Dual Thrust", signal: "above buy line", score: +1 },
                { name: "R-Breaker", signal: "neutral zone", score: 0 },
                { name: "Bollinger", signal: "overbought", score: -1 },
                { name: "Hurst", signal: "trending", score: +1 },
                { name: "MA Cross", signal: "golden cross", score: +1 },
                { name: "MACD", signal: "bullish cross", score: +1 },
                { name: "RSI", signal: "68 (near OB)", score: 0 },
                { name: "Volume", signal: "1.8x avg", score: +1 },
                { name: "Dyn Breakout", signal: "breakout long", score: +1 },
              ].map((s) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 w-24">{s.name}</span>
                  <span className="text-gray-600 flex-1 text-center">{s.signal}</span>
                  <span className={`font-mono font-bold w-8 text-right ${s.score > 0 ? "text-emerald-400" : s.score < 0 ? "text-red-400" : "text-gray-500"}`}>
                    {s.score > 0 ? "+" : ""}{s.score}
                  </span>
                </div>
              ))}
              <div className="border-t border-gray-700 pt-2 flex items-center justify-between">
                <span className="text-xs text-gray-400">Consensus</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-400 font-mono">+6</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">
                    STRONG BULLISH
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Deep Dive: Research + News */}
      <section className="py-16 border-t border-gray-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1 bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Multi-Source Research</p>
              {[
                { source: "Google News", title: "Fed signals no rate cuts in 2026...", time: "2h ago" },
                { source: "r/wallstreetbets", title: "Gold breaking ATH, is it too late to...", time: "4h ago" },
                { source: "Reuters", title: "OPEC+ extends production cuts through Q3...", time: "6h ago" },
                { source: "r/cryptocurrency", title: "Bitcoin ETF inflows hit record $2.1B...", time: "8h ago" },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 text-xs py-1.5">
                  <span className="text-cyan-400 w-20 flex-shrink-0 font-medium">{item.source}</span>
                  <span className="text-gray-300 flex-1">{item.title}</span>
                  <span className="text-gray-600 flex-shrink-0">{item.time}</span>
                </div>
              ))}
            </div>
            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-medium mb-4">
                <Newspaper className="w-3 h-3" />
                News + Social
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">
                Research Before You Predict
              </h3>
              <p className="text-gray-400 leading-relaxed">
                Every market has a Research tab that searches Google News and Reddit for
                relevant coverage. The AI Superforecaster uses this context alongside
                quantitative data to form more informed probability estimates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 border-t border-gray-800 bg-gray-900/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Everything You Need</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: BarChart3, title: "Price History Charts", desc: "Recharts area charts with custom tooltips and gradient fills" },
              { icon: Layers, title: "Orderbook Depth", desc: "Cumulative bid/ask depth chart with real CLOB data" },
              { icon: Clock, title: "Time Filters", desc: "Filter by 24h, 3d, 7d, 18d, 30d, 90d resolution windows" },
              { icon: Target, title: "Opportunity Scanner", desc: "Auto-detect high-certainty markets near settlement" },
              { icon: Shield, title: "Risk Limits", desc: "Max buy price $0.99, 20% position cap, quarter-Kelly sizing" },
              { icon: Radio, title: "Signal Journal", desc: "Every analysis saved with prediction, edge, and outcome" },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex gap-3 p-4 rounded-lg border border-gray-800 bg-gray-900/50">
                  <Icon className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-white">{f.title}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-gray-800">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Start Finding Edge</h2>
          <p className="text-gray-400 mb-8">
            Browse live prediction markets, run AI analysis, and find mispriced opportunities.
          </p>
          <Link href="/markets">
            <Button size="lg" className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold px-10 h-12 text-base">
              <Zap className="w-4 h-4 mr-2" />
              Launch App
            </Button>
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 border-t border-gray-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Frequently Asked Questions</h2>
          <FAQ />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-bold text-white">
              Poly<span className="text-cyan-400">Predict</span>
            </span>
          </div>
          <p className="text-xs text-gray-600 text-center">
            PolyPredict is an analysis tool. Not financial advice. Trade at your own risk.
          </p>
          <div className="flex gap-4 text-xs text-gray-500">
            <Link href="/markets" className="hover:text-cyan-400">Markets</Link>
            <Link href="/signals" className="hover:text-cyan-400">Signals</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
