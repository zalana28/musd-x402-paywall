/**
 * Full happy-path integration test (mock facilitator):
 *   402 → EIP-712 sign → paid retry → 200 + PAYMENT-RESPONSE → /stats telemetry.
 * Exercises the server's onAfterSettle hook and every metered handler.
 *
 * Start first:
 *   node scripts/mock-facilitator.mjs
 *   PORT=4023 FACILITATOR_URL=http://localhost:4022 node src/server.js
 *   node scripts/test-happy-path.mjs
 */
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE = process.env.HAPPY_API_URL || "http://localhost:4023";
const RPC = process.env.RPC_URL || "https://rpc.test.mezo.org";

let pass = 0, fail = 0;
const t = (name, cond, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`);
};

const account = privateKeyToAccount(generatePrivateKey());
console.log("[happy] agent wallet:", account.address);

const client = new x402Client();
registerExactEvmScheme(client, { signer: account, schemeOptions: { rpcUrl: RPC } });
const fetchPay = wrapFetchWithPayment(globalThis.fetch, client);

const statsBefore = await (await fetch(`${BASE}/stats`)).json();

// 1) haiku (GET)
const h = await fetchPay(`${BASE}/v1/haiku?topic=mezo`);
const hBody = await h.json();
const hSettleRaw = h.headers.get("payment-response");
let hSettle = null;
if (hSettleRaw) hSettle = decodePaymentResponseHeader(hSettleRaw);
t("haiku: 200 OK", h.status === 200);
t("haiku: konten 3 baris", (hBody.haiku || "").split("\n").length === 3);
t("haiku: PAYMENT-RESPONSE tx hash", /^0x[0-9a-f]{64}$/.test(hSettle?.transaction || ""), hSettle?.transaction?.slice(0, 18) + "…");

// 2) answer (GET)
const a = await fetchPay(`${BASE}/v1/answer?q=what+is+musd`);
const aBody = await a.json();
t("oracle: 200 OK + jawaban", a.status === 200 && (aBody.answer || "").length > 40);

// 3) summarize (POST) — pertama kali model ini dieksekusi via HTTP berbayar
const s = await fetchPay(`${BASE}/v1/summarize`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "Mezo is bitcoin bank. It lets holders borrow. The trove locks BTC. MUSD is minted against it." }),
});
const sBody = await s.json();
t("summarize: 200 OK", s.status === 200);
t("summarize: hasil ekstraktif", (sBody.summary || "").startsWith("Mezo is bitcoin bank."));

// 4) sentiment (POST)
const st = await fetchPay(`${BASE}/v1/sentiment`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "bitcoin pump rally adoption" }),
});
const stBody = await st.json();
t("sentiment: 200 OK + bullish", st.status === 200 && stBody.label === "bullish", `score=${stBody.score}`);

// 5) telemetry via onAfterSettle
const statsAfter = await (await fetch(`${BASE}/stats`)).json();
t("stats: paidRequests naik", statsAfter.paidRequests === statsBefore.paidRequests + 4, `${statsBefore.paidRequests} → ${statsAfter.paidRequests}`);
t("stats: grossMusd = 0.011", Math.abs(statsAfter.grossMusd - (statsBefore.grossMusd + 0.011)) < 1e-9, `gross=${statsAfter.grossMusd}`);
t("stats: settlements tercatat (4)", (statsAfter.settlements || []).length >= 4);
t("stats: settlement ada txHash+payer", Boolean(statsAfter.settlements?.[0]?.txHash && statsAfter.settlements?.[0]?.payer));

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
