import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 20;

/**
 * Reference prices of the underlying shares, from Yahoo Finance's public chart
 * endpoint (the source documented by the stockos base; no key). Server side only
 * (no CORS upstream), cached 60 s per ticker so visitors never cause one call each.
 *
 *   GET /api/prices?t=NVDA,AAPL            -> { prices: { NVDA: { price, time } | null } }
 *   GET /api/prices?t=NVDA,AAPL&history=1  -> also { history: { NVDA: [[unixSec, close], …] } } (3 months, daily)
 *
 * Only tickers of the verified stock-token list are accepted.
 */
const ALLOWED = new Set(["NVDA", "AAPL", "TSLA", "META", "NFLX", "DELL", "SPY", "GLD", "EWY", "INDA"]);

interface YahooChart {
  chart?: {
    result?: {
      meta?: { regularMarketPrice?: number; regularMarketTime?: number; currency?: string };
      timestamp?: number[];
      indicators?: { quote?: { close?: (number | null)[] }[] };
    }[];
  };
}

async function chart(ticker: string, history: boolean) {
  const range = history ? "3mo" : "5d";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=1d&includePrePost=false`;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; folio-price/1.0)" },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as YahooChart;
    const r = json.chart?.result?.[0];
    const price = r?.meta?.regularMarketPrice;
    if (!r || typeof price !== "number" || !Number.isFinite(price) || price <= 0 || (r.meta?.currency && r.meta.currency !== "USD")) return null;
    const closes = r.indicators?.quote?.[0]?.close ?? [];
    const points: [number, number][] = (r.timestamp ?? []).flatMap((t, i) => {
      const c = closes[i];
      return typeof c === "number" && Number.isFinite(c) ? [[t, c] as [number, number]] : [];
    });
    return { price, time: r.meta?.regularMarketTime ?? 0, points };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const tickers = [...new Set((params.get("t") ?? "").split(",").map((s) => s.trim().toUpperCase()))].filter((t) => ALLOWED.has(t)).slice(0, 10);
  const history = params.get("history") === "1";
  const results = await Promise.all(tickers.map((t) => chart(t, history)));
  const prices: Record<string, { price: number; time: number } | null> = {};
  const hist: Record<string, [number, number][]> = {};
  tickers.forEach((t, i) => {
    const r = results[i];
    prices[t] = r ? { price: r.price, time: r.time } : null;
    if (history && r) hist[t] = r.points;
  });
  return NextResponse.json(history ? { prices, history: hist } : { prices }, { headers: { "cache-control": "public, max-age=30, s-maxage=60" } });
}
