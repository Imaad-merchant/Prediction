"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Radio, LayoutGrid, Zap, BarChart2, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  const links = [
    { href: "/markets", label: "Markets", icon: LayoutGrid },
    { href: "/dashboard", label: "Dashboard", icon: BarChart2 },
    { href: "/analytics", label: "Analytics", icon: PieChart },
    { href: "/signals", label: "Signals", icon: Radio },
  ];

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

          <div className="flex items-center gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    active
                      ? "text-cyan-400 bg-cyan-400/10"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}

            {isLanding && (
              <Link href="/markets" className="ml-2">
                <Button size="sm" className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold">
                  <Zap className="w-3.5 h-3.5 mr-1" />
                  Launch App
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
