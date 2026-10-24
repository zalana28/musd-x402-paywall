import { useEffect, useRef, useState } from "react";
import FlowVisualizer from "../components/FlowVisualizer";
import ResultCard from "../components/ResultCard";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  connectWallet,
  getInjected,
  walletSignTypedData,
  walletApprovePermit2,
} from "../lib/wallet.js";
import { useWallet } from "../lib/walletContext.jsx";

const ENDPOINTS = [
  {
    id: "haiku",
    label: "Haiku",
    path: "GET /v1/haiku",
    price: "$0.001",
    param: "topic",
    placeholder: "mezo",
    defaults: ["mezo", "satoshis coffee", "lightning night", "cold storage"],
  },
  {
    id: "answer",
    label: "Oracle",
    path: "GET /v1/answer",
    price: "$0.002",
    param: "q",
    placeholder: "what is musd?",
    defaults: ["what is musd?", "how does x402 work?", "who pays the gas?"],
  },
  {
    id: "summarize",
    label: "Summarize",
    path: "POST /v1/summarize",
    price: "$0.005",
    placeholder: "Paste text to summarize…",
    defaults: [],
    textarea: true,
  },
  {
    id: "sentiment",
    label: "Sentiment",
    path: "POST /v1/sentiment",
    price: "$0.003",
    placeholder: "Paste market chatter…",
    defaults: [],
    textarea: true,
  },
];

const LS_KEY = "musd402.agentWallet";

function loadWallet() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw && /^0x[0-9a-fA-F]{64}$/.test(raw)) return raw;
  } catch {}
  return null;
}

