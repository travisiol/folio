import { expect } from "chai";
import { ethers } from "hardhat";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const E18 = 10n ** 18n;
const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

async function setup(feeBps = 30n) {
  const [creator, alice, bob, carol] = await ethers.getSigners();
  const Stock = await ethers.getContractFactory("MockStock");
  const a = await Stock.deploy("Stock A", "STA");
  const b = await Stock.deploy("Stock B", "STB");
  const c = await Stock.deploy("Stock C", "STC");
  const Factory = await ethers.getContractFactory("BasketFactory");
  const factory = await Factory.deploy();

  // odd units on purpose so rounding shows
  const comps = [
    { token: await a.getAddress(), units: 1_500_000_000_000_000_001n },
    { token: await b.getAddress(), units: 333_333_333_333_333_333n },
    { token: await c.getAddress(), units: 7n },
  ];
  await factory.connect(creator).create("Big Three", "BIG3", comps, feeBps);
  const basketAddr = (await factory.baskets(0, 1))[0];
  const basket = await ethers.getContractAt("Basket", basketAddr);
  for (const t of [a, b, c]) {
    for (const s of [alice, bob, carol]) {
      await t.mint(s.address, 1_000_000n * E18);
      await t.connect(s).approve(basketAddr, ethers.MaxUint256);
    }
  }
  return { creator, alice, bob, carol, a, b, c, factory, basket, comps, tokens: [a, b, c] };
}

describe("BasketFactory: create", () => {
  it("creates a basket with its components, creator and fee", async () => {
    const { basket, creator, comps, factory } = await setup(30n);
    expect(await basket.name()).to.equal("Big Three");
    expect(await basket.symbol()).to.equal("BIG3");
    expect(await basket.decimals()).to.equal(18n);
    expect(await basket.creator()).to.equal(creator.address);
    expect(await basket.mintFeeBps()).to.equal(30n);
    expect(await basket.factory()).to.equal(await factory.getAddress());
    const got = await basket.components();
    expect(got.map((x) => [x.token, x.units])).to.deep.equal(comps.map((x) => [x.token, x.units]));
  });

  it("enforces 2–10 components, fee ≤ 2%, no duplicate, no zero units", async () => {
    const { factory, a, b } = await setup();
    const Stock = await ethers.getContractFactory("MockStock");
    const many = [];
    for (let i = 0; i < 11; i++) many.push({ token: await (await Stock.deploy(`S${i}`, `S${i}`)).getAddress(), units: E18 });
    const basketErr = await ethers.getContractFactory("Basket");
    const A = await a.getAddress();
    const B = await b.getAddress();
    await expect(factory.create("x", "x", [{ token: A, units: E18 }], 0)).to.be.revertedWithCustomError(basketErr, "ComponentCount");
    await expect(factory.create("x", "x", many, 0)).to.be.revertedWithCustomError(basketErr, "ComponentCount");
    await expect(factory.create("x", "x", many.slice(0, 10), 0)).to.not.be.reverted;
    await expect(factory.create("x", "x", many.slice(0, 2), 201)).to.be.revertedWithCustomError(basketErr, "FeeTooHigh");
    await expect(factory.create("x", "x", many.slice(0, 2), 200)).to.not.be.reverted;
    await expect(factory.create("x", "x", [{ token: A, units: E18 }, { token: A, units: 2n }], 0)).to.be.revertedWithCustomError(basketErr, "DuplicateToken");
    await expect(factory.create("x", "x", [{ token: A, units: E18 }, { token: B, units: 0n }], 0)).to.be.revertedWithCustomError(basketErr, "ZeroUnits");
    await expect(factory.create("x", "x", [{ token: A, units: E18 }, { token: ethers.ZeroAddress, units: 1n }], 0)).to.be.revertedWithCustomError(basketErr, "ZeroToken");
  });

  it("lists baskets by page and by creator", async () => {
    const { factory, creator, alice, a, b } = await setup();
    const comps = [{ token: await a.getAddress(), units: E18 }, { token: await b.getAddress(), units: E18 }];
    await factory.connect(alice).create("Two", "TWO", comps, 0);
    await factory.connect(alice).create("Three", "THR", comps, 100);
    expect(await factory.count()).to.equal(3n);
    const all = await factory.baskets(0, 10);
    expect(all.length).to.equal(3);
    expect(await factory.baskets(1, 1)).to.deep.equal([all[1]]);
    expect(await factory.baskets(5, 2)).to.deep.equal([]);
    expect(await factory.basketsOf(alice.address)).to.deep.equal([all[1], all[2]]);
    expect(await factory.basketsOf(creator.address)).to.deep.equal([all[0]]);
    expect(await factory.isBasket(all[2])).to.equal(true);
    await expect(factory.connect(alice).create("Four", "FOUR", comps, 0)).to.emit(factory, "BasketCreated");
  });

  it("the limits printed on the site equal the contract constants", async () => {
    const { basket } = await setup();
    const site = JSON.parse(readFileSync(resolve(__dirname, "../../src/config/limits.json"), "utf8"));
    expect(BigInt(site.minComponents)).to.equal(await basket.MIN_COMPONENTS());
    expect(BigInt(site.maxComponents)).to.equal(await basket.MAX_COMPONENTS());
    expect(BigInt(site.maxFeeBps)).to.equal(await basket.MAX_FEE_BPS());
  });
});

