"use client";

import { useState } from "react";
import type { Address } from "viem";
import { useConnection, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { openConnect } from "@/components/wallet/ConnectButton";
import { CHAIN_ID } from "@/config/network";

export function errorText(e: unknown): string {
  const x = e as { shortMessage?: string; message?: string };
  const msg = x?.shortMessage ?? x?.message ?? "The transaction failed.";
  if (/user rejected|denied/i.test(msg)) return "You cancelled in your wallet.";
  return msg.split("\n")[0].slice(0, 180);
}

/**
 * Wallet plumbing for an action: `ready()` opens the connect sheet or switches
 * network when needed and returns the account; `send()` writes and waits for the receipt.
 */
export function useWallet() {
  const { address, isConnected, chainId } = useConnection();
  const client = usePublicClient();
  const { mutateAsync: switchChain } = useSwitchChain();
  const { mutateAsync: write } = useWriteContract();
  const [busy, setBusy] = useState<string | null>(null);

  async function ready(): Promise<Address | null> {
    if (!isConnected || !address) {
      openConnect();
      return null;
    }
    if (chainId !== CHAIN_ID) await switchChain({ chainId: CHAIN_ID });
    return address;
  }

  async function send(label: string, request: Parameters<typeof write>[0]) {
    setBusy(label);
    try {
      const hash = await write(request);
      const receipt = await client!.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The transaction reverted.");
      return receipt;
    } finally {
      setBusy(null);
    }
  }

  return { address: isConnected ? address : undefined, ready, send, busy, client };
}
