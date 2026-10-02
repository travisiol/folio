# FOLIO

- **Name**: FOLIO (in `src/config/site.ts` and `package.json`)
- **Hook**: One token. Your whole portfolio.
- **Palette**: background `#141411`, surface `#23221E`, stroke `#3A3831`, ink `#F4F0E6`, muted `#9B9588`, accent `#18C7CF` (fills and lines only, never small text).
  Series colours for components: `#18C7CF`, `#F2B51D`, `#E75B57`, `#F4F0E6`, `#62C86A`, `#7F8CFF` (tokens in `src/app/globals.css`, series in `src/config/tokens.ts`).
- **Type**: Fraunces (headlines), Literata (body), IBM Plex Mono (numbers, tickers, addresses), via `next/font/google`.
- **Layout**: centered poster headline above one large app console (sidebar: name / symbol / fee; centre: the live coin; right: Build / Mint / Redeem). Mobile: one card with Build / Mint / Redeem tabs and a sticky Mint / Redeem bar.
- **Hero object**: the basket drawn in SVG from its real weights (a coin face split into raised radial slabs), laid on the rendered coin body `public/hero-folio.png` so the face sits on a coin with volume. Logo: `brand/logo-1024.png` → `public/logo-128.png`, `src/app/icon.png`.
- **Concept source**: a Pons coin whose product mints a portfolio of tokenized stocks as one token. Concept only: contracts, copy, look and name written from scratch.

## Contracts (`contracts/contracts`)

`BasketFactory.create(name, symbol, components[], mintFeeBps)` deploys a `Basket` (ERC-20, 18 decimals); the caller is its creator.
No owner, no admin, no allowlist, no pause, no upgrade. Not audited.

- **Components**: 2–10 `(token, units)`; `units` = raw units of `token` per 1e18 basket tokens. Duplicate tokens, zero units and the zero address are refused.
  The weights are fixed in token units at creation; their % value moves with prices (no rebalancing).
- **Mint** `mint(amount, to)`: for each component pulls `deposit = ceil(amount × units / 1e18)` into the vault and `fee = floor(deposit × bps / 10000)` to the creator (fee on top of the deposit, paid in the same stock), then mints `amount` to `to`. The vault leg checks the balance increase and refuses fee-on-transfer tokens.
- **Redeem** `redeem(amount)`: burns, then sends `floor(vaultBalance × amount / totalSupply)` of each component. Dust stays in the vault for the other holders; redeeming the whole supply empties it. No redeem fee.
- **Fee**: `mintFeeBps ≤ 200` (2%). The site reads the limits from `src/config/limits.json`, and a contract test fails if they differ from `Basket.sol`.
- Reentrancy-guarded (`mint`, `redeem`). Events `BasketCreated`, `Minted`, `Redeemed`.
- Views: `components()`, `quoteMint(amount)`, `quoteRedeem(amount)`, `vault()`, factory `baskets(offset, limit)`, `basketsOf(creator)`, `count()`, `isBasket(address)`.

## Site

- `/` — headline + console: builder (verified stock tokens only, live reference price per stock, % → units at the chosen value per token, indicative value, fee), mint ticket (what one mint pulls per stock, fee, your balances, what you receive), redeem (the baskets you hold). Then the factory's baskets ("No baskets yet"), How it works, FAQ with the limits.
- `/baskets` — every basket, newest first.
- `/b/[address]` — composition (units, today's %, price, vault balance; a tag on any component outside the verified list), value per token, supply, vault value, your holdings and what redeeming them returns, creator and fee, a 3-month indicative value chart, recent mints and redeems from events, Explorer links, and the Mint / Redeem ticket (approvals as needed, then the transaction; quotes read from the contract).
- **Prices**: `/api/prices` — Yahoo Finance chart endpoint for the underlying shares (the source documented by the stockos base), server side, cached 60 s. The contracts never read a price. "Price unavailable" when Yahoo does not answer; the builder then takes units directly.
- **Unset factory**: same screens, builder usable, empty lists, wallet connect works, Create answers "Creating baskets is not open yet." on click.
- Vercel-safe: no background work, no local files; browser chain reads go through `/api/rpc`.

## Configuration

`src/config/network.ts` (chain 4663, RPC, explorer — values of `stakeback/src/config/network.ts`), `src/config/tokens.ts`
(verified addresses from `stockos/packages/token-registry` and `stakeback/src/config/network.ts`), env in `.env.example`:
`NEXT_PUBLIC_FACTORY_ADDRESS`, `NEXT_PUBLIC_FACTORY_START_BLOCK`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_SITE_URL`.

## Commands

    npm install && npm --prefix contracts install
    npm test                   # 14 contract tests
    npm run dev                # http://localhost:3897
    npx eslint . && npx next typegen && npx tsc --noEmit && npx next build
    npm --prefix contracts run node                                       # local chain on 8897
    cd contracts && npx hardhat run scripts/play-local.ts --network localhost   # factory + 3 test stocks, two-wallet play checked to the wei
    node scripts/capture.mjs   # screenshots into shots/ (BASKET=0x… adds the basket page)
    node scripts/play-ui.mjs http://localhost:3897   # local node only: Create → Approve each stock → Mint → Redeem through the site (EIP-6963 test stub)

Site against the local node (inline env, no `.env.local`): `NEXT_PUBLIC_CHAIN_ID=31337 NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8897
NEXT_PUBLIC_FACTORY_ADDRESS=<factory> NEXT_PUBLIC_LOCAL_TOKENS=NVDA=<a>,AAPL=<b>,TSLA=<c> npx next build && npx next start --port 3897`.

## Before launch (owner)

1. Deploy `BasketFactory` (no constructor arguments) on Robinhood Chain; set `NEXT_PUBLIC_FACTORY_ADDRESS` and `NEXT_PUBLIC_FACTORY_START_BLOCK`.
2. Not audited. Not tried with real Robinhood Stock Tokens (ERC-8056 scaled UI amounts: the basket counts raw units; the site assumes 1 raw token = 1 share when it shows a USD value).
