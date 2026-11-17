import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { BellOffIcon, MegaphoneIcon } from 'lucide-react';
import BeheerSwitch from '@/components/beheer/controls/BeheerSwitch';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadError from '@/components/LoadError';
import { Skeleton } from '@/components/ui/skeleton';
import BusyIcon from '@/components/motion/BusyIcon';
import Reveal from '@/components/motion/Reveal';
import NotificationTile from '@/components/notifications/NotificationTile';
import { NOTIFICATION_ICON } from '@/components/notifications/notification-icons';
import { NOTIFICATION_OPTIONS, NOTIFICATIONS_PROMPT_VERSION, sameTypes, setAllTypes, toggleType, type OptionalNotificationType } from '@/lib/notifications';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { useFetcher } from '@/hooks/utils/api.hook';
import { useEdition } from '@/hooks/edition.hook';
import { useNotificationPrefs } from '@/hooks/notification-prefs.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { DIALOG_SHELL } from '@/lib/dialog-shell';
import { TONAL_HOVER } from '@/lib/tonal-button';
import { SWAP } from '@/lib/motion';
import { markDevicePrompted } from '@/lib/notifications-prompt';
import { currentDevicePush, subscribePush, type PushResult } from '@/lib/push';
import useNotificationsDialogStore from '@/stores/notifications-dialog.store';
import { cn } from '@/lib/utils';
import { BUSY_CLASSES, busyProps } from '@/lib/busy';

const RESULT_MESSAGE: Record<Exclude<PushResult, 'subscribed'>, string> = {
  denied: 'Meldingen zijn geblokkeerd. Zet ze aan in de instellingen van je browser; geluiden in de app werken wel.',
  unsupported: 'Deze browser ondersteunt geen pushmeldingen; geluiden in de app werken wel.',
  unavailable: 'Pushmeldingen zijn niet ingesteld op de server; geluiden in de app werken wel.',
  error: 'Je keuzes zijn opgeslagen, maar aanmelden voor pushmeldingen op dit apparaat is mislukt. Probeer het later opnieuw.',
};

const NOTICE = 'mt-2.5 rounded-2xl bg-beheer-row p-3 text-xs';