export default function Playground() {
  const [endpointId, setEndpointId] = useState("haiku");
  const [param, setParam] = useState("mezo");
  const [running, setRunning] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // wallet state
  const [persist, setPersist] = useState(false);
  const [walletKey, setWalletKey] = useState(null);
  const [walletAddr, setWalletAddr] = useState(null);
  const [balance, setBalance] = useState(null);
  const [sponsored, setSponsored] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveResult, setApproveResult] = useState(null);

  // external (injected) wallet — shared with the navbar via context
  const walletCtx = useWallet();
  const extWallet = walletCtx.address ? { address: walletCtx.address } : null;
  const extConnecting = walletCtx.connecting;

  // progressive reveal
  const [revealed, setRevealed] = useState(0);
  const revealTimers = useRef([]);

  useEffect(() => {
    const k = loadWallet();
    if (k) {
      setPersist(true);
      setWalletKey(k);
      setWalletAddr(privateKeyToAccount(k).address);
    }
  }, []);

  // fetch balance whenever address changes
  useEffect(() => {
    if (!walletAddr) return setBalance(null);
    let alive = true;
    fetch("/api/agent/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: walletAddr }),
    })
      .then((r) => r.json())
      .then((j) => alive && !j.error && setBalance(j))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [walletAddr]);

  function enablePersist() {
    const k = walletKey || generatePrivateKey();
    try {
      localStorage.setItem(LS_KEY, k);
    } catch {}
    setPersist(true);
    setWalletKey(k);
    setWalletAddr(privateKeyToAccount(k).address);
  }

  function disablePersist() {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {}
    setPersist(false);
    setWalletKey(null);
    setWalletAddr(null);
    setApproveResult(null);
  }

  async function approvePermit2() {
    if (!walletKey) return;
    setApproving(true);
    setApproveResult(null);
    try {
      const r = await fetch("/api/agent/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentPrivateKey: walletKey }),
      });
      const j = await r.json();
      setApproveResult(j);
      if (j.ok) {
        // allowance takes effect once the tx mines — poll balance a couple times
        setTimeout(() => walletAddr && refreshBalance(), 6000);
        setTimeout(() => walletAddr && refreshBalance(), 15000);
      }
    } catch (e) {
      setApproveResult({ ok: false, error: String(e?.message || e) });
    } finally {
      setApproving(false);
    }
  }

  async function connectExt() {
    await walletCtx.connect();
  }

  function disconnectExt() {
    walletCtx.disconnect();
  }

  async function approveViaWallet(assetAddress, label) {
    try {
      const tx = await walletApprovePermit2(assetAddress);
      setApproveResult({
        ok: true,
        approvals: [{ asset: label, txHash: tx }],
      });
      setTimeout(() => walletAddr && refreshBalance(), 6000);
      setTimeout(() => walletAddr && refreshBalance(), 15000);
    } catch (e) {
      setApproveResult({ ok: false, error: String(e?.message || e) });
    }
  }

  /** Wallet-paid flow: prepare → sign in the user's wallet → submit. */
  async function runWithExternalWallet() {
    const steps = [];
    const push = (id, label, status, detail) =>
      steps.push({ id, label, status, detail: detail ?? null });

    const prep = await fetch("/api/agent/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpointId,
        params: ep.textarea ? { text: param } : { [ep.param || "text"]: param },
        payerAddress: extWallet.address,
      }),
    }).then((r) => r.json());
    if (!prep.ok) throw new Error(prep.error || "prepare failed");

    const req0 = prep.paymentRequired?.accepts?.[0];
    const assetIsBtc =
      req0?.asset?.toLowerCase() ===
      "0x7b7c000000000000000000000000000000000000";
    push("request", "Request", "done", {
      method: ep.method,
      url: prep.request.url,
    });
    push("402", "402 · Price quote", "done", {
      price: req0?.amount
        ? `${Number(BigInt(req0.amount)) / 1e18} ${assetIsBtc ? "BTC" : "USD"}`
        : "?",
      asset: req0?.asset,
      network: req0?.network,
      payTo: req0?.payTo,
    });

    const signature = await walletSignTypedData(
      extWallet.address,
      prep.typedData
    );
    const payload = JSON.parse(JSON.stringify(prep.payload));
    if (payload.payload && "signature" in payload.payload) {
      payload.payload.signature = signature;
    }
    push("sign", "Sign in wallet", "done", {
      signer: extWallet.address,
      typedData: prep.typedData,
      signaturePrefix: String(signature).slice(0, 34) + "…",
    });

    const sub = await fetch("/api/agent/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request: prep.request, payload }),
    }).then((r) => r.json());
    push(
      "retry",
      "Paid retry",
      sub.status === 200 ? "done" : "failed",
      { status: sub.status }
    );

    if (sub.ok) {
      const settle = sub.settle || {};
      push("verify", "Facilitator verify", "done", {
        payer: settle.payer ?? extWallet.address,
      });
      push("settle", "Settle on Mezo", "done", {
        success: settle.success ?? true,
        transaction: settle.transaction ?? null,
        explorer: settle.transaction
          ? `${process.env.NEXT_PUBLIC_EXPLORER || "https://explorer.test.mezo.org"}/tx/${settle.transaction}`
          : null,
        raw: settle,
      });
      return { steps, result: sub.result };
    }

    const reason = sub.error || "verification_failed";
    push("verify", "Facilitator verify", "failed", { reason });
    push("settle", "Settle on Mezo", "pending", { note: "skipped" });
    return {
      steps,
      result: null,
      fundingHint:
        reason.toLowerCase().includes("balance") ||
        reason.toLowerCase().includes("allowance"),
    };
  }

  function refreshBalance() {
    if (!walletAddr) return;
    fetch("/api/agent/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: walletAddr }),
    })
      .then((r) => r.json())
      .then((j) => !j.error && setBalance(j))
      .catch(() => {});
  }

  function reveal(steps) {
    revealTimers.current.forEach(clearTimeout);
    revealTimers.current = [];
    setRevealed(0);
    steps.forEach((_, i) => {
      revealTimers.current.push(
        setTimeout(() => setRevealed(i + 1), 550 * (i + 1))
      );
    });
  }

  useEffect(() => () => revealTimers.current.forEach(clearTimeout), []);

  const ep = ENDPOINTS.find((e) => e.id === endpointId);

  async function run() {
    setRunning(true);
    setError(null);
    setData(null);
    setRevealed(0);
    if (extWallet) {
      try {
        const out = await runWithExternalWallet();
        setData({ agent: extWallet.address, ...out });
        reveal(out.steps || []);
        if (extWallet.address) {
          fetch("/api/agent/balance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: extWallet.address }),
          })
            .then((r) => r.json())
            .then((j) => !j.error && setBalance(j))
            .catch(() => {});
        }
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setRunning(false);
      }
      return;
    }
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpointId,
          params: ep.textarea ? { text: param } : { [ep.param || "text"]: param },
          agentPrivateKey: persist && walletKey ? walletKey : null,
          sponsored: Boolean(sponsored),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "agent run failed");
      setData(json);
      reveal(json.steps || []);
      if (persist && walletAddr) {
        fetch("/api/agent/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: walletAddr }),
        })
          .then((r) => r.json())
          .then((j) => !j.error && setBalance(j))
          .catch(() => {});
      }
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setRunning(false);
    }
  }

  const shownSteps = data ? data.steps.slice(0, revealed) : [];

  return (
    <div className="mx-auto max-w-6xl px-5 pb-10 pt-12">
      <p className="label">agent playground</p>
      <h1 className="mb-2 font-display text-4xl font-bold text-white">
        Watch an agent <span className="grad-text">pay per request</span>
      </h1>
      <p className="mb-10 max-w-2xl text-[15px] leading-relaxed text-white/55">
        Every run performs the real x402 handshake against the paywall API and
        sends the payment to the live facilitator for verification on Mezo
        testnet. Switch to a persistent agent wallet, fund it once with testnet
        MUSD, and every run settles on-chain.
      </p>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* control panel */}
        <div className="flex h-fit flex-col gap-4">
          <button
              onClick={() => setSponsored((v) => !v)}
              className={`mb-1 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${sponsored ? "border-mezo-orange/60 bg-mezo-orange/10" : "border-white/10 bg-white/[0.02] hover:border-white/25"}`}
            >
              <span>
                <span className="block font-display text-sm font-semibold text-white">Juri Mode — Sponsored Demo</span>
                <span className="mono text-[11px] text-white/45">GET /demo/sponsored · instant success · requires DEMO_SPONSOR=true</span>
              </span>
              <span className={`ml-2 shrink-0 rounded-full px-2.5 py-0.5 mono text-[11px] font-semibold ${sponsored ? "bg-mezo-orange text-[#1a0f02]" : "bg-white/10 text-white/40"}`}>{sponsored ? "ON" : "OFF"}</span>
            </button>
          <div className="glass p-6">
            <p className="label mb-3">endpoint</p>
            <div className="mb-6 flex flex-col gap-2">
              {ENDPOINTS.map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    setEndpointId(e.id);
                    setParam(e.defaults[0] || "");
                    setData(null);
                    setRevealed(0);
                  }}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                    endpointId === e.id
                      ? "border-mezo-orange/60 bg-mezo-orange/10 shadow-glow-sm"
                      : "border-white/10 bg-white/[0.02] hover:border-white/25"
                  }`}
                >
                  <span>
                    <span className="block font-display text-sm font-semibold text-white">
                      {e.label}
                    </span>
                    <span className="mono text-[11px] text-white/40">
                      {e.path}
                    </span>
                  </span>
                  <span
                    className={`mono text-xs font-semibold ${
                      endpointId === e.id ? "text-mezo-amber" : "text-white/40"
                    }`}
                  >
                    {e.price}
                  </span>
                </button>
              ))}
            </div>

            <p className="label mb-2">{ep.textarea ? "body · text" : ep.param}</p>
            {ep.textarea ? (
              <textarea
                value={param}
                onChange={(e) => setParam(e.target.value)}
                rows={5}
                placeholder={ep.placeholder}
                className="w-full rounded-xl border border-white/10 bg-black/30 p-3.5 text-sm text-white/85 outline-none transition placeholder:text-white/25 focus:border-mezo-orange/60"
              />
            ) : (
              <input
                value={param}
                onChange={(e) => setParam(e.target.value)}
                placeholder={ep.placeholder}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/85 outline-none transition placeholder:text-white/25 focus:border-mezo-orange/60"
              />
            )}

            {ep.defaults.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ep.defaults.map((d) => (
                  <button
                    key={d}
                    onClick={() => setParam(d)}
                    className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/45 transition hover:border-mezo-orange/40 hover:text-mezo-gold"
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={run}
              disabled={running}
              className="btn-primary mt-6 w-full justify-center"
            >
              {running ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1a0f02]/30 border-t-[#1a0f02]" />
                  Running handshake…
                </>
              ) : (
                <>▶ Run paying agent</>
              )}
            </button>
          </div>

          {/* connect external wallet */}
          <div className="glass p-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="label">connect wallet</p>
              {extWallet && (
                <button
                  onClick={disconnectExt}
                  className="text-[11px] text-white/40 underline hover:text-mezo-rose"
                >
                  disconnect
                </button>
              )}
            </div>
            {!extWallet ? (
              <>
                <button
                  onClick={connectExt}
                  disabled={extConnecting}
                  className="btn-ghost w-full justify-center"
                >
                  {extConnecting ? "Connecting…" : "🦊 Connect MetaMask / Brave"}
                </button>
                <p className="mt-3 text-[12px] leading-relaxed text-white/40">
                  Payments are signed <span className="text-white/70">in your own wallet</span> (EIP-712
                  popup) — the key never touches this server. BTC wallets
                  (Xverse/Unisat) arrive via Mezo Passport (roadmap).
                </p>
              </>
            ) : (
              <div className="space-y-3">
                <code className="mono block break-all text-[11.5px] leading-snug text-mezo-gold/90">
                  {extWallet.address}
                </code>
                <p className="text-[12px] leading-relaxed text-white/45">
                  External wallet active — the Run button now asks{" "}
                  <span className="text-white/70">your wallet</span> to sign each payment.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      approveViaWallet(
                        process.env.NEXT_PUBLIC_MUSD_ADDRESS ||
                          "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
                        "MUSD"
                      )
                    }
                    className="btn-ghost !py-2 !text-xs"
                  >
                    Approve MUSD
                  </button>
                  <button
                    onClick={() =>
                      approveViaWallet(
                        process.env.NEXT_PUBLIC_BTC_ERC20_ADDRESS ||
                          "0x7b7C000000000000000000000000000000000000",
                        "BTC"
                      )
                    }
                    className="btn-ghost !py-2 !text-xs"
                  >
                    Approve BTC
                  </button>
                </div>
              </div>
            )}
            {walletCtx.error && (
              <p className="mt-3 text-[12px] leading-relaxed text-mezo-rose/90">
                {walletCtx.error}
              </p>
            )}
          </div>

          {/* agent wallet card */}
          <div className="glass p-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="label">agent wallet (burner)</p>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-white/55">
                <input
                  type="checkbox"
                  checked={persist}
                  onChange={(e) =>
                    e.target.checked ? enablePersist() : disablePersist()
                  }
                  className="h-3.5 w-3.5 accent-[#f7931a]"
                />
                persistent
              </label>
            </div>

            {!persist ? (
              <p className="text-[13px] leading-relaxed text-white/45">
                Ephemeral mode: a fresh keypair per run. Great for demos —
                but it can never be funded, so settlement always stops at the
                facilitator's balance check.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <code className="mono break-all text-[11.5px] leading-snug text-mezo-gold/90">
                    {walletAddr}
                  </code>
                  <button
                    onClick={() =>
                      navigator.clipboard?.writeText(walletAddr || "")
                    }
                    className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/60 transition hover:border-mezo-orange/50 hover:text-mezo-gold"
                  >
                    copy
                  </button>
                </div>
                {balance ? (
                  <div className="flex items-center justify-between">
                    <span className="mono text-left text-xs leading-relaxed text-white/60">
                      {balance.musdBalance.toFixed(3)} MUSD ·{" "}
                      {balance.permit2Allowance > 0 ? "permit2 ✓" : "permit2 ✗"}
                      <br />
                      {balance.btcBalance.toFixed(4)} BTC ·{" "}
                      {balance.btcPermit2 > 0 ? "permit2 ✓" : "permit2 ✗"}
                    </span>
                    <span
                      className={`chip !py-0.5 !text-[10px] ${
                        balance.ready
                          ? "!border-mezo-mint/40 !text-mezo-mint"
                          : "!border-mezo-rose/40 !text-mezo-rose"
                      }`}
                    >
                      {balance.ready ? "ready to pay" : "needs funding"}
                    </span>
                  </div>
                ) : (
                  <span className="mono text-xs text-white/35">
                    checking balance…
                  </span>
                )}
                              {balance?.mezoHolder ? (
                  <div className="flex items-center gap-2 rounded-lg border border-mezo-orange/25 bg-mezo-orange/10 px-3 py-1.5 text-xs">
                    <span className="mono font-semibold text-mezo-gold">MEZO holder ✓</span>
                    <span className="text-white/50">— {balance.mezoBalance.toFixed ? balance.mezoBalance.toFixed(2) : balance.mezoBalance} MEZO · discount active</span>
                  </div>
                ) : balance?.mezoHolder === null ? (
                  <div className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/35">Set <span className="mono text-white/50">MEZO_ADDRESS</span> (or <span className="mono text-white/50">NEXT_PUBLIC_MEZO_ADDRESS</span>) to enable the MEZO discount check.</div>
                ) : balance && !balance.mezoHolder ? (
                  <div className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/35">No MEZO balance on this wallet.</div>
                ) : null}
                <p className="text-[12px] leading-relaxed text-white/40">
                  Stored only in this browser (localStorage). Fund it once →
                  every run settles on-chain and appears in the Ledger.
                </p>
                {balance && !balance.ready && (
                  <div className="space-y-2">
                    <button
                      onClick={approvePermit2}
                      disabled={approving}
                      className="btn-primary w-full justify-center !py-2 !text-sm"
                    >
                      {approving ? "Sending approvals…" : "Approve Permit2 — MUSD + BTC"}
                    </button>
                    {approveResult?.ok ? (
                      <div className="space-y-0.5">
                        {(approveResult.approvals || [])
                          .filter((a) => a.txHash)
                          .map((a) => (
                            <p key={a.asset} className="mono break-all text-[11px] text-mezo-mint">
                              ✓ {a.asset} tx{" "}
                              <a
                                href={`https://explorer.test.mezo.org/tx/${a.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="underline"
                              >
                                {a.txHash.slice(0, 16)}…
                              </a>
                            </p>
                          ))}
                        <p className="text-[11px] text-white/35">
                          approvals mined → chip turns ready
                        </p>
                      </div>
                    ) : approveResult && !approveResult.ok ? (
                      <p className="text-[11px] leading-relaxed text-mezo-rose/90">{approveResult.error}</p>
                    ) : (
                      <p className="text-[11px] leading-relaxed text-white/35">
                        Prasyarat: wallet sudah punya MUSD + sedikit BTC gas (~0.001) untuk satu tx approval.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* output */}
        <div className="flex flex-col gap-6">
          {error && (
            <div className="glass border-mezo-rose/40 p-5 text-sm text-mezo-rose">
              {error}
            </div>
          )}

          {data && revealed > 0 && (
            <FlowVisualizer
              steps={shownSteps}
              total={data.steps.length}
              agent={data.agent}
            />
          )}
          {data && data.result && revealed >= data.steps.length && (
            <ResultCard result={data.result} endpointId={endpointId} />
          )}
          {data && data.fundingHint && revealed >= data.steps.length && (
            <FundingPanel addr={data.agent} persist={persist} />
          )}
          {!data && !running && !error && <IdleState />}
        </div>
      </div>
    </div>
  );
}

