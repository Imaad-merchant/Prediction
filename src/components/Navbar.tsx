"use client";

import Link from "next/link";
import { TrendingUp, Radio } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-cyan-400" />
            <span className="text-lg font-bold text-white">
              Poly<span className="text-cyan-400">Predict</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/signals"
              className="flex items-center gap-1.5 text-gray-400 hover:text-cyan-400 transition-colors"
            >
              <Radio className="w-4 h-4" />
              Signals
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
