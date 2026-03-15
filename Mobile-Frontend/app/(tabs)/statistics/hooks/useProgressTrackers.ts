import { useState, useEffect, useCallback } from 'react';
import { progressTrackerAPI, ProgressTrackers } from '@/app/utils/authAPI';

export function useProgressTrackers() {
  const [data, setData] = useState<ProgressTrackers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await progressTrackerAPI.get();
      setData(result);
    } catch {
      setError('無法載入進度資料');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