/** Choose which notifications to get (all on by default) and register this device for push. */
export default function NotificationsDialog() {
  const open = useNotificationsDialogStore((state) => state.open);
  const setOpen = useNotificationsDialogStore((state) => state.setOpen);
  const { prefs, update, isError, retry } = useNotificationPrefs();
  const { fetch } = useFetcher();
  const [disabled, setDisabled] = useState<OptionalNotificationType[] | null>(null);
  const [saving, setSaving] = useState(false);
  // Closing with unsaved tile changes asks first ("Wijzigingen weggooien?")
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Preferences live in the edition's data: read-only while an archive is shown
  const { readOnly } = useEdition();

  // Local edits start from the server prefs each time the dialog opens; reset once it has faded out, so the switches don't snap back mid-close
  const current = disabled ?? prefs?.disabledTypes ?? [];
  const push = currentDevicePush();
  const iosInstall = push === 'install';
  const total = NOTIFICATION_OPTIONS.length;
  const onCount = NOTIFICATION_OPTIONS.filter((option) => !current.includes(option.type)).length;
  const blocked = push === 'blocked';
  // Push-capable but never switched on here (e.g. saved on a laptop, first time on this phone): one tap fixes it
  const pushOff = push === 'off';
  // Until the real prefs are in, the tiles can't show (or change) the user's choice: skeletons, or LoadError when the
  // first load failed
  const view = prefs ? 'tiles' : isError ? 'error' : 'loading';
  // A save sends the choice as it was when Opslaan was tapped, so nothing may change until it settles
  const locked = saving || readOnly || !prefs;
  const dirty = disabled !== null && !sameTypes(disabled, prefs?.disabledTypes ?? []);

  function toggle(type: OptionalNotificationType, on: boolean) {
    if (locked) return;
    setDisabled(toggleType(current, type, on));
  }

  /** Later, Esc, the backdrop, swiping down and Back: ask first when tiles were changed but not saved */
  function requestClose() {
    // While saving, the dialog stays open until the save settles
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else close();
  }

  function close() {
    setOpen(false);
    // Later isn't "seen": the dialog waits for the next session (only Opslaan marks it seen, for the user and this device)
    useNotificationsDialogStore.getState().snooze();
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await update({ disabledTypes: current, promptedVersion: NOTIFICATIONS_PROMPT_VERSION });
      markDevicePrompted();
      // Always: broadcasts can't be switched off, so every device wants push
      if (push !== 'install' && push !== 'unsupported') {
        const result = await subscribePush(fetch);
        if (result === 'subscribed') toast.success('Meldingen opgeslagen', { description: 'Je krijgt pushmeldingen op dit apparaat.' });
        else toast.warning('Meldingen opgeslagen', { description: RESULT_MESSAGE[result] });
      } else {
        toast.success('Meldingen opgeslagen');
      }
      setOpen(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Opslaan is mislukt, probeer het opnieuw.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ResponsiveDialog open={open} onClose={requestClose} title="Meldingen" description="Tik aan waarvoor je een melding en geluid wilt." className={cn(DIALOG_SHELL, 'bg-card p-5 sm:max-w-sm')} drawerClassName="bg-card" compact onClosed={() => setDisabled(null)}>
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Short windows (360×640 phones, low desktop windows): the options scroll, the Later/Opslaan row stays in view.
              The 4px inset keeps the tiles' focus rings inside the scroll clip */}
          <div className="-m-1 min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
            <Reveal>
              {pushOff && (
                <p className={cn(NOTICE, 'mt-0 mb-2 flex items-start gap-2.5 bg-primary-container text-on-primary-container')}>
                  <BellOffIcon className="mt-px size-4 shrink-0" aria-hidden />
                  <span>
                    <strong className="block font-semibold">Pushmeldingen staan op dit apparaat nog uit</strong>
                    Tik op <strong>Meldingen aanzetten</strong> en sta meldingen toe, dan krijg je ze ook als de app dicht is.
                  </span>
                </p>
              )}
            </Reveal>
            {/* The label names the switch ("Alles", the word on screen); the count is visual only, the tiles below say which are on */}
            <label className={cn('flex items-center gap-3 rounded-2xl bg-beheer-row px-3.5 py-3 transition-opacity duration-200 motion-reduce:transition-none', locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
              <span className="flex-1 text-sm font-semibold">Alles</span>
              <AnimatePresence mode="popLayout" initial={false}>
                {prefs && (
                  <motion.span key="count" {...SWAP} aria-hidden className="text-xs font-semibold text-muted-foreground tabular-nums">
                    {onCount} van {total}
                  </motion.span>
                )}
              </AnimatePresence>
              <BeheerSwitch checked={onCount === total} onCheckedChange={(on) => setDisabled(setAllTypes(on))} disabled={locked} className="disabled:opacity-100" />
            </label>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={view} {...SWAP} className="mt-2">
                {view === 'tiles' ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {NOTIFICATION_OPTIONS.map((option) => {
                      const on = !current.includes(option.type);
                      return <NotificationTile key={option.type} icon={NOTIFICATION_ICON[option.type]} label={option.label} short={option.short} description={option.description} on={on} onToggle={() => toggle(option.type, !on)} disabled={locked} />;
                    })}
                  </div>
                ) : view === 'error' ? (
                  <LoadError message="Je meldingen konden niet worden geladen." onRetry={retry} centered className="rounded-2xl bg-beheer-row px-3 py-6" />
                ) : (
                  <div className="grid grid-cols-2 gap-1.5" aria-busy="true" aria-label="Meldingen laden">
                    {NOTIFICATION_OPTIONS.map((option) => (
                      <Skeleton key={option.type} className="min-h-[104px] rounded-2xl bg-beheer-row" />
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <p className="mt-2.5 flex items-center gap-2 rounded-(--radius-tile) border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
              <MegaphoneIcon className="size-4 shrink-0" aria-hidden />
              {push === 'on' ? 'Berichten van HQ krijg je altijd.' : 'Berichten van HQ krijg je altijd in de app; buiten de app alleen met pushmeldingen aan.'}
            </p>

            <Reveal>
              {iosInstall && (
                <p className={NOTICE}>
                  Op een iPhone werken pushmeldingen alleen als de app op je beginscherm staat: tik op <strong>Deel</strong> en dan <strong>Zet op beginscherm</strong>. Geluiden in de app werken wel.
                </p>
              )}
            </Reveal>
            <Reveal>{blocked && <p className={NOTICE}>{RESULT_MESSAGE.denied}</p>}</Reveal>
          </div>

          <div className="mt-3.5 flex shrink-0 gap-2">
            <button
              type="button"
              onClick={requestClose}
              // aria-disabled while saving, not disabled: the focused button would drop the focus to <body>
              aria-disabled={saving || undefined}
              className={cn('h-11 flex-1 cursor-pointer rounded-xl bg-beheer-row-high text-sm font-semibold outline-none transition-[background-color,opacity] focus-visible:ring-[3px] focus-visible:ring-ring', TONAL_HOVER, BUSY_CLASSES)}
            >
              Later
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={readOnly || !prefs}
              {...busyProps(saving)}
              className={cn(
                'inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-semibold text-on-primary-container outline-none transition-[background-color,opacity] hover:bg-[color-mix(in_oklab,var(--on-primary-container)_10%,var(--primary-container))] focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none [&_svg]:size-4',
                // Saving keeps full colour and the focus (the spinner says it's busy); only "can't save" dims
              )}
            >
              <BusyIcon busy={saving} />
              {pushOff ? (saving ? 'Aanzetten…' : 'Meldingen aanzetten') : saving ? 'Opslaan…' : 'Opslaan'}
            </button>
          </div>
        </div>
      </ResponsiveDialog>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Wijzigingen weggooien?"
        description="Je keuzes voor meldingen zijn nog niet opgeslagen."
        cancelLabel="Verder bewerken"
        confirmLabel="Weggooien"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false);
          close();
        }}
      />
    </>
  );
}
