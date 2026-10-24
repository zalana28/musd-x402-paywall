import { useEffect, useState } from "react";
import { NET, short } from "../lib/net";

export default function Ledger() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [auto, setAuto] = useState(false);

  async function load() {
    setError(null);
    try {
      const [res, sres] = await Promise.all([
        fetch("/api/ledger"),
        fetch(`${NET.api}/stats`).catch(() => null),
      ]);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "ledger query failed");
      setData(json);
      if (sres && sres.ok) setStats(await sres.json());
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [auto]);

  return (
    <div className="container-wide px-5 sm:px-8 pb-10 pt-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">on-chain revenue</p>
          <h1 className="font-display text-4xl font-bold text-white">
            MUSD <span className="grad-text">settlement ledger</span>
          </h1>
          <p className="mt-2 max-w-xl text-[15px] text-white/55">
            Every MUSD transfer received by the seller wallet, read directly
            from Mezo testnet RPC — no indexer, no database.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="glass px-6 py-4 text-right">
            <p className="label">MUSD settled</p>
            <p className="font-display text-3xl font-bold text-mezo-gold">
              {data ? `${(data.totals?.MUSD || 0).toFixed(3)}` : "—"}
            </p>
          </div>
          <div className="glass px-6 py-4 text-right">
            <p className="label">BTC settled</p>
            <p className="font-display text-3xl font-bold text-mezo-amber">
              {data ? `${(data.totals?.BTC || 0).toFixed(3)}` : "—"}
            </p>
          </div>
          <div className="glass px-6 py-4 text-right">
            <p className="label">paid requests</p>
            <p className="font-display text-3xl font-bold text-mezo-mint">
              {stats ? stats.paidRequests : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="glass overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <span className="label">transfers to {short(NET.seller)}</span>
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-white/55">
              <input
                type="checkbox"
                checked={auto}
                onChange={(e) => setAuto(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#f7931a]"
              />
              auto 15s
            </label>
            <button
              onClick={load}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:border-mezo-orange/40 hover:text-mezo-gold"
            >
              {loading ? "scanning…" : "↻ refresh"}
            </button>
          </div>
        </div>

        {error && (
          <p className="px-5 py-8 text-center text-sm text-mezo-rose">
            {error}
          </p>
        )}

        {data && data.transfers.length === 0 && (
          <div className="px-5 py-14 text-center">
            <p className="mb-1 font-display text-lg text-white/70">
              No settlements yet
            </p>
            <p className="text-sm text-white/40">
              Fund an agent wallet with testnet MUSD and run the{" "}
              <a href="/playground" className="text-mezo-gold hover:underline">
                playground
              </a>{" "}
              — settled transfers appear here instantly.
            </p>
          </div>
        )}

        {data && data.transfers.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left">
                <th className="label px-5 py-3">tx</th>
                <th className="label px-5 py-3">from</th>
                <th className="label px-5 py-3">asset</th>
                <th className="label px-5 py-3 text-right">amount</th>
              </tr>
            </thead>
            <tbody>
              {data.transfers.map((t) => (
                <tr
                  key={t.txHash + t.block}
                  className="border-b border-white/[0.04] transition hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-3.5">
                    <a
                      href={`${NET.explorer}/tx/${t.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mono text-xs text-mezo-gold hover:underline"
                    >
                      {short(t.txHash)}
                    </a>
                    <span className="ml-2 mono text-[10px] text-white/25">
                      block {t.block}
                    </span>
                  </td>
                  <td className="mono px-5 py-3.5 text-xs text-white/55">
                    {short(t.from)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`chip !py-0.5 !text-[10px] ${t.asset === "BTC" ? "!border-mezo-amber/40 !text-mezo-amber" : ""}`}>
                      {t.asset}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-display font-semibold text-mezo-mint">
                    +{t.usd}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {stats && stats.settlements?.length > 0 && (
        <div className="glass mt-6 overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-3.5">
            <span className="label">recent settlements · counted by the x402 afterSettle hook</span>
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              {stats.settlements.slice(0, 5).map((s, i) => (
                <tr key={(s.txHash || "pending") + i} className="border-b border-white/[0.04]">
                  <td className="mono px-5 py-3 text-xs text-white/55">
                    {s.txHash ? (
                      <a
                        href={`${NET.explorer}/tx/${s.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-mezo-gold hover:underline"
                      >
                        {short(s.txHash)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="mono px-5 py-3 text-xs text-white/55">
                    payer {s.payer ? short(s.payer) : "—"}
                  </td>
                  <td className="mono px-5 py-3 text-xs text-white/40">
                    {s.amountWei ? `${Number(BigInt(s.amountWei)) / 1e18} MUSD` : "—"}
                  </td>
                  <td className="mono px-5 py-3 text-right text-xs text-white/30">
                    {s.at}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-white/30">
        scanned from block {data ? data.scannedFrom : "…"} · MUSD{" "}
        {short(NET.musd)} · <span className="mono">{NET.rpc}</span>
        {data?.cached ? " · cached 10s" : ""}
      </p>
    </div>
  );
}
