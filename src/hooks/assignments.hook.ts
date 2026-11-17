import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { latestGate } from '@/lib/latest-gate';
import { asList } from '@/lib/response-shape';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import type { UserRef } from '@/types/HintCell';
import type { Assignment, AssignmentStatus } from '@/types/Intel';

const ASSIGNMENTS_REFRESH_MS = 5000;

/**
 * Per account and assignment: only the answer to the latest write goes into the cache (each answer is the whole
 * assignment, so a slower earlier one would undo the newer change). Module-level, like the SWR cache it guards: the
 * detail pane and a chat proposal card each mount their own useAssignments but write to the same cached list.
 */
const writes = latestGate<string>();

/** The gate key for one assignment as seen by one account (the SWR cache is keyed by URL and auth header too) */
export const assignmentWriteKey = (authHeader: string, articleId: number) => `${authHeader}\n${articleId}`;

/** Bookkeeping of the assignment articles (owner, status, notes) and the team members an assignment can be given to */
export const useAssignments = () => {
  const authHeader = useAuthHeader() || '';
  const { data, error, mutate } = useAuthSWR<Assignment[]>('/assignments', { refreshInterval: ASSIGNMENTS_REFRESH_MS });
  const { data: members } = useAuthSWR<UserRef[]>('/assignments/members', { revalidateOnFocus: false });

  /** Post a change and put the returned assignment straight into the cache. Throws the axios error on failure. */
  async function post(articleId: number, action: string, body: unknown): Promise<Assignment> {
    const key = assignmentWriteKey(authHeader, articleId);
    const ticket = writes.next(key);
    let assignment: Assignment;
    try {
      assignment = (await fetcherWithMethod(`/assignments/${articleId}/${action}`, authHeader, 'POST', body)) as Assignment;
    } catch (error) {
      // An earlier write may have succeeded while its answer was skipped: fetch the real state
      if (writes.isLatest(key, ticket)) void mutate();
      throw error;
    }
    if (writes.isLatest(key, ticket)) {
      await mutate((current) => [...(current ?? []).filter((existing) => existing.articleId !== assignment.articleId), assignment], { revalidate: false });
    }
    return assignment;
  }

  return {
    assignments: asList(data),
    members: asList(members) ?? [],
    isError: error,
    error,
    retry: () => mutate(),
    setStatus: (articleId: number, status: AssignmentStatus) => post(articleId, 'status', { status }),
    setOwner: (articleId: number, owner: string | null) => post(articleId, 'owner', { owner }),
    addNote: (articleId: number, text: string) => post(articleId, 'notes', { text }),
  };
};