describe("Basket: mint", () => {
  it("quotes deposits rounded up and fees rounded down, to the wei", async () => {
    const { basket, comps } = await setup(30n);
    for (const amount of [1n, 3n, E18, 123_456_789_012_345_678_901n]) {
      const [, deposits, fees] = await basket.quoteMint(amount);
      comps.forEach((c, i) => {
        const d = ceilDiv(amount * c.units, E18);
        expect(deposits[i]).to.equal(d);
        expect(fees[i]).to.equal((d * 30n) / 10_000n);
      });
    }
    const [, d1] = await basket.quoteMint(1n);
    expect(d1).to.deep.equal([2n, 1n, 1n]); // ceil(1.5…), ceil(0.33…), ceil(7e-18)
  });

  it("pulls exactly the quote, sends the fee to the creator, mints the amount", async () => {
    const { basket, alice, bob, creator, tokens } = await setup(30n);
    const amount = 2n * E18 + 17n;
    const [, deposits, fees] = await basket.quoteMint(amount);
    const before = await Promise.all(tokens.map((t) => t.balanceOf(alice.address)));
    const creatorBefore = await Promise.all(tokens.map((t) => t.balanceOf(creator.address)));
    await expect(basket.connect(alice).mint(amount, bob.address)).to.emit(basket, "Minted");
    for (let i = 0; i < 3; i++) {
      expect(await tokens[i].balanceOf(alice.address)).to.equal(before[i] - deposits[i] - fees[i]);
      expect(await tokens[i].balanceOf(await basket.getAddress())).to.equal(deposits[i]);
      expect((await tokens[i].balanceOf(creator.address)) - creatorBefore[i]).to.equal(fees[i]);
    }
    expect(fees[0] > 0n).to.equal(true);
    expect(await basket.balanceOf(bob.address)).to.equal(amount);
    expect(await basket.balanceOf(alice.address)).to.equal(0n);
    expect(await basket.totalSupply()).to.equal(amount);
  });

  it("a zero fee basket sends nothing to the creator", async () => {
    const { basket, alice, creator, tokens } = await setup(0n);
    const before = await tokens[0].balanceOf(creator.address);
    await basket.connect(alice).mint(E18, alice.address);
    expect(await tokens[0].balanceOf(creator.address)).to.equal(before);
  });

  it("refuses zero, and fee-on-transfer tokens", async () => {
    const { basket, alice, factory, a } = await setup();
    await expect(basket.connect(alice).mint(0, alice.address)).to.be.revertedWithCustomError(basket, "ZeroAmount");
    const Fee = await ethers.getContractFactory("FeeOnTransferToken");
    const fee = await Fee.deploy();
    await factory.connect(alice).create("Fee", "FEE", [{ token: await a.getAddress(), units: E18 }, { token: await fee.getAddress(), units: E18 }], 0);
    const addr = (await factory.basketsOf(alice.address))[0];
    const b2 = await ethers.getContractAt("Basket", addr);
    await fee.mint(alice.address, 10n * E18);
    await fee.connect(alice).approve(addr, ethers.MaxUint256);
    await a.connect(alice).approve(addr, ethers.MaxUint256);
    await expect(b2.connect(alice).mint(E18, alice.address)).to.be.revertedWithCustomError(b2, "FeeOnTransfer").withArgs(await fee.getAddress());
  });
});

