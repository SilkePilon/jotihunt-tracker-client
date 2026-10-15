import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { EllipsisIcon, KeyRoundIcon, LaptopIcon, Loader2Icon, LogOutIcon, PencilIcon, PlusIcon, SmartphoneIcon, TabletIcon, Trash2Icon, type LucideIcon } from 'lucide-react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import RenamePasskeyDialog from '@/components/account/RenamePasskeyDialog';
import Reveal from '@/components/motion/Reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAccount } from '@/hooks/account.hook';
import { useAuth } from '@/hooks/auth.hook';
import { useLogout } from '@/hooks/logout.hook';
import { useNow } from '@/hooks/now.hook';
import { deviceMeta, orderSessions, passkeyMeta, sessionDevice, sessionMeta, type AccountPasskey, type SessionDevice } from '@/lib/account';
import { apiErrorMessage } from '@/lib/api-error';
import { addPasskey, passkeysSupported } from '@/lib/auth-api';
import { REVEAL_TRANSITION, SWAP } from '@/lib/motion';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';
import { cn } from '@/lib/utils';
import useAccountDialogStore from '@/stores/account-dialog.store';

interface Confirm {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Toasts its own errors; closes the confirm itself on success */
  action: () => Promise<void>;
}

// Same shell as the Meldingen dialog: 28px card, no border, 34×32 tonal close button with 12px corners
const DIALOG_CLASS =
  'sm:max-w-md rounded-[28px] border-0 bg-card p-5 shadow-[0_0_0_1px_var(--border),0_18px_50px_rgb(0_0_0/0.35)] [&>[data-slot=dialog-close]]:top-4 [&>[data-slot=dialog-close]]:right-4 [&>[data-slot=dialog-close]]:grid [&>[data-slot=dialog-close]]:h-8 [&>[data-slot=dialog-close]]:w-[34px] [&>[data-slot=dialog-close]]:place-items-center [&>[data-slot=dialog-close]]:rounded-xl [&>[data-slot=dialog-close]]:bg-beheer-row [&>[data-slot=dialog-close]]:text-muted-foreground [&>[data-slot=dialog-close]]:opacity-100 [&>[data-slot=dialog-close]]:ring-0 [&>[data-slot=dialog-close]]:ring-offset-0 [&>[data-slot=dialog-close]]:transition-colors [&>[data-slot=dialog-close]:hover]:bg-beheer-row-high [&>[data-slot=dialog-close]:focus-visible]:ring-[3px] [&>[data-slot=dialog-close]:focus-visible]:ring-ring/50';

