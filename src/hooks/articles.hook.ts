import { Article } from '@/types/Article';
import { useAuthSWR } from '../lib/swr';
import { asList } from '@/lib/response-shape';

export const useArticles = () => {
  const { data, error, mutate } = useAuthSWR<Article[]>('/articles', {
    refreshInterval: 10000,
  });

  return {
    articles: asList(data),
    isLoading: !error && !data,
    isError: error,
    error,
    retry: () => mutate(),
  };
};
