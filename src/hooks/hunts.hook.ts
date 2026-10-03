import { Hunt } from '@/types/Hunt';
import { useAuthSWR } from '../lib/swr';
import { asList } from '@/lib/response-shape';

export const useHunts = () => {
  const { data, error } = useAuthSWR<Hunt[]>('/hunts', {
    refreshInterval: 5000,
  });

  return {
    hunts: asList(data),
    isLoading: !error && !data,
    isError: error,
  };
};
