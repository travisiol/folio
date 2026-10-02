import { defineChain, getAddress, isAddress, type Address } from "viem";

/**
 * Network and contract configuration — the only place addresses live.
 *
 * Nothing here is guessed:
 * - Chain id, RPC and explorer are the values of the verified config in
 *   `stakeback/src/config/network.ts` (official Robinhood Chain docs; chain
 *   id read from the RPC: 0x1237 = 4663). The env overrides exist for a
 *   local hardhat node only.
 * - The basket factory is `null` until the owner deploys it and sets
 *   NEXT_PUBLIC_FACTORY_ADDRESS.
 */
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 4663);
export const IS_MAINNET = CHAIN_ID === 4663;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL?.trim() || "https://rpc.mainnet.chain.robinhood.com";
export const EXPLORER_URL = (process.env.NEXT_PUBLIC_EXPLORER_URL?.trim() || "https://robinhoodchain.blockscout.com").replace(/\/$/, "");

/** The browser reads through our same-origin relay (see app/api/rpc); the server goes direct. */
export const BROWSER_RPC_URL = "/api/rpc";

export function parseAddress(raw: string | undefined | null): Address | null {
  const v = raw?.trim();
  return v && isAddress(v) ? getAddress(v) : null;
}

/** The BasketFactory contract. `null` until set. */
export const FACTORY_ADDRESS: Address | null = parseAddress(process.env.NEXT_PUBLIC_FACTORY_ADDRESS);

/** Block the factory was deployed in; mint and redeem history is read from here. 0 = the last LOOKBACK_BLOCKS. */
export const FACTORY_START_BLOCK = BigInt(process.env.NEXT_PUBLIC_FACTORY_START_BLOCK || 0);
export const LOOKBACK_BLOCKS = 400_000n;

export const robinhoodChain = defineChain({
  id: CHAIN_ID,
  name: IS_MAINNET ? "Robinhood Chain" : "Local chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Explorer", url: EXPLORER_URL } },
  contracts: IS_MAINNET ? { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } } : undefined,
  testnet: !IS_MAINNET,
});

export const explorer = {
  address: (a: string) => `${EXPLORER_URL}/address/${a}`,
  token: (a: string) => `${EXPLORER_URL}/token/${a}`,
  tx: (h: string) => `${EXPLORER_URL}/tx/${h}`,
};
