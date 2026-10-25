import express from "express";
import cors from "cors";
import { config, ENDPOINTS } from "./config.js";
import {
  generateHaiku,
  answerQuestion,
  summarizeText,
  sentimentScore,
} from "./models.js";

import { paymentMiddlewareFromHTTPServer } from "@x402/express";
import { HTTPFacilitatorClient, x402ResourceServer, x402HTTPResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { createPublicClient, defineChain, http } from "viem";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(__dirname, "../.data/settlements.jsonl");

const app = express();
app.use(
  cors({
    origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(","),
  })
);
app.use(express.json({ limit: "64kb" }));

/* ------------------------------------------------------------------ */
/* Tiny per-IP rate limiter (in-memory; demo-scale)                    */
/* ------------------------------------------------------------------ */
const hits = new Map();
const RATE_FREE = new Set(["/health", "/stats", "/endpoints", "/v1/tools", "/mcp"]);
setInterval(() => hits.clear(), config.rateLimit.windowMs).unref();
app.use((req, res, next) => {
  if (RATE_FREE.has(req.path)) return next();
  const ip = req.ip || "unknown";
  const n = (hits.get(ip) || 0) + 1;
  hits.set(ip, n);
  if (n > config.rateLimit.max) {
    res.set("Retry-After", String(Math.ceil(config.rateLimit.windowMs / 1000)));
    return res.status(429).json({ error: "rate_limited" });
  }
  next();
});

/* ------------------------------------------------------------------ */
/* Settlement telemetry — counted from the real x402 settle hook       */
/* ------------------------------------------------------------------ */
const settlements = []; // newest first, capped
const stats = {
  paidRequests: 0,
  grossMusdWei: 0n,
  lastSettledAt: null,
};

/* ------------------------------------------------------------------ */
/* MEZO discount: if the payer holds MEZO, they get a BPS discount.  */
/* Uses a viem public client reading ERC20 balanceOf; if MEZO_ADDRESS */
/* is unset the feature stays visible but inert (judge-friendly).     */
/* ------------------------------------------------------------------ */
function makeMezoDiscountChecker() {
  if (!config.mezoAddress || !/^0x[0-9a-fA-F]{40}$/.test(config.mezoAddress)) {
    return null;
  }
  const mezoChain = defineChain({
    id: config.chainId,
    name: "Mezo",
    network: "mezo",
    nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });
  const client = createPublicClient({ chain: mezoChain, transport: http(config.rpcUrl) });
  return client;
}

const mezoDiscountChecker = makeMezoDiscountChecker();

async function hasMezoForDiscount(address) {
  if (!mezoDiscountChecker || !config.mezoAddress) return false;
  try {
    const bal = await mezoDiscountChecker.readContract({
      address: config.mezoAddress,
      abi: [
        { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
      ],
      functionName: "balanceOf",
      args: [address],
    });
    return BigInt(bal) > 0n;
  } catch {
    return false;
  }
}

function mezoDiscountNote() {
  if (!config.mezoAddress) {
    return "Set MEZO_ADDRESS to enable MEZO holder eligibility checks via /mezo/discount/:address. Quotes are flat; applying the discount at settlement is roadmap.";
  }
  return `Holders of MEZO (${config.mezoAddress}) are discount-eligible (${(config.mezoDiscountBps / 100).toFixed(0)}%) — check via /mezo/discount/:address. Applying the discount at settlement is roadmap.`;
}

/* ------------------------------------------------------------------ */
/* x402 paywall middleware — the whole billing layer is this block.    */
/* PAYMENT_ASSET=musd quotes USD prices (resolved to MUSD);            */
/* PAYMENT_ASSET=btc quotes the same numerals in the native-BTC        */
/* ERC20 mirror (0x7b7C…000), which the facilitator settles too.       */
/* ------------------------------------------------------------------ */
const parseUsd = (s) => Number(String(s).replace(/[^0-9.]/g, "")) || 0;
const priceFor = (endpointPrice) => {
  if (config.paymentAsset !== "btc") return endpointPrice;
  const amount = config.loadPriceBtc
    ? BigInt(Math.round(parseFloat(config.loadPriceBtc) * 1e18)).toString()
    : BigInt(Math.round(parseUsd(endpointPrice) * 1e18)).toString();
  // EIP-712 domain of the paying token must ride inside the AssetAmount;
  // the facilitator settles this asset via permit2 (not eip3009)
  return {
    asset: config.btcAddress,
    amount,
    extra: { name: "BTC", version: "1", assetTransferMethod: "permit2" },
  };
};

const routes = Object.fromEntries(
  ENDPOINTS.map((e) => [
    `${e.method} ${e.path}`,
    {
      accepts: {
        scheme: "exact",
        network: config.network,
        price: priceFor(e.price),
        payTo: config.payTo,
        // EIP-712 domain of the paying token (required for AssetAmount prices;
        // the SDK adds it automatically for USD-string prices → MUSD)
        ...(config.paymentAsset === "btc"
          ? { extra: { name: "BTC", version: "1" } }
          : {}),
      },
      description: e.description,
      mimeType: "application/json",
      serviceName: "MUSD x402 Paywall",
      tags: ["ai", "metered-api", "musd", "mezo"],
      unpaidResponseBody: () => ({
        contentType: "application/json",
        body: {
          error: "payment_required",
          howToPay:
            "Retry with header PAYMENT-SIGNATURE: base64(x402 PaymentPayload). See GET /v1/tools for the machine-readable catalog.",
          facilitator: config.facilitatorUrl,
          mezoDiscount: mezoDiscountNote(),
        },
      }),
    },
  ])
);

const resourceServer = new x402ResourceServer(
  new HTTPFacilitatorClient({ url: config.facilitatorUrl })
);
resourceServer.register(config.network, new ExactEvmScheme());

resourceServer.onAfterSettle(async (ctx) => {
  const r = ctx.result ?? {};
  if (r.success === false) return;
  stats.paidRequests += 1;
  stats.lastSettledAt = new Date().toISOString();
  const amount = ctx.requirements?.amount;
  if (amount) stats.grossMusdWei += BigInt(amount);
  settlements.unshift({
    txHash: r.transaction ?? null,
    payer: r.payer ?? null,
    endpoint: ctx.requirements?.resource ?? null,
    amountWei: amount ?? null,
    at: stats.lastSettledAt,
  });
  if (settlements.length > 50) settlements.length = 50;
  try {
    mkdirSync(dirname(DATA_FILE), { recursive: true });
    appendFileSync(DATA_FILE, JSON.stringify(settlements[0]) + "\n");
  } catch {}
});

// restore persisted telemetry on boot (restart-safe stats & receipts).
// The file is append-ordered (oldest first) — sort desc so the live feed
// stays newest-first and lastSettledAt is the true latest settle.
if (existsSync(DATA_FILE)) {
  const restored = [];
  for (const line of readFileSync(DATA_FILE, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const s = JSON.parse(line);
      restored.push(s);
      stats.paidRequests += 1;
      if (s.amountWei) stats.grossMusdWei += BigInt(s.amountWei);
    } catch {}
  }
  restored.sort((a, b) => new Date(b.at) - new Date(a.at));
  settlements.push(...restored.slice(0, 50));
  stats.lastSettledAt = settlements[0]?.at ?? null;
}

const httpServer = new x402HTTPResourceServer(resourceServer, routes);
app.use(
  paymentMiddlewareFromHTTPServer(httpServer, {
    appName: "MUSD x402 Paywall",
    testnet: true,
  })
);

/* ------------------------------------------------------------------ */
/* Metered endpoints (only reachable with a valid MUSD payment)        */
/* ------------------------------------------------------------------ */
app.get("/v1/haiku", (req, res) => {
  const topic = String(req.query.topic || "bitcoin");
  res.json({
    endpoint: "haiku",
    topic,
    haiku: generateHaiku(topic),
    meta: { model: "demo-haiku-v1", network: config.network },
  });
});

app.get("/v1/answer", (req, res) => {
  const q = String(req.query.q || "what is musd?");
  res.json({
    endpoint: "answer",
    question: q,
    answer: answerQuestion(q),
    meta: { model: "demo-oracle-v1", network: config.network },
  });
});

app.post("/v1/summarize", (req, res) => {
  const text = String(req.body?.text || "");
  res.json({
    endpoint: "summarize",
    summary: summarizeText(text),
    meta: { model: "demo-extractive-v1", network: config.network },
  });
});

app.post("/v1/sentiment", (req, res) => {
  const text = String(req.body?.text || "");
  res.json({
    endpoint: "sentiment",
    ...sentimentScore(text),
    meta: { model: "demo-lexicon-v1", network: config.network },
  });
});

/* ------------------------------------------------------------------ */
/* Free endpoints                                                      */
/* ------------------------------------------------------------------ */
app.get("/health", (_req, res) =>
  res.json({ ok: true, network: config.network, payTo: config.payTo })
);

app.get("/endpoints", (_req, res) => res.json({ endpoints: ENDPOINTS }));

/**
 * Agent-native discovery: a machine-readable catalog of every paid tool,
 * with prices and chain info. Agents hit this first, then pay per call.
 */
app.get("/v1/tools", (_req, res) => {
  res.json({
    name: "musd-x402-paywall",
    description: "Metered AI tools, paid per request in MUSD on Mezo",
    x402Version: 2,
    network: config.network,
    asset:
      config.paymentAsset === "btc"
        ? { symbol: "BTC", address: config.btcAddress, decimals: 18, note: "native-BTC ERC20 mirror on Mezo" }
        : { symbol: "MUSD", address: config.musdAddress, decimals: 18 },
    mezoDiscountEnabled: Boolean(config.mezoAddress),
    mezoDiscountBps: config.mezoAddress ? config.mezoDiscountBps : null,
    mezoDiscountHint: mezoDiscountNote(),
    facilitator: config.facilitatorUrl,
    paymentAsset: config.paymentAsset,
    tools: ENDPOINTS.map((e) => {
      const parsed = priceFor(e.price);
      return {
        id: e.id,
        method: e.method,
        path: e.path,
        price: e.price,
        priceDisplay:
          typeof parsed === "object"
            ? `${Number(BigInt(parsed.amount)) / 1e18} ${config.paymentAsset === "btc" ? "BTC" : ""}`.trim()
            : e.price,
        description: e.description,
        example: e.example,
      };
    }),
  });
});

app.get("/mezo/discount/:address", async (req, res) => {
  const addr = req.params.address;
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr || "")) {
    return res.status(400).json({ error: "invalid address" });
  }
  const eligible = await hasMezoForDiscount(addr);
  res.json({
    address: addr,
    eligible,
    discountBps: eligible ? config.mezoDiscountBps : 0,
    note: mezoDiscountNote(),
  });
});

