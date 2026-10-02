/**
 * The basket drawn as a coin seen from the front: its face is divided into
 * raised radial slabs, one per component, sized by `share`. Always drawn from
 * real numbers passed in (today's value share, or units when no price).
 *
 * `body` puts the rendered coin (public/hero-folio.png) behind the face so the
 * flat SVG face sits on a coin with volume; the render's own slabs are covered.
 */
export interface Slice {
  label: string;
  share: number; // any positive scale; normalised here
  color: string;
}

function shade(hex: string, k = 0.62): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}

function wedge(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): string {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) {
    return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0 Z`;
  }
  const x0 = cx + rx * Math.cos(a0);
  const y0 = cy + ry * Math.sin(a0);
  const x1 = cx + rx * Math.cos(a1);
  const y1 = cy + ry * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${rx} ${ry} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

function layout(items: Slice[], total: number) {
  const out: (Slice & { a0: number; a1: number; frac: number })[] = [];
  let a = -Math.PI / 2;
  for (const s of items) {
    const span = (s.share / total) * Math.PI * 2;
    out.push({ ...s, a0: a, a1: a + span, frac: s.share / total });
    a += span;
  }
  return out;
}

function Face({ slices, cx, cy, rx, ry, labelSize, gap }: { slices: Slice[]; cx: number; cy: number; rx: number; ry: number; labelSize: number; gap: number }) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.share), 0);
  const items = total > 0 ? slices.filter((s) => s.share > 0) : [];
  const parts = layout(items, total);
  const depth = ry * 0.035;
  const R = 0.9;
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#EDE5D3" />
      {parts.length === 0 ? (
        <ellipse cx={cx} cy={cy} rx={rx * R} ry={ry * R} fill="#3A3831" />
      ) : (
        <>
          {parts.map((p, i) => (
            <path key={`s${i}`} d={wedge(cx, cy + depth, rx * R, ry * R, p.a0, p.a1)} fill={shade(p.color)} stroke="#EDE5D3" strokeWidth={gap} strokeLinejoin="round" />
          ))}
          {parts.map((p, i) => (
            <path key={`f${i}`} d={wedge(cx, cy, rx * R, ry * R, p.a0, p.a1)} fill={p.color} stroke="#EDE5D3" strokeWidth={gap} strokeLinejoin="round" />
          ))}
          {parts.map((p, i) =>
            labelSize > 0 && p.frac >= 0.06 ? (
              <text
                key={`t${i}`}
                x={cx + rx * 0.58 * Math.cos((p.a0 + p.a1) / 2)}
                y={cy + ry * 0.58 * Math.sin((p.a0 + p.a1) / 2)}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="var(--font-literata), Georgia, serif"
                fontWeight={700}
                fontSize={labelSize}
                fill="#141411"
              >
                {p.label}
              </text>
            ) : null,
          )}
        </>
      )}
    </g>
  );
}

/** Large coin on the rendered body (console centre, basket page). */
export function CoinStage({ slices, title }: { slices: Slice[]; title: string }) {
  return (
    <svg viewBox="300 40 960 900" className="h-full w-full" role="img" aria-label={title}>
      <image href="/hero-folio.png" x={0} y={0} width={1536} height={1024} style={{ mixBlendMode: "lighten" }} />
      <Face slices={slices} cx={779} cy={487} rx={362} ry={386} labelSize={58} gap={14} />
    </svg>
  );
}

/** Small flat coin for lists. */
export function CoinMini({ slices, size = 72 }: { slices: Slice[]; size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true" className="shrink-0">
      <circle cx={100} cy={100} r={96} fill="#2C2B27" stroke="#3A3831" strokeWidth={4} />
      <Face slices={slices} cx={100} cy={100} rx={84} ry={84} labelSize={0} gap={6} />
    </svg>
  );
}
