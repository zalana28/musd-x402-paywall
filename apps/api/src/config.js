import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });
dotenv.config();
export const config = {
  port: Number(process.env.PORT || 4021),
  network: process.env.NETWORK || "eip155:31611",
  chainId: 31611,
  rpcUrl: process.env.RPC_URL || "https://rpc.test.mezo.org",
  musdAddress:
    process.env.MUSD_ADDRESS || "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
  mezoAddress: process.env.MEZO_ADDRESS || null,
  // ERC20 mirror of native BTC on Mezo — accepted by the x402 facilitator
  btcAddress:
    process.env.BTC_ERC20_ADDRESS ||
    "0x7b7C000000000000000000000000000000000000",
  // Settlement asset for quotes: "musd" (default) or "btc"
  paymentAsset: (process.env.PAYMENT_ASSET || "musd").toLowerCase(),
  facilitatorUrl:
    process.env.FACILITATOR_URL || "https://facilitator.vativ.io",
  payTo: process.env.SELLER_ADDRESS,
  // "*" keeps the local demo frictionless; set a comma-separated allowlist in prod
  corsOrigin: process.env.CORS_ORIGIN || "*",
  mezoDiscountBps: Number(process.env.MEZO_DISCOUNT_BPS || 2000),
  demoSponsorEnabled:
    String(process.env.DEMO_SPONSOR || "false").toLowerCase() === "true",
  rateLimit: {
    windowMs: 60_000,
    max: Number(process.env.RATE_LIMIT_MAX || 90),
  },
};

if (!config.payTo) {
  console.error("[config] SELLER_ADDRESS is required (set it in apps/api/.env)");
  process.exit(1);
}

/**
 * Paywalled catalog. Prices are plain USD strings — the x402 SDK resolves
 * them to MUSD amounts at runtime (MUSD is Mezo's default settlement asset).
 */
export const ENDPOINTS = [
  {
    id: "haiku",
    method: "GET",
    path: "/v1/haiku",
    price: "$0.001",
    description: "Generate a 3-line haiku about any topic",
    param: "topic",
    example: "/v1/haiku?topic=mezo",
  },
  {
    id: "answer",
    method: "GET",
    path: "/v1/answer",
    price: "$0.002",
    description: "Ask the demo oracle a Bitcoin / finance question",
    param: "q",
    example: "/v1/answer?q=what+is+musd",
  },
  {
    id: "summarize",
    method: "POST",
    path: "/v1/summarize",
    price: "$0.005",
    description: "Summarize a block of text (extractive demo model)",
    example: 'POST body: {"text":"..."}',
  },
  {
    id: "sentiment",
    method: "POST",
    path: "/v1/sentiment",
    price: "$0.003",
    description: "Score the sentiment of a text (-1 bearish … +1 bullish)",
    example: 'POST body: {"text":"..."}',
  },
];
