/**
 * Mock x402 facilitator for local integration testing of the FULL happy path
 * (402 → sign → verify ✓ → handler → settle ✓ → 200 + PAYMENT-RESPONSE),
 * including the server's onAfterSettle telemetry.
 *
 * It performs no signature or on-chain checks — its only job is to let our
 * own server code paths execute end to end. The REAL facilitator is exercised
 * in the normal demo (which correctly rejects unfunded agents).
 *
 * Run: node scripts/mock-facilitator.mjs   (listens on :4022)
 */
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.MOCK_PORT || 4022);
const NETWORK = process.env.MOCK_NETWORK || "eip155:31611";
const MUSD = process.env.MOCK_MUSD || "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";

let verifyCount = 0;
let settleCount = 0;

const server = http.createServer((req, res) => {
  const send = (code, body) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.method === "GET" && req.url === "/supported") {
    return send(200, {
      kinds: [
        {
          x402Version: 2,
          scheme: "exact",
          network: NETWORK,
          extra: {
            assets: [
              {
                address: MUSD,
                symbol: "MUSD",
                decimals: 18,
                eip712: { name: "Mezo USD", version: "1" },
                assetTransferMethod: "permit2",
                supportsEip2612: true,
              },
            ],
          },
        },
      ],
      extensions: ["eip2612GasSponsoring"],
      signers: { [NETWORK]: ["0xMockFacilitatorSigner00000000000000000000"] },
    });
  }

  if (req.method === "POST" && req.url === "/verify") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      verifyCount += 1;
      try {
        const body = JSON.parse(raw);
        const payer =
          body?.paymentPayload?.payload?.authorization?.owner ??
          body?.paymentPayload?.payload?.transfer?.from ??
          "0xMockPayer0000000000000000000000000000000000000000";
        console.log(`[mock-facilitator] verify #${verifyCount} → isValid=true (payer ${payer})`);
        return send(200, { isValid: true, payer });
      } catch (e) {
        return send(400, { error: String(e?.message || e) });
      }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/settle") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      settleCount += 1;
      let payer = "0xMockPayer0000000000000000000000000000000000000000";
      let amount = "0";
      try {
        const body = JSON.parse(raw);
        payer = body?.paymentPayload?.payload?.authorization?.owner ?? payer;
        amount = body?.paymentRequirements?.amount ?? amount;
      } catch {}
      const txHash = "0x" + crypto.randomBytes(32).toString("hex");
      console.log(`[mock-facilitator] settle #${settleCount} → success, tx ${txHash.slice(0, 18)}…`);
      return send(200, {
        success: true,
        payer,
        transaction: txHash,
        network: NETWORK,
      });
    });
    return;
  }

  send(404, { error: "not found" });
});

server.listen(PORT, () =>
  console.log(`[mock-facilitator] listening on http://localhost:${PORT} (network ${NETWORK})`)
);
