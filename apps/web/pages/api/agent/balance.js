import { createPublicClient, http, parseAbiItem } from "viem";

const RPC = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.test.mezo.org";
const MUSD =
  process.env.NEXT_PUBLIC_MUSD_ADDRESS ||
  "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";
const BTC_ERC20 =
  process.env.NEXT_PUBLIC_BTC_ERC20_ADDRESS ||
  "0x7b7C000000000000000000000000000000000000";
const MEZO_ENV = process.env.NEXT_PUBLIC_MEZO_ADDRESS || null;
// Canonical Permit2 deployment and the Mezo x402 settlement proxy (spender).
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const SETTLEMENT_PROXY =
  process.env.NEXT_PUBLIC_SETTLEMENT_PROXY ||
  "0x402085c248EeA27D92E8b30b2C58ed07f9E20001";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { address } = req.body || {};
  if (!/^0x[0-9a-fA-F]{40}$/.test(address || "")) {
    return res.status(400).json({ error: "invalid address" });
  }
  try {
    const client = createPublicClient({ transport: http(RPC) });
    const erc20BalanceOf = parseAbiItem(
      "function balanceOf(address) view returns (uint256)"
    );
    const erc20AllowanceAbi = parseAbiItem(
      "function allowance(address,address) view returns (uint256)"
    );
    const reads = [
      client.readContract({
        address: MUSD,
        abi: [erc20BalanceOf],
        functionName: "balanceOf",
        args: [address],
      }),
      client
        .readContract({
          address: MUSD,
          abi: [erc20AllowanceAbi],
          functionName: "allowance",
          args: [address, PERMIT2],
        })
        .catch(() => null),
      client.readContract({
        address: BTC_ERC20,
        abi: [erc20BalanceOf],
        functionName: "balanceOf",
        args: [address],
      }),
      client
        .readContract({
          address: BTC_ERC20,
          abi: [erc20AllowanceAbi],
          functionName: "allowance",
          args: [address, PERMIT2],
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
    const [musdBal, musdAllow, btcBal, btcAllow, mezoBalRaw] =
      await Promise.all(reads);

    const musdBalance = Number(musdBal) / 1e18;
    const permit2Allowance = musdAllow ? Number(musdAllow) / 1e18 : 0;
    const btcBalance = Number(btcBal) / 1e18;
    const btcPermit2 = btcAllow ? Number(btcAllow) / 1e18 : 0;
    const musdPath = musdBalance > 0 && permit2Allowance > 0;
    const btcPath = btcBalance > 0 && btcPermit2 > 0;
    const mezoBalance = mezoBalRaw != null ? Number(mezoBalRaw) / 1e18 : null;

    return res.json({
      address,
      musdBalance,
      permit2Allowance,
      btcBalance,
      btcPermit2,
      ready: musdPath || btcPath,
      readyAsset: musdPath ? "musd" : btcPath ? "btc" : null,
      mezoBalance,
      mezoHolder: mezoBalance != null ? mezoBalance > 0 : null,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
