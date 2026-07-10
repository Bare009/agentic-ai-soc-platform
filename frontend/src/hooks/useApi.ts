import { useCallback, useEffect, useRef, useState } from "react";

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetch-on-mount hook with optional polling. `deps` re-runs the fetch when they
 * change (e.g. the selected time window or filters). `pollMs` refreshes in the
 * background without a loading flicker.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  pollMs?: number
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async (initial: boolean) => {
    if (initial) setLoading(true);
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Request failed");
    } finally {
      if (initial) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    run(true);
    if (!pollMs) return;
    const id = setInterval(() => run(false), pollMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refresh = useCallback(() => run(false), [run]);

  return { data, loading, error, refresh };
}
