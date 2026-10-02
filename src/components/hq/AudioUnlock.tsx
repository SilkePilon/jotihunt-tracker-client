import { Volume2Icon } from 'lucide-react';

/** Browsers block sound until the first click; the HQ screen asks for one. */
export default function AudioUnlock({ onUnlock }: { onUnlock: () => void }) {
  return (
    <button type="button" onClick={onUnlock} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
      <Volume2Icon className="size-16" />
      <span className="text-2xl font-semibold">Klik om geluid aan te zetten</span>
    </button>
  );
}