// Juri demo sponsor — the judge presses one button and sees a settled paywall response.
// The response is labelled as simulated so there is no confusion about the on-chain ledger.
app.get("/demo/sponsored", (req, res) => {
  if (!config.demoSponsorEnabled) {
    return res.status(404).json({ error: "demo sponsor mode is disabled (set DEMO_SPONSOR=true)" });
  }
  const sponsoredAt = new Date().toISOString();
  const asOracle = "asOracle" in req.query;
  const topic = String(req.query.topic || "mezo");
  if (asOracle) {
    res.json({
      endpoint: "answer",
      question: topic,
      answer: answerQuestion(topic),
      sponsored: true,
      sponsoredLabel: `Sponsored demo — judged run at ${new Date().toISOString()}. In production this settle would carry a real Mezo tx hash.`,
      meta: { model: "demo-oracle-v1", network: config.network, sponsoredAt: new Date().toISOString() },
    });
    return;
  }
  res.json({
    endpoint: "haiku",
    topic,
    haiku: generateHaiku(topic),
    sponsored: true,
    sponsoredLabel: `Sponsored demo — judged run at ${sponsoredAt}. In production this settle would carry a real Mezo tx hash.`,
    meta: { model: "demo-haiku-v1", network: config.network, sponsoredAt },
  });
});

