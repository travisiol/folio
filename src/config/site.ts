import limits from "./limits.json";

/** The brand, in one place. */
export const site = {
  name: "FOLIO",
  hook: "One token. Your whole portfolio.",
  description:
    "Build a basket of Robinhood Stock Tokens and mint it as one ERC-20. Redeem it any time for its share of the stocks in the vault. Creators earn their fee on every mint.",
  url: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3897",
} as const;

/** The contract's limits (a contract test fails if these differ from Basket.sol). */
export const LIMITS = {
  minComponents: limits.minComponents,
  maxComponents: limits.maxComponents,
  maxFeeBps: limits.maxFeeBps,
} as const;
