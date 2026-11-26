import { useFocusEffect } from 'expo-router';
import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';

import { keepUnchanged } from '../../../shared/keepUnchanged';
import { GENERIC_ERROR_MESSAGE } from '@/lib/errors';
import { loadPage, readPage, writePage } from '@/lib/pageCache';

export function useAsyncData<T>(loader: () => Promise<T>, cacheKey?: string) {
  const cached = cacheKey ? readPage<T>(cacheKey) : undefined;
  const [data, updateData] = useState<T | null>(() => cached ? cached.value : null);
  const dataRef = useRef<T | null>(cached ? cached.value : null);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  useEffect(() => { loaderRef.current = loader; }, [loader]);
  const requestVersion = useRef(0);
  const [dataKey, setDataKey] = useState(cacheKey);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; requestVersion.current += 1; };
  }, []);

  const setData: Dispatch<SetStateAction<T | null>> = useCallback(next => {
    requestVersion.current += 1;
    setLoading(false);
    setRefreshing(false);
    const value = typeof next === 'function' ? (next as (value: T | null) => T | null)(dataRef.current) : next;
    dataRef.current = value;
    if (cacheKey && value !== null) writePage(cacheKey, value);
    updateData(value);
  }, [cacheKey]);

  const load = useCallback(async (refresh = false) => {
    const version = ++requestVersion.current;
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      const result = cacheKey
        ? await loadPage(cacheKey, () => loaderRef.current(), refresh)
        : await loaderRef.current();
      if (mounted.current && version === requestVersion.current) {
        const value = keepUnchanged(dataRef.current, result);
        dataRef.current = value;
        updateData(value);
      }
      return result;
    } catch (cause) {
      console.error('Could not load data:', cause);
      if (mounted.current && version === requestVersion.current) setError(GENERIC_ERROR_MESSAGE);
      return null;
    } finally {
      if (mounted.current && version === requestVersion.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [cacheKey]);

  useFocusEffect(useCallback(() => {
    requestVersion.current += 1;
    if (dataKey !== cacheKey) {
      setDataKey(cacheKey);
      dataRef.current = null;
      updateData(null);
      setLoading(true);
    }
    const snapshot = cacheKey ? readPage<T>(cacheKey) : undefined;
    if (snapshot) {
      dataRef.current = snapshot.value;
      updateData(snapshot.value);
      setLoading(false);
    } else {
      // Keep already visible content during revalidation after a write or expiry.
      void load();
    }
    return () => { requestVersion.current += 1; };
  }, [cacheKey, dataKey, load]));

  return {
    data: dataKey === cacheKey ? data : cached?.value ?? null,
    setData,
    loading: dataKey === cacheKey ? loading : !cached,
    refreshing,
    error,
    reload: useCallback(() => load(true), [load]),
  };
}
