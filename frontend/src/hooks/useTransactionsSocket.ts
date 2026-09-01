import { useEffect, useState } from "react";
import { wsUrl, Tx } from "../api";

export function useTransactionsSocket() {
  const [live, setLive] = useState<Tx[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === "transaction") setLive((prev) => [msg.data, ...prev].slice(0, 50));
    };
    return () => ws.close();
  }, []);

  return { live, connected };
}
