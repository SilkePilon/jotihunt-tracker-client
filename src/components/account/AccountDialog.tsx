import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { EllipsisIcon, Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import RenamePasskeyDialog from '@/components/account/RenamePasskeyDialog';
import Reveal from '@/components/motion/Reveal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAccount } from '@/hooks/account.hook';
import { useAuth } from '@/hooks/auth.hook';
import { useLogout } from '@/hooks/logout.hook';
import { useNow } from '@/hooks/now.hook';
import { deviceMeta, orderSessions, passkeyMeta, sessionMeta, type AccountPasskey } from '@/lib/account';
import { apiErrorMessage } from '@/lib/api-error';
import { addPasskey, passkeysSupported } from '@/lib/auth-api';
import { REVEAL_TRANSITION, SWAP } from '@/lib/motion';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';
import useAccountDialogStore from '@/stores/account-dialog.store';

interface Confirm {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Toasts its own errors; closes the confirm itself on success */
  action: () => Promise<void>;
}

/** Your passkeys and everywhere you are logged in (browsers and paired Android phones), opened from the gear menu. */
export default function AccountDialog() {
  const open = useAccountDialogStore((state) => state.open);
  const setOpen = useAccountDialogStore((state) => state.setOpen);
  const { account, error, refresh, renamePasskey, removePasskey, removeSession, removeOtherSessions, removeDevice } = useAccount(open);
  const authHeader = useAuthHeader();
  const { updateUserState } = useAuth();
  const logout = useLogout();
  const now = useNow(open);
  const [adding, setAdding] = useState(false);
  // The content is kept after closing, so the dialog doesn't go blank while it fades out
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [renaming, setRenaming] = useState<AccountPasskey | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);

  const view = account ? 'content' : error ? 'error' : 'loading';

  function ask(next: Confirm) {
    setConfirm(next);
    setConfirmOpen(true);
  }

  async function handleAddPasskey() {
    if (!authHeader || adding) return;
    setAdding(true);
    try {
      await updateUserState(await addPasskey(authHeader));
      void refresh();
      toast.success('Passkey toegevoegd');
    } catch (failure) {
      const kind = classifyPasskeyError(failure);
      if (kind !== 'cancelled') toast.error(PASSKEY_MESSAGES[kind]);
    } finally {
      setAdding(false);
    }
  }

  function askRemovePasskey(passkey: AccountPasskey) {
    ask({
      title: 'Passkey verwijderen?',
      description: `Met "${passkey.name}" kun je daarna niet meer inloggen.`,
      confirmLabel: 'Verwijderen',
      destructive: true,
      action: async () => {
        try {
          await removePasskey(passkey.id);
          setConfirmOpen(false);
          toast.success('Passkey verwijderd');
        } catch (failure) {
          toast.error(apiErrorMessage(failure, 'Verwijderen is mislukt, probeer het opnieuw.'));
        }
      },
    });
  }

  function startRename(passkey: AccountPasskey) {
    setRenaming(passkey);
    setRenameOpen(true);
  }

  const passkeys = account?.passkeys ?? [];
  const sessions = account ? orderSessions(account.sessions) : [];
  const devices = account?.devices ?? [];
  const hasOtherSessions = sessions.some((session) => !session.current);
  const lastPasskey = passkeys.length <= 1;

  return (
    <ResponsiveDialog open={open} onClose={() => setOpen(false)} title="Account" description="Je passkeys en de apparaten waarop je bent ingelogd." className="sm:max-w-2xl">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          {view === 'loading' && (
            <motion.div key="loading" className="flex flex-col gap-7" {...SWAP}>
              {[0, 1].map((index) => (
                <div key={index} className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-32 w-full rounded-lg" />
                </div>
              ))}
            </motion.div>
          )}

          {view === 'error' && (
            <motion.div key="error" className="flex flex-col items-start gap-3" {...SWAP}>
              <p className="text-sm text-muted-foreground">Kan je account niet laden.</p>
              <Button variant="outline" size="sm" onClick={() => void refresh()}>
                Opnieuw
              </Button>
            </motion.div>
          )}

          {view === 'content' && (
            <motion.div key="content" className="flex flex-col gap-7" {...SWAP}>
              <Group
                title="Passkeys"
                action={
                  passkeysSupported() && (
                    <Button size="sm" variant="outline" onClick={() => void handleAddPasskey()} disabled={adding}>
                      {adding ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
                      Passkey toevoegen
                    </Button>
                  )
                }
              >
                <AnimatePresence initial={false}>
                  {passkeys.length === 0 && (
                    <Row key="empty">
                      <p className="text-sm text-muted-foreground">Nog geen passkey. Voeg er een toe om sneller in te loggen.</p>
                    </Row>
                  )}
                  {passkeys.map((passkey) => (
                    <Row key={passkey.id} title={passkey.name} meta={passkeyMeta(passkey, now)}>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Opties voor ${passkey.name}`}>
                            <EllipsisIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => startRename(passkey)}>
                            <PencilIcon />
                            Hernoemen
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" disabled={lastPasskey} onSelect={() => askRemovePasskey(passkey)}>
                            <Trash2Icon />
                            <div className="flex flex-col">
                              <span>Verwijderen</span>
                              {lastPasskey && <span className="text-xs text-muted-foreground">Je laatste passkey kan niet weg</span>}
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Row>
                  ))}
                </AnimatePresence>
              </Group>

              <Group
                title="Ingelogd op"
                footer={
                  <Reveal gap={8}>
                    {hasOtherSessions && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          ask({
                            title: 'Alle andere browsers uitloggen?',
                            description: 'Overal behalve hier moet je opnieuw inloggen. Gekoppelde Android-telefoons blijven gekoppeld.',
                            confirmLabel: 'Uitloggen',
                            destructive: true,
                            action: async () => {
                              try {
                                const removed = await removeOtherSessions();
                                setConfirmOpen(false);
                                toast.success(removed === 1 ? '1 browser uitgelogd' : `${removed} browsers uitgelogd`);
                              } catch (failure) {
                                toast.error(apiErrorMessage(failure, 'Uitloggen is mislukt, probeer het opnieuw.'));
                              }
                            },
                          })
                        }
                      >
                        Alle andere browsers uitloggen
                      </Button>
                    )}
                  </Reveal>
                }
              >
                <AnimatePresence initial={false}>
                  {sessions.map((session) => (
                    <Row key={`session-${session.id}`} title={session.label} meta={sessionMeta(session, now)}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          ask(
                            session.current
                              ? {
                                  title: 'Uitloggen op dit apparaat?',
                                  description: 'Je moet daarna opnieuw inloggen.',
                                  confirmLabel: 'Uitloggen',
                                  action: async () => {
                                    try {
                                      await logout();
                                      setConfirmOpen(false);
                                    } catch (failure) {
                                      toast.error(apiErrorMessage(failure, 'Uitloggen is mislukt, probeer het opnieuw.'));
                                    }
                                  },
                                }
                              : {
                                  title: `${session.label} uitloggen?`,
                                  description: 'Wie daar is ingelogd, moet opnieuw inloggen.',
                                  confirmLabel: 'Uitloggen',
                                  destructive: true,
                                  action: async () => {
                                    try {
                                      await removeSession(session.id);
                                      setConfirmOpen(false);
                                      toast.success(`Uitgelogd op ${session.label}`);
                                    } catch (failure) {
                                      toast.error(apiErrorMessage(failure, 'Uitloggen is mislukt, probeer het opnieuw.'));
                                    }
                                  },
                                },
                          )
                        }
                        aria-label={`Uitloggen op ${session.label}`}
                      >
                        Uitloggen
                      </Button>
                    </Row>
                  ))}
                  {devices.map((device) => (
                    <Row key={`device-${device.id}`} title={device.name} meta={deviceMeta(device, now)}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          ask({
                            title: `${device.name} ontkoppelen?`,
                            description: 'De app op die telefoon stopt met het delen van de locatie tot je hem opnieuw koppelt.',
                            confirmLabel: 'Ontkoppelen',
                            destructive: true,
                            action: async () => {
                              try {
                                await removeDevice(device.id);
                                setConfirmOpen(false);
                                toast.success(`${device.name} ontkoppeld`);
                              } catch (failure) {
                                toast.error(apiErrorMessage(failure, 'Ontkoppelen is mislukt, probeer het opnieuw.'));
                              }
                            },
                          })
                        }
                        aria-label={`${device.name} ontkoppelen`}
                      >
                        Ontkoppelen
                      </Button>
                    </Row>
                  ))}
                </AnimatePresence>
              </Group>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirm?.title}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        destructive={confirm?.destructive}
        onConfirm={() => confirm?.action()}
      />
      <RenamePasskeyDialog
        open={renameOpen}
        name={renaming?.name ?? ''}
        onOpenChange={setRenameOpen}
        onSave={async (name) => {
          if (renaming) await renamePasskey(renaming.id, name);
        }}
      />
    </ResponsiveDialog>
  );
}

/** A heading, a bordered box of rows and optionally something below it (Beheer v3 style). */
function Group({ title, action, footer, children }: { title: string; action?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      <div className="divide-y rounded-lg border">{children}</div>
      {footer}
    </section>
  );
}

/** One row of a group box; unfolds in and folds away. The padding sits inside, so the height can animate to zero. */
function Row({ title, meta, children }: { title?: string; meta?: string; children: ReactNode }) {
  return (
    <motion.div
      className="overflow-hidden"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={REVEAL_TRANSITION}
    >
      <div className="flex items-center gap-4 px-4 py-3">
        {title === undefined ? (
          <div className="min-w-0 flex-1">{children}</div>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{title}</div>
              <div className="text-xs text-muted-foreground">{meta}</div>
            </div>
            {children}
          </>
        )}
      </div>
    </motion.div>
  );
}
