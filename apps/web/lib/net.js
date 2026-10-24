export const NET = {
  api: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4021",
  rpc: process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.test.mezo.org",
  musd:
    process.env.NEXT_PUBLIC_MUSD_ADDRESS ||
    "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
  seller:
    process.env.NEXT_PUBLIC_SELLER_ADDRESS ||
    "0x2d31C9d84812E009A362C8caE6F3F3e17E5C78b9",
  network: process.env.NEXT_PUBLIC_NETWORK || "eip155:31611",
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31611),
  explorer: process.env.NEXT_PUBLIC_EXPLORER || "https://explorer.test.mezo.org",
  facilitator:
    process.env.NEXT_PUBLIC_FACILITATOR || "https://facilitator.vativ.io",
};

export const short = (str = "", maxLen = 24) => {
  if (!str) return str;
  if (str.startsWith("0x") && str.length > 12) {
    return `${str.slice(0, 6)}…${str.slice(-4)}`;
  }
  return str.length > maxLen ? `${str.slice(0, maxLen - 1)}…` : str;
};

export const fmtMUSD = (wei) => {
  try {
    const v = BigInt(wei) / 10n ** 15n; // milli-MUSD
    return `${Number(v) / 1000} MUSD`;
  } catch {
    return wei;
  }
};

export const fmtUsd = (wei) => {
  try {
    return `$${Number(BigInt(wei)) / 10 ** 18}`;
  } catch {
    return wei;
  }
};

export const fmtTime = (ts) =>
  new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
