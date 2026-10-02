import type { Address } from "viem";
import { IS_MAINNET, parseAddress } from "./network";

/**
 * The stock tokens the builder offers. Only verified Robinhood Stock Tokens:
 * - NVDA, AAPL, META, TSLA, SPY, GLD, EWY, INDA: `stockos/packages/token-registry`
 *   (name/symbol/decimals read with eth_call at block 67,399,213, issuer "Robinhood Token").
 * - DELL, NFLX (and NVDA, AAPL, META, TSLA again): `stakeback/src/config/network.ts`
 *   (Robinhood's official asset list, read on chain at block 77,355,971).
 * HOOD, MSFT, GOOGL… have no verified address and are not offered.
 *
 * `ticker` is the underlying share's ticker, used only for the reference price.
 */
export interface StockToken {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  ticker: string;
}

const MAINNET: StockToken[] = [
  { symbol: "NVDA", name: "NVIDIA", address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", decimals: 18, ticker: "NVDA" },
  { symbol: "AAPL", name: "Apple", address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9", decimals: 18, ticker: "AAPL" },
  { symbol: "TSLA", name: "Tesla", address: "0x322f0929C4625Ed5BAd873C95208d54E1C003B2D", decimals: 18, ticker: "TSLA" },
  { symbol: "META", name: "Meta Platforms", address: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35", decimals: 18, ticker: "META" },
  { symbol: "NFLX", name: "Netflix", address: "0xE0444EF8BF4eD74f74FD73686e2ddF4C1c5591E8", decimals: 18, ticker: "NFLX" },
  { symbol: "DELL", name: "Dell", address: "0x941AE714EC6D8130c7B75d67160Ca08f1e7d11Dd", decimals: 18, ticker: "DELL" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", address: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C", decimals: 18, ticker: "SPY" },
  { symbol: "GLD", name: "SPDR Gold Trust", address: "0xC9a981FEE1F9DEc688bb123ccDeCc63D0deBFC4e", decimals: 18, ticker: "GLD" },
  { symbol: "EWY", name: "iShares MSCI South Korea", address: "0x7f0abef0c07280f82c6a08ead09ded6bae2c13fc", decimals: 18, ticker: "EWY" },
  { symbol: "INDA", name: "iShares MSCI India", address: "0xacef2e09adb47ad6abebad9ff06689e60615c2b6", decimals: 18, ticker: "INDA" },
];

/**
 * Local hardhat node only (chain id ≠ 4663): NEXT_PUBLIC_LOCAL_TOKENS="NVDA=0x…,AAPL=0x…"
 * maps verified symbols to local test tokens. Ignored on Robinhood Chain.
 */
function localTokens(): StockToken[] {
  const raw = process.env.NEXT_PUBLIC_LOCAL_TOKENS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((pair) => pair.split("="))
    .flatMap(([sym, addr]) => {
      const base = MAINNET.find((t) => t.symbol === sym?.trim().toUpperCase());
      const address = parseAddress(addr);
      return base && address ? [{ ...base, address }] : [];
    });
}

export const STOCK_TOKENS: StockToken[] = IS_MAINNET ? MAINNET : localTokens();

export function findToken(address: string): StockToken | undefined {
  const a = address.toLowerCase();
  return STOCK_TOKENS.find((t) => t.address.toLowerCase() === a);
}

export function findSymbol(symbol: string): StockToken | undefined {
  return STOCK_TOKENS.find((t) => t.symbol === symbol);
}

/** Series colours, in order of the components. */
export const SERIES = ["#18C7CF", "#F2B51D", "#E75B57", "#F4F0E6", "#62C86A", "#7F8CFF", "#3FA7AC", "#C9962A", "#B9B2A3", "#9AA4FF"];
export const seriesColor = (i: number) => SERIES[i % SERIES.length];
