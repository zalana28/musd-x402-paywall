import "../styles/globals.css";
import Link from "next/link";
import { NET, short } from "../lib/net";

function Layout({ children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#08060b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-mezo-amber to-mezo-ember text-sm font-black text-[#1a0f02] shadow-glow-sm">
              ₿
            </span>
            <span className="font-display text-[15px] font-bold tracking-tight text-white">
              MUSD <span className="text-mezo-amber">x402</span> Paywall
            </span>
          </Link>
          <div className="flex items-center gap-1 text-sm">
            <Link href="/playground" className="rounded-lg px-3.5 py-2 text-white/70 transition hover:bg-white/5 hover:text-white">
              Playground
            </Link>
            <Link href="/ledger" className="rounded-lg px-3.5 py-2 text-white/70 transition hover:bg-white/5 hover:text-white">
              Ledger
            </Link>
            <Link href="/docs" className="rounded-lg px-3.5 py-2 text-white/70 transition hover:bg-white/5 hover:text-white">
              Docs
            </Link>
            <a
              href={`${NET.explorer}/address/${NET.seller}`}
              target="_blank"
              rel="noreferrer"
              className="ml-2 hidden items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 mono text-[11px] text-white/60 transition hover:border-mezo-orange/50 hover:text-mezo-gold sm:flex"
            >
              <span className="live-dot" />
              {short(NET.seller)}
            </a>
          </div>
        </div>
      </nav>

      <main className="flex-1">{children}</main>

      <footer className="mt-24 border-t border-white/[0.06] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-sm text-white/40 sm:flex-row">
          <p>
            Built for the{" "}
            <a
              href="https://mezo.org/blog/mezo-buildathon-is-underway/"
              target="_blank"
              rel="noreferrer"
              className="text-mezo-amber/80 hover:text-mezo-amber"
            >
              Mezo Buildathon
            </a>{" "}
            · MUSD Track
          </p>
          <p className="mono text-xs">
            eip155:31611 · MUSD {short(NET.musd)} · x402 v2
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}
