import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { useFetcher } from '@/hooks/utils/api.hook';
import { useNotificationPrefs } from '@/hooks/notification-prefs.hook';
import { NOTIFICATION_OPTIONS, NOTIFICATIONS_PROMPT_VERSION, type OptionalNotificationType } from '@/lib/notifications';
import { isPushSupported, isStandalone, needsIosInstall, pushPermission, subscribePush, type PushResult } from '@/lib/push';
import useNotificationsDialogStore from '@/stores/notifications-dialog.store';

const RESULT_MESSAGE: Record<Exclude<PushResult, 'subscribed'>, string> = {
  denied: 'Meldingen zijn geblokkeerd. Zet ze aan in de instellingen van je browser; geluiden in de app werken wel.',
  unsupported: 'Deze browser ondersteunt geen pushmeldingen; geluiden in de app werken wel.',
  unavailable: 'Pushmeldingen zijn niet ingesteld op de server; geluiden in de app werken wel.',
  error: 'Aanmelden voor pushmeldingen is mislukt, probeer het later opnieuw.',
};

/** Choose which notifications to get (all on by default) and register this device for push. */
export default function NotificationsDialog() {
  const open = useNotificationsDialogStore((state) => state.open);
  const setOpen = useNotificationsDialogStore((state) => state.setOpen);
  const { prefs, update } = useNotificationPrefs();
  const { fetch } = useFetcher();
  const [disabled, setDisabled] = useState<OptionalNotificationType[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Local edits start from the server prefs each time the dialog opens
  const current = disabled ?? prefs?.disabledTypes ?? [];
  const iosInstall = needsIosInstall(navigator.userAgent, isStandalone());

  function toggle(type: OptionalNotificationType, on: boolean) {
    setDisabled(on ? current.filter((item) => item !== type) : [...current, type]);
  }

  async function close() {
    setOpen(false);
    setDisabled(null);
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
      setDisabled(null);
    } catch {
      toast.error('Opslaan is mislukt, probeer het opnieuw.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={() => void close()} title="Meldingen" description="Kies waarvoor je een melding en geluid krijgt." className="sm:max-w-sm" compact>
      <div className="flex flex-col gap-3">
        {NOTIFICATION_OPTIONS.map((option) => (
          <div key={option.type} className="flex items-center justify-between gap-3">
            <Label htmlFor={`notification-${option.type}`} className="flex flex-col items-start gap-0 leading-tight">
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-xs font-normal text-muted-foreground">{option.description}</span>
            </Label>
            <Switch id={`notification-${option.type}`} checked={!current.includes(option.type)} onCheckedChange={(on) => toggle(option.type, on)} />
          </div>
        ))}
        {iosInstall && (
          <p className="rounded-md border bg-muted/50 p-2 text-xs">
            Op een iPhone werken pushmeldingen alleen als de app op je beginscherm staat: tik op <strong>Deel</strong> en dan <strong>Zet op beginscherm</strong>. Geluiden in de app werken wel.
          </p>
        )}
        {!iosInstall && pushPermission() === 'denied' && <p className="rounded-md border bg-muted/50 p-2 text-xs">{RESULT_MESSAGE.denied}</p>}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-muted-foreground">Berichten van HQ krijg je altijd.</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void close()}>
              Later
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={saving || !prefs}>
              Opslaan
            </Button>
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
