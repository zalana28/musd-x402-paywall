import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { decodePaymentResponseHeader } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

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

function isHexKey(k) {
  return typeof k === "string" && /^0x[0-9a-fA-F]{64}$/.test(k);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }
  const { endpointId = "haiku", params = {}, agentPrivateKey = null } =
    req.body || {};
  const ep = ENDPOINTS[endpointId];
  if (!ep) return res.status(400).json({ error: "unknown endpoint" });

  // Wallet: either a browser-owned persistent key (validated), or ephemeral.
  let account;
  try {
    account = isHexKey(agentPrivateKey)
      ? privateKeyToAccount(agentPrivateKey)
      : (await import("viem/accounts")).privateKeyToAccount(
          (await import("viem/accounts")).generatePrivateKey()
        );
  } catch {
    return res.status(400).json({ error: "invalid agentPrivateKey" });
  }

  const steps = [];
  const push = (id, label, status, detail) =>
    steps.push({ id, label, status, detail: detail ?? null });

  const timeout = (ms) => AbortSignal.timeout(ms);

  const wantSponsored = req.body && req.body.sponsored === true;
  try {
    if (wantSponsored) {
      const sponsoredMap = {
        haiku: {
          url: `${API}/demo/sponsored?topic=${encodeURIComponent(String(params.topic || params[ep.param] || "").slice(0, 200))}`,
          note: "Seller-sponsored haiku (no facilitator).",
        },
        answer: {
          url: `${API}/demo/sponsored?topic=${encodeURIComponent(String(params.q || params[ep.param] || "").slice(0, 200))}&asOracle=1`,
          note: "Seller-sponsored oracle — real paywall response served via juri demo.",
        },
        summarize: {
          url: `${API}/demo/sponsored?topic=${encodeURIComponent(String(params.text || "").slice(0, 60))}`,
          note: "Seller-sponsored (demo endpoint; summarize shown via haiku model in sponsored mode).",
        },
        sentiment: {
          url: `${API}/demo/sponsored?topic=${encodeURIComponent(String(params.text || "").slice(0, 60))}`,
          note: "Seller-sponsored (demo endpoint; sentiment shown via haiku model in sponsored mode).",
        },
      };
      const sEntry = sponsoredMap[endpointId] || sponsoredMap.haiku;
      const sponsoredRes = await fetch(sEntry.url, { signal: timeout(10_000) });
      if (sponsoredRes.ok) {
        const sponsoredJson = await sponsoredRes.json();
        return res.json({
          agent: account.address,
          sponsored: true,
          steps: [
            { id: "request", label: "Sponsored request", status: "done", detail: { method: "GET", url: sEntry.url, note: sEntry.note } },
            { id: "402", label: "Price (sponsored)", status: "done", detail: { sponsored: true, note: "Sponsored demo — facilitator and 402 skipped by seller." } },
            { id: "sign", label: "Sponsored (no sign)", status: "done", detail: { sponsored: true, note: "No EIP-712 signature — seller-sponsored, no MUSD moved." } },
            { id: "retry", label: "Sponsored fetch", status: "done", detail: { sponsored: true } },
            { id: "verify", label: "Sponsor verify", status: "done", detail: { sponsored: true, sponsor: "GET /demo/sponsored (no facilitator)" } },
            { id: "settle", label: "Settle (sponsored)", status: "done", detail: { sponsored: true, note: "No on-chain settlement — sponsored demo. A funded run settles for real (see mode below)." } },
          ],
          result: sponsoredJson,
        });
      }
    }
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

    // 1) Unpaid request → 402 + PAYMENT-REQUIRED
    const unpaid = await fetch(url, {
      method: ep.method,
      headers: { "Content-Type": "application/json" },
      body,
      signal: timeout(10_000),
    });
    const paymentRequired = decodeHeader(unpaid.headers, "payment-required");
    push("request", "Request", "done", {
      method: ep.method,
      url,
      status: unpaid.status,
    });
    if (unpaid.status !== 402) {
      push("402", "Price quote", "failed", {
        note: "expected 402 but got " + unpaid.status,
      });
      return res.json({ agent: account.address, steps, result: null });
    }
    const req0 = paymentRequired?.accepts?.[0];
    push("402", "402 · Price quote", "done", {
      price: req0?.amount ? `${Number(BigInt(req0.amount)) / 1e18} USD` : "?",
      asset: req0?.asset,
      assetName: req0?.extra?.name,
      network: req0?.network,
      payTo: req0?.payTo,
      raw: paymentRequired,
    });

    // 2) Agent signs the payment payload (EIP-712, permit2)
    const client = new x402Client();
    registerExactEvmScheme(client, {
      signer: account,
      schemeOptions: { rpcUrl: RPC },
    });
    const payload = await client.createPaymentPayload(paymentRequired);
    const p0 = payload?.payload ?? payload;
    push("sign", "Sign EIP-712", "done", {
      payer: account.address,
      scheme: payload?.scheme,
      network: payload?.network,
      payloadKeys: Object.keys(p0 || {}),
      authorization: p0?.authorization ?? p0?.details ?? null,
      raw: p0,
    });

    // 3) Paid retry with PAYMENT-SIGNATURE
    const paid = await fetch(url, {
      method: ep.method,
      headers: {
        "Content-Type": "application/json",
        "PAYMENT-SIGNATURE": Buffer.from(JSON.stringify(payload)).toString(
          "base64"
        ),
      },
      body,
      signal: timeout(25_000),
    });
    push("retry", "Paid retry", paid.status === 200 ? "done" : "failed", {
      status: paid.status,
      headerSent: "PAYMENT-SIGNATURE: <base64 payload>",
    });

    if (paid.status === 200) {
      const settle = decodePaymentResponseHeader(paid.headers);
      const result = await paid.json();
      push("verify", "Facilitator verify", "done", {
        verifier: process.env.NEXT_PUBLIC_FACILITATOR || "https://facilitator.vativ.io",
        payer: settle?.payer ?? account.address,
      });
      push("settle", "Settle on Mezo", "done", {
        success: settle?.success ?? true,
        transaction: settle?.transaction ?? null,
        explorer: settle?.transaction
          ? `${process.env.NEXT_PUBLIC_EXPLORER || "https://explorer.test.mezo.org"}/tx/${settle.transaction}`
          : null,
        raw: settle,
      });
      return res.json({ agent: account.address, steps, result });
    }

    // 402 again — verification failed on the facilitator (e.g. no funds)
    const err = decodeHeader(paid.headers, "payment-required");
    const reason = err?.error || "verification_failed";
    push("verify", "Facilitator verify", "failed", {
      verifier: process.env.NEXT_PUBLIC_FACILITATOR || "https://facilitator.vativ.io",
      reason,
      note: FUND_HINT(reason),
      raw: err,
    });
    push("settle", "Settle on Mezo", "pending", {
      note: "skipped — verify failed",
    });
    return res.json({
      agent: account.address,
      steps,
      result: null,
      fundingHint:
        reason.toLowerCase().includes("balance") ||
        reason.toLowerCase().includes("allowance"),
    });
  } catch (e) {
    push("error", "Error", "failed", {
      message: String(e?.message || e),
      name: e?.name,
    });
    return res
      .status(200)
      .json({ agent: account.address, steps, result: null });
  }
}

function FUND_HINT(reason) {
  const r = String(reason).toLowerCase();
  if (r.includes("balance"))
    return "Agent wallet holds no MUSD. Fund it with testnet MUSD to settle on-chain.";
  if (r.includes("allowance"))
    return "Agent wallet has not approved Permit2 to move MUSD.";
  return "Facilitator could not verify this payment.";
}