describe("Basket: redeem", () => {
  it("returns amount / supply of each vault balance, rounded down; dust stays", async () => {
    const { basket, alice, bob, tokens } = await setup(0n);
    await basket.connect(alice).mint(3n, alice.address); // 3 wei of basket: deposits 5, 1, 1
    const vault0 = await Promise.all(tokens.map((t) => t.balanceOf(basket.getAddress())));
    expect(vault0).to.deep.equal([5n, 1n, 1n]);
    await basket.connect(bob).mint(E18, bob.address);
    const supply = await basket.totalSupply();
    const vault = await Promise.all(tokens.map((t) => t.balanceOf(basket.getAddress())));
    const [, quoted] = await basket.quoteRedeem(1n);
    const before = await Promise.all(tokens.map((t) => t.balanceOf(alice.address)));
    await expect(basket.connect(alice).redeem(1n)).to.emit(basket, "Redeemed");
    for (let i = 0; i < 3; i++) {
      const expected = (vault[i] * 1n) / supply;
      expect(quoted[i]).to.equal(expected);
      expect((await tokens[i].balanceOf(alice.address)) - before[i]).to.equal(expected);
      expect(await tokens[i].balanceOf(basket.getAddress())).to.equal(vault[i] - expected);
    }
    expect(await basket.balanceOf(alice.address)).to.equal(2n);
  });

  it("redeeming the whole supply empties the vault", async () => {
    const { basket, alice, tokens } = await setup(30n);
    await basket.connect(alice).mint(5n * E18 + 3n, alice.address);
    await basket.connect(alice).redeem(await basket.balanceOf(alice.address));
    expect(await basket.totalSupply()).to.equal(0n);
    for (const t of tokens) expect(await t.balanceOf(basket.getAddress())).to.equal(0n);
  });

  it("a transferred basket token is redeemable by its new holder", async () => {
    const { basket, alice, carol, tokens } = await setup(30n);
    await basket.connect(alice).mint(4n * E18, alice.address);
    await basket.connect(alice).transfer(carol.address, E18);
    const vault = await Promise.all(tokens.map((t) => t.balanceOf(basket.getAddress())));
    const supply = await basket.totalSupply();
    const before = await Promise.all(tokens.map((t) => t.balanceOf(carol.address)));
    await basket.connect(carol).redeem(E18);
    for (let i = 0; i < 3; i++) expect((await tokens[i].balanceOf(carol.address)) - before[i]).to.equal((vault[i] * E18) / supply);
    expect(await basket.balanceOf(carol.address)).to.equal(0n);
  });

  it("cannot redeem more than you hold, nor zero", async () => {
    const { basket, alice, bob } = await setup();
    await basket.connect(alice).mint(E18, alice.address);
    await expect(basket.connect(bob).redeem(1n)).to.be.revertedWithCustomError(basket, "ERC20InsufficientBalance");
    await expect(basket.connect(alice).redeem(0n)).to.be.revertedWithCustomError(basket, "ZeroAmount");
  });
});

describe("Basket: reentrancy", () => {
  async function reentrantBasket() {
    const { factory, alice, a } = await setup();
    const Re = await ethers.getContractFactory("ReentrantToken");
    const re = await Re.deploy();
    await factory.connect(alice).create("Re", "RE", [{ token: await a.getAddress(), units: E18 }, { token: await re.getAddress(), units: E18 }], 0);
    const addr = (await factory.basketsOf(alice.address))[0];
    const basket = await ethers.getContractAt("Basket", addr);
    await re.mint(alice.address, 100n * E18);
    await re.connect(alice).approve(addr, ethers.MaxUint256);
    await a.connect(alice).approve(addr, ethers.MaxUint256);
    return { basket, re, alice, addr };
  }

  it("a token calling back into mint during mint is refused", async () => {
    const { basket, re, alice, addr } = await reentrantBasket();
    await re.arm(addr, false);
    await expect(basket.connect(alice).mint(E18, alice.address)).to.be.revertedWithCustomError(basket, "ReentrancyGuardReentrantCall");
  });

  it("a token calling back into redeem during redeem is refused", async () => {
    const { basket, re, alice, addr } = await reentrantBasket();
    await basket.connect(alice).mint(2n * E18, alice.address);
    await re.arm(addr, true);
    await expect(basket.connect(alice).redeem(E18)).to.be.revertedWithCustomError(basket, "ReentrancyGuardReentrantCall");
  });
});
