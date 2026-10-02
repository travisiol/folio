import { BasketList } from "@/components/BasketList";
import { Console } from "@/components/Console";
import { LIMITS, site } from "@/config/site";
import { bpsLabel } from "@/lib/format";

const STEPS = [
  {
    n: "1",
    title: "Build",
    text: `Pick ${LIMITS.minComponents} to ${LIMITS.maxComponents} Robinhood Stock Tokens and set their weights in %. FOLIO turns each weight into a fixed number of token units per basket token, at today's price. Set your mint fee, from 0 to ${bpsLabel(LIMITS.maxFeeBps)}.`,
  },
  {
    n: "2",
    title: "Mint",
    text: "Anyone mints by depositing every stock in the basket's proportions. The deposit goes into the basket's own vault, the fee goes to the creator in the same stocks, and the minter gets the basket token.",
  },
  {
    n: "3",
    title: "Redeem",
    text: "Any holder burns basket tokens at any time and receives their share of every stock in the vault, rounded down to the smallest unit. The token is an ordinary ERC-20: send it, hold it, give it.",
  },
];

const FAQ = [
  {
    q: "Who holds the stocks?",
    a: "The basket contract itself. It has no owner and no admin: nobody can pause it, change it, or move the vault. The only way stocks leave the vault is a holder redeeming basket tokens.",
  },
  {
    q: "Why do the weights drift?",
    a: "Weights are fixed in token units at creation; their % value moves with prices. A basket that starts at 32% NVDA holds the same NVDA per token tomorrow, whatever NVDA does. There is no rebalancing.",
  },
  {
    q: "What do I get when I redeem?",
    a: "Stock tokens, not cash: your basket tokens divided by the total supply, times each stock the vault holds, rounded down. The rounding dust stays in the vault for the other holders. Redeeming has no fee.",
  },
  {
    q: "Where do the prices come from?",
    a: "The prices shown are the underlying shares on Yahoo Finance, used to turn your % into units and to estimate a basket's value. The contracts never read a price. A stock token can trade away from its share price, and a stock token's balance can carry a display multiplier after splits or dividends; FOLIO counts raw token units.",
  },
  {
    q: "Which stocks can I add?",
    a: "The builder offers only Robinhood Stock Tokens whose addresses were checked on chain. The contract itself accepts any ERC-20, so a basket page marks any component that is not on that verified list. Tokens that take a fee on transfer are refused at mint.",
  },
  {
    q: "Is it audited? Can I lose money?",
    a: "No audit. The contracts are short and tested, but untested risks remain. The stocks inside can lose value, and nothing on FOLIO promises a price, a return or a buyer for basket tokens.",
  },
];

export default function Home() {
  return (
    <div className="pb-24 lg:pb-0">
      <section className="wrap pt-4 text-center lg:pt-0">
        <h1 className="display mx-auto max-w-[980px] text-[clamp(44px,5vw,76px)]">{site.hook}</h1>
        <p className="mx-auto mt-3 max-w-[1000px] text-[19px] leading-snug text-ink-2 lg:text-[21px]">
          Robinhood Stock Tokens in one basket, minted as one token, redeemable for the stocks any time.
        </p>
      </section>

      <div className="wrap mt-6 lg:mt-6">
        <Console />
      </div>

      <section className="wrap mt-20" id="baskets">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="display text-[clamp(36px,4vw,56px)]">Baskets</h2>
        </div>
        <BasketList limit={6} />
      </section>

      <section className="wrap mt-24 scroll-mt-6" id="how">
        <h2 className="display text-[clamp(36px,4vw,56px)]">How it works</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="card p-6">
              <span className="num grid h-11 w-11 place-items-center rounded-full bg-teal text-[18px] text-bg">{s.n}</span>
              <h3 className="serif mt-4 text-[28px]">{s.title}</h3>
              <p className="mt-2 text-[17px] leading-relaxed text-ink-2">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap mt-24 scroll-mt-6" id="faq">
        <h2 className="display text-[clamp(36px,4vw,56px)]">FAQ</h2>
        <div className="mt-8 grid gap-x-10 md:grid-cols-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group border-t border-stroke py-5" open>
              <summary className="serif cursor-pointer list-none text-[22px]">{f.q}</summary>
              <p className="mt-2 text-[17px] leading-relaxed text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
