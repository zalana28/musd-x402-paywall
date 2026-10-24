import { createPublicClient, http, parseAbiItem } from "viem";

const RPC = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.test.mezo.org";
const MUSD =
  process.env.NEXT_PUBLIC_MUSD_ADDRESS ||
  "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";
const MEZO_ENV = process.env.NEXT_PUBLIC_MEZO_ADDRESS || null;
// Canonical Permit2 deployment and the Mezo x402 settlement proxy (spender).
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const SETTLEMENT_PROXY =
  process.env.NEXT_PUBLIC_SETTLEMENT_PROXY ||
  "0x402085c248EeA27D92E8b30b2C58ed07f9E20001";

const erc20BalanceOf = parseAbiItem(
  "function balanceOf(address) view returns (uint256)"
);
const permit2Allowance = parseAbiItem(
  "function allowance(address,address,address) view returns (uint160 expiration, uint48 nonce)"
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { address } = req.body || {};
  if (!/^0x[0-9a-fA-F]{40}$/.test(address || "")) {
    return res.status(400).json({ error: "invalid address" });
  }
  try {
    const client = createPublicClient({ transport: http(RPC) });
    const reads = [
      client.readContract({
        address: MUSD,
        abi: [erc20BalanceOf],
        functionName: "balanceOf",
        args: [address],
      }),
      client
        .readContract({
          address: PERMIT2,
          abi: [permit2Allowance],
          functionName: "allowance",
          args: [address, MUSD, SETTLEMENT_PROXY],
        })
        .catch(() => null),
    ];
    if (MEZO_ENV) {
      reads.push(
        client
          .readContract({
            address: MEZO_ENV,
            abi: [erc20BalanceOf],
            functionName: "balanceOf",
            args: [address],
          })
          .catch(() => 0n)
      );
    }
    const [balance, allowance, mezoBalRaw] = await Promise.all(reads);
    const bal = Number(balance) / 1e18;
    // Permit2 returns a packed uint160 amount (0 = none)
    const allow = allowance ? Number(allowance[0]) / 1e18 : 0;
    const mezoBal = mezoBalRaw != null ? Number(mezoBalRaw) / 1e18 : null;
    return res.json({
      address,
      musdBalance: bal,
      permit2Allowance: allow,
      ready: bal > 0 && allow > 0,
      mezoBalance: mezoBal,
      mezoHolder: mezoBal != null ? Number(mezoBalRaw) > 0n : null,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