const DEVICE_ICONS: Record<SessionDevice, LucideIcon> = { phone: SmartphoneIcon, tablet: TabletIcon, computer: LaptopIcon };

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

  // The store is global: Layout unmounts on /login (logout, or a 401 after "Alle andere browsers uitloggen" elsewhere),
  // and a dialog left open would pop up again right after the next login
  useEffect(() => () => useAccountDialogStore.getState().setOpen(false), []);

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
          void refresh();
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
  const noPasskey = passkeys.length === 0;

  return (
    <ResponsiveDialog
      open={open}
      onClose={() => setOpen(false)}
      title="Account"
      description="Je passkeys en waar je bent ingelogd."
      className={DIALOG_CLASS}
      drawerClassName="bg-card"
      compact
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          {view === 'loading' && (
            <motion.div key="loading" className="flex flex-col gap-4" {...SWAP}>
              {[0, 1].map((index) => (
                <div key={index} className="flex flex-col gap-1.5">
                  <Skeleton className="mx-1.5 h-3.5 w-24" />
                  <Skeleton className="h-28 w-full rounded-[18px]" />
                </div>
              ))}
            </motion.div>
          )}

          {view === 'error' && (
            <motion.div key="error" className="flex flex-col items-start gap-3" {...SWAP}>
              <p className="text-sm text-muted-foreground">Kan je account niet laden.</p>
              <SmallButton onClick={() => void refresh()}>Opnieuw</SmallButton>
            </motion.div>
          )}

          {view === 'content' && (
            <motion.div key="content" className="flex flex-col gap-4" {...SWAP}>
              <Group title="Passkeys">
                <AnimatePresence initial={false}>
                  {passkeys.length === 0 && (
                    <Row key="empty">
                      <p className="px-3 py-3 text-sm text-muted-foreground">Nog geen passkey. Voeg er een toe om sneller in te loggen.</p>
                    </Row>
                  )}
                  {passkeys.map((passkey) => (
                    <Row key={passkey.id} icon={KeyRoundIcon} highlight title={passkey.name} meta={passkeyMeta(passkey, now)}>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <SmallButton icon aria-label={`Opties voor ${passkey.name}`}>
                            <EllipsisIcon />
                          </SmallButton>
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
                  {passkeysSupported() && (
                    <Row key="add">
                      <ActionRow
                        onClick={() => void handleAddPasskey()}
                        disabled={adding}
                        className="text-primary"
                        iconClassName="bg-transparent text-primary shadow-[inset_0_0_0_1.5px_var(--border)]"
                        icon={
                          <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span
                              key={adding ? 'busy' : 'idle'}
                              className="grid place-items-center"
                              initial={{ opacity: 0, scale: 0.6 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.6 }}
                              transition={{ duration: 0.15 }}
                            >
                              {adding ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
                            </motion.span>
                          </AnimatePresence>
                        }
                      >
                        Passkey toevoegen
                      </ActionRow>
                    </Row>
                  )}
                </AnimatePresence>
              </Group>

              <Group title="Ingelogd op">
                <AnimatePresence initial={false}>
                  {sessions.map((session) => (
                    <Row
                      key={`session-${session.id}`}
                      icon={DEVICE_ICONS[sessionDevice(session.label)]}
                      highlight={session.current}
                      title={session.label}
                      chip={session.current ? 'Dit apparaat' : undefined}
                      meta={sessionMeta(session, now)}
                    >
                      <SmallButton
                        onClick={() =>
                          ask(
                            session.current
                              ? {
                                  title: 'Uitloggen op dit apparaat?',
                                  description: noPasskey
                                    ? 'Je hebt nog geen passkey: daarna kom je alleen weer binnen met een QR-code of een herstel-link.'
                                    : 'Je moet daarna opnieuw inloggen.',
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
                                      void refresh();
                                    }
                                  },
                                },
                          )
                        }
                        aria-label={`Uitloggen op ${session.label}`}
                      >
                        Uitloggen
                      </SmallButton>
                    </Row>
                  ))}
                  {hasOtherSessions && (
                    <Row key="logout-others">
                      <ActionRow
                        className="text-destructive"
                        iconClassName="text-destructive"
                        icon={<LogOutIcon />}
                        onClick={() =>
                          ask({
                            title: 'Alle andere browsers uitloggen?',
                            description: `Overal behalve hier moet je opnieuw inloggen. Gekoppelde Android-telefoons blijven gekoppeld.${
                              noPasskey ? ' Zonder passkey kom je daar alleen weer binnen met een QR-code of een herstel-link.' : ''
                            }`,
                            confirmLabel: 'Uitloggen',
                            destructive: true,
                            action: async () => {
                              try {
                                const removed = await removeOtherSessions();
                                setConfirmOpen(false);
                                toast.success(removed === 1 ? '1 browser uitgelogd' : `${removed} browsers uitgelogd`);
                              } catch (failure) {
                                toast.error(apiErrorMessage(failure, 'Uitloggen is mislukt, probeer het opnieuw.'));
                                void refresh();
                              }
                            },
                          })
                        }
                      >
                        Alle andere browsers uitloggen
                      </ActionRow>
                    </Row>
                  )}
                </AnimatePresence>
              </Group>

              <Reveal gap={16}>
                {devices.length > 0 && (
                  <Group title="Gekoppelde telefoons">
                    <AnimatePresence initial={false}>
                      {devices.map((device) => (
                        <Row key={`device-${device.id}`} icon={SmartphoneIcon} title={device.name} meta={deviceMeta(device, now)}>
                          <SmallButton
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
                                    void refresh();
                                  }
                                },
                              })
                            }
                            aria-label={`${device.name} ontkoppelen`}
                          >
                            Ontkoppelen
                          </SmallButton>
                        </Row>
                      ))}
                    </AnimatePresence>
                  </Group>
                )}
              </Reveal>
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
          if (!renaming) return;
          try {
            await renamePasskey(renaming.id, name);
          } catch (failure) {
            // A passkey removed in another tab disappears from the list instead of lingering until the next poll
            void refresh();
            throw failure;
          }
        }}
      />
    </ResponsiveDialog>
  );
}

