import { useCallback, useEffect, useState } from 'react';

export default function useApiResource(loader, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loader();
      setData(result);
      return result;
    } catch (requestError) {
      setError(requestError.message || 'Data tidak dapat dimuat.');
      return null;
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}
