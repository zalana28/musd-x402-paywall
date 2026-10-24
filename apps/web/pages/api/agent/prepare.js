import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4021";
const RPC = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.test.mezo.org";

const ENDPOINTS = {
  haiku: { method: "GET", path: "/v1/haiku", param: "topic" },
  answer: { method: "GET", path: "/v1/answer", param: "q" },
  summarize: { method: "POST", path: "/v1/summarize" },
  sentiment: { method: "POST", path: "/v1/sentiment" },
};

function decodeHeader(headers, name) {
  const raw = headers.get(name);
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return { raw: String(raw).slice(0, 200) };
  }
}

export function buildRequest(endpointId, params) {
  const ep = ENDPOINTS[endpointId];
  if (!ep) return null;
  const url =
    ep.method === "GET"
      ? `${API}${ep.path}?${ep.param}=${encodeURIComponent(
          String(params[ep.param] || "").slice(0, 200)
        )}`
      : `${API}${ep.path}`;
  const body =
    ep.method === "POST"
      ? JSON.stringify({ text: String(params.text || "").slice(0, 8000) })
      : undefined;
  return { method: ep.method, url, body };
}

/**
 * Phase 1 of the wallet-paid flow: fetch the 402 quote and build the payment
 * payload with a stub signer that CAPTURES the typed data instead of signing.
 * The browser asks the user's wallet to sign that typed data, then /submit
 * performs the paid retry.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { endpointId = "haiku", params = {}, payerAddress = null } =
    req.body || {};
  if (!/^0x[0-9a-fA-F]{40}$/.test(payerAddress || "")) {
    return res.status(400).json({ error: "invalid payerAddress" });
  }
  const rq = buildRequest(endpointId, params);
  if (!rq) return res.status(400).json({ error: "unknown endpoint" });

  try {
    const unpaid = await fetch(rq.url, {
      method: rq.method,
      headers: { "Content-Type": "application/json" },
      body: rq.body,
      signal: AbortSignal.timeout(10_000),
    });
    const paymentRequired = decodeHeader(unpaid.headers, "payment-required");
    if (unpaid.status !== 402 || !paymentRequired?.accepts?.length) {
      return res.status(200).json({
        ok: false,
        error: "expected 402 quote, got " + unpaid.status,
      });
    }

    let capturedTypedData = null;
    const stubSigner = {
      address: payerAddress,
      signTypedData: async (message) => {
        capturedTypedData = message;
        return "0x" + "00".repeat(65); // placeholder, replaced by the wallet
      },
    };
    const client = new x402Client();
    client.setSpendControls({ allowedAssets: true });
    registerExactEvmScheme(client, {
      signer: stubSigner,
      schemeOptions: { rpcUrl: RPC },
    });
    const payload = await client.createPaymentPayload(paymentRequired);
    if (!capturedTypedData) {
      return res
        .status(200)
        .json({ ok: false, error: "no typed data captured" });
    }
    // BigInt-safe serialization for the wire (amounts become strings)
    const clean = (x) =>
      JSON.parse(
        JSON.stringify(x, (_, v) => (typeof v === "bigint" ? v.toString() : v))
      );
    return res.status(200).json({
      ok: true,
      request: rq,
      paymentRequired: clean(paymentRequired),
      payload: clean(payload),
      typedData: clean(capturedTypedData),
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
}
