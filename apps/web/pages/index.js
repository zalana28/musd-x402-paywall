import { useEffect, useState } from "react";
import Link from "next/link";
import { NET, short } from "../lib/net";

const ENDPOINTS = [
  { id: "haiku", path: "GET /v1/haiku", price: "$0.001", desc: "Generate a 3-line haiku about any topic.", icon: "✍️" },
  { id: "answer", path: "GET /v1/answer", price: "$0.002", desc: "Ask the demo oracle about Bitcoin finance.", icon: "🔮" },
  { id: "sentiment", path: "POST /v1/sentiment", price: "$0.003", desc: "Score market sentiment: −1 bearish … +1 bullish.", icon: "📈" },
  { id: "summarize", path: "POST /v1/summarize", price: "$0.005", desc: "Metered text summarization, per call.", icon: "📝" },
];

const STEPS = [
  { n: "01", t: "Discover", d: "Agent hits GET /v1/tools — machine-readable catalog. No docs, no keys." },
  { n: "02", t: "Quote", d: "Server replies 402 with a price in MUSD or BTC on Mezo." },
  { n: "03", t: "Sign", d: "One EIP-712 signature in the agent's wallet. Zero gas for buyers." },
  { n: "04", t: "Settle", d: "Facilitator verifies and settles on-chain. Content unlocks." },
];

