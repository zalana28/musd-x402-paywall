/**
 * 100× paid-request load run — every iteration performs the full real
 * handshake (402 quote → EIP-712 sign → paid retry → facilitator settles
 * on-chain). Progress is appended to /tmp/loadtest.log as JSON lines.
 *
 * Run with the API in BTC mode (optionally LOAD_PRICE_BTC for micro prices):
 *   LOAD_KEY=0x… node scripts/loadtest-100.mjs
 */
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, formatUnits } from "viem";
import { appendFileSync } from "node:fs";

const KEY = process.env.LOAD_KEY;
if (!KEY || !/^0x[0-9a-fA-F]{64}$/.test(KEY)) {
  console.error("Set LOAD_KEY=0x… (funded testnet buyer key) — refusing to run without it.");
  process.exit(1);
}
const TOTAL = Number(process.env.LOAD_TOTAL || 100);
const PACING_MS = Number(process.env.LOAD_PACING || 2200);
const LOG = "/tmp/loadtest.log";

const account = privateKeyToAccount(KEY);
const rpc = createPublicClient({ transport: http("https://rpc.test.mezo.org") });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (o) => appendFileSync(LOG, JSON.stringify(o) + "\n");

let ok = 0,
  fail = 0;
const t0 = Date.now();
console.log(`[load] wallet ${account.address} — ${TOTAL} runs @ ${PACING_MS}ms pacing`);

for (let i = 1; i <= TOTAL; i++) {
  const tRun = Date.now();
  try {
    const prep = await fetch("http://localhost:3000/api/agent/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpointId: "haiku",
        params: { topic: `load ${i}/${TOTAL}` },
        payerAddress: account.address,
      }),
    }).then((r) => r.json());

    if (!prep.ok) throw new Error(prep.error || "prepare failed");
    const sig = await account.signTypedData({
      domain: prep.typedData.domain,
      types: prep.typedData.types,
      primaryType: prep.typedData.primaryType,
      message: prep.typedData.message,
    });
    const payload = JSON.parse(JSON.stringify(prep.payload));
    payload.payload.signature = sig;

    const sub = await fetch("http://localhost:3000/api/agent/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request: prep.request, payload }),
    }).then((r) => r.json());

    if (sub.ok) {
      ok++;
      log({ i, ok: true, tx: sub.settle?.transaction, ms: Date.now() - tRun });
    } else {
      fail++;
      log({ i, ok: false, err: sub.error, ms: Date.now() - tRun });
    }
  } catch (e) {
    fail++;
    log({ i, ok: false, err: String(e?.message || e).slice(0, 120), ms: Date.now() - tRun });
  }

  if (i % 10 === 0 || i === 1) {
    const bal = await rpc
      .getBalance({ address: account.address })
      .then((b) => formatUnits(b, 18))
      .catch(() => "?");
    const line = `[load] ${i}/${TOTAL} ✓${ok} ✗${fail} | wallet ${Number(bal).toFixed(5)} BTC | ${((Date.now() - t0) / 1000).toFixed(0)}s`;
    console.log(line);
    log({ milestone: i, ok, fail, balance: bal, elapsedS: (Date.now() - t0) / 1000 });
  }
  if (i < TOTAL) await sleep(PACING_MS);
}

console.log(
  `[load] SELESAI — ✓${ok} sukses ✗${fail} gagal dalam ${((Date.now() - t0) / 1000 / 60).toFixed(1)} menit`
);
log({ done: true, ok, fail, totalMin: (Date.now() - t0) / 60000 });
