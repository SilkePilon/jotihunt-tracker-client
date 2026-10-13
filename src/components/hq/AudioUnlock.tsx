import { Volume2Icon } from 'lucide-react';

/** Browsers block sound until the first click; the HQ screen asks for one. */
export default function AudioUnlock({ onUnlock }: { onUnlock: () => void }) {
  return (
    <button type="button" onClick={onUnlock} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <span className="card flex flex-col items-center gap-3 rounded-2xl bg-card px-8 py-6 text-card-foreground shadow-2xl">
        <Volume2Icon className="size-12 text-primary" />
        <span className="text-2xl font-semibold">Klik om geluid aan te zetten</span>
        <span className="text-muted-foreground">Browsers spelen pas geluid af na één klik</span>
      </span>
    </button>
  );
}
