/**
 * Demo "models" — deterministic generators so the paywall works without an
 * LLM key. Swap these for real model calls and the x402 billing layer is
 * unchanged; that is the whole point of metered x402 endpoints.
 */

export const MAX_QUERY = 200;
export const MAX_TEXT = 8_000;

const clamp = (s, max) => String(s ?? "").slice(0, max);

function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length];
}

export function generateHaiku(topic) {
  const t = clamp(topic, MAX_QUERY).trim().toLowerCase() || "bitcoin";
  const seed = [...t].reduce((a, c) => a + c.charCodeAt(0), 0);
  const lines = [
    [
      `cold wallets hum slow,`,
      `orange light on quiet screens,`,
      `${t} holds its breath,`,
      `sats drift through lightning veins,`,
    ],
    [
      `a stack of ${t},`,
      `collateral blooms in spring,`,
      `the peg holds its line,`,
      `miners hum beneath the frost,`,
    ],
    [
      `no bank, no hours, no queue —`,
      `${t} settles while you sleep,`,
      `proof sleeps in the chain,`,
      `trust folds into math,`,
    ],
  ];
  return [
    pick(lines[0], seed),
    pick(lines[1], seed >> 3),
    pick(lines[2], seed >> 6),
  ].join("\n");
}

const ORACLE = [
  {
    keys: ["musd", "stablecoin"],
    a: "MUSD is Mezo's native, Bitcoin-backed stablecoin. You mint it by opening a trove — locking BTC as collateral (110% minimum) — and it settles payments on Mezo, including every x402 request to this API.",
  },
  {
    keys: ["x402", "payment", "http 402"],
    a: "x402 is an HTTP-native payment standard: a server answers with 402 Payment Required and a machine-readable price, the client retries with a signed payment payload, and a facilitator verifies and settles it on-chain — here, in MUSD on Mezo.",
  },
  {
    keys: ["gas", "fee", "sponsor"],
    a: "Buyers pay zero gas on Mezo x402 flows. The payment is an EIP-712 signature (permit2 + EIP-2612); the facilitator sponsors the on-chain settlement transaction.",
  },
  {
    keys: ["mezo", "chain", "network", "testnet"],
    a: "Mezo is a Bitcoin economic layer — an EVM-compatible chain (chain ID 31611 on testnet, 31612 mainnet) where gas is paid in BTC. This demo runs on the Mezo testnet (Matsnet).",
  },
  {
    keys: ["borrow", "trove", "cdp"],
    a: "Borrowing on Mezo works like a CDP (similar to Liquity): open a trove with BTC collateral, mint MUSD against it, keep the ratio above 110%, and close it by repaying the debt.",
  },
];

export function answerQuestion(q) {
  const text = clamp(q, MAX_QUERY).toLowerCase();
  const hit = ORACLE.find((e) => e.keys.some((k) => text.includes(k)));
  if (hit) return hit.a;
  return `The demo oracle is keyword-based, but the payment was very real: your agent just paid for this answer with MUSD on Mezo. Try asking about "MUSD", "x402", "gas", "Mezo", or "trove".`;
}

export function summarizeText(text) {
  const body = clamp(text, MAX_TEXT).replace(/\s+/g, " ").trim();
  if (!body) return "No text provided.";
  const sentences = body.split(/(?<=[.!?])\s+/).filter(Boolean);
  const keep = Math.max(1, Math.ceil(sentences.length * 0.34));
  const summary = sentences.slice(0, keep).join(" ");
  return `${summary}\n\n[extractive demo model — ${sentences.length} sentences in, ${keep} out, ${body.length} chars]`;
}

const BULLISH = [
  "bitcoin", "bull", "moon", "pump", "ath", "gain", "rally", "adoption",
  "upgrade", "support", "buy", "long", "hodl", "surge", "record",
];
const BEARISH = [
  "crash", "bear", "dump", "loss", "hack", "rug", "fear", "sell",
  "short", "ban", "bubble", "rekt", "liquidation", "fud", "down",
];

// Word-boundary match so "ath" doesn't fire inside "weather", etc.
const hasWord = (body, w) => new RegExp(`\\b${w}\\b`).test(body);

export function sentimentScore(text) {
  const body = clamp(text, MAX_TEXT).toLowerCase();
  if (!body.trim()) return { score: 0, label: "neutral", matched: [] };
  const matched = [];
  let score = 0;
  for (const w of BULLISH)
    if (hasWord(body, w)) { score += 1; matched.push(`+${w}`); }
  for (const w of BEARISH)
    if (hasWord(body, w)) { score -= 1; matched.push(`-${w}`); }
  const norm = Math.max(-1, Math.min(1, score / 3));
  const label =
    norm > 0.25 ? "bullish" : norm < -0.25 ? "bearish" : "neutral";
  return {
    score: Number(norm.toFixed(2)),
    label,
    matched: matched.slice(0, 12),
    note: "lexicon demo model — swap in any scoring model, billing unchanged",
  };
}
