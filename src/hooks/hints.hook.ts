import { useEffect, useState } from 'react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { hintBoardRefreshMs } from '@/lib/hints';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import { HintBoard, HintCell, RdPreview } from '@/types/HintCell';

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

/** The hint board (articles and their cells per area) and solving a cell */
export const useHintBoard = ({ live = false }: { live?: boolean } = {}) => {
  const authHeader = useAuthHeader() || '';
  // The intel window polls fast (answers by others show up quickly); the sidebar mini grid slowly
  const { data, error, mutate } = useAuthSWR<HintBoard>('/hints/board', { refreshInterval: hintBoardRefreshMs(live) });

  /**
   * Store an answer and put the returned cell straight into the cache. Throws the axios error on failure; a 409 with
   * `existingMarkerId` means another hint marker is there (resend with replaceMarker).
   */
  async function solve(articleId: number, area: string, answer: string, replaceMarker = false): Promise<HintCell> {
    const cell = (await fetcherWithMethod(`/hints/${articleId}/${area}/solve`, authHeader, 'POST', { answer, replaceMarker })) as HintCell;
    await mutate((current) => current && { ...current, cells: current.cells.map((existing) => (existing._id === cell._id ? cell : existing)) }, { revalidate: false });
    return cell;
  }

  /** Remove a stored answer (the cell is open again, its hint marker goes) and put the returned cell in the cache */
  async function clear(articleId: number, area: string): Promise<HintCell> {
    const cell = (await fetcherWithMethod(`/hints/${articleId}/${area}/solve`, authHeader, 'DELETE')) as HintCell;
    await mutate((current) => current && { ...current, cells: current.cells.map((existing) => (existing._id === cell._id ? cell : existing)) }, { revalidate: false });
    return cell;
  }

  return {
    board: data,
    isLoading: !error && !data,
    isError: error,
    solve,
    clear,
  };
};

/**
 * Let the server parse a typed answer as an RD coordinate (single source of truth for RD rules).
 * @returns `rd`: the parsed coordinate, or null when the answer is not a coordinate (or not known yet); `pending`: true
 * while the debounce or the request for the current answer is still running, so `rd` doesn't belong to it yet
 */
export const useRdPreviewState = (answer: string): { rd: RdPreview | null; pending: boolean } => {
  const trimmedAnswer = answer.trim();
  const debouncedAnswer = useDebouncedValue(trimmedAnswer, RD_PREVIEW_DEBOUNCE_MS);
  const url = debouncedAnswer ? `/hints/parse-answer?answer=${encodeURIComponent(debouncedAnswer)}` : null;

  const { data, isLoading } = useAuthSWR<{ rd: RdPreview | null }>(url, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });
  // While the debounce is pending, trimmedAnswer !== debouncedAnswer: the fetched data (or
  // keepPreviousData'd stale data) still belongs to an older answer, so don't show it.
  // isLoading looks at the current key's cache only: true while keepPreviousData still hands out an older answer's data.
  if (!trimmedAnswer) return { rd: null, pending: false };
  if (trimmedAnswer !== debouncedAnswer || isLoading) return { rd: null, pending: true };
  return { rd: data?.rd ?? null, pending: false };
};
