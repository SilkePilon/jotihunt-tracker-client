import { useState } from 'react';
import { createPendingGuard } from '@/lib/pending';

/**
 * One request at a time for a form or flow step: `run(kind, action)` refuses while another runs, and `pending` says
 * which kind runs, so competing controls can be disabled and the running one can show its spinner.
 */
export function usePending<Kind extends string>() {
  const [pending, setPending] = useState<Kind | null>(null);
  const [run] = useState(() => createPendingGuard<Kind>(setPending));
  return { pending, run };
}
