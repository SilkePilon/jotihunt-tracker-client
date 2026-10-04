import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { asList } from '@/lib/response-shape';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import type { UserRef } from '@/types/HintCell';
import type { Assignment, AssignmentStatus } from '@/types/Intel';

const ASSIGNMENTS_REFRESH_MS = 5000;

/** Bookkeeping of the assignment articles (owner, status, notes) and the team members an assignment can be given to */
export const useAssignments = () => {
  const authHeader = useAuthHeader() || '';
  const { data, error, mutate } = useAuthSWR<Assignment[]>('/assignments', { refreshInterval: ASSIGNMENTS_REFRESH_MS });
  const { data: members } = useAuthSWR<UserRef[]>('/assignments/members', { revalidateOnFocus: false });

  /** Post a change and put the returned assignment straight into the cache. Throws the axios error on failure. */
  async function post(articleId: number, action: string, body: unknown): Promise<Assignment> {
    const assignment = (await fetcherWithMethod(`/assignments/${articleId}/${action}`, authHeader, 'POST', body)) as Assignment;
    await mutate((current) => [...(current ?? []).filter((existing) => existing.articleId !== assignment.articleId), assignment], { revalidate: false });
    return assignment;
  }

  return {
    assignments: asList(data),
    members: asList(members) ?? [],
    isError: error,
    setStatus: (articleId: number, status: AssignmentStatus, overwrite = false) => post(articleId, 'status', { status, overwrite }),
    setOwner: (articleId: number, owner: string | null, overwrite = false) => post(articleId, 'owner', { owner, overwrite }),
    addNote: (articleId: number, text: string) => post(articleId, 'notes', { text }),
  };
};
