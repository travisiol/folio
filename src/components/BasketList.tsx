"use client";

import Link from "next/link";
import { findToken, seriesColor } from "@/config/tokens";
import { useBasketList, usePrices } from "@/lib/basket";
import { bpsLabel, fmt, shortAddress, toFloat } from "@/lib/format";
import { CoinMini } from "./Coin";

/** Baskets created through the factory, newest first. */
export function BasketList({ limit }: { limit?: number }) {
  const { list, count, loading } = useBasketList();
  const shown = limit ? list.slice(0, limit) : list;
  const prices = usePrices(shown.flatMap((b) => b.components.map((c) => findToken(c.token)?.ticker ?? "")).filter(Boolean));

  if (loading) return <p className="note card p-6">Reading baskets…</p>;
  if (shown.length === 0)
    return (
      <div className="card p-8 text-center">
        <p className="serif text-[24px]">No baskets yet</p>
        <p className="note mt-2">The first basket created on FOLIO will appear here.</p>
        <Link href="/#console" className="btn btn-cream btn-sm mt-5">
          Build one
        </Link>
      </div>
    );

  return (
    <div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((b) => {
          // today's value share when every price is known, else raw units
          const vals = b.components.map((c) => {
            const t = findToken(c.token);
            const p = t ? prices.data?.prices?.[t.ticker]?.price : undefined;
            return p ? toFloat(c.units, t!.decimals) * p : null;
          });
          const byValue = vals.every((v) => v !== null);
          return (
            <li key={b.address}>
              <Link href={`/b/${b.address}`} className="card flex items-center gap-4 p-4 transition hover:border-muted">
                <CoinMini slices={b.components.map((c, i) => ({ label: "", share: byValue ? (vals[i] as number) : toFloat(c.units), color: seriesColor(i) }))} />
                <span className="min-w-0 flex-1">
                  <span className="serif block truncate text-[21px]">{b.name}</span>
                  <span className="ticker block text-ink-2">{b.symbol}</span>
                  <span className="mt-1 block truncate text-[15px] text-muted">
                    {b.components.map((c) => findToken(c.token)?.symbol ?? shortAddress(c.token)).join(" · ")}
                  </span>
                  <span className="num mt-1 block text-[15px] text-ink-2">
                    {fmt(b.supply)} minted · fee {bpsLabel(b.feeBps)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {limit && Number(count) > limit ? (
        <Link href="/baskets" className="btn btn-line btn-sm mt-4">
          All {count.toString()} baskets
        </Link>
      ) : null}
    </div>
  );
}
