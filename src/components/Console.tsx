"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatUnits, parseEventLogs, parseUnits, type Address } from "viem";
import { useReadContracts } from "wagmi";
import { FACTORY_ADDRESS } from "@/config/network";
import { LIMITS } from "@/config/site";
import { STOCK_TOKENS, findSymbol, seriesColor } from "@/config/tokens";
import { erc20Abi, factoryAbi } from "@/lib/abi";
import { ONE, unitsFor, useMounted, usePrices } from "@/lib/basket";
import { bpsLabel, fmt, pct, toFloat, usd } from "@/lib/format";
import { errorText, useWallet } from "@/lib/tx";
import { CoinStage, type Slice } from "./Coin";
import { Holdings } from "./Holdings";

type Tab = "build" | "mint" | "redeem";

interface Row {
  id: number;
  symbol: string;
  pct: number;
  units: string; // manual units per token, used only when no price can be read
}

const START: Row[] = [
  { id: 1, symbol: "NVDA", pct: 30, units: "" },
  { id: 2, symbol: "AAPL", pct: 25, units: "" },
  { id: 3, symbol: "TSLA", pct: 15, units: "" },
  { id: 4, symbol: "META", pct: 15, units: "" },
  { id: 5, symbol: "NFLX", pct: 15, units: "" },
];

function safeUnits(v: string): bigint {
  try {
    return v.trim() ? parseUnits(v.trim(), 18) : 0n;
  } catch {
    return 0n;
  }
}

function TabBar({ tab, setTab, className }: { tab: Tab; setTab: (t: Tab) => void; className: string }) {
  return (
    <div className={`tabs ${className}`} role="tablist" aria-label="Console">
      {(["build", "mint", "redeem"] as const).map((t) => (
        <button key={t} type="button" role="tab" aria-selected={tab === t} className="tab" onClick={() => setTab(t)}>
          {t === "build" ? "Build" : t === "mint" ? "Mint" : "Redeem"}
        </button>
      ))}
    </div>
  );
}

