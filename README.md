# MUSD x402 Paywall

**AI agents pay your API per request — settled in MUSD on Mezo.**
*Stripe for AI agents, settled in Bitcoin's stablecoin.*
Built for the [Mezo Buildathon](https://mezo.org/blog/mezo-buildathon-is-underway/) — **MUSD + MEZO tracks.**

**Repo:** https://github.com/zalana28/musd-x402-paywall

```
                      ┌─────────────────────────────────────────────┐
                      │                Mezo Matsnet                 │
                      │  eip155:31611  ·  gas BTC ·  facilitator    │
                      │  https://facilitator.vativ.io                │
                      │  MUSD 0x1189…c503 · x402 exact/permit2     │
                      └──────────────────────┬──────────────────────┘
                                             │ verifies & settles
                                             ▼
  Agent ──① discovery GET /v1/tools─────────────────────────┐
         │ free, machine-readable catalog (prices, asset,   │
         │ facilitator, MEZO discount hint)                 │
         │                                                  │
         ──② GET /v1/haiku?topic=mezo──▶ Paywall (x402) ────┘
           ◀─③ 402 + PAYMENT-REQUIRED (0.001 MUSD)──
         ──④ EIP-712 permit2 signature──▶ onAfterSettle hook
           ◀─⑤ 200 + PAYMENT-RESPONSE (tx hash)    counts toward /stats
```

> **One-line pitch:** Stripe for AI agents — every API call is a micropayment settled in MUSD on Mezo, zero gas for buyers, one middleware line for sellers.

## Stack

| Layer | Tech |
|---|---|
| Paywall API | Express + `@x402/express` v2.28, `@x402/evm` (ExactEvmScheme), `HTTPFacilitatorClient` · `onAfterSettle` telemetry |
| Web | Next.js 14 + Tailwind, agent runner on `@x402/core/client` + `@x402/fetch` |
| Ledger | Chunked+parallel `eth_getLogs` on MUSD (indexer-less), 10s cache |
| Tracks | **MUSD** (settlement) + **MEZO** (holder discount check) — both buildathon tracks |
| Chain | Mezo Testnet `eip155:31611` · MUSD `0x1189…c503` · facilitator `vativ.io` |

## Run locally

```bash
npm install            # workspaces: apps/api + apps/web
npm run dev:api        # http://localhost:4021
npm run dev:web        # http://localhost:3000
# protocol smoke test
cd apps/api && node scripts/e2e-test.mjs
```

## One-command deploy (any Docker host: Fly, Railway, Render, VPS)

```bash
docker compose up --build
```

Set the public API URL for the web image:

```bash
NEXT_PUBLIC_API_URL=https://api.your-domain.com docker compose up --build
```

`.env` files are gitignored and **never copied into images** (see `.dockerignore`).

## Features

- **4 metered endpoints** — haiku `$0.001`, oracle `$0.002`, sentiment `$0.003`, summarize `$0.005`
- **MEZO track** — holder **eligibility check** via `/mezo/discount/:address`, advertised in `GET /v1/tools` and shown on the playground wallet card. Quotes are flat; applying the discount at settlement (partial-settlement override) is roadmap. Set `MEZO_ADDRESS` in `apps/api/.env` (and `NEXT_PUBLIC_MEZO_ADDRESS` in `apps/web/.env.local`) to make the on-chain check live.
- **Juri mode (sponsored demo)** — enable with `DEMO_SPONSOR=true` in `apps/api/.env`. `GET /demo/sponsored` returns a happy-path haiku with `sponsoredLabel` and **does not touch the on-chain ledger** — the playground toggle `sponsored: true` drives the visualizer into a 6-step sponsored flow with the correct endpoint-respecting handler.
- **Agent discovery** — `GET /v1/tools`: catalog of every paid tool (prices, asset, facilitator, MEZO hint)
- **Persistent agent wallets** — generated in the browser, stored in `localStorage`, key never saved server-side; live MUSD balance + Permit2 allowance chip + copy address
- **Live handshake visualizer** — progressive reveal + payload inspector + sponsored-friendly labels
- **Settlement telemetry** — counted by the real `onAfterSettle` hook (`GET /stats`)
- **Hardening** — per-IP rate limit (90/min, free paths exempt), CORS allowlist, clamps, timeouts

```
                     ┌─────────────────────────────┐
                     │  /v1/tools (free discovery) │
                     └──────────────┬──────────────┘
                                    ▼
  Agent ── 402 ─────────►  Paywall (x402 exact/permit2, gasless buyer, vativ.io)
        ◄── EIP-712 ──  ── onAfterSettle ──► /stats + ledger (eth_getLogs)
  Juri ── /demo/sponsored (no facilitator) ──► sponsored ribbon + no ledger write
```

## 90-second demo script (use it for the video)

```
0:00  (Landing)  "We built a Stripe for AI agents — every API call is a micropayment in MUSD on Mezo."
0:08  (Playground) toggle **Juri Mode ON**, press ▶ Run paying agent — flow animates to ✓ Sponsored fetch → ✓ Sponsor verify → ✓ Settle (sponsored)
0:30  Toggle Juri Mode OFF, press Run again — the real facilitator says permit2_insufficient_balance (this IS the live Mezo verification).
0:45  Flip the agent wallet to **persistent**, copy the address, fund it with faucet → MUSD → one Permit2 approval.
0:58  Run once more with the now-funded persistent wallet — ✓ settled on Mezo · tx 0x… — flip to Ledger tab: the transfer is there.
1:10  (Docs) "One middleware line. Four endpoints. Two buildathon tracks."
1:20  Outro: GitHub link + live URL.
```

Rehearse once with Juri Mode ON so the video never waits.

## Audit log

### v0.5 — audit 2026-10-24 (round 2)

1. **`.dockerignore` patterns were root-only** — Docker matches `.env`/`node_modules` without `**/` at context root only, so `apps/api/.env` (seller key) and `apps/web/.env.local` still leaked into images. All patterns now use `**/` prefixes; `.env.example` re-included.
2. **Duplicate MEZO badge** — the stale endpoint-panel badge (misleading copy) was removed; the correct badge lives only on the wallet card.
3. **MEZO discount copy overstated** — notes now say "discount-eligible; applying at settlement is roadmap" everywhere (`/v1/tools`, 402 body, `/mezo/discount`, README).
4. **Sentiment result block never rendered** — `ResultCard` checked `result.sentiment`, but the endpoint field is `score`; fixed and the redundant meta chip dropped.
5. **Dead code removed** — no-op `setTimeout` in the playground balance refresh; unused `erc20Abi` in the discount checker.
6. **Repo initialized** — `git init` + MIT `LICENSE` + initial commit, ready to push for submission.

### v0.4 — audit 2026-10-24 (round 1)

1. **Paid-request counter was dead** — stats middleware sat after the route handlers so Express never reached it. Replaced with the official `onAfterSettle` settle hook.
2. **Docs snippet was wrong** — `createPermit2ApprovalTx` takes a single `tokenAddress` argument.
3. **Ledger scan too narrow/slow** — sequential 95k scan → parallel chunked 190k scan + 10s cache; respects RPC 10k-block `eth_getLogs` cap.
4. **No abuse guards** — per-IP rate limit (free paths exempt), input clamps, request timeouts (10s unpaid, 25s sponsored/paid), CORS allowlist knob.
5. **Unpaid 402 body was `{}`** — now a helpful `payment_required` response with `GET /v1/tools` pointer.
6. **Demo key hygiene** — `.env*` gitignored; `.env.example` templates contain no secrets.
7. **MEZO discount story not wired** — eligibility check exposed via `/mezo/discount/:address`, `v1/tools` hints, and the wallet-card badge; quotes stay flat and no discount is applied at settlement (see v0.5 item 3).
8. **Juri/sponsored demo not endpoint-aware** — sponsored branch now respects the selected endpoint (haiku/answer vs demo haiku for summarize/sentiment).
9. **Sponsored result mis-labelled as paid** — visualizer labels and ResultCard now show **sponsored** ribbon/badge instead of "paid ✓" when `sponsored: true`.
10. **Copy & deploy hygiene** — missing `.dockerignore` → private key baked into images (added); API Dockerfile `COPY ... 2>/dev/null || true` shellism removed; `NEXT_PUBLIC_*` build-args made explicit in `apps/web/Dockerfile`; stray commit-note paragraphs removed from README.

Configure for production with `MEZO_ADDRESS` (and `NEXT_PUBLIC_MEZO_ADDRESS`) for the on-chain discount check; set `DEMO_SPONSOR=true` in `apps/api/.env` to expose the sponsored demo.

## Submission checklist (Wave 1)

- [ ] `apps/api/.env` on disk includes `SELLER_ADDRESS` and — for demo — `DEMO_SPONSOR=true` + `MEZO_ADDRESS`
- [ ] Register at [app.akindo.io/wave-hacks/OVOO0gdrVU8379D10](https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10) + join Discord
- [ ] Push to GitHub (public) — record the 90-second video **with Juri Mode ON**
- [ ] Submit on AKINDO before **Oct 26**

Wave 2: fund a persistent wallet for a fully on-chain video run + mainnet flag.
