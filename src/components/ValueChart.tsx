"use client";

import { usd } from "@/lib/format";

/** Line of the basket's indicative value per token: Σ units × daily close of each underlying share. */
export function ValueChart({ points }: { points: [number, number][] }) {
  if (points.length < 2) return null;
  const W = 800;
  const H = 240;
  const pad = { l: 8, r: 8, t: 16, b: 16 };
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const span = hi - lo || 1;
  const X = (t: number) => pad.l + ((t - x0) / (x1 - x0 || 1)) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - (v - lo) / span) * (H - pad.t - pad.b);
  const d = points.map((p, i) => `${i ? "L" : "M"} ${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(" ");
  const first = points[0][1];
  const last = points[points.length - 1][1];
  const change = ((last - first) / first) * 100;
  const date = (t: number) => new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="num text-[28px]">{usd(last)}</div>
        <div className={`num text-[17px] ${change >= 0 ? "text-green" : "text-coral"}`}>
          {change >= 0 ? "+" : ""}
          {change.toFixed(2)}% over {Math.round((x1 - x0) / 86_400)} days
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Indicative value per token over time">
        <line x1={pad.l} x2={W - pad.r} y1={Y(first)} y2={Y(first)} stroke="#3A3831" strokeDasharray="4 6" />
        <path d={d} fill="none" stroke="#18C7CF" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between text-[15px] text-muted">
        <span>{date(x0)}</span>
        <span>
          {usd(lo)} – {usd(hi)}
        </span>
        <span>{date(x1)}</span>
      </div>
    </div>
  );
}
