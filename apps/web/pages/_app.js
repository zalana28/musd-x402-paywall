import "../styles/globals.css";
import Link from "next/link";
import { NET, short } from "../lib/net";
import { WalletProvider, useWallet } from "../lib/walletContext";

function Layout({ children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#08060b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between px-5">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-mezo-amber to-mezo-ember text-sm font-black text-[#1a0f02] shadow-glow-sm">
              ₿
            </span>
            <span className="font-display text-[16px] font-bold tracking-[0.14em] text-white">
              PAYWALL
            </span>
          </Link>
          <div className="flex items-center gap-0.5 text-[13px] sm:gap-1 sm:text-sm">
            <Link href="/playground" className="rounded-lg px-2 py-2 text-white/70 transition hover:bg-white/5 hover:text-white sm:px-3.5">
              Playground
            </Link>
            <Link href="/ledger" className="rounded-lg px-2 py-2 text-white/70 transition hover:bg-white/5 hover:text-white sm:px-3.5">
              Ledger
            </Link>
            <Link href="/docs" className="rounded-lg px-2 py-2 text-white/70 transition hover:bg-white/5 hover:text-white sm:px-3.5">
              Docs
            </Link>
            <NavWalletButton />
          </div>
        </div>
      </nav>

      <main className="flex-1">{children}</main>

      <footer className="mt-24 border-t border-white/[0.06] py-10">
        <div className="mx-auto flex max-w-[1360px] flex-col items-center justify-between gap-3 px-5 text-sm text-white/40 sm:flex-row">
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
            eip155:31611 · MUSD {short(NET.musd)} · x402 v2 ·{" "}
            <a
              href={`${NET.explorer}/address/${NET.seller}`}
              target="_blank"
              rel="noreferrer"
              className="text-mezo-gold/70 hover:text-mezo-gold"
            >
              payTo {short(NET.seller)}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function NavWalletButton() {
  const { address, connecting, connect } = useWallet();
  if (!address) {
    return (
      <button
        onClick={connect}
        disabled={connecting}
        className="ml-2 rounded-lg bg-gradient-to-br from-mezo-amber to-mezo-ember px-3.5 py-1.5 text-[12px] font-bold text-[#1a0f02] transition hover:brightness-110 disabled:opacity-60"
      >
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }
  return (
    <a
      href={`${NET.explorer}/address/${address}`}
      target="_blank"
      rel="noreferrer"
      className="ml-2 flex items-center gap-2 rounded-lg border border-mezo-mint/40 px-3 py-1.5 mono text-[11px] text-mezo-mint transition hover:border-mezo-mint"
    >
      <span className="live-dot" />
      {short(address)}
    </a>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <WalletProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </WalletProvider>
  );
}
