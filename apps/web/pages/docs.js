import { NET, short } from "../lib/net";

function Code({ children }) {
  return <pre className="payload my-3 !max-h-none">{children}</pre>;
}

export default function Docs() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-10 pt-12">
      <p className="label">integration</p>
      <h1 className="mb-2 font-display text-4xl font-bold text-white">
        Ship a metered API in <span className="grad-text">5 minutes</span>
      </h1>
      <p className="mb-10 text-[15px] leading-relaxed text-white/55">
        Everything on this site is standard <span className="mono text-mezo-gold/90">@x402</span>{" "}
        SDK v2 wired to Mezo. Copy any of it.
      </p>

      {/* 1. seller */}
      <section className="glass mb-6 p-6">
        <h2 className="mb-1 font-display text-xl font-semibold text-white">
          1 · Protect your endpoints
        </h2>
        <p className="mb-3 text-sm text-white/55">
          One middleware. Prices are plain USD strings — the SDK resolves them
          to MUSD on Mezo automatically. Optionally count real settlements with
          the <span className="mono">onAfterSettle</span> hook.
        </p>
        <Code>{`import { paymentMiddlewareFromHTTPServer } from "@x402/express";
import { HTTPFacilitatorClient, x402ResourceServer, x402HTTPResourceServer }
  from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const resourceServer = new x402ResourceServer(
  new HTTPFacilitatorClient({ url: "https://facilitator.vativ.io" })
);
resourceServer.register("eip155:31611", new ExactEvmScheme());

resourceServer.onAfterSettle(async (ctx) => {
  console.log("settled:", ctx.result.transaction, "payer:", ctx.result.payer);
});

app.use(paymentMiddlewareFromHTTPServer(
  new x402HTTPResourceServer(resourceServer, {
    "GET /v1/haiku": {
      accepts: {
        scheme: "exact",
        network: "eip155:31611",   // Mezo testnet
        price: "$0.001",
        payTo: SELLER_ADDRESS,
      },
      description: "Generate a haiku",
      unpaidResponseBody: () => ({
        contentType: "application/json",
        body: { error: "payment_required", howToPay: "GET /v1/tools" },
      }),
    },
  }),
  { appName: "MUSD x402 Paywall", testnet: true }
));`}</Code>
      </section>

      {/* 2. agent */}
      <section className="glass mb-6 p-6">
        <h2 className="mb-1 font-display text-xl font-semibold text-white">
          2 · Call it from an agent
        </h2>
        <p className="mb-3 text-sm text-white/55">
          The client signs EIP-712 (permit2) and retries automatically. No gas,
          no API keys, no accounts.
        </p>
        <Code>{`import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(AGENT_KEY);
const client = new x402Client();
registerExactEvmScheme(client, {
  signer: account,
  schemeOptions: { rpcUrl: "https://rpc.test.mezo.org" },
});

const fetchWithPay = wrapFetchWithPayment(fetch, client);
const res = await fetchWithPay("https://your-api/v1/haiku?topic=mezo");
// 402 → sign → retry → 200 with content. Two lines of business logic.`}</Code>
      </section>

      {/* 3. discovery */}
      <section className="glass mb-6 p-6">
        <h2 className="mb-1 font-display text-xl font-semibold text-white">
          3 · Let agents discover your tools
        </h2>
        <p className="mb-3 text-sm text-white/55">
          <span className="mono text-mezo-gold">GET /v1/tools</span> is a free,
          machine-readable catalog of every paid endpoint — so agents can find
          prices, asset, and facilitator without any docs. Try it on this very
          API (it&apos;s live):
        </p>
        <Code>{`$ curl http://localhost:4021/v1/tools | jq

{
  "name": "musd-x402-paywall",
  "x402Version": 2,
  "network": "eip155:31611",
  "asset": { "symbol": "MUSD", "address": "0x1189…c503", "decimals": 18 },
  "facilitator": "https://facilitator.vativ.io",
  "tools": [
    { "id": "haiku", "method": "GET",  "path": "/v1/haiku",     "price": "$0.001", … },
    { "id": "sentiment", "method": "POST", "path": "/v1/sentiment", "price": "$0.003", … }
  ]
}`}</Code>
      </section>

      {/* 4. funding */}
      <section className="glass mb-6 p-6">
        <h2 className="mb-1 font-display text-xl font-semibold text-white">
          4 · Fund an agent for on-chain settlement
        </h2>
        <p className="mb-3 text-sm text-white/55">
          Verification (signature + balance + allowance checks) works against
          the live facilitator out of the box. Full on-chain settlement needs
          the agent wallet to hold MUSD and a one-time Permit2 approval:
        </p>
        <Code>{`# one-time Permit2 approval tx, sent from the agent wallet
import { createPermit2ApprovalTx } from "@x402/evm/exact/client";

const tx = createPermit2ApprovalTx("${NET.musd}"); // MUSD — single arg
await walletClient.sendTransaction({
  account: agentAccount,
  to: tx.to,
  data: tx.data,
});
// after it mines, every x402 payment settles fully on-chain`}</Code>
        <p className="mt-2 text-sm text-white/50">
          Testnet BTC gas:{" "}
          <a href="https://faucet.test.mezo.org" target="_blank" rel="noreferrer" className="mono text-mezo-gold hover:underline">
            faucet.test.mezo.org
          </a>{" "}
          · MUSD: borrow at{" "}
          <a href="https://app.mezo.org" target="_blank" rel="noreferrer" className="mono text-mezo-gold hover:underline">
            app.mezo.org
          </a>
        </p>
        <p className="mt-2 text-sm text-white/50">
          Tip: in the{" "}
          <a href="/playground" className="text-mezo-gold hover:underline">
            playground
          </a>{" "}
          you can switch the agent wallet to <em>persistent</em> mode — it is
          generated and stored in your browser only, the key is used for a run
          and never saved server-side. Fund it once, approve Permit2 once, and
          every run settles with a real tx hash.
        </p>
      </section>

      {/* 5. mcp */}
      <section className="glass mb-6 p-6">
        <h2 className="mb-1 font-display text-xl font-semibold text-white">
          5 · Paid MCP tools
        </h2>
        <p className="mb-3 text-sm text-white/55">
          The whole catalog is also exposed as an MCP server at{" "}
          <span className="mono text-mezo-gold">POST /mcp</span> (JSON-RPC 2.0).{" "}
          <span className="mono">tools/call</span> proxies to the paywalled endpoints and passes
          the x402 <span className="mono">PAYMENT-SIGNATURE</span> through — agents pay per tool call.
        </p>
        <Code>{`$ curl -X POST http://localhost:4021/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# unpaid tool call → machine-readable price
$ curl -X POST http://localhost:4021/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call",
       "params":{"name":"haiku","arguments":{"topic":"mezo"}}}'
→ error -32001 "payment required" { price: "$0.001", asset, network, facilitator }

# retry the same call with header: PAYMENT-SIGNATURE: <base64 payload> → content`}</Code>
      </section>

      {/* 6. receipts */}
      <section className="glass mb-6 p-6">
        <h2 className="mb-1 font-display text-xl font-semibold text-white">
          6 · Receipts
        </h2>
        <p className="mb-3 text-sm text-white/55">
          Every settlement gets a receipt from the{" "}
          <span className="mono">onAfterSettle</span> hook:
        </p>
        <Code>{`$ curl http://localhost:4021/v1/receipt/<txHash>

{ "txHash": "0x99da…", "payer": "0x490F…", "amountWei": "1000000000000000",
  "endpoint": "/v1/haiku?…", "at": "2026-10-24T…" }`}</Code>
      </section>

      {/* 7. wallet connect */}
      <section className="glass mb-6 p-6">
        <h2 className="mb-1 font-display text-xl font-semibold text-white">
          7 · Connect Wallet (injected)
        </h2>
        <p className="mb-3 text-sm text-white/55">
          The navbar button connects MetaMask/Brave/OKX (EIP-1193), auto-adds the Mezo
          Testnet network, and every payment becomes an EIP-712 popup signed in the
          user's own wallet — the key never touches the server. Two-phase flow:{" "}
          <span className="mono">/api/agent/prepare</span> → wallet signs →{" "}
          <span className="mono">/api/agent/submit</span>. BTC wallets (Xverse/Unisat)
          arrive via Mezo Passport (roadmap).
        </p>
      </section>

      {/* addresses */}
      <section className="glass p-6">
        <h2 className="mb-3 font-display text-xl font-semibold text-white">
          Network reference
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Network", "eip155:31611 (Mezo Testnet)"],
            ["RPC", NET.rpc],
            ["MUSD", short(NET.musd)],
            ["Facilitator", NET.facilitator],
            ["Seller (payTo)", short(NET.seller)],
            ["Explorer", NET.explorer],
          ].map(([k, v]) => (
            <div key={k} className="glass-soft px-4 py-3">
              <p className="label mb-0.5">{k}</p>
              <p className="mono break-all text-[12.5px] text-white/80">{v}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-white/40">
          Docs:{" "}
          <a href="https://mezo.org/docs/developers/getting-started" target="_blank" rel="noreferrer" className="text-mezo-gold hover:underline">
            mezo.org/docs/developers
          </a>{" "}
          ·{" "}
          <a href="https://mezo.org/docs/developers/getting-started/musd-payments-x402" target="_blank" rel="noreferrer" className="text-mezo-gold hover:underline">
            MUSD × x402 overview
          </a>
        </p>
      </section>
    </div>
  );
}
