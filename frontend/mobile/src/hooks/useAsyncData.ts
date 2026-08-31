import { useCallback, useEffect, useState } from 'react';

export function useAsyncData<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stableLoader] = useState(() => loader);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await stableLoader();
      setData(result);
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong.');
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stableLoader]);

  useEffect(() => {
    let active = true;
    void stableLoader()
      .then(result => {
        if (active) setData(result);
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Something went wrong.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [stableLoader]);

  return {
    data,
    setData,
    loading,
    refreshing,
    error,
    reload: () => load(true),
  };
}