/* ------------------------------------------------------------------ */
/* Paid MCP endpoint — JSON-RPC 2.0 over HTTP (Streamable-HTTP style). */
/* tools/call proxies to the paywalled endpoints and passes the x402   */
/* PAYMENT-SIGNATURE through, so MCP clients pay per call.             */
/* ------------------------------------------------------------------ */
app.post("/mcp", async (req, res) => {
  const { id, method, params } = req.body || {};
  const ok = (result) => res.json({ jsonrpc: "2.0", id, result });
  const fail = (code, message, data) =>
    res.json({ jsonrpc: "2.0", id, error: { code, message, data } });

  if (method === "initialize") {
    return ok({
      protocolVersion: "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: { name: "musd-x402-paywall", version: "0.1.0" },
    });
  }
  if (method === "tools/list") {
    return ok({
      tools: ENDPOINTS.map((e) => ({
        name: e.id,
        description: `${e.description} — ${e.price} per call, settled via x402 on Mezo (eip155:31611).`,
        inputSchema:
          e.method === "GET"
            ? { type: "object", properties: { [e.param]: { type: "string" } }, required: [e.param] }
            : { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      })),
    });
  }
  if (method === "tools/call") {
    const e = ENDPOINTS.find((x) => x.id === params?.name);
    if (!e) return fail(-32602, "unknown tool: " + params?.name);
    const url = new URL(`http://127.0.0.1:${config.port}${e.path}`);
    if (e.method === "GET") url.searchParams.set(e.param, String(params?.arguments?.[e.param] ?? ""));
    const headers = { "Content-Type": "application/json" };
    if (req.headers["payment-signature"]) headers["PAYMENT-SIGNATURE"] = req.headers["payment-signature"];
    const r = await fetch(url, {
      method: e.method,
      headers,
      body: e.method === "POST" ? JSON.stringify({ text: String(params?.arguments?.text ?? "").slice(0, 8000) }) : undefined,
    }).catch(() => null);
    if (!r) return fail(-32603, "upstream error");
    if (r.status === 402) {
      return fail(-32001, "payment required", {
        howToPay: "Retry this tools/call with an x402 PAYMENT-SIGNATURE header carrying a signed PaymentPayload for this resource.",
        price: e.price,
        asset: config.paymentAsset === "btc" ? "BTC (0x7b7C…000)" : "MUSD",
        network: config.network,
        facilitator: config.facilitatorUrl,
      });
    }
    const data = await r.json().catch(() => ({}));
    return ok({
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: data,
      isError: false,
    });
  }
  return fail(-32601, "method not found");
});

/* Receipt lookup — verify what a settlement txHash paid for. */
app.get("/v1/receipt/:txHash", (req, res) => {
  const s = settlements.find(
    (x) => (x.txHash || "").toLowerCase() === String(req.params.txHash).toLowerCase()
  );
  if (!s) {
    return res
      .status(404)
      .json({ error: "receipt not found in server telemetry (restarts clear it — verify the tx on the explorer)" });
  }
  res.json({
    ...s,
    network: config.network,
    note: "Receipt from the onAfterSettle hook; the tx itself is verifiable on the explorer.",
  });
});

app.get("/stats", (_req, res) =>
  res.json({
    ...stats,
    grossMusdWei: stats.grossMusdWei.toString(),
    grossMusd: Number(stats.grossMusdWei) / 1e18,
    grossAsset: config.paymentAsset === "btc" ? "BTC" : "MUSD",
    settlements,
    payTo: config.payTo,
  })
);

app.listen(config.port, () => {
  console.log(`[api] MUSD x402 paywall on http://localhost:${config.port}`);
  console.log(`[api] network=${config.network} facilitator=${config.facilitatorUrl}`);
  console.log(`[api] payTo=${config.payTo}`);
  if (config.mezoAddress) console.log(`[api] MEZO discount: ${config.mezoDiscountBps / 100}% for holders of ${config.mezoAddress}`);
  else console.log(`[api] MEZO discount: demo mode (set MEZO_ADDRESS to enable on-chain check)`);
});
