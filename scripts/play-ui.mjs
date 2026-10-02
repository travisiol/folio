/**
\s* Local only: drives the built site in headless Chrome as a connected wallet
\s* against the hardhat node (8897), whose test accounts are unlocked, so
\s* eth_sendTransaction goes straight to the node. Plays: connect, Create basket,
\s* Approve each stock, Mint, Redeem. Screenshots into shots/ui-*.png.
\s*
\s*   node scripts/play-ui.mjs [base=http://localhost:3897] [account]
\s*
\s* The injected provider is a test stub announced over EIP-6963; it never
\s* holds a key and only talks to http://127.0.0.1:8897.
\s*/
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.argv[2] ?? "http://localhost:3897";
const account = process.argv[3] ?? "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
const out = resolve("shots");
mkdirSync(out, { recursive: true });
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => existsSync(p));
const PORT = 9348;
const proc = spawn(chrome, ["--headless=new", "--no-first-run", `--user-data-dir=${resolve(".capture-profile-ui")}`, `--remote-debugging-port=${PORT}`, "--window-size=1536,900", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STUB = `(() => {
  const account = ${JSON.stringify(account)};
  const rpc = async (method, params) => {
    const r = await fetch("http://127.0.0.1:8897", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }) });
    const j = await r.json();
    if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; e.data = j.error.data; throw e; }
    return j.result;
  };
  const listeners = {};
  const provider = {
    isMetaMask: false,
    request: async ({ method, params }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [account];
      if (method === "eth_chainId") return "0x7a69";
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
      if (method === "wallet_requestPermissions" || method === "wallet_getPermissions") return [{ parentCapability: "eth_accounts" }];
      if (method === "eth_sendTransaction") { const tx = { ...params[0], from: account }; return rpc(method, [tx]); }
      return rpc(method, params);
    },
    on: (ev, fn) => { (listeners[ev] ||= []).push(fn); },
    removeListener: (ev, fn) => { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); },
  };
  const info = { uuid: "7d0c7c39-0000-4000-8000-000000000001", name: "Local test wallet", icon: "data:image/sv\S+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='%23141411'/%3E%3C/svg%3E", rdns: "local.test.wallet" };
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
})();`;

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) rej(new Error(m.error.message));
        else res(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
}

async function main() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break;
    } catch {}
    await sleep(200);
  }
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  const cdp = new Cdp(ws);
  const js = async (expression) => (await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  const shot = async (name) => {
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(resolve(out, `${name}.png`), Buffer.from(data, "base64"));
    console.log(`${name}.png`);
  };
  const clickText = (text) => js(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes(${JSON.stringify(text)})); if (b) b.click(); return Boolean(b); })()`);

  await cdp.send("Page.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1536, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: STUB });
  await cdp.send("Page.navigate", { url: base + "/" });
  await sleep(6000);
  console.log("connect button:", await clickText("Connect wallet"));
  await sleep(800);
  console.log("pick wallet:", await clickText("Local test wallet"));
  await sleep(4000);
  await shot("ui-connected-1536");
  const status = () => js(`[...document.querySelectorAll("[role=status]")].map((x) => x.innerText).join(" | ")`);
  const ticketButton = () => js(`[...document.querySelectorAll("#ticket button:not([role=tab])")].map((b) => b.textContent).find((t) => /^(Approve|Approving|Mint|Minting|Redeem |Redeeming)/.test(t))`);
  const waitIdle = async () => { for (let k = 0; k < 60; k++) { const t = await ticketButton(); if (t && !/ing…$/.test(t)) return t; await sleep(500); } return ticketButton(); };

  console.log("create:", await clickText("Create basket"));
  for (let k = 0; k < 60 && !(await js("location.pathname")).startsWith("/b/"); k++) await sleep(500);
  console.log("basket page:", await js("location.pathname"), "| home status:", await status());
  await sleep(6000);
  console.log("approvals row:", await js(`document.querySelector("[data-testid=approvals]")?.innerText`));
  console.log("money rows:", await js(`document.querySelector("#ticket dl")?.innerText.replace(/\\n/g, " ")`));
  await shot("ui-basket-before-mint-1536");
  for (let step = 0; step < 8; step++) {
    const label = await waitIdle();
    console.log("button:", label);
    if (!label || label.startsWith("Redeem")) break;
    await clickText(label);
    await sleep(1500);
    const after = await waitIdle();
    console.log("  status:", await status());
    if (label.startsWith("Mint")) { console.log("  button after mint:", after); break; }
  }
  await sleep(3000);
  console.log("holdings:", await js(`document.body.innerText.match(/Your holdings\\s*\\S+/)?.[0]`));
  await shot("ui-minted-1536");
  await js(`[...document.querySelectorAll("#ticket [role=tab]")].find((b) => b.textContent === "Redeem")?.click()`);
  await sleep(1500);
  const rl = await waitIdle();
  console.log("redeem button:", rl, "| you receive:", await js(`[...document.querySelectorAll("#ticket ul li")].map((l) => l.innerText.replace(/\\n/g, " ")).join(", ")`));
  await clickText(rl);
  await sleep(1500);
  await waitIdle();
  await sleep(3000);
  console.log("  status:", await status());
  console.log("holdings after redeem:", await js(`document.body.innerText.match(/Your holdings\\s*\\S+/)?.[0]`));
  console.log("activity:", await js(`document.body.innerText.match(/Recent mints and redeems[\\s\\S]{0,200}/)?.[0].replace(/\\n/g, " ")`));
  await shot("ui-redeemed-1536");
  ws.close();
}

try {
  await main();
} finally {
  proc.kill();
}
