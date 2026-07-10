import { useEffect, useRef, useState } from "react";
import type { LiveStats } from "../api/types";

/**
 * Subscribes to the API's live WebSocket for the footer status bar. Auto-
 * reconnects with a short backoff. `connected` reflects the socket state.
 */
export function useLiveStats(): { stats: LiveStats | null; connected: boolean } {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [connected, setConnected] = useState(false);
  const retryRef = useRef<number | null>(null);

  useEffect(() => {
    let closed = false;
    let ws: WebSocket | null = null;

    const url = () => {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      return `${proto}://${window.location.host}/api/v1/ws/live`;
    };

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(url());

      ws.onopen = () => setConnected(true);
      ws.onmessage = (ev) => {
        try {
          setStats(JSON.parse(ev.data));
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retryRef.current = window.setTimeout(connect, 4000);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      closed = true;
      if (retryRef.current) window.clearTimeout(retryRef.current);
      ws?.close();
    };
  }, []);

  return { stats, connected };
}
