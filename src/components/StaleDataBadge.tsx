import { useEffect, useState } from 'react';
import { WifiOffIcon } from 'lucide-react';
import { connectionState, staleAge, staleLabel } from '@/lib/connection';

const CHECK_MS = 5000;

/** Small notice when polled data hasn't refreshed for a while (offline, server down, hung requests); gone after the next successful poll. */
export default function StaleDataBadge() {
  const [age, setAge] = useState<number | null>(null);

  useEffect(() => {
    const check = () => setAge(staleAge(connectionState(), navigator.onLine, Date.now()));
    const interval = setInterval(check, CHECK_MS);
    window.addEventListener('online', check);
    window.addEventListener('offline', check);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', check);
      window.removeEventListener('offline', check);
    };
  }, []);

  if (age === null) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed left-1/2 top-2 z-50 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-badge bg-destructive px-2.5 py-1 text-xs font-semibold text-white shadow-md"
    >
      <WifiOffIcon className="size-3.5 shrink-0" />
      {staleLabel(age)}
    </div>
  );
}
