import Link from "next/link";
import { NET, short } from "../lib/net";

const ENDPOINTS = [
  {
    id: "haiku",
    path: "GET /v1/haiku",
    price: "$0.001",
    desc: "Generate a 3-line haiku about any topic.",
  },
  {
    id: "answer",
    path: "GET /v1/answer",
    price: "$0.002",
    desc: "Ask the demo oracle about Bitcoin finance.",
  },
  {
    id: "sentiment",
    path: "POST /v1/sentiment",
    price: "$0.003",
    desc: "Score market sentiment: -1 bearish … +1 bullish.",
  },
  {
    id: "summarize",
    path: "POST /v1/summarize",
    price: "$0.005",
    desc: "Metered text summarization, per call.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Request",
    body: "An agent calls your API with no account, no API key, no signup.",
  },
  {
    n: "02",
    title: "402 · Price quote",
    body: "Your server replies 402 with a machine-readable price in MUSD.",
  },
  {
    n: "03",
    title: "Sign & retry",
    body: "The agent signs an EIP-712 permit2 authorization and retries — zero gas.",
  },
  {
    n: "04",
    title: "Verify & settle",
    body: "The facilitator verifies and settles on Mezo. You ship content.",
  },
];

function MiniConsole() {
  const rows = [
    { c: "text-white/40", t: "$ curl api.musd402.xyz/v1/haiku?topic=mezo" },
    { c: "text-mezo-rose", t: "HTTP/1.1 402 Payment Required" },
    { c: "text-white/60", t: "price: 0.001 MUSD → 0x1189…c503" },
    { c: "text-white/40", t: "" },
    { c: "text-white/40", t: "$ agent.pay()  # EIP-712, gas sponsored" },
    { c: "text-mezo-amber", t: "✓ verified by facilitator.vativ.io" },
    { c: "text-mezo-mint", t: "✓ settled on Mezo · eip155:31611" },
    { c: "text-white/80", t: '{ "haiku": "orange light on quiet…" }' },
  ];
  return (
    <div className="glow-card relative w-full p-5 font-mono text-[12.5px] leading-7 shadow-card sm:p-6">
      <div className="mb-4 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-[11px] tracking-wider text-white/35">
          x402 — agent session
        </span>
      </div>
      {rows.map((r, i) => (
        <p
          key={i}
          className={`${r.c} whitespace-pre-wrap opacity-0`}
          style={{ animation: `fade-up 0.4s ease-out ${0.35 * i + 0.2}s forwards` }}
        >
          {r.t || "\u00A0"}
        </p>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-5">
      {/* hero */}
      <section className="grid items-center gap-10 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24">
        <div>
          <div className="mb-6 flex flex-wrap gap-2">
            <span className="chip">
              <span className="live-dot" /> MEZO TESTNET · 31611
            </span>
            <span className="chip">MUSD · BITCOIN-BACKED</span>
            <span className="chip">x402 v2 · LIVE FACILITATOR</span>
          </div>
          <h1 className="font-display text-[2.6rem] font-bold leading-[1.04] tracking-tight text-white sm:text-6xl">
            AI agents pay your API.
            <br />
            <span className="grad-text">In Bitcoin's stablecoin.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/60">
            A metered API paywall with zero signup: agents pay per request in{" "}
            <span className="text-mezo-gold">MUSD</span> over the{" "}
            <span className="text-mezo-gold">x402</span> protocol, verified by a
            live facilitator and settled on Mezo — gasless for buyers, one
            middleware line for sellers.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/playground" className="btn-primary">
              Run a paying agent →
            </Link>
            <Link href="/docs" className="btn-ghost">
              Ship your own in 5 minutes
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/40">
            <span>
              <span className="mono text-mezo-gold">$0.001</span> min charge
            </span>
            <span>
              <span className="mono text-mezo-gold">0 gas</span> for buyers
            </span>
            <span>
              <span className="mono text-mezo-gold">0 API keys</span> ever
            </span>
          </div>
        </div>
        <div className="animate-float">
          <MiniConsole />
        </div>
      </section>

      {/* endpoints */}
      <section className="pb-20">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="label">the catalog</p>
            <h2 className="font-display text-3xl font-bold text-white">
              Three metered endpoints
            </h2>
          </div>
          <span className="mono hidden text-xs text-white/35 sm:block">
            payTo {short(NET.seller)}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {ENDPOINTS.map((e) => (
            <div
              key={e.id}
              className="glass group p-6 transition hover:-translate-y-1 hover:border-mezo-orange/40"
            >
              <div className="mb-3 flex items-center justify-between">
                <code className="mono text-[12.5px] text-mezo-gold">
                  {e.path}
                </code>
                <span className="rounded-md bg-mezo-orange/10 px-2 py-0.5 mono text-xs font-semibold text-mezo-amber">
                  {e.price}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-white/60">{e.desc}</p>
              <p className="mt-4 text-xs text-white/30 transition group-hover:text-mezo-amber/80">
                settled in MUSD on Mezo →
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section className="pb-24">
        <p className="label">how it works</p>
        <h2 className="mb-8 font-display text-3xl font-bold text-white">
          Four steps. No accounts. No keys.
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="glass-soft relative overflow-hidden p-6">
              <span className="pointer-events-none absolute -right-2 -top-5 font-display text-7xl font-bold text-white/[0.045]">
                {s.n}
              </span>
              <h3 className="mb-2 font-display text-lg font-semibold text-mezo-gold">
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed text-white/60">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="glass mt-10 flex flex-col items-center justify-between gap-4 p-6 lg:flex-row">
          <div className="flex items-start gap-3">
            <span className="live-dot mt-1.5" />
            <div className="text-sm leading-relaxed text-white/70">
              Everything here is live on Mezo testnet — the facilitator at{" "}
              <span className="mono text-mezo-gold">
                {short(NET.facilitator, 10)}
              </span>{" "}
              verifies real signatures against real MUSD balances. Agents can
              discover the catalog machine-readably at{" "}
              <span className="mono text-mezo-gold">GET /v1/tools</span> — zero
              docs, zero keys, zero signup.
            </div>
          </div>
          <Link href="/playground" className="btn-primary shrink-0">
            See it happen →
          </Link>
        </div>
      </section>
    </div>
  );
}