function TerminalCard() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % 7), 900);
    return () => clearInterval(id);
  }, []);
  const lines = [
    { t: "$ curl api/v1/haiku?topic=mezo", c: "text-white/50" },
    { t: "HTTP/1.1 402 Payment Required", c: "text-mezo-rose" },
    { t: "price: 0.001 BTC · eip155:31611", c: "text-mezo-gold" },
    { t: "$ agent.sign()   # EIP-712 permit2", c: "text-white/70" },
    { t: "✓ verified — facilitator.vativ.io", c: "text-mezo-amber" },
    { t: "✓ settled on Mezo · tx 0x99da…d63", c: "text-mezo-mint" },
    { t: '{ "haiku": "orange light on quiet…" }', c: "text-white/85" },
  ];
  return (
    <div className="glow-card relative w-full p-5 font-mono text-[12.5px] leading-7 shadow-card sm:p-6">
      <div className="mb-4 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-[11px] tracking-wider text-white/35">
          x402 agent session
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-mezo-mint">
          <span className="live-dot" /> LIVE
        </span>
      </div>
      {lines.map((l, i) => (
        <p
          key={i}
          className={`${l.c} whitespace-pre transition-all duration-500 ${
            i < phase ? "opacity-100" : "opacity-0 translate-y-1"
          }`}
        >
          {l.t || "\u00A0"}
        </p>
      ))}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4">
        {["⚡ 0 gas for buyers", "🔑 no API keys", "⛓ settled on Mezo"].map((c) => (
          <span
            key={c}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/60"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function Ticker() {
  const items = [
    ...ENDPOINTS.map((e) => `${e.path} — ${e.price}`),
    "MEZO TESTNET · eip155:31611",
    "facilitator · facilitator.vativ.io",
    "MUSD 0x1189…c503",
  ];
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-white/[0.06] bg-white/[0.015] py-2.5">
      <div className="marquee-track">
        {row.map((t, i) => (
          <span key={i} className="mono whitespace-nowrap text-[11px] text-white/35">
            <span className="text-mezo-orange/70">◆</span> {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    fetch(`${NET.api}/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const settled = stats ? stats.grossMusd : null;
  const feed = (stats?.settlements || []).slice(0, 6);

  return (
    <div>
      {/* ================= HERO full-bleed ================= */}
      <section className="relative overflow-hidden">
        <div className="orb animate-orb left-[-140px] top-[-120px] h-[420px] w-[420px] bg-mezo-orange/25" />
        <div className="orb animate-orb-slow right-[-160px] top-[60px] h-[460px] w-[460px] bg-mezo-ember/20" />
        <div className="orb animate-orb bottom-[-200px] left-[38%] h-[360px] w-[360px] bg-mezo-amber/10" />

        <div className="container-wide relative grid items-center gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
          <div>
            <div className="mb-6 flex flex-wrap gap-2">
              <span className="chip"><span className="live-dot" /> MEZO TESTNET · 31611</span>
              <span className="chip">MUSD · BITCOIN-BACKED</span>
              <span className="chip">x402 v2 · LIVE SETTLEMENTS</span>
            </div>
            <h1 className="font-display text-[2.7rem] font-bold leading-[1.03] tracking-tight text-white sm:text-6xl xl:text-7xl">
              AI agents pay your API.
              <br />
              <span className="grad-text">In Bitcoin's stablecoin.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/60">
              A metered API paywall with zero signup: agents pay per request in{" "}
              <span className="text-mezo-gold">MUSD</span> or{" "}
              <span className="text-mezo-gold">BTC</span> over the{" "}
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
            <div className="mt-10 flex flex-wrap gap-x-10 gap-y-3 text-sm text-white/40">
              <span><span className="mono text-mezo-gold">$0.001</span> min charge</span>
              <span><span className="mono text-mezo-gold">0 gas</span> for buyers</span>
              <span><span className="mono text-mezo-gold">0 API keys</span> ever</span>
            </div>
          </div>
          <div className="lg:pl-6">
            <TerminalCard />
          </div>
        </div>
      </section>

      <Ticker />

      {/* ================= LIVE STATS ================= */}
      <section className="container-wide px-5 py-14 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "settled on Mezo", val: settled != null ? `${Number(settled).toFixed(3)} BTC` : "—", sub: "real facilitator txs" },
            { label: "paid requests", val: stats ? String(stats.paidRequests) : "—", sub: "counted by onAfterSettle" },
            { label: "metered endpoints", val: "4", sub: "$0.001 – $0.005 / call" },
            { label: "network", val: "eip155:31611", sub: "Mezo Matsnet · gas BTC" },
          ].map((s) => (
            <div key={s.label} className="glass p-6">
              <p className="label">{s.label}</p>
              <p className="stat-num mt-2 text-mezo-gold">{s.val}</p>
              <p className="mt-1 text-xs text-white/35">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= ENDPOINTS ================= */}
      <section className="container-wide px-5 pb-16 sm:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label">the catalog</p>
            <h2 className="font-display text-3xl font-bold text-white">
              Four metered endpoints
            </h2>
          </div>
          <code className="mono text-xs text-white/35">GET /v1/tools · machine-readable</code>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ENDPOINTS.map((e) => (
            <div key={e.id} className="glass group p-6 transition hover:-translate-y-1 hover:border-mezo-orange/40">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-2xl">{e.icon}</span>
                <span className="rounded-md bg-mezo-orange/10 px-2 py-0.5 mono text-xs font-semibold text-mezo-amber">
                  {e.price}
                </span>
              </div>
              <code className="mono block text-[12.5px] text-mezo-gold">{e.path}</code>
              <p className="mt-3 text-sm leading-relaxed text-white/60">{e.desc}</p>
              <p className="mt-4 text-xs text-white/30 transition group-hover:text-mezo-amber/80">
                settled in MUSD / BTC on Mezo →
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="border-y border-white/[0.05] bg-white/[0.015]">
        <div className="container-wide px-5 py-16 sm:px-8">
          <p className="label">how it works</p>
          <h2 className="mb-12 font-display text-3xl font-bold text-white">
            Four steps. No accounts. No keys.
          </h2>
          <div className="step-line relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-mezo-orange/50 bg-[#0c0a10] font-display text-sm font-bold text-mezo-amber shadow-glow-sm">
                  {s.n}
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold text-mezo-gold">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= LIVE SETTLEMENTS FEED ================= */}
      <section className="container-wide px-5 py-16 sm:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label">on-chain revenue</p>
            <h2 className="font-display text-3xl font-bold text-white">
              Live settlements <span className="live-dot ml-1 inline-block align-middle" />
            </h2>
          </div>
          <Link href="/ledger" className="mono text-xs text-mezo-gold hover:underline">
            full ledger →
          </Link>
        </div>
        <div className="glass overflow-hidden">
          <div className="grid grid-cols-[1.4fr_1fr_0.7fr_auto] gap-3 border-b border-white/[0.06] px-5 py-3">
            <span className="label">tx</span>
            <span className="label">payer</span>
            <span className="label text-right">amount</span>
            <span className="label text-right">time</span>
          </div>
          {feed.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-white/40">
              Loading on-chain settlements…
            </p>
          )}
          {feed.map((s, i) => {
            return (
              <div key={(s.txHash || "") + i} className="feed-row grid grid-cols-[1.4fr_1fr_0.7fr_auto] items-center gap-3 border-b border-white/[0.04] px-5 py-3.5">
                <a
                  href={`${NET.explorer}/tx/${s.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mono text-xs text-mezo-gold hover:underline"
                >
                  {s.txHash ? short(s.txHash) : "—"}
                </a>
                <span className="mono text-xs text-white/55">{s.payer ? short(s.payer) : "—"}</span>
                <span className="text-right font-display text-sm font-semibold text-mezo-mint">
                  +{Number(BigInt(s.amountWei)) / 1e18}
                </span>
                <span className="mono text-right text-[11px] text-white/30">
                  {new Date(s.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="container-wide px-5 pb-24 sm:px-8">
        <div className="glow-card relative overflow-hidden p-10 text-center sm:p-14">
          <div className="orb left-1/2 top-[-80px] h-[300px] w-[500px] -translate-x-1/2 bg-mezo-orange/20" />
          <h2 className="relative font-display text-3xl font-bold text-white sm:text-4xl">
            Ready to charge <span className="grad-text">per request?</span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-white/55">
            One middleware line turns any JSON endpoint into a metered, agent-payable
            API — settled in Bitcoin's stablecoin on Mezo.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/playground" className="btn-primary">Try the playground →</Link>
            <Link href="/docs" className="btn-ghost">Read the 5-min guide</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
