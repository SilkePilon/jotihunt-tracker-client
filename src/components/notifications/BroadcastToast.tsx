import { MegaphoneIcon } from 'lucide-react';
import { toast } from 'sonner';

/** Message from HQ while the app is open: a regular toast with a coloured border and megaphone, so it stands out. */
export function showBroadcastToast(message: string, from: string | undefined, duration: number) {
  toast(`Bericht van HQ${from ? ` · ${from}` : ''}`, {
    description: message,
    icon: <MegaphoneIcon className="size-4 text-indigo-500" />,
    className: 'border-2! border-indigo-500!',
    duration,
  });
}
