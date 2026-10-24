import { createWalletClient, defineChain, http, encodeFunctionData, parseAbiItem } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.test.mezo.org";
const MUSD =
  process.env.NEXT_PUBLIC_MUSD_ADDRESS ||
  "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";
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
    const data = encodeFunctionData({
      abi: [approveAbi],
      functionName: "approve",
      args: [PERMIT2, 2n ** 256n - 1n], // max allowance
    });
    const txHash = await client.sendTransaction({
      to: MUSD,
      data,
      chain: mezoTestnet,
      account,
    });
    return res.json({
      ok: true,
      txHash,
      explorer: `${EXPLORER}/tx/${txHash}`,
      approved: MUSD,
      spender: PERMIT2,
      agent: account.address,
      note: "MUSD → Permit2 max approval sent. Wait for the tx to mine, then refresh the balance chip.",
    });
  } catch (e) {
    const msg = String(e?.message || e);
    const friendly = /insufficient funds|exceeds the balance/i.test(msg)
      ? "Agent wallet has no BTC for gas. Send a little testnet BTC to the agent address first (~0.001 is enough)."
      : msg;
    return res.status(200).json({ ok: false, error: friendly });
  }
}