export function Console() {
  const router = useRouter();
  const mounted = useMounted();
  const { address, ready, send, busy } = useWallet();
  const [tab, setTab] = useState<Tab>("build");
  const [name, setName] = useState("Big Tech 5");
  const [symbol, setSymbol] = useState("BT5");
  const [fee, setFee] = useState("0.30");
  const [value, setValue] = useState("100");
  const [rows, setRows] = useState<Row[]>(START.filter((r) => findSymbol(r.symbol)).length >= 2 ? START.filter((r) => findSymbol(r.symbol)) : STOCK_TOKENS.slice(0, 3).map((t, i) => ({ id: i + 1, symbol: t.symbol, pct: i === 0 ? 34 : 33, units: "" })));
  const [nextId, setNextId] = useState(10);
  const [mintAmount, setMintAmount] = useState("1");
  const [msg, setMsg] = useState<string | null>(null);

  const prices = usePrices(STOCK_TOKENS.map((t) => t.ticker));
  const balances = useReadContracts({
    contracts: STOCK_TOKENS.map((t) => ({ address: t.address, abi: erc20Abi, functionName: "balanceOf", args: [address ?? "0x0000000000000000000000000000000000000000"] }) as const),
    query: { enabled: Boolean(address) && mounted, refetchInterval: 15_000 },
  });
  const balanceOf = (sym: string): bigint | null => {
    const i = STOCK_TOKENS.findIndex((t) => t.symbol === sym);
    const r = balances.data?.[i]?.result;
    return typeof r === "bigint" ? r : null;
  };

  const valueUsd = Number(value) || 0;
  const feeBps = Math.round((Number(fee) || 0) * 100);
  const computed = rows.map((r, i) => {
    const token = findSymbol(r.symbol)!;
    const p = prices.data?.prices?.[token.ticker] ?? null;
    const units = p ? unitsFor(valueUsd, r.pct, p.price, token.decimals) : safeUnits(r.units);
    return { ...r, unitsText: r.units, token, price: p?.price ?? null, units, color: seriesColor(i) };
  });
  const allPriced = computed.length > 0 && computed.every((c) => c.price !== null);
  const sumPct = computed.reduce((s, c) => s + (c.price !== null ? c.pct : 0), 0);
  const indicative = allPriced ? computed.reduce((s, c) => s + toFloat(c.units) * (c.price ?? 0), 0) : null;
  const slices: Slice[] = computed.map((c) => ({ label: c.symbol, share: allPriced ? toFloat(c.units) * (c.price ?? 0) : toFloat(c.units) || c.pct, color: c.color }));
  const available = STOCK_TOKENS.filter((t) => !rows.some((r) => r.symbol === t.symbol));
  const weightsOk = allPriced ? Math.abs(sumPct - 100) < 0.001 : computed.every((c) => c.units > 0n);
  const gap = Math.round((100 - sumPct) * 10) / 10;
  const allocation = !allPriced ? "Weights by units" : weightsOk ? "100% allocated" : gap > 0 ? `Add ${gap}% to continue` : `Remove ${-gap}% to continue`;

  function problem(): string | null {
    if (!name.trim()) return "Give the basket a name.";
    if (!/^[A-Z0-9]{1,11}$/.test(symbol)) return "The symbol is 1 to 11 letters or digits.";
    if (rows.length < LIMITS.minComponents || rows.length > LIMITS.maxComponents) return `A basket holds ${LIMITS.minComponents} to ${LIMITS.maxComponents} stocks.`;
    if (!(feeBps >= 0 && feeBps <= LIMITS.maxFeeBps)) return `The fee is between 0% and ${bpsLabel(LIMITS.maxFeeBps)}.`;
    if (computed.some((c) => c.units === 0n)) return "Every stock needs a weight above zero.";
    if (allPriced && !weightsOk) return `Weights add up to ${pct(sumPct)}. Make them 100%.`;
    return null;
  }

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function create() {
    setMsg(null);
    const p = problem();
    if (p) return setMsg(p);
    if (!FACTORY_ADDRESS) return setMsg("Creating baskets is not open yet.");
    try {
      const acct = await ready();
      if (!acct) return;
      const receipt = await send("create", {
        address: FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: "create",
        args: [name.trim(), symbol, computed.map((c) => ({ token: c.token.address, units: c.units })), BigInt(feeBps)],
      });
      const [ev] = parseEventLogs({ abi: factoryAbi, logs: receipt.logs, eventName: "BasketCreated" });
      if (ev) router.push(`/b/${ev.args.basket}`);
    } catch (e) {
      setMsg(errorText(e));
    }
  }

  const amount = (() => {
    try {
      return mintAmount.trim() ? parseUnits(mintAmount.trim(), 18) : 0n;
    } catch {
      return 0n;
    }
  })();
  const ticket = computed.map((c) => {
    const deposit = (amount * c.units + ONE - 1n) / ONE;
    const feeAmt = (deposit * BigInt(feeBps)) / 10_000n;
    return { ...c, deposit, fee: feeAmt, total: deposit + feeAmt, bal: balanceOf(c.symbol) };
  });
  const feeUsd = allPriced ? ticket.reduce((s, t) => s + toFloat(t.fee) * (t.price ?? 0), 0) : null;
  const depositUsd = allPriced ? ticket.reduce((s, t) => s + toFloat(t.deposit) * (t.price ?? 0), 0) : null;
  const costUsd = allPriced ? ticket.reduce((s, t) => s + toFloat(t.total) * (t.price ?? 0), 0) : null;

  const cta = (
    <div>
      <button type="button" className="btn btn-cream h-14 w-full" onClick={create} disabled={busy !== null || !weightsOk}>
        {busy === "create" ? "Creating…" : "Create basket"}
      </button>
      {msg ? (
        <p className="note mt-3" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  );

  return (
    <section id="console" className="console scroll-mt-6 p-3 sm:p-4 lg:p-5">
      <TabBar tab={tab} setTab={setTab} className="mb-3 lg:hidden" />
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[280px_minmax(0,1fr)_380px] lg:gap-5">
        {/* sidebar: the basket itself */}
        <aside className={`${tab === "build" ? "flex" : "hidden"} order-1 flex-col gap-3 p-2 lg:order-none lg:flex lg:p-2`}>
          <label className="block">
            <span className="label">Basket name</span>
            <input className="field serif mt-1.5 text-[20px]" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Symbol</span>
              <input className="field ticker mt-1.5" value={symbol} maxLength={11} onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
            </label>
            <label className="block">
              <span className="label">Mint fee</span>
              <div className="relative mt-1.5">
                <input className="field num pr-8" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">%</span>
              </div>
            </label>
          </div>
          <label className="block">
            <span className="label">Value of 1 {symbol || "token"} at creation</span>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">$</span>
              <input className="field num pl-8" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`chip ${weightsOk ? "border-teal" : ""}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${weightsOk ? "bg-teal" : "bg-amber"}`} />
              {allocation}
            </span>
            <span className="chip">{rows.length} stocks</span>
          </div>
          <div className="rule flex items-baseline justify-between gap-2 pt-3">
            <div className="label">Value per token</div>
            <div className="num text-[22px]">{indicative !== null ? usd(indicative) : "Price unavailable"}</div>
          </div>
          <div className="mt-auto">{cta}</div>
        </aside>

        {/* centre: the live coin */}
        <div className={`well relative ${tab === "build" ? "order-3" : "order-2"} flex min-h-[300px] flex-col items-center justify-center overflow-hidden lg:order-none lg:min-h-[440px]`}>
          <div className="aspect-square w-full max-w-[280px] sm:max-w-[360px] lg:max-w-[400px]">
            <CoinStage slices={slices} title={`${name}: ${computed.map((c) => `${c.symbol} ${pct(c.pct)}`).join(", ")}`} />
          </div>
          <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 pb-4">
            {computed.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                <span className="ticker">{c.symbol}</span>
                <span className="num text-[15px] text-muted">{allPriced ? pct(c.pct) : `${fmt(c.units)} u`}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* right: builder → mint ticket → redeem */}
        <div className={`${tab === "build" ? "order-2" : "order-3"} flex min-w-0 flex-col gap-3 lg:order-none`}>
          <TabBar tab={tab} setTab={setTab} className="hidden lg:grid" />

          {tab === "build" ? (
            <div className="flex flex-col gap-2 lg:max-h-[440px] lg:overflow-y-auto lg:pr-1">
              {computed.map((c) => {
                const bal = balanceOf(c.symbol);
                return (
                  <div key={c.id} className="rounded-2xl border border-stroke bg-bg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: c.color }} />
                      <span className="ticker">{c.symbol}</span>
                      <span className="min-w-0 flex-1 truncate text-[15px] text-muted">{c.token.name}</span>
                      {c.price !== null ? (
                        <div className="relative w-[84px]">
                          <input
                            aria-label={`${c.symbol} weight in percent`}
                            className="field num h-11 pr-7 text-right"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={c.pct}
                            onChange={(e) => update(c.id, { pct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                          />
                          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">%</span>
                        </div>
                      ) : null}
                      <button type="button" aria-label={`Remove ${c.symbol}`} className="grid h-9 w-9 place-items-center rounded-full text-xl text-muted hover:text-ink" onClick={() => setRows((rs) => rs.filter((r) => r.id !== c.id))}>
                        ×
                      </button>
                    </div>
                    {c.price !== null ? (
                      <input
                        aria-label={`${c.symbol} weight slider`}
                        className="slider mt-1"
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={c.pct}
                        style={{ ["--thumb" as string]: c.color }}
                        onChange={(e) => update(c.id, { pct: Number(e.target.value) })}
                      />
                    ) : (
                      <label className="mt-2 block">
                        <span className="label">Price unavailable: set {c.symbol} per token</span>
                        <input className="field num mt-1 h-11" inputMode="decimal" placeholder="0.0" value={c.unitsText} onChange={(e) => update(c.id, { units: e.target.value })} />
                      </label>
                    )}
                    <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-[15px] text-muted">
                      <span className="num">{c.price !== null ? usd(c.price) : "Price unavailable"}</span>
                      <span className="num">
                        {fmt(c.units, 18, 6)} {c.symbol} / token
                      </span>
                    </div>
                    {bal !== null ? <div className="num text-[15px] text-muted">You hold {fmt(bal)}</div> : null}
                  </div>
                );
              })}
              {available.length > 0 && rows.length < LIMITS.maxComponents ? (
                <label className="block">
                  <span className="sr-only">Add a stock</span>
                  <select
                    className="field cursor-pointer"
                    value=""
                    onChange={(e) => {
                      const sym = e.target.value;
                      if (!sym) return;
                      setRows((rs) => [...rs, { id: nextId, symbol: sym, pct: Math.max(0, Math.round(100 - sumPct)), units: "" }]);
                      setNextId((n) => n + 1);
                    }}
                  >
                    <option value="">+ Add a stock</option>
                    {available.map((t) => (
                      <option key={t.symbol} value={t.symbol}>
                        {t.symbol} · {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <p className="note px-1">
                Weights are fixed in token units at creation; their % value moves with prices. Prices are the underlying shares on Yahoo Finance.
              </p>
            </div>
          ) : null}

          {tab === "mint" ? (
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="serif text-[22px]">Deposit stock tokens</h3>
                <p className="note">What minting {symbol || "this basket"} pulls from your wallet once the basket is created.</p>
              </div>
              <label className="block">
                <span className="label">Amount of {symbol || "basket tokens"}</span>
                <input className="field num mt-1.5" inputMode="decimal" value={mintAmount} onChange={(e) => setMintAmount(e.target.value)} />
              </label>
              <ul className="flex flex-col divide-y divide-stroke rounded-2xl border border-stroke bg-bg px-4">
                {ticket.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                      <span className="ticker">{t.symbol}</span>
                      <span className="num text-[15px] text-muted">{allPriced ? pct(t.pct) : ""}</span>
                    </span>
                    <span className="text-right">
                      <span className="num block text-[17px]">{fmt(t.total, 18, 6)}</span>
                      {t.bal !== null ? <span className={`num block text-[15px] ${t.bal < t.total ? "text-coral" : "text-muted"}`}>you hold {fmt(t.bal)}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-[15px]">
                <dt className="whitespace-nowrap text-muted">Stock deposit value</dt>
                <dd className="num text-right">{depositUsd !== null ? usd(depositUsd) : "—"}</dd>
                <dt className="text-muted">Creator fee {bpsLabel(feeBps)}</dt>
                <dd className="num text-right">{feeUsd !== null ? usd(feeUsd) : "—"}</dd>
                <dt className="text-ink">Total cost</dt>
                <dd className="num text-right text-[17px]">{costUsd !== null ? usd(costUsd) : "—"}</dd>
                <dt className="text-muted">You receive</dt>
                <dd className="num text-right text-[17px]">
                  {amount > 0n ? formatUnits(amount, 18) : "0"} {symbol}
                  {depositUsd !== null ? <span className="block text-[15px] font-medium text-muted">worth {usd(depositUsd)}</span> : null}
                </dd>
              </dl>
              <div className="lg:hidden">{cta}</div>
            </div>
          ) : null}

          {tab === "redeem" ? (
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="serif text-[22px]">Redeem a basket</h3>
                <p className="note">Burn basket tokens, get your share of every stock in its vault. Pick one you hold.</p>
              </div>
              <Holdings account={address as Address | undefined} />
              <Link href="/baskets" className="btn btn-line btn-sm self-start">
                All baskets
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {/* mobile: sticky actions */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stroke bg-bg/95 p-3 lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
          <a href="#console" className="btn btn-cream btn-sm" onClick={() => setTab("mint")}>
            Mint
          </a>
          <a href="#console" className="btn btn-line btn-sm" onClick={() => setTab("redeem")}>
            Redeem
          </a>
        </div>
      </div>
    </section>
  );
}
