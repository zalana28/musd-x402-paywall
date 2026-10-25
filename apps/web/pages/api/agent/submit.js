import { decodePaymentResponseHeader } from "@x402/fetch";

function decodeHeader(headers, name) {
  const raw = headers.get(name);
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return { raw: String(raw).slice(0, 200) };
  }
}

/**
 * Phase 2 of the wallet-paid flow: the browser returns the payload whose
 * signature was produced by the user's own wallet. We perform the paid
 * retry against the paywall and report the settlement.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { request = null, payload = null } = req.body || {};
  if (
    !request?.url ||
    !request?.method ||
    !payload ||
    typeof payload !== "object"
  ) {
    return res.status(400).json({ error: "invalid request/payload" });
  }
  const allowedMethods = new Set(["GET", "POST"]);
  if (!allowedMethods.has(request.method)) {
    return res.status(400).json({ error: "invalid method" });
  }
  // SSRF guard: the paid retry may only target the configured paywall API.
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4021";
  let target;
  try {
    target = new URL(request.url);
  } catch {
    return res.status(400).json({ error: "invalid url" });
  }
  if (target.origin !== new URL(API_BASE).origin) {
    return res.status(400).json({ error: "url must target the paywall API" });
  }

  try {
    const paid = await fetch(request.url, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        "PAYMENT-SIGNATURE": Buffer.from(JSON.stringify(payload)).toString(
          "base64"
        ),
      },
      body: request.body || undefined,
      signal: AbortSignal.timeout(25_000),
    });

    if (paid.status === 200) {
      const settleRaw = paid.headers.get("payment-response");
      let settle = null;
      if (settleRaw) {
        try {
          settle = decodePaymentResponseHeader(settleRaw);
        } catch {
          settle = { success: true, raw: String(settleRaw).slice(0, 200) };
        }
      }
      const result = await paid.json();
      return res.status(200).json({ ok: true, status: 200, settle, result });
    }

    const err = decodeHeader(paid.headers, "payment-required");
    return res.status(200).json({
      ok: false,
      status: paid.status,
      error: err?.error || "verification_failed",
      raw: err,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
}
