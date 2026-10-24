/**
 * E2E protocol test: plain request → 402 → paid retry → settlement info.
 * Run with the API server up: node scripts/e2e-test.mjs
 */
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE = process.env.API_URL || "http://localhost:4021";
const RPC = process.env.RPC_URL || "https://rpc.test.mezo.org";

function decodePaymentRequired(res) {
  const raw = res.headers.get("payment-required");
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return { raw };
  }
}

const account = privateKeyToAccount(generatePrivateKey());
console.log("[test] ephemeral agent wallet:", account.address);

// 0) Discovery + stats sanity
const tools = await (await fetch(`${BASE}/v1/tools`)).json();
console.log(
  "[test] /v1/tools:",
  tools.name,
  "| tools:",
  tools.tools.map((t) => `${t.id}@${t.price}`).join(", ")
);
const stats0 = await (await fetch(`${BASE}/stats`)).json();
console.log("[test] /stats before:", stats0.paidRequests, "paid requests");

// 1) Unpaid request → expect 402 + PAYMENT-REQUIRED
const unpaid = await fetch(`${BASE}/v1/haiku?topic=mezo`);
console.log("[test] unpaid status:", unpaid.status);
const pr = decodePaymentRequired(unpaid);
console.log(
  "[test] payment-required:",
  JSON.stringify(pr, (k, v) => (k === "amount" ? v : v), 2)?.slice(0, 900)
);

// 2) Paid request via x402 client
const client = new x402Client();
registerExactEvmScheme(client, {
  signer: account,
  schemeOptions: { rpcUrl: RPC },
});
const paidFetch = wrapFetchWithPayment(globalThis.fetch, client);

const paid = await paidFetch(`${BASE}/v1/haiku?topic=mezo`);
console.log("[test] paid status:", paid.status);
for (const [k, v] of paid.headers.entries()) {
  console.log(`[test]   header ${k}: ${String(v).slice(0, 120)}`);
}
const body = await paid.json();
console.log("[test] body:", JSON.stringify(body).slice(0, 300));
const settle = decodePaymentResponseHeader(paid.headers);
console.log("[test] settlement:", JSON.stringify(settle, null, 2));
