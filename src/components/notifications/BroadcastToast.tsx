import { MegaphoneIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';

/** Message from HQ while the app is open: a loud, coloured toast so it stands out from the regular ones. */
export function showBroadcastToast(message: string, from: string | undefined, duration: number) {
  toast.custom(
    (id) => (
      <div role="alert" className="flex w-[var(--width)] max-w-full items-start gap-3 rounded-xl border-2 border-indigo-300 bg-indigo-600 p-4 text-white shadow-2xl ring-4 ring-indigo-500/30">
        <div className="flex size-9 shrink-0 animate-pulse items-center justify-center rounded-full bg-white/20">
          <MegaphoneIcon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-indigo-100 uppercase">
            Bericht van HQ{from ? ` · ${from}` : ''}
          </p>
          <p className="mt-0.5 text-base font-semibold break-words">{message}</p>
        </div>
        <button type="button" aria-label="Sluiten" onClick={() => toast.dismiss(id)} className="-m-1 rounded p-1 text-indigo-100 hover:bg-white/15 hover:text-white">
          <XIcon className="size-4" />
        </button>
      </div>
    ),
    { duration },
  );
}
