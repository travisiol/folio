/**
 * Local play on a hardhat node (never a real network): deploys the factory and three
 * test "stocks", then as two wallets: A creates a basket with a 0.3% fee, B mints,
 * the fee lands with A, B transfers to C, C and B redeem. Every balance is checked to the wei.
 *
 *   npx hardhat run scripts/play-local.ts --network localhost
 * Prints the addresses the site needs (NEXT_PUBLIC_FACTORY_ADDRESS, NEXT_PUBLIC_LOCAL_TOKENS).
 */
import { ethers, network } from "hardhat";

const E18 = 10n ** 18n;
const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

function check(label: string, got: bigint, want: bigint) {
  if (got !== want) throw new Error(`${label}: got ${got}, want ${want}`);
  console.log(`ok  ${label} = ${got}`);
}

async function main() {
  if (network.name !== "localhost" && network.name !== "hardhat") throw new Error("local networks only");
  const [A, B, C, D] = await ethers.getSigners();
  const Stock = await ethers.getContractFactory("MockStock");
  const nvda = await Stock.deploy("NVDA test stock", "NVDA");
  const aapl = await Stock.deploy("AAPL test stock", "AAPL");
  const tsla = await Stock.deploy("TSLA test stock", "TSLA");
  const meta = await Stock.deploy("META test stock", "META");
  const nflx = await Stock.deploy("NFLX test stock", "NFLX");
  const tokens = [nvda, aapl, tsla];
  const factory = await (await ethers.getContractFactory("BasketFactory")).deploy();

  // units per 1e18 basket tokens (≈ 45/35/20 % of $100 at round test prices)
  const units = [192_307_692_307_692_307n, 104_895_104_895_104_895n, 53_967_611_336_032_388n];
  const comps = tokens.map((t, i) => ({ token: t.target as string, units: units[i] }));
  const tx = await factory.connect(A).create("Local Three", "LOC3", comps, 30);
  await tx.wait();
  const basketAddr = (await factory.baskets(0, 1))[0];
  const basket = await ethers.getContractAt("Basket", basketAddr);

  for (const t of tokens) {
    await (await t.mint(B.address, 1_000n * E18)).wait();
    await (await t.connect(B).approve(basketAddr, ethers.MaxUint256)).wait();
  }

  // B mints 2.5 tokens
  const amount = 2n * E18 + E18 / 2n;
  const aBefore = await Promise.all(tokens.map((t) => t.balanceOf(A.address)));
  const bBefore = await Promise.all(tokens.map((t) => t.balanceOf(B.address)));
  await (await basket.connect(B).mint(amount, B.address)).wait();
  for (let i = 0; i < 3; i++) {
    const dep = ceilDiv(amount * units[i], E18);
    const fee = (dep * 30n) / 10_000n;
    check(`vault ${i}`, await tokens[i].balanceOf(basketAddr), dep);
    check(`fee to creator ${i}`, (await tokens[i].balanceOf(A.address)) - aBefore[i], fee);
    check(`B paid ${i}`, bBefore[i] - (await tokens[i].balanceOf(B.address)), dep + fee);
  }
  check("B basket balance", await basket.balanceOf(B.address), amount);

  // B transfers 1 to C, C redeems it
  await (await basket.connect(B).transfer(C.address, E18)).wait();
  const vault1 = await Promise.all(tokens.map((t) => t.balanceOf(basketAddr)));
  const supply1 = await basket.totalSupply();
  await (await basket.connect(C).redeem(E18)).wait();
  for (let i = 0; i < 3; i++) check(`C received ${i}`, await tokens[i].balanceOf(C.address), (vault1[i] * E18) / supply1);

  // B redeems 0.5
  const vault2 = await Promise.all(tokens.map((t) => t.balanceOf(basketAddr)));
  const supply2 = await basket.totalSupply();
  const b2 = await Promise.all(tokens.map((t) => t.balanceOf(B.address)));
  await (await basket.connect(B).redeem(E18 / 2n)).wait();
  for (let i = 0; i < 3; i++) check(`B received ${i}`, (await tokens[i].balanceOf(B.address)) - b2[i], (vault2[i] * (E18 / 2n)) / supply2);
  check("supply", await basket.totalSupply(), E18);

  // wallet D gets test stocks to drive the site itself (scripts/play-ui.mjs)
  for (const t of [nvda, aapl, tsla, meta, nflx]) await (await t.mint(D.address, 100n * E18)).wait();

  const out = {
    factory: factory.target,
    basket: basketAddr,
    localTokens: `NVDA=${nvda.target},AAPL=${aapl.target},TSLA=${tsla.target},META=${meta.target},NFLX=${nflx.target}`,
    uiWallet: D.address,
  };
  console.log(JSON.stringify(out));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
