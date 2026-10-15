import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "./api";

export function useResource<T>(path: string, version = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((v) => v + 1), []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    api<T>(path)
      .then((value) => {
        if (current) setData(value);
      })
      .catch((err) => {
        if (current) setError(errorMessage(err));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [path, version, attempt]);
  return { data, error, loading, retry };
}

export function useDebounce(value: string, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
