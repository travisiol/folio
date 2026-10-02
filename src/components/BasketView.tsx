"use client";

import Link from "next/link";
import { useState } from "react";
import { formatUnits, parseUnits, type Address } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { FACTORY_ADDRESS, explorer } from "@/config/network";
import { seriesColor } from "@/config/tokens";
import { basketAbi, erc20Abi } from "@/lib/abi";
import { ZERO, useBasket, useBasketEvents, useMounted, usePrices, valuePerToken, type ComponentInfo } from "@/lib/basket";
import { bpsLabel, fmt, pct, shortAddress, toFloat, usd } from "@/lib/format";
import { errorText, useWallet } from "@/lib/tx";
import { CoinStage } from "./Coin";
import { ValueChart } from "./ValueChart";

function parseAmount(v: string): bigint {
  try {
    return v.trim() ? parseUnits(v.trim(), 18) : 0n;
  } catch {
    return 0n;
  }
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="num mt-0.5 text-[20px]">{children}</div>
    </div>
  );
}

export function BasketView({ address }: { address: Address }) {
  const mounted = useMounted();
  const wallet = useWallet();
  const account = mounted ? wallet.address : undefined;
  const b = useBasket(address, account);
  const tickers = b.components.flatMap((c) => (c.ticker ? [c.ticker] : []));
  const prices = usePrices(tickers, true);
  const priceOf = (c: ComponentInfo) => (c.ticker ? (prices.data?.prices?.[c.ticker]?.price ?? null) : null);
  const value = valuePerToken(b.components, prices.data?.prices);
  const values = b.components.map((c) => {
    const p = priceOf(c);
    return p !== null ? toFloat(c.units, c.decimals) * p : null;
  });
  const allPriced = values.length > 0 && values.every((v) => v !== null);
  const totalVal = allPriced ? values.reduce<number>((s, v) => s + (v ?? 0), 0) : 0;
  const events = useBasketEvents(b.exists ? address : null);
  const yours = useReadContract({ address, abi: basketAbi, functionName: "quoteRedeem", args: [b.balance], query: { enabled: b.balance > 0n } });

  // indicative value history: Σ units × daily close, on days every component has a close
  const history: [number, number][] = (() => {
    const h = prices.data?.history;
    if (!h || !allPriced) return [];
    const maps = b.components.map((c) => new Map((h[c.ticker!] ?? []).map(([t, v]) => [Math.floor(t / 86_400), [t, v] as [number, number]])));
    const days = [...maps[0].keys()].filter((d) => maps.every((m) => m.has(d))).sort((x, y) => x - y);
    return days.map((d) => [maps[0].get(d)![0], b.components.reduce((s, c, i) => s + toFloat(c.units, c.decimals) * maps[i].get(d)![1], 0)]);
  })();

  if (b.loading) return <p className="wrap note py-20">Reading the basket…</p>;
  if (!b.exists)
    return (
      <div className="wrap py-20">
        <h1 className="display text-[clamp(40px,6vw,72px)]">No basket at this address.</h1>
        <p className="note mt-4 mono break-all">{address}</p>
        <Link href="/baskets" className="btn btn-cream mt-8">
          See all baskets
        </Link>
      </div>
    );

  const fromFactory = FACTORY_ADDRESS !== null && b.factory.toLowerCase() === FACTORY_ADDRESS.toLowerCase();
  const slices = b.components.map((c, i) => ({ label: c.symbol, share: allPriced ? (values[i] as number) : toFloat(c.units, c.decimals), color: seriesColor(i) }));

  return (
    <div className="wrap">
      <div className="flex flex-col items-start gap-3 pb-8 pt-4 lg:pt-8">
        <Link href="/baskets" className="pill">
          ← Baskets
        </Link>
        <h1 className="display text-[clamp(44px,7vw,88px)]">{b.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip ticker">{b.symbol}</span>
          <span className="chip">Fee {bpsLabel(b.feeBps)} to the creator</span>
          {!fromFactory ? <span className="chip border-amber">Not created by the FOLIO factory</span> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="console grid grid-cols-1 gap-5 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:p-5">
            <div className="well flex items-center justify-center overflow-hidden">
              <div className="aspect-square w-full max-w-[380px]">
                <CoinStage slices={slices} title={`${b.name} composition`} />
              </div>
            </div>
            <div className="grid grid-cols-2 content-start gap-5 p-2">
              <Stat label="Value per token">{value !== null ? usd(value) : "Price unavailable"}</Stat>
              <Stat label="Total supply">{fmt(b.supply)}</Stat>
              <Stat label="Vault value">{value !== null ? usd(value * toFloat(b.supply)) : "—"}</Stat>
              <Stat label="Your holdings">{account ? fmt(b.balance) : "—"}</Stat>
              <div className="col-span-2">
                <div className="label">Creator</div>
                <a href={explorer.address(b.creator)} target="_blank" rel="noreferrer" className="mono text-[17px] underline decoration-stroke underline-offset-4 hover:decoration-ink">
                  {shortAddress(b.creator)}
                </a>
              </div>
              {account && b.balance > 0n && yours.data ? (
                <div className="col-span-2 rounded-2xl border border-stroke bg-bg p-4">
                  <div className="label">Redeeming all yours returns</div>
                  <ul className="mt-1">
                    {b.components.map((c, i) => (
                      <li key={c.token} className="flex justify-between">
                        <span className="ticker">{c.symbol}</span>
                        <span className="num">{fmt(yours.data[1][i] ?? 0n, c.decimals, 6)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="col-span-2 flex flex-wrap gap-2">
                <a href={explorer.token(address)} target="_blank" rel="noreferrer" className="btn btn-line btn-sm">
                  Explorer
                </a>
              </div>
            </div>
          </div>

          <section className="card p-5">
            <h2 className="h2 text-[26px]">Composition</h2>
            <p className="note mt-1">Weights are fixed in token units at creation; their % value moves with prices. Today&apos;s % uses the underlying share prices.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead>
                  <tr className="label">
                    <th className="py-2 font-normal">Stock</th>
                    <th className="py-2 text-right font-normal">Per token</th>
                    <th className="py-2 text-right font-normal">Today</th>
                    <th className="py-2 text-right font-normal">Price</th>
                    <th className="py-2 text-right font-normal">In the vault</th>
                  </tr>
                </thead>
                <tbody>
                  {b.components.map((c, i) => (
                    <tr key={c.token} className="border-t border-stroke">
                      <td className="py-3">
                        <span className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ background: seriesColor(i) }} />
                          <a href={explorer.token(c.token)} target="_blank" rel="noreferrer" className="ticker hover:underline">
                            {c.symbol}
                          </a>
                          {!c.verified ? <span className="chip border-amber">Not a verified stock token</span> : null}
                        </span>
                      </td>
                      <td className="num py-3 text-right">{fmt(c.units, c.decimals, 6)}</td>
                      <td className="num py-3 text-right">{allPriced && totalVal > 0 ? pct(((values[i] as number) / totalVal) * 100) : "—"}</td>
                      <td className="num py-3 text-right">{priceOf(c) !== null ? usd(priceOf(c)) : "Price unavailable"}</td>
                      <td className="num py-3 text-right">{fmt(c.vault, c.decimals)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {history.length > 1 ? (
            <section className="card p-5">
              <h2 className="h2 text-[26px]">Indicative value per token</h2>
              <p className="note mt-1">The basket&apos;s units times each underlying share&apos;s daily close (Yahoo Finance). Not a market price for the token.</p>
              <div className="mt-4">
                <ValueChart points={history} />
              </div>
            </section>
          ) : null}

          <section className="card p-5">
            <h2 className="h2 text-[26px]">Recent mints and redeems</h2>
            {events.isLoading ? (
              <p className="note mt-3">Reading activity…</p>
            ) : (events.data ?? []).length === 0 ? (
              <p className="note mt-3">Nobody has minted this basket yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-stroke">
                {events.data!.map((e) => (
                  <li key={`${e.tx}-${e.kind}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span className="flex items-center gap-3">
                      <span className={`chip ${e.kind === "mint" ? "border-teal" : ""}`}>{e.kind === "mint" ? "Mint" : "Redeem"}</span>
                      <span className="num">
                        {fmt(e.amount)} {b.symbol}
                      </span>
                      <span className="mono text-[15px] text-muted">{shortAddress(e.account)}</span>
                    </span>
                    <a href={explorer.tx(e.tx)} target="_blank" rel="noreferrer" className="text-[15px] text-ink-2 underline decoration-stroke underline-offset-4">
                      Block {e.block.toString()}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <Ticket address={address} symbol={b.symbol} feeBps={b.feeBps} components={b.components} balance={b.balance} prices={b.components.map(priceOf)} onDone={() => { b.refetch(); events.refetch(); }} />
      </div>
    </div>
  );
}

function Ticket({
  address,
  symbol,
  feeBps,
  components,
  balance,
  prices,
  onDone,
}: {
  address: Address;
  symbol: string;
  feeBps: number;
  components: ComponentInfo[];
  balance: bigint;
  prices: (number | null)[];
  onDone: () => void;
}) {
  const mounted = useMounted();
  const { address: account, ready, send, busy } = useWallet();
  const acct = mounted ? account : undefined;
  const [tab, setTab] = useState<"mint" | "redeem">("mint");
  const [mintIn, setMintIn] = useState("1");
  const [redeemIn, setRedeemIn] = useState("");
  const [msg, setMsg] = useState<{ text: string; tx?: string } | null>(null);
  const mintAmt = parseAmount(mintIn);
  const redeemAmt = redeemIn ? parseAmount(redeemIn) : balance;
  const amountLabel = mintAmt > 0n ? formatUnits(mintAmt, 18) : "0";

  const quote = useReadContract({ address, abi: basketAbi, functionName: "quoteMint", args: [mintAmt], query: { enabled: mintAmt > 0n } });
  const rquote = useReadContract({ address, abi: basketAbi, functionName: "quoteRedeem", args: [redeemAmt], query: { enabled: redeemAmt > 0n } });
  const wallet = useReadContracts({
    contracts: components.flatMap((c) => [
      { address: c.token, abi: erc20Abi, functionName: "balanceOf", args: [acct ?? ZERO] } as const,
      { address: c.token, abi: erc20Abi, functionName: "allowance", args: [acct ?? ZERO, address] } as const,
    ]),
    query: { enabled: Boolean(acct) && components.length > 0, refetchInterval: 12_000 },
  });
  const bal = (i: number) => wallet.data?.[i * 2]?.result as bigint | undefined;
  const allowance = (i: number) => (wallet.data?.[i * 2 + 1]?.result as bigint | undefined) ?? 0n;
  const need = (i: number) => (quote.data ? quote.data[1][i] + quote.data[2][i] : 0n);

  // money before the click (USD from the reference prices; "—" if any is missing)
  const priced = prices.length === components.length && prices.every((p) => p !== null);
  const usdOf = (k: 1 | 2) => (priced && quote.data ? components.reduce((s, c, i) => s + toFloat(quote.data![k][i], c.decimals) * (prices[i] as number), 0) : null);
  const depositUsd = usdOf(1);
  const feeUsd = usdOf(2);
  const totalUsd = depositUsd !== null && feeUsd !== null ? depositUsd + feeUsd : null;

  // approvals, read on chain when connected
  const toApprove = acct && wallet.data && quote.data ? components.map((c, i) => ({ c, i })).filter(({ i }) => allowance(i) < need(i)) : [];
  const next = toApprove[0];

  async function mintStep() {
    setMsg(null);
    if (mintAmt === 0n || !quote.data) return setMsg({ text: "Enter an amount to mint." });
    try {
      const me = await ready();
      if (!me) return;
      for (let i = 0; i < components.length; i++) {
        if ((bal(i) ?? 0n) < need(i)) return setMsg({ text: `You need ${fmt(need(i), components[i].decimals, 6)} ${components[i].symbol}.` });
      }
      if (next) {
        const r = await send(`approve-${next.i}`, { address: next.c.token, abi: erc20Abi, functionName: "approve", args: [address, need(next.i)] });
        setMsg({ text: `${next.c.symbol} approved.`, tx: r.transactionHash });
        await wallet.refetch();
        return;
      }
      const r = await send("mint", { address, abi: basketAbi, functionName: "mint", args: [mintAmt, me] });
      setMsg({ text: `Minted ${amountLabel} ${symbol}.`, tx: r.transactionHash });
      await wallet.refetch();
      onDone();
    } catch (e) {
      setMsg({ text: errorText(e) });
    }
  }

  async function redeem() {
    setMsg(null);
    if (redeemAmt === 0n) return setMsg({ text: "Enter an amount to redeem." });
    try {
      const me = await ready();
      if (!me) return;
      if (redeemAmt > balance) return setMsg({ text: `You hold ${fmt(balance)} ${symbol}.` });
      const r = await send("redeem", { address, abi: basketAbi, functionName: "redeem", args: [redeemAmt] });
      setMsg({ text: `Redeemed ${formatUnits(redeemAmt, 18)} ${symbol}.`, tx: r.transactionHash });
      setRedeemIn("");
      await wallet.refetch();
      onDone();
    } catch (e) {
      setMsg({ text: errorText(e) });
    }
  }

  const busyLabel = busy?.startsWith("approve-") ? `Approving ${components[Number(busy.split("-")[1])]?.symbol}…` : busy === "mint" ? "Minting…" : busy === "redeem" ? "Redeeming…" : null;
  const mintLabel = next ? `Approve ${next.c.symbol}` : `Mint ${amountLabel} ${symbol}`;

  return (
    <aside id="ticket" className="console flex h-fit scroll-mt-6 flex-col gap-4 p-4 lg:sticky lg:top-6 lg:p-5">
      <div className="tabs" role="tablist">
        {(["mint", "redeem"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className="tab" onClick={() => setTab(t)}>
            {t === "mint" ? "Mint" : "Redeem"}
          </button>
        ))}
      </div>

      {tab === "mint" ? (
        <>
          <label className="block">
            <span className="label">Amount of {symbol}</span>
            <input className="field num mt-1.5" inputMode="decimal" value={mintIn} onChange={(e) => setMintIn(e.target.value)} />
          </label>
          <div>
            <div className="label">You deposit (creator fee included)</div>
            <ul className="mt-1.5 divide-y divide-stroke rounded-2xl border border-stroke bg-bg px-4">
              {components.map((c, i) => {
                const have = bal(i);
                return (
                  <li key={c.token} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: seriesColor(i) }} />
                      <span className="ticker">{c.symbol}</span>
                    </span>
                    <span className="text-right">
                      <span className="num block">{fmt(need(i), c.decimals, 6)}</span>
                      {have !== undefined ? <span className={`num block text-[15px] font-medium ${have < need(i) ? "text-coral" : "text-muted"}`}>you hold {fmt(have, c.decimals)}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-[15px]">
            <dt className="whitespace-nowrap text-muted">Stock deposit value</dt>
            <dd className="num text-right">{depositUsd !== null ? usd(depositUsd) : "—"}</dd>
            <dt className="text-muted">Creator fee {bpsLabel(feeBps)}</dt>
            <dd className="num text-right">{feeUsd !== null ? usd(feeUsd) : "—"}</dd>
            <dt>Total cost</dt>
            <dd className="num text-right text-[17px]">{totalUsd !== null ? usd(totalUsd) : "—"}</dd>
            <dt className="text-muted">You receive</dt>
            <dd className="num text-right text-[17px]">
              {amountLabel} {symbol}
              {depositUsd !== null ? <span className="block text-[15px] font-medium text-muted">worth {usd(depositUsd)}</span> : null}
            </dd>
          </dl>
          {acct ? (
            <p className="rounded-2xl border border-stroke bg-bg px-4 py-2.5 text-[15px]" data-testid="approvals">
              {wallet.data && quote.data ? (toApprove.length ? `Approvals needed: ${toApprove.map(({ c }) => c.symbol).join(", ")}` : "Approvals: all set") : "Reading approvals…"}
            </p>
          ) : null}
          <button type="button" className="btn btn-cream h-14 w-full" onClick={mintStep} disabled={busy !== null}>
            {busyLabel ?? mintLabel}
          </button>
          <p className="note">One transaction per click: each stock is approved once for the exact amount, then the mint.</p>
        </>
      ) : (
        <>
          <label className="block">
            <span className="label">Amount of {symbol} (you hold {acct ? fmt(balance) : "—"})</span>
            <input className="field num mt-1.5" inputMode="decimal" placeholder={formatUnits(balance, 18)} value={redeemIn} onChange={(e) => setRedeemIn(e.target.value)} />
          </label>
          <div>
            <div className="label">You receive</div>
            <ul className="mt-1.5 divide-y divide-stroke rounded-2xl border border-stroke bg-bg px-4">
              {components.map((c, i) => (
                <li key={c.token} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: seriesColor(i) }} />
                    <span className="ticker">{c.symbol}</span>
                  </span>
                  <span className="num">{fmt(rquote.data?.[1]?.[i] ?? 0n, c.decimals, 6)}</span>
                </li>
              ))}
            </ul>
          </div>
          <button type="button" className="btn btn-cream h-14 w-full" onClick={redeem} disabled={busy !== null}>
            {busyLabel ?? `Redeem ${symbol}`}
          </button>
          <p className="note">You get your share of what the vault holds, rounded down; the dust stays for the other holders. No fee on redeem.</p>
        </>
      )}

      {msg ? (
        <p className="note" role="status">
          {msg.text}{" "}
          {msg.tx ? (
            <a href={explorer.tx(msg.tx)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              View transaction
            </a>
          ) : null}
        </p>
      ) : null}
    </aside>
  );
}
