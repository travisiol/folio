"use client";

import Link from "next/link";
import type { Address } from "viem";
import { useReadContracts } from "wagmi";
import { basketAbi } from "@/lib/abi";
import { useBasketList } from "@/lib/basket";
import { fmt } from "@/lib/format";
import { openConnect } from "./wallet/ConnectButton";

/** The baskets the connected wallet holds, each with a link to redeem. */
export function Holdings({ account }: { account?: Address }) {
  const { list, loading } = useBasketList();
  const bals = useReadContracts({
    contracts: list.map((b) => ({ address: b.address, abi: basketAbi, functionName: "balanceOf", args: [account!] }) as const),
    query: { enabled: Boolean(account) && list.length > 0, refetchInterval: 15_000 },
  });

  if (!account) {
    return (
      <div className="rounded-2xl border border-stroke bg-bg p-4">
        <p className="note">Connect your wallet to see the baskets you hold.</p>
        <button type="button" className="btn btn-cream btn-sm mt-3" onClick={openConnect}>
          Connect wallet
        </button>
      </div>
    );
  }
  const held = list.map((b, i) => ({ b, bal: (bals.data?.[i]?.result as bigint | undefined) ?? 0n })).filter((x) => x.bal > 0n);
  if (loading || bals.isLoading) return <p className="note rounded-2xl border border-stroke bg-bg p-4">Reading your baskets…</p>;
  if (held.length === 0) return <p className="note rounded-2xl border border-stroke bg-bg p-4">You hold no basket tokens yet.</p>;
  return (
    <ul className="flex flex-col divide-y divide-stroke rounded-2xl border border-stroke bg-bg px-4">
      {held.map(({ b, bal }) => (
        <li key={b.address} className="flex items-center justify-between gap-3 py-3">
          <span className="min-w-0">
            <span className="serif block truncate text-[18px]">{b.name}</span>
            <span className="num text-[15px] text-muted">
              {fmt(bal)} {b.symbol}
            </span>
          </span>
          <Link href={`/b/${b.address}#ticket`} className="btn btn-line btn-sm">
            Redeem
          </Link>
        </li>
      ))}
    </ul>
  );
}
