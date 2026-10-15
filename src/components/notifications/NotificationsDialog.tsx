import { useState } from 'react';
import { toast } from 'sonner';
import { FlagIcon, LightbulbIcon, MegaphoneIcon, NewspaperIcon, PartyPopperIcon, SwordsIcon, TimerIcon, type LucideIcon } from 'lucide-react';
import BeheerSwitch from '@/components/beheer/controls/BeheerSwitch';
import Reveal from '@/components/motion/Reveal';
import NotificationTile from '@/components/notifications/NotificationTile';
import { NOTIFICATION_OPTIONS, NOTIFICATIONS_PROMPT_VERSION, setAllTypes, toggleType, type OptionalNotificationType } from '@/lib/notifications';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { useFetcher } from '@/hooks/utils/api.hook';
import { useNotificationPrefs } from '@/hooks/notification-prefs.hook';
import { isPushSupported, isStandalone, needsIosInstall, pushPermission, subscribePush, type PushResult } from '@/lib/push';
import useNotificationsDialogStore from '@/stores/notifications-dialog.store';

const RESULT_MESSAGE: Record<Exclude<PushResult, 'subscribed'>, string> = {
  denied: 'Meldingen zijn geblokkeerd. Zet ze aan in de instellingen van je browser; geluiden in de app werken wel.',
  unsupported: 'Deze browser ondersteunt geen pushmeldingen; geluiden in de app werken wel.',
  unavailable: 'Pushmeldingen zijn niet ingesteld op de server; geluiden in de app werken wel.',
  error: 'Aanmelden voor pushmeldingen is mislukt, probeer het later opnieuw.',
};

const ICONS: Record<OptionalNotificationType, LucideIcon> = {
  'fox-status': FlagIcon,
  hint: LightbulbIcon,
  article: NewspaperIcon,
  'hunt-deadline': TimerIcon,
  'counter-hunt': SwordsIcon,
  'happy-hour': PartyPopperIcon,
};

// Desktop shell: 28px card with the layers-popover shadow; the built-in close X becomes a 34×32 tonal button like the sidebar header buttons
const SHELL =
  'sm:max-w-sm rounded-[28px] border-0 bg-card p-5 shadow-[0_0_0_1px_var(--border),0_18px_50px_rgb(0_0_0/0.35)] [&>[data-slot=dialog-close]]:top-4 [&>[data-slot=dialog-close]]:right-4 [&>[data-slot=dialog-close]]:grid [&>[data-slot=dialog-close]]:h-8 [&>[data-slot=dialog-close]]:w-[34px] [&>[data-slot=dialog-close]]:place-items-center [&>[data-slot=dialog-close]]:rounded-xl [&>[data-slot=dialog-close]]:bg-beheer-row [&>[data-slot=dialog-close]]:text-muted-foreground [&>[data-slot=dialog-close]]:opacity-100 [&>[data-slot=dialog-close]]:ring-0 [&>[data-slot=dialog-close]]:ring-offset-0 [&>[data-slot=dialog-close]]:transition-colors [&>[data-slot=dialog-close]:hover]:bg-beheer-row-high [&>[data-slot=dialog-close]:focus-visible]:ring-[3px] [&>[data-slot=dialog-close]:focus-visible]:ring-ring/50';

const NOTICE = 'mt-2.5 rounded-2xl bg-beheer-row p-3 text-xs';

/** Choose which notifications to get (all on by default) and register this device for push. */
export default function NotificationsDialog() {
  const open = useNotificationsDialogStore((state) => state.open);
  const setOpen = useNotificationsDialogStore((state) => state.setOpen);
  const { prefs, update } = useNotificationPrefs();
  const { fetch } = useFetcher();
  const [disabled, setDisabled] = useState<OptionalNotificationType[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Local edits start from the server prefs each time the dialog opens; reset once it has faded out, so the switches don't snap back mid-close
  const current = disabled ?? prefs?.disabledTypes ?? [];
  const iosInstall = needsIosInstall(navigator.userAgent, isStandalone());
  const total = NOTIFICATION_OPTIONS.length;
  const onCount = total - current.length;
  const blocked = !iosInstall && pushPermission() === 'denied';

  function toggle(type: OptionalNotificationType, on: boolean) {
    setDisabled(toggleType(current, type, on));
  }

  async function close() {
    setOpen(false);
    // Closing counts as "seen" too, so the dialog doesn't come back on every open
    if ((prefs?.promptedVersion ?? 0) < NOTIFICATIONS_PROMPT_VERSION) {
      await update({ promptedVersion: NOTIFICATIONS_PROMPT_VERSION }).catch(() => {});
    }
  }

  async function save() {
    setSaving(true);
    try {
      await update({ disabledTypes: current, promptedVersion: NOTIFICATIONS_PROMPT_VERSION });
      // Always: broadcasts can't be switched off, so every device wants push
      if (!iosInstall && isPushSupported()) {
        const result = await subscribePush(fetch);
        if (result === 'subscribed') toast.success('Meldingen opgeslagen', { description: 'Je krijgt pushmeldingen op dit apparaat.' });
        else toast.warning('Meldingen opgeslagen', { description: RESULT_MESSAGE[result] });
      } else {
        toast.success('Meldingen opgeslagen');
      }
      setOpen(false);
    } catch {
      toast.error('Opslaan is mislukt, probeer het opnieuw.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={() => void close()} title="Meldingen" description="Tik aan waarvoor je een melding en geluid wilt." className={SHELL} compact onClosed={() => setDisabled(null)}>
      <div className="flex flex-col">
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-beheer-row px-3.5 py-3">
          <span className="flex-1 text-sm font-semibold">Alles</span>
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {onCount} van {total}
          </span>
          <BeheerSwitch checked={onCount === total} onCheckedChange={(on) => setDisabled(setAllTypes(on))} aria-label="Alle meldingen" />
        </label>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {NOTIFICATION_OPTIONS.map((option) => {
            const on = !current.includes(option.type);
            return <NotificationTile key={option.type} icon={ICONS[option.type]} label={option.label} short={option.short} description={option.description} on={on} onToggle={() => toggle(option.type, !on)} />;
          })}
        </div>

        <p className="mt-2.5 flex items-center gap-2 rounded-[14px] border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
          <MegaphoneIcon className="size-4 shrink-0" aria-hidden />
          Berichten van HQ krijg je altijd.
        </p>

        <Reveal>
          {iosInstall && (
            <p className={NOTICE}>
              Op een iPhone werken pushmeldingen alleen als de app op je beginscherm staat: tik op <strong>Deel</strong> en dan <strong>Zet op beginscherm</strong>. Geluiden in de app werken wel.
            </p>
          )}
        </Reveal>
        <Reveal>{blocked && <p className={NOTICE}>{RESULT_MESSAGE.denied}</p>}</Reveal>

        <div className="mt-3.5 flex gap-2">
          <button type="button" onClick={() => void close()} className="h-11 flex-1 cursor-pointer rounded-xl bg-beheer-row-high text-sm font-semibold outline-none transition-colors hover:bg-beheer-row-high/70 focus-visible:ring-[3px] focus-visible:ring-ring/50">
            Later
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !prefs}
            className="h-11 flex-1 cursor-pointer rounded-xl bg-primary text-sm font-semibold text-primary-foreground outline-none transition-[filter,opacity] hover:brightness-105 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Opslaan
          </button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
