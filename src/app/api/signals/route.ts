import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const SIGNALS_DIR = join(process.cwd(), "data");
const SIGNALS_FILE = join(SIGNALS_DIR, "signals.json");

async function readSignals() {
  try {
    const data = await readFile(SIGNALS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeSignals(signals: unknown[]) {
  await mkdir(SIGNALS_DIR, { recursive: true });
  await writeFile(SIGNALS_FILE, JSON.stringify(signals, null, 2));
}

export async function GET() {
  const signals = await readSignals();
  return NextResponse.json({ data: signals });
}

export async function POST(req: Request) {
  try {
    const signal = await req.json();
    if (!signal.id || !signal.question) {
      return NextResponse.json({ error: "Invalid signal" }, { status: 400 });
    }
    const signals = await readSignals();
    signals.unshift(signal); // newest first
    // Keep last 100 signals
    await writeSignals(signals.slice(0, 100));
    return NextResponse.json({ data: signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save signal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
