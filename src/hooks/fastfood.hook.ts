import { asList } from '@/lib/response-shape';
import { useAuthSWR } from '@/lib/swr';
import type { FastfoodRestaurant } from '@/types/Fastfood';

/** The server recomputes the intervals every 10 minutes; the list itself changes once a day */
const REFRESH_MS = 30 * 60_000;

/** McDonald's / KFC / Burger King for the map; nothing is fetched while no fastfood layer is on. */
export function useFastfood(enabled: boolean): FastfoodRestaurant[] | undefined {
  const { data } = useAuthSWR<FastfoodRestaurant[]>(enabled ? '/fastfood' : null, { refreshInterval: REFRESH_MS, revalidateOnFocus: false });
  return enabled ? asList(data) : undefined;
}
