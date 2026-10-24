import { createPublicClient, http, parseAbiItem } from "viem";

const RPC = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.test.mezo.org";
const SELLER =
  process.env.NEXT_PUBLIC_SELLER_ADDRESS ||
  "0x2d31C9d84812E009A362C8caE6F3F3e17E5C78b9";
// Settlement assets on Mezo testnet: MUSD + the native-BTC ERC20 mirror.
const ASSETS = [
  {
    symbol: "MUSD",
    address:
      process.env.NEXT_PUBLIC_MUSD_ADDRESS ||
      "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
  },
  {
    symbol: "BTC",
    address:
      process.env.NEXT_PUBLIC_BTC_ERC20_ADDRESS ||
      "0x7b7C000000000000000000000000000000000000",
  },
];

// Mezo testnet RPC caps eth_getLogs ranges at 10,000 blocks.
const CHUNK = 9_500;
const TOTAL_RANGE = 190_000;
const PARALLEL = 4;
const CACHE_TTL = 10_000;

let cache = { at: 0, data: null };

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

async function scanAsset(client, asset) {
  const latest = await client.getBlockNumber();
  const start =
    latest > BigInt(TOTAL_RANGE) ? latest - BigInt(TOTAL_RANGE) : 0n;

  const ranges = [];
  for (let from = start; from <= latest; from += BigInt(CHUNK)) {
    const to = from + BigInt(CHUNK) > latest ? latest : from + BigInt(CHUNK);
    ranges.push([from, to]);
  }

  const transfers = [];
  for (let i = 0; i < ranges.length; i += PARALLEL) {
    const batch = ranges.slice(i, i + PARALLEL);
    const results = await Promise.allSettled(
      batch.map(([from, to]) =>
        client.getLogs({
          address: asset.address,
          event: transferEvent,
          args: { to: SELLER },
          fromBlock: from,
          toBlock: to,
        })
      )
    );
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const l of r.value) {
        transfers.push({
          txHash: l.transactionHash,
          block: Number(l.blockNumber),
          from: l.args.from,
          to: l.args.to,
          amount: l.args.value?.toString(),
          usd: l.args.value ? Number(l.args.value) / 1e18 : 0,
          asset: asset.symbol,
        });
      }
    }
  }
  return transfers;
}

export default async function handler(_req, res) {
  if (cache.data && Date.now() - cache.at < CACHE_TTL) {
    return res.json({ ...cache.data, cached: true });
  }
  try {
    const client = createPublicClient({ transport: http(RPC) });
    const settled = await Promise.allSettled(
      ASSETS.map((a) => scanAsset(client, a))
    );
    const transfers = settled
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .sort((a, b) => b.block - a.block);

    const totals = { MUSD: 0, BTC: 0 };
    for (const t of transfers) totals[t.asset] = (totals[t.asset] || 0) + t.usd;

    const payload = {
      transfers,
      total: transfers.length,
      totals,
      scannedFrom: Number(
        (await client.getBlockNumber()) - BigInt(TOTAL_RANGE) > 0n
          ? (await client.getBlockNumber()) - BigInt(TOTAL_RANGE)
          : 0n
      ),
    };
    cache = { at: Date.now(), data: payload };
    return res.json({ ...payload, cached: false });
  } catch (e) {
    return res
      .status(500)
      .json({ error: String(e?.message || e), transfers: [], totals: { MUSD: 0, BTC: 0 }, total: 0 });
  }
}
