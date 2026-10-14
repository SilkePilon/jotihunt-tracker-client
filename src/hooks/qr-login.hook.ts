import { useEffect, useRef, useState } from 'react';
import { pollQrLogin, startQrLogin, type QrPoll, type QrStart, type SessionResult } from '@/lib/auth-api';
import { panelAfterPoll, QR_POLL_MS, QR_RENEW_FOR_MS, type QrPanelState } from '@/lib/qr-login';

/** Laptop: show a code, poll it, make a new one when it expires (for 10 minutes), hand over the session on approval. */
export function useQrLogin(onApproved: (result: SessionResult) => void) {
  const [state, setState] = useState<QrPanelState>({ phase: 'loading' });
  // Bumped by "Nieuwe code" / "Niet jij? Opnieuw": starts over with a fresh code and a fresh 10 minutes
  const [round, setRound] = useState(0);
  const onApprovedRef = useRef(onApproved);
  useEffect(() => {
    onApprovedRef.current = onApproved;
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let qr: QrStart | null = null;
    const renewingSince = Date.now();

    async function renew() {
      try {
        qr = await startQrLogin();
      } catch {
        if (!cancelled) setState({ phase: 'error' });
        return;
      }
      if (cancelled) return;
      setState({ phase: 'waiting', url: qr.url, expiresAt: Date.parse(qr.expiresAt) });
      timer = setTimeout(poll, QR_POLL_MS);
    }

    async function poll() {
      if (!qr) return;
      let answer: QrPoll | 'gone' | null;
      try {
        answer = await pollQrLogin(qr.id, qr.pollSecret);
      } catch {
        // Network hiccup: keep the code and ask again
        answer = null;
      }
      if (cancelled) return;
      if (answer === null) {
        // Errors count against the 10 minutes too: a forgotten tab must stop polling
        if (Date.now() - renewingSince >= QR_RENEW_FOR_MS) {
          setState({ phase: 'expired' });
          return;
        }
        timer = setTimeout(poll, QR_POLL_MS);
        return;
      }
      if (answer !== 'gone' && answer.status === 'approved') {
        setState({ phase: 'done', name: answer.user.name });
        onApprovedRef.current({ token: answer.token, user: answer.user });
        return;
      }
      const next = panelAfterPoll(answer, qr.url, renewingSince, Date.now());
      if (next === 'renew') {
        void renew();
        return;
      }
      setState(next);
      if (next.phase !== 'expired') timer = setTimeout(poll, QR_POLL_MS);
    }

    void renew();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [round]);

  function restart() {
    setState({ phase: 'loading' });
    setRound((value) => value + 1);
  }

  return { state, restart };
}
