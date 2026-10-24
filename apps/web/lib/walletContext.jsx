import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { connectWallet, getInjected } from "./wallet.js";

const Ctx = createContext(null);

/**
 * Shared injected-wallet state for the navbar button and the playground.
 * Reconnects silently on load if the wallet was previously authorized.
 */
export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const eth = getInjected();
    if (!eth) return;
    eth
      .request({ method: "eth_accounts" })
      .then((accs) => {
        if (accs?.length) setAddress(accs[0]);
      })
      .catch(() => {});
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const w = await connectWallet();
      setAddress(w.address);
      return w;
    } catch (e) {
      const m = String(e?.message || e);
      setError(
        m === "NO_WALLET"
          ? "No injected wallet detected — install MetaMask or use Brave, then reload."
          : m
      );
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setError(null);
  }, []);

  return (
    <Ctx.Provider value={{ address, connecting, error, connect, disconnect }}>
      {children}
    </Ctx.Provider>
  );
}

export const useWallet = () => useContext(Ctx);
