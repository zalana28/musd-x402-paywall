/**
 * Injected-wallet (EIP-1193) helpers for the playground.
 * Works with MetaMask, Brave, OKX and any browser extension exposing
 * window.ethereum. BTC wallets (Xverse/Unisat) land via Mezo Passport later.
 */

export const MEZO_TESTNET = {
  chainId: "0x7b7b", // 31611
  chainName: "Mezo Testnet",
  nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 },
  rpcUrls: ["https://rpc.test.mezo.org"],
  blockExplorerUrls: ["https://explorer.test.mezo.org"],
};

export function getInjected() {
  if (typeof window === "undefined") return null;
  return window.ethereum || null;
}

export async function connectWallet() {
  const eth = getInjected();
  if (!eth) throw new Error("NO_WALLET");
  const accounts = await eth.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("NO_ACCOUNTS");
  await ensureMezoChain(eth);
  return { address: accounts[0] };
}

export async function ensureMezoChain(eth = getInjected()) {
  if (!eth) throw new Error("NO_WALLET");
  const current = await eth.request({ method: "eth_chainId" });
  if (current?.toLowerCase() === MEZO_TESTNET.chainId) return;
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MEZO_TESTNET.chainId }],
    });
  } catch (e) {
    if (e?.code === 4902 || /Unrecognized chain/i.test(String(e?.message))) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [MEZO_TESTNET],
      });
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: MEZO_TESTNET.chainId }],
      });
    } else {
      throw e;
    }
  }
}

export async function walletSignTypedData(address, typedData) {
  const eth = getInjected();
  if (!eth) throw new Error("NO_WALLET");
  return eth.request({
    method: "eth_signTypedData_v4",
    params: [address.toLowerCase(), JSON.stringify(typedData)],
  });
}

/** Sends one ERC20 approve(asset → Permit2, max) from the connected wallet. */
export async function walletApprovePermit2(assetAddress) {
  const eth = getInjected();
  if (!eth) throw new Error("NO_WALLET");
  const [from] = await eth.request({ method: "eth_accounts" });
  // approve(address,uint256) selector 0x095ea7b3 + spender + max amount
  const data =
    "0x095ea7b3" +
    "000000000000000000000000000000000022d473030f116ddee9f6b43ac78ba3".slice(
      -40
    ) +
    "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  return eth.request({
    method: "eth_sendTransaction",
    params: [{ from, to: assetAddress, data }],
  });
}
