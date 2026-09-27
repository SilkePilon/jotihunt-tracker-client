import { RefObject } from 'react';
import { useOutletContext } from 'react-router';
import { MapRef } from '@/components/Map';

export type OutletContextType = {
  mapRef: RefObject<MapRef | null>;
};

/**
 * Access the context passed down from the Layout's <Outlet />.
 */
export function useOutlet() {
  return useOutletContext<OutletContextType>();
}
