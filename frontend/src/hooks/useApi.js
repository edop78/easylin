import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

/**
 * Custom hook for API calls with loading/error state.
 */
export function useApi(endpoint, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { autoFetch = true, interval = 0 } = options;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.get(endpoint);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }

    if (autoFetch && interval > 0) {
      const timer = setInterval(fetchData, interval);
      return () => clearInterval(timer);
    }
  }, [autoFetch, interval, fetchData]);

  return { data, loading, error, refetch: fetchData };
}
