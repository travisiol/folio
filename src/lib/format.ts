import { formatUnits } from "viem";

/** A token amount with at most `digits` decimals, trailing zeros removed, thousands grouped. */
export function fmt(value: bigint, decimals = 18, digits = 4): string {
  const s = formatUnits(value, decimals);
  const [int, frac = ""] = s.split(".");
  const grouped = BigInt(int).toLocaleString("en-US");
  const cut = frac.slice(0, digits).replace(/0+$/, "");
  if (!cut && value !== 0n && BigInt(int) === 0n) {
    // smaller than the shown precision: show significant digits instead of 0
    const sig = frac.match(/^0*\d{1,3}/)?.[0]?.replace(/0+$/, "") ?? "";
    return sig ? `0.${sig}` : "0";
  }
  return cut ? `${grouped}.${cut}` : grouped;
}

export function shortAddress(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** USD with cents ("$1,234.56"); below a cent, 3 significant digits. */
export function usd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n === 0) return "$0.00";
  if (Math.abs(n) < 0.01) return `$${n.toPrecision(3)}`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Basis points as a percent: 30 -> "0.30%". */
export function bpsLabel(bps: number | bigint): string {
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

export function pct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(n >= 10 || n === 0 ? 0 : 1)}%`;
}

/** "3 min ago", "2 h ago", "4 d ago" from unix seconds. */
export function ago(ts: number, now: number): string {
  const s = Math.max(0, now - ts);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} d ago`;
}

/** Raw token amount as a float (for USD estimates only, never for amounts sent). */
export function toFloat(value: bigint, decimals = 18): number {
  return Number(formatUnits(value, decimals));
}
