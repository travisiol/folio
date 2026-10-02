"use client";

import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import type { Address } from "viem";
import { usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { FACTORY_ADDRESS, FACTORY_START_BLOCK, LOOKBACK_BLOCKS } from "@/config/network";
import { findToken } from "@/config/tokens";
import { basketAbi, erc20Abi, factoryAbi } from "./abi";

export const ZERO: Address = "0x0000000000000000000000000000000000000000";
export const hasFactory = Boolean(FACTORY_ADDRESS);
export const ONE = 10n ** 18n;

export function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

// ------------------------------------------------------------------ prices

export type PriceMap = Record<string, { price: number; time: number } | null>;
export type HistoryMap = Record<string, [number, number][]>;

/** Reference prices of the underlying shares (server route, Yahoo Finance, 60 s cache). */
export function usePrices(tickers: string[], history = false) {
  const key = [...new Set(tickers)].sort().join(",");
  return useQuery({
    queryKey: ["prices", key, history],
    enabled: key.length > 0,
    refetchInterval: 60_000,
    queryFn: async (): Promise<{ prices: PriceMap; history?: HistoryMap }> => {
      const res = await fetch(`/api/prices?t=${key}${history ? "&history=1" : ""}`);
      if (!res.ok) return { prices: {} };
      return res.json();
    },
  });
}

/**
 * Units of a component per 1e18 basket tokens so that `pct` % of `valueUsd`
 * is held in it at `price`. Integer math on micro-dollars; never zero.
 */
export function unitsFor(valueUsd: number, pct: number, price: number, decimals = 18): bigint {
  if (!(valueUsd > 0) || !(pct > 0) || !(price > 0)) return 0n;
  const valueMicro = BigInt(Math.round(valueUsd * pct * 10_000)); // valueUsd × pct/100 × 1e6
  const priceMicro = BigInt(Math.max(1, Math.round(price * 1e6)));
  const u = (valueMicro * 10n ** BigInt(decimals)) / priceMicro;
  return u > 0n ? u : 1n;
}

// ------------------------------------------------------------------ factory

export interface BasketSummary {
  address: Address;
  name: string;
  symbol: string;
  supply: bigint;
  feeBps: number;
  creator: Address;
  components: { token: Address; units: bigint }[];
}

const LIST_LIMIT = 60n;

/** The factory's baskets, newest first (up to 60), with their summary. */
export function useBasketList() {
  const count = useReadContract({ address: FACTORY_ADDRESS ?? ZERO, abi: factoryAbi, functionName: "count", query: { enabled: hasFactory, refetchInterval: 15_000 } });
  const n = count.data ?? 0n;
  const offset = n > LIST_LIMIT ? n - LIST_LIMIT : 0n;
  const page = useReadContract({
    address: FACTORY_ADDRESS ?? ZERO,
    abi: factoryAbi,
    functionName: "baskets",
    args: [offset, LIST_LIMIT],
    query: { enabled: hasFactory && n > 0n, refetchInterval: 15_000 },
  });
  const addrs = [...(page.data ?? [])].reverse();
  const fields = ["name", "symbol", "totalSupply", "mintFeeBps", "creator", "components"] as const;
  const details = useReadContracts({
    contracts: addrs.flatMap((address) => fields.map((functionName) => ({ address, abi: basketAbi, functionName }) as const)),
    query: { enabled: addrs.length > 0, refetchInterval: 15_000 },
  });
  const list: BasketSummary[] = [];
  if (details.data) {
    addrs.forEach((address, i) => {
      const r = details.data.slice(i * fields.length, (i + 1) * fields.length).map((x) => x.result);
      if (r.some((x) => x === undefined)) return;
      list.push({
        address,
        name: r[0] as string,
        symbol: r[1] as string,
        supply: r[2] as bigint,
        feeBps: Number(r[3] as bigint),
        creator: r[4] as Address,
        components: (r[5] as readonly { token: Address; units: bigint }[]).map((c) => ({ token: c.token, units: c.units })),
      });
    });
  }
  return {
    count: n,
    list,
    loading: hasFactory && (count.isLoading || (n > 0n && (page.isLoading || details.isLoading))),
  };
}

// ------------------------------------------------------------------ one basket

export interface ComponentInfo {
  token: Address;
  units: bigint;
  vault: bigint;
  symbol: string;
  decimals: number;
  verified: boolean;
  ticker: string | null;
}

export function useBasket(address: Address | null, account?: Address) {
  const enabled = Boolean(address);
  const a = address ?? ZERO;
  const core = useReadContracts({
    contracts: [
      { address: a, abi: basketAbi, functionName: "name" },
      { address: a, abi: basketAbi, functionName: "symbol" },
      { address: a, abi: basketAbi, functionName: "totalSupply" },
      { address: a, abi: basketAbi, functionName: "creator" },
      { address: a, abi: basketAbi, functionName: "mintFeeBps" },
      { address: a, abi: basketAbi, functionName: "components" },
      { address: a, abi: basketAbi, functionName: "vault" },
      { address: a, abi: basketAbi, functionName: "factory" },
      { address: a, abi: basketAbi, functionName: "balanceOf", args: [account ?? ZERO] },
    ],
    query: { enabled, refetchInterval: 12_000 },
  });
  const r = core.data?.map((x) => x.result);
  const comps = (r?.[5] as readonly { token: Address; units: bigint }[] | undefined) ?? [];
  const vault = r?.[6] as readonly [readonly Address[], readonly bigint[]] | undefined;
  const meta = useReadContracts({
    contracts: comps.flatMap((c) => [
      { address: c.token, abi: erc20Abi, functionName: "symbol" } as const,
      { address: c.token, abi: erc20Abi, functionName: "decimals" } as const,
    ]),
    query: { enabled: comps.length > 0 },
  });
  const components: ComponentInfo[] = comps.map((c, i) => {
    const known = findToken(c.token);
    const sym = meta.data?.[i * 2]?.result as string | undefined;
    const dec = meta.data?.[i * 2 + 1]?.result as number | undefined;
    return {
      token: c.token,
      units: c.units,
      vault: vault?.[1]?.[i] ?? 0n,
      symbol: known?.symbol ?? sym ?? "?",
      decimals: known?.decimals ?? (typeof dec === "number" ? dec : 18),
      verified: Boolean(known),
      ticker: known?.ticker ?? null,
    };
  });
  const ok = Boolean(r && r[0] !== undefined && r[5] !== undefined);
  return {
    exists: ok,
    loading: enabled && core.isLoading,
    error: enabled && !core.isLoading && !ok,
    name: (r?.[0] as string) ?? "",
    symbol: (r?.[1] as string) ?? "",
    supply: (r?.[2] as bigint) ?? 0n,
    creator: (r?.[3] as Address) ?? ZERO,
    feeBps: Number((r?.[4] as bigint) ?? 0n),
    factory: (r?.[7] as Address) ?? ZERO,
    balance: (r?.[8] as bigint) ?? 0n,
    components,
    refetch: core.refetch,
  };
}

// ------------------------------------------------------------------ history

export interface BasketEvent {
  kind: "mint" | "redeem";
  account: Address;
  amount: bigint;
  amounts: readonly bigint[];
  fees: readonly bigint[];
  block: bigint;
  tx: `0x${string}`;
}

/** Recent mints and redeems of one basket, from its events (newest first). */
export function useBasketEvents(address: Address | null) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["basket-events", address],
    enabled: Boolean(address && client),
    refetchInterval: 20_000,
    queryFn: async (): Promise<BasketEvent[]> => {
      if (!address || !client) return [];
      const latest = await client.getBlockNumber();
      const fromBlock = FACTORY_START_BLOCK > 0n ? FACTORY_START_BLOCK : latest > LOOKBACK_BLOCKS ? latest - LOOKBACK_BLOCKS : 0n;
      const [mints, redeems] = await Promise.all([
        client.getContractEvents({ address, abi: basketAbi, eventName: "Minted", fromBlock, toBlock: latest }),
        client.getContractEvents({ address, abi: basketAbi, eventName: "Redeemed", fromBlock, toBlock: latest }),
      ]);
      const out: BasketEvent[] = [
        ...mints.map((l) => ({
          kind: "mint" as const,
          account: l.args.to as Address,
          amount: l.args.amount ?? 0n,
          amounts: l.args.deposits ?? [],
          fees: l.args.fees ?? [],
          block: l.blockNumber ?? 0n,
          tx: l.transactionHash as `0x${string}`,
        })),
        ...redeems.map((l) => ({
          kind: "redeem" as const,
          account: l.args.account as Address,
          amount: l.args.amount ?? 0n,
          amounts: l.args.amounts ?? [],
          fees: [] as bigint[],
          block: l.blockNumber ?? 0n,
          tx: l.transactionHash as `0x${string}`,
        })),
      ];
      return out.sort((x, y) => (y.block > x.block ? 1 : y.block < x.block ? -1 : 0)).slice(0, 25);
    },
  });
}

/** Indicative USD value of one basket token: Σ units × price (null if any price is missing). */
export function valuePerToken(components: { units: bigint; decimals: number; ticker: string | null }[], prices: PriceMap | undefined): number | null {
  if (!prices || components.length === 0) return null;
  let total = 0;
  for (const c of components) {
    const p = c.ticker ? prices[c.ticker] : null;
    if (!p) return null;
    total += (Number(c.units) / 10 ** c.decimals) * p.price;
  }
  return total;
}