function IdleState() {
  return (
    <div className="glass flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-mezo-orange/10 text-3xl animate-float">
        ⛓
      </div>
      <h3 className="font-display text-xl font-semibold text-white/80">
        The pipeline is warm
      </h3>
      <p className="max-w-sm text-sm leading-relaxed text-white/40">
        Pick an endpoint, press run, and watch a real x402 handshake: quote →
        signature → facilitator verify → MUSD settlement on Mezo.
      </p>
    </div>
  );
}

function FundingPanel({ addr, persist }) {
  return (
    <div className="glass animate-fade-up border-mezo-amber/30 p-6">
      <h3 className="mb-1 font-display text-lg font-semibold text-mezo-gold">
        Make settlement fully on-chain
      </h3>
      <p className="mb-4 text-sm leading-relaxed text-white/55">
        The signature was valid and the facilitator verified it live — the agent
        wallet just has no MUSD yet.{" "}
        {persist
          ? "Fund your persistent agent wallet below once, and every future run settles with a real transaction."
          : "Switch the agent wallet to persistent mode first so you can fund it."}
      </p>
      {persist && addr && (
        <p className="mono mb-4 break-all rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-mezo-gold/90">
          {addr}
        </p>
      )}
      <ol className="ml-4 list-decimal space-y-2 text-sm text-white/65">
        <li>
          Kirim ke alamat agent di atas — <span className="text-mezo-amber">HANYA Mezo TESTNET</span> (chain 31611):{" "}
          <span className="mono text-white/80">±1 MUSD</span> (kontrak{" "}
          <span className="mono">0x1189…c503</span>) +{" "}
          <span className="mono text-white/80">~0.001 BTC gas</span>
        </li>
        <li>
          Sumber dana: BTC gas di{" "}
          <a href="https://faucet.test.mezo.org" target="_blank" rel="noreferrer" className="mono text-mezo-gold hover:underline">
            faucet.test.mezo.org
          </a>{" "}
          · pinjam MUSD dengan BTC di{" "}
          <a href="https://app.mezo.org" target="_blank" rel="noreferrer" className="mono text-mezo-gold hover:underline">
            app.mezo.org
          </a>{" "}
          (atau minta di Discord Mezo #faucet)
        </li>
        <li>
          Setelah keduanya sampai, klik <span className="text-white/85">Approve Permit2</span> di kartu wallet — chip berubah hijau{" "}
          <span className="mono text-mezo-mint">ready to pay</span>
        </li>
      </ol>
    </div>
  );
}