/** A muted label above a list of tonal rows (settings-menu style): 2px apart, 18px outer corners. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mx-1.5 mb-1.5 text-xs font-semibold text-muted-foreground">{title}</h3>
      {/* The corners sit on each row's inner surface, so they stay right while a neighbour folds away */}
      <div className="flex flex-col gap-0.5 [&>*:first-child>*]:rounded-t-[18px] [&>*:last-child>*]:rounded-b-[18px]">{children}</div>
    </section>
  );
}

/** One tonal row; unfolds in and folds away. With a `title` it shows an icon tile, title (+ chip), meta and the action on the right. */
function Row({
  icon: Icon,
  highlight,
  title,
  chip,
  meta,
  children,
}: {
  icon?: LucideIcon;
  /** Orange icon tile: your passkeys and this browser */
  highlight?: boolean;
  title?: string;
  chip?: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      className="overflow-hidden"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={REVEAL_TRANSITION}
    >
      <div className="overflow-hidden rounded-md bg-beheer-row">
        {title === undefined ? (
          children
        ) : (
          <div className="flex items-center gap-3 px-3 py-2.5">
            {Icon && <IconTile className={cn(highlight && 'bg-(--map-selected-bg) text-(--map-selected-fg)')}><Icon /></IconTile>}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[13.5px] font-semibold">{title}</span>
                {chip && (
                  <span className="inline-flex h-[18px] flex-none items-center rounded-full bg-(--map-selected-bg) px-[7px] text-[10.5px] font-bold text-(--map-selected-fg)">
                    {chip}
                  </span>
                )}
              </div>
              <div className="text-[11.5px] leading-snug text-muted-foreground">{meta}</div>
            </div>
            {children}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function IconTile({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'relative grid size-[34px] flex-none place-items-center rounded-xl bg-beheer-row-high text-muted-foreground transition-colors [&_svg]:size-[18px]',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Tonal 32px button with 12px corners; `icon` makes it a 34×32 square. */
function SmallButton({ icon, className, ...props }: ComponentProps<'button'> & { icon?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 flex-none items-center justify-center gap-1.5 rounded-xl bg-beheer-row-high text-[12.5px] font-semibold transition-colors outline-none',
        'hover:bg-[color-mix(in_oklab,var(--foreground)_14%,var(--card))] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
        icon ? 'w-[34px]' : 'px-3',
        className,
      )}
      {...props}
    />
  );
}

/** A whole row as one button (add passkey, log out the others), like the Uitloggen row in the settings menu. */
function ActionRow({ icon, iconClassName, className, children, ...props }: ComponentProps<'button'> & { icon: ReactNode; iconClassName?: string }) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13.5px] font-semibold transition-colors outline-none',
        'hover:bg-beheer-row-high focus-visible:bg-beheer-row-high focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-60',
        className,
      )}
      {...props}
    >
      <IconTile className={iconClassName}>{icon}</IconTile>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}
