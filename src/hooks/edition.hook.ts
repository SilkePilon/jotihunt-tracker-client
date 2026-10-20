import { useAuthSWR } from '@/lib/swr';
import { SLOW_REQUEST_TIMEOUT_MS } from '@/lib/http';
import type { EditionsState } from '@/lib/editions';
import { useFetcher } from './utils/api.hook';

export const useEdition = () => {
  const { data, mutate } = useAuthSWR<EditionsState>('/editions', { refreshInterval: 30_000 });
  const { fetch } = useFetcher();

  /** Show an edition to everyone (admin). Takes several seconds; throws (axios error) on failure. */
  async function showEdition(year: number) {
    const result = await fetch<EditionsState>('/editions/show', 'POST', { year }, SLOW_REQUEST_TIMEOUT_MS);
    await mutate(result.data, { revalidate: false });
    return result.data;
  }

  /** Start the next edition (admin); it becomes live and shown. */
  async function createEdition() {
    const result = await fetch<EditionsState>('/editions', 'POST', undefined, SLOW_REQUEST_TIMEOUT_MS);
    await mutate(result.data, { revalidate: false });
    return result.data;
  }

  return { state: data, readOnly: data?.readOnly === true, showEdition, createEdition };
};
