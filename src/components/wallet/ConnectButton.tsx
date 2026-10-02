"use client";

import { useState, useSyncExternalStore } from "react";
import { useConnection, useDisconnect, useSwitchChain } from "wagmi";
import { CHAIN_ID } from "@/config/network";
import { shortAddress } from "@/lib/format";
import { useMounted } from "@/lib/basket";
import { ConnectDialog } from "./ConnectDialog";

// One connect sheet for the whole page; any action can open it.
let dialogOpen = false;
const listeners = new Set<() => void>();
function setDialog(v: boolean) {
  dialogOpen = v;
  listeners.forEach((l) => l());
}
export const openConnect = () => setDialog(true);

export function ConnectHost() {
  const open = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => dialogOpen,
    () => false,
  );
  return <ConnectDialog open={open} onClose={() => setDialog(false)} />;
}

/** Connect / switch network / connected address with a disconnect menu. */
export function ConnectButton({ className = "btn btn-cream btn-sm" }: { className?: string }) {
  const mounted = useMounted();
  const { address, isConnected, chainId } = useConnection();
  const { mutate: disconnect } = useDisconnect();
  const { mutateAsync: switchChain, isPending: switching } = useSwitchChain();
  const [menu, setMenu] = useState(false);

  if (!mounted || !isConnected || !address) {
    return (
      <button type="button" className={className} onClick={openConnect}>
        Connect wallet
      </button>
    );
  }

  if (chainId !== CHAIN_ID) {
    return (
      <button type="button" className={className} disabled={switching} onClick={() => switchChain({ chainId: CHAIN_ID }).catch(() => {})}>
        {switching ? "Switching…" : "Switch network"}
      </button>
    );
  }

  return (
    <div className="relative">
      <button type="button" className="btn btn-line btn-sm mono" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-haspopup="menu">
        <span className="h-2.5 w-2.5 rounded-full bg-teal" />
        {shortAddress(address)}
      </button>
      {menu ? (
        <div role="menu" className="card absolute right-0 z-40 mt-2 w-48 p-1.5">
          <button
            type="button"
            role="menuitem"
            className="w-full rounded-2xl px-4 py-2.5 text-left font-semibold hover:bg-bg"
            onClick={() => {
              disconnect();
              setMenu(false);
            }}
          >
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}
