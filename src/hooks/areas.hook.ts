import { useCallback } from 'react';
import { Area } from '@/types/Area';
import { useAuthSWR } from '../lib/swr';
import useHiddenAreasStore from '@/stores/hiddenareas.store';

export const useAreas = () => {
  const { data, error } = useAuthSWR<Area[]>('/areas', {
    // The server refreshes areas from the Jotihunt API every 10 s
    refreshInterval: 5000,
  });

  const { hiddenAreas, toggleHidden } = useHiddenAreasStore();

  // Stable between renders: layers use these in memoised filters
  const isHidden = useCallback((areaName: string) => hiddenAreas.includes(areaName.toLowerCase()), [hiddenAreas]);
  const isVisible = useCallback((areaName: string) => !hiddenAreas.includes(areaName.toLowerCase()), [hiddenAreas]);

  return {
    areas: data,
    isLoading: !error && !data,
    isError: error,
    toggleHidden,
    isHidden,
    isVisible,
    hiddenAreas,
  };
};
