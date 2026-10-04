import { useCallback, useEffect, useMemo, useState } from 'react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { hintBoardRefreshMs } from '@/lib/hints';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import { HintBoard, HintCell, HintCheck, RdPreview } from '@/types/HintCell';
import type { WriteFlags } from '@/types/Intel';

const RD_PREVIEW_DEBOUNCE_MS = 300;

/**
 * Debounce a fast-changing value by a fixed delay.
 * @param value The value to debounce
 * @param delayMs The debounce delay in milliseconds
 * @returns The debounced value
 */
const useDebouncedValue = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
};

export const useHintBoard = ({ live = false }: { live?: boolean } = {}) => {
  const authHeader = useAuthHeader() || '';
  // The hints page polls fast (claims by others must show up quickly); the sidebar mini grid slowly
  const { data, error, mutate } = useAuthSWR<HintBoard>('/hints/board', { refreshInterval: hintBoardRefreshMs(live) });
  const refresh = useCallback(() => mutate(), [mutate]);

  // Memoised: the functions keep their identity between polls, so a pane that only uses them need not re-render
  const actions = useMemo(() => {
    /**
     * Post an action for a cell and put the returned cell straight into the cache.
     * Throws the axios error on failure so callers can show the right message.
     */
    async function post(articleId: number, area: string, action: string, body?: unknown): Promise<HintCell> {
      const cell = (await fetcherWithMethod(`/hints/${articleId}/${area}/${action}`, authHeader, 'POST', body)) as HintCell;
      await mutate((current) => current && { ...current, cells: current.cells.map((existing) => (existing._id === cell._id ? cell : existing)) }, { revalidate: false });
      return cell;
    }

    return {
      claim: (articleId: number, area: string, overwrite = false) => post(articleId, area, 'claim', { overwrite }),
      release: (articleId: number, area: string) => post(articleId, area, 'release'),
      solve: (articleId: number, area: string, answer: string, flags: Partial<WriteFlags> = {}) =>
        post(articleId, area, 'solve', { answer, replaceMarker: flags.replaceMarker === true, overwrite: flags.overwrite === true }),
      setCheck: (articleId: number, area: string, check: HintCheck) => post(articleId, area, 'check', { check }),
      addNote: (articleId: number, area: string, text: string) => post(articleId, area, 'notes', { text }),
      setStatus: (articleId: number, area: string, status: 'open' | 'none') => post(articleId, area, 'status', { status }),
    };
  }, [authHeader, mutate]);

  return {
    board: data,
    isLoading: !error && !data,
    isError: error,
    /** Fetch the board now (e.g. when a dialog opens, the idle poll can be up to 10 s old). */
    refresh,
    ...actions,
  };
};

/**
 * Let the server parse a typed answer as an RD coordinate (single source of truth for RD rules).
 * @returns The parsed coordinate, or null when the answer is not a coordinate (or still loading)
 */
export const useRdPreview = (answer: string): RdPreview | null => {
  const trimmedAnswer = answer.trim();
  const debouncedAnswer = useDebouncedValue(trimmedAnswer, RD_PREVIEW_DEBOUNCE_MS);
  const url = debouncedAnswer ? `/hints/parse-answer?answer=${encodeURIComponent(debouncedAnswer)}` : null;

  const { data } = useAuthSWR<{ rd: RdPreview | null }>(url, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });
  // While the debounce is pending, trimmedAnswer !== debouncedAnswer: the fetched data (or
  // keepPreviousData'd stale data) still belongs to an older answer, so don't show it.
  if (trimmedAnswer !== debouncedAnswer) return null;
  return trimmedAnswer ? (data?.rd ?? null) : null;
};
