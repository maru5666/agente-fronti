'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiError } from '@/services/api';

export function useResource<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError('');

    try {
      const nextData = await loader();
      if (mountedRef.current && requestIdRef.current === requestId) {
        setData(nextData);
      }
    } catch (err) {
      if (mountedRef.current && requestIdRef.current === requestId) {
        setError(getApiError(err));
      }
    } finally {
      if (mountedRef.current && requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    load();

    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  return { data, loading, error, reload: load };
}
