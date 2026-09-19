import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Runs an async fetcher and tracks loading/error, re-running when `deps` change
 * or when `refresh()` is called. Responses that arrive out of order are dropped
 * so fast typing in a filter box cannot show stale rows.
 */
export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  options: { keepPrevious?: boolean } = {}
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const keepPrevious = options.keepPrevious ?? false;

  useEffect(() => {
    const id = ++requestId.current;
    let cancelled = false;

    if (!keepPrevious) setLoading(true);
    setError(null);

    fetcherRef
      .current()
      .then((result) => {
        if (cancelled || id !== requestId.current) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled || id !== requestId.current) return;
        setError(err instanceof Error ? err.message : "Request failed");
      })
      .finally(() => {
        if (cancelled || id !== requestId.current) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [...deps, nonce, keepPrevious]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, refresh };
}
