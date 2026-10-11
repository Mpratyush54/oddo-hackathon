import { useCallback, useEffect, useRef, useState } from 'react';
import { backendRequest, cloudMode } from '../api/client';
import { paginateLocal } from '../utils/paginate';

export type ServerTablePage<T> = {
  rows: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

const DEFAULT_LIMIT = 5;

/** Backend-paginated table when cloud; same pager contract for local demo data. */
export function useServerTable<T>({
  clubId,
  table,
  localRows,
  limit = DEFAULT_LIMIT,
  query = '',
  status = '',
  category = '',
  action = '',
  entity = '',
  enabled = true,
}: {
  clubId: string;
  table: string;
  localRows: T[];
  limit?: number;
  query?: string;
  status?: string;
  category?: string;
  action?: string;
  entity?: string;
  enabled?: boolean;
}) {
  const localRef = useRef(localRows);
  localRef.current = localRows;
  const [page, setPageState] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ServerTablePage<T>>({
    rows: [],
    page: 1,
    limit,
    total: 0,
    pages: 1,
  });

  const load = useCallback(
    async (nextPage = 1) => {
      if (!enabled) return;
      setLoading(true);
      setError('');
      try {
        if (!cloudMode) {
          const local = paginateLocal(localRef.current, nextPage, limit);
          setResult(local);
          setPageState(local.page);
          return;
        }
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: String(limit),
        });
        if (query.trim()) params.set('q', query.trim());
        if (status && status !== 'All') params.set('status', status);
        if (category && category !== 'All') params.set('category', category);
        if (action && action !== 'All') params.set('action', action);
        if (entity && entity !== 'All') params.set('entity', entity);
        let data = await backendRequest<ServerTablePage<T>>(
          `/clubs/${encodeURIComponent(clubId)}/tables/${encodeURIComponent(table)}?${params}`,
        );
        if (!data.rows.length && data.page > 1) {
          params.set('page', String(data.page - 1));
          data = await backendRequest<ServerTablePage<T>>(
            `/clubs/${encodeURIComponent(clubId)}/tables/${encodeURIComponent(table)}?${params}`,
          );
        }
        setResult(data);
        setPageState(data.page);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load this table.');
      } finally {
        setLoading(false);
      }
    },
    [clubId, table, limit, query, status, category, action, entity, enabled],
  );

  useEffect(() => {
    void load(1);
  }, [load, localRows.length]);

  return {
    rows: result.rows,
    page: result.page || page,
    pages: result.pages,
    total: result.total,
    limit: result.limit || limit,
    loading,
    error,
    setPage: (next: number) => void load(next),
    reload: () => void load(page),
  };
}
