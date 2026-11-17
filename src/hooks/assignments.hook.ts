import { useState } from 'react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { latestGate } from '@/lib/latest-gate';
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
  // Per assignment: only the answer to the latest write goes into the cache (each answer is the whole assignment, so a
  // slower earlier one would undo the newer change)
  const [gate] = useState(() => latestGate<number>());

  /** Post a change and put the returned assignment straight into the cache. Throws the axios error on failure. */
  async function post(articleId: number, action: string, body: unknown): Promise<Assignment> {
    const ticket = gate.next(articleId);
    let assignment: Assignment;
    try {
      assignment = (await fetcherWithMethod(`/assignments/${articleId}/${action}`, authHeader, 'POST', body)) as Assignment;
    } catch (error) {
      // An earlier write may have succeeded while its answer was skipped: fetch the real state
      if (gate.isLatest(articleId, ticket)) void mutate();
      throw error;
    }
    if (gate.isLatest(articleId, ticket)) {
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
