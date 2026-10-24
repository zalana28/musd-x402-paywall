import { createWalletClient, defineChain, http, encodeFunctionData, parseAbiItem } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.test.mezo.org";
const MUSD =
  process.env.NEXT_PUBLIC_MUSD_ADDRESS ||
  "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";
const BTC_ERC20 =
  process.env.NEXT_PUBLIC_BTC_ERC20_ADDRESS ||
  "0x7b7C000000000000000000000000000000000000";
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const EXPLORER =
  process.env.NEXT_PUBLIC_EXPLORER || "https://explorer.test.mezo.org";

const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  network: "mezo-testnet",
  nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: EXPLORER } },
});

const approveAbi = parseAbiItem(
  "function approve(address spender, uint256 amount)"
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { agentPrivateKey } = req.body || {};
  if (!/^0x[0-9a-fA-F]{64}$/.test(agentPrivateKey || "")) {
    return res.status(400).json({ error: "invalid agentPrivateKey" });
  }
  try {
    const account = privateKeyToAccount(agentPrivateKey);
    const client = createWalletClient({
      account,
      chain: mezoTestnet,
      transport: http(RPC),
    });

    // Approve Permit2 for both settlement assets in one click.
    const approvals = [];
    for (const [symbol, asset] of [
      ["MUSD", MUSD],
      ["BTC", BTC_ERC20],
    ]) {
      const data = encodeFunctionData({
        abi: [approveAbi],
        functionName: "approve",
        args: [PERMIT2, 2n ** 256n - 1n],
      });
      try {
        const txHash = await client.sendTransaction({
          to: asset,
          data,
          chain: mezoTestnet,
          account,
        });
        approvals.push({ asset: symbol, address: asset, txHash });
      } catch (e) {
        const msg = String(e?.message || e);
        // one asset failing (e.g. no gas yet) shouldn't block the other
        approvals.push({
          asset: symbol,
          address: asset,
          error: /insufficient funds|exceeds the balance/i.test(msg)
            ? "no BTC for gas — fund the agent wallet first (~0.001 native BTC)"
            : msg.slice(0, 160),
        });
      }
    }

    const ok = approvals.some((a) => a.txHash);
    return res.status(200).json({
      ok,
      approvals,
      agent: account.address,
      note: ok
        ? "Approvals sent. Wait for the tx(s) to mine, then the balance chip updates."
        : "No approval could be sent — see per-asset errors.",
    });
  } catch (e) {
    return res
      .status(200)
      .json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
}
