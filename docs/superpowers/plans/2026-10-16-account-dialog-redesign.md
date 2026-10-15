# Account Dialog Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Account dialog to option A (tonal rows with device icons, paired phones in their own group, compact dialog) from `docs/superpowers/specs/2026-10-16-account-dialog-redesign-design.md`.

**Architecture:** Two small pure helpers change in `src/lib/account.ts` (`sessionDevice`, current-session `sessionMeta`), tested with bun. `src/components/account/AccountDialog.tsx` gets new local `Group` / `Row` / `SmallButton` / `ActionRow` building blocks and a new layout; all data, hooks, confirms and toasts stay as they are.

**Tech Stack:** React 19, TypeScript, Tailwind v4, motion/react, lucide-react, shadcn dialog + vaul drawer (`ResponsiveDialog`), bun test.

## Global Constraints

- Only `src/lib/account.ts`, `src/lib/account.test.ts` and `src/components/account/AccountDialog.tsx` change. No server, hook, `ResponsiveDialog`, `ConfirmDialog` or `RenamePasskeyDialog` changes.
- Buttons use 12px radius (`rounded-xl`), never pills. Rows: `bg-beheer-row`, 2px gap, 6px inner corners, 18px outer corners.
- Orange accents use `--map-selected-bg` / `--map-selected-fg` (`bg-(--map-selected-bg) text-(--map-selected-fg)`).
- Every state change animates (fold in/out, swaps) with motion/react, as today.
- Dutch UI copy exactly as in the spec: "Je passkeys en waar je bent ingelogd.", "Passkeys", "Ingelogd op", "Gekoppelde telefoons", "Passkey toevoegen", "Dit apparaat", "Uitloggen", "Ontkoppelen", "Alle andere browsers uitloggen".
- `bun` is not on PATH: use `npx --yes bun test`. Typecheck/build with `npx tsc -b`, lint with `npm run lint`.
- Work on branch `feat/account-dialog-redesign` in a worktree (`.worktrees/client-account` next to the client repo); never switch the main client checkout.

---

### Task 1: `sessionDevice` and current-session meta

**Files:**
- Modify: `src/lib/account.ts` (`sessionMeta`, new `sessionDevice`)
- Test: `src/lib/account.test.ts`

**Interfaces:**
- Produces: `export type SessionDevice = 'phone' | 'tablet' | 'computer'`; `export function sessionDevice(label: string): SessionDevice`; `sessionMeta(session, now)` returns only the via text for the current session.

- [ ] **Step 1: Write the failing tests**

In `src/lib/account.test.ts`, change the import line to:

```ts
import { deviceMeta, formatAgo, formatDay, orderSessions, passkeyMeta, sessionDevice, sessionMeta, type AccountSession } from './account';
```

Replace the first expectation of the `'session: this device first, ...'` test and rename the test:

```ts
  test('session: only how it logged in for this device, else last used too', () => {
    const base = { id: 's', label: 'Firefox op Linux', createdAt: ago(DAY), lastUsedAt: ago(5 * MIN) };
    expect(sessionMeta({ ...base, via: 'passkey', current: true }, now)).toBe('met passkey');
    expect(sessionMeta({ ...base, via: 'qr', current: false }, now)).toBe('5 min geleden · met QR-code');
    expect(sessionMeta({ ...base, via: 'invite', current: false }, now)).toBe('5 min geleden · via invite');
    expect(sessionMeta({ ...base, via: 'herstel', current: false }, now)).toBe('5 min geleden · via herstel-link');
    expect(sessionMeta({ ...base, via: 'cli', current: false }, now)).toBe('5 min geleden · via herstel-link');
  });
```

Add at the end of the file:

```ts
describe('sessionDevice', () => {
  test('phones, tablets, everything else a computer', () => {
    expect(sessionDevice('Chrome op Android')).toBe('phone');
    expect(sessionDevice('Safari op iPhone')).toBe('phone');
    expect(sessionDevice('Chrome op iPad')).toBe('tablet');
    expect(sessionDevice('Firefox op Linux')).toBe('computer');
    expect(sessionDevice('Safari op macOS')).toBe('computer');
    expect(sessionDevice('Edge op Windows')).toBe('computer');
    expect(sessionDevice('chrome op ANDROID')).toBe('phone');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx --yes bun test src/lib/account.test.ts`
Expected: FAIL — `sessionDevice` is not exported (SyntaxError on import) / `'Dit apparaat · met passkey'` not `'met passkey'`.

- [ ] **Step 3: Implement**

In `src/lib/account.ts`, replace `sessionMeta` with:

```ts
export function sessionMeta(session: AccountSession, now: number): string {
  const via = VIA_TEXT[session.via] ?? VIA_TEXT.passkey;
  // The dialog marks this browser with a "Dit apparaat" chip instead
  return session.current ? via : `${formatAgo(session.lastUsedAt, now)} · ${via}`;
}

export type SessionDevice = 'phone' | 'tablet' | 'computer';

/** Which icon a session gets, from its "Browser op OS" label. */
export function sessionDevice(label: string): SessionDevice {
  const lower = label.toLowerCase();
  if (lower.includes('ipad')) return 'tablet';
  if (lower.includes('android') || lower.includes('iphone')) return 'phone';
  return 'computer';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx --yes bun test src/lib/account.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/account.ts src/lib/account.test.ts
git commit -m "feat(account): session device kind, drop 'Dit apparaat' from current meta"
```

---

### Task 2: Restyle `AccountDialog` (option A)

**Files:**
- Modify: `src/components/account/AccountDialog.tsx` (whole render + local `Group` / `Row` helpers)

**Interfaces:**
- Consumes: `sessionDevice(label): 'phone' | 'tablet' | 'computer'` and `sessionMeta` from Task 1 (`@/lib/account`).
- Produces: nothing used elsewhere (default export `AccountDialog` keeps its signature).

- [ ] **Step 1: Replace the imports block**

```tsx
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
```

(`Button` is no longer imported: all buttons become the local `SmallButton` / `ActionRow`.)

- [ ] **Step 2: Add module constants under the `Confirm` interface**

```tsx
// Same shell as the Meldingen dialog: 28px card, no border, 34×32 tonal close button with 12px corners
const DIALOG_CLASS =
  'sm:max-w-md rounded-[28px] border-0 bg-card p-5 shadow-[0_0_0_1px_var(--border),0_18px_50px_rgb(0_0_0/0.35)] [&>[data-slot=dialog-close]]:top-4 [&>[data-slot=dialog-close]]:right-4 [&>[data-slot=dialog-close]]:grid [&>[data-slot=dialog-close]]:h-8 [&>[data-slot=dialog-close]]:w-[34px] [&>[data-slot=dialog-close]]:place-items-center [&>[data-slot=dialog-close]]:rounded-xl [&>[data-slot=dialog-close]]:bg-beheer-row [&>[data-slot=dialog-close]]:text-muted-foreground [&>[data-slot=dialog-close]]:opacity-100 [&>[data-slot=dialog-close]]:ring-0 [&>[data-slot=dialog-close]]:ring-offset-0 [&>[data-slot=dialog-close]]:transition-colors [&>[data-slot=dialog-close]:hover]:bg-beheer-row-high [&>[data-slot=dialog-close]:focus-visible]:ring-[3px] [&>[data-slot=dialog-close]:focus-visible]:ring-ring/50';

const DEVICE_ICONS: Record<SessionDevice, LucideIcon> = { phone: SmartphoneIcon, tablet: TabletIcon, computer: LaptopIcon };
```

- [ ] **Step 3: Replace everything from `return (` in `AccountDialog` to the end of the file**

Keep all state, effects and handler functions above `return` unchanged. Below, the confirm objects are copied verbatim from the current file; only the elements around them change.

```tsx
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
                        icon={adding ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
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
        'grid size-[34px] flex-none place-items-center rounded-xl bg-beheer-row-high text-muted-foreground transition-colors [&_svg]:size-[18px]',
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
        'hover:bg-beheer-row-high focus-visible:bg-beheer-row-high disabled:pointer-events-none disabled:opacity-60',
        className,
      )}
      {...props}
    >
      <IconTile className={iconClassName}>{icon}</IconTile>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}
```

Notes for the implementer:
- `Row` without `title` renders `children` directly inside the tonal surface (the empty-passkeys text brings its own padding, `ActionRow` fills it).
- `ActionRow` fills the row surface, so its hover colour covers the whole row and the group's outer corners still clip it (`overflow-hidden rounded-md` on the surface).
- `Reveal gap={16}` cancels the parent's `gap-4` while the phones group is folded away.
- `DropdownMenuTrigger asChild` needs `SmallButton` to forward its ref: React 19 passes `ref` as a normal prop through `...props`, so no `forwardRef` is needed.

- [ ] **Step 4: Typecheck, lint, tests**

Run: `npx tsc -b && npm run lint && npx --yes bun test`
Expected: no type errors, no lint warnings, all tests pass.

- [ ] **Step 5: Visual check**

Run the dev server (`npm run dev -- --port 5180`) against a server you can log in to, open gear menu → Account, light and dark, desktop and phone width (≤ 640px). Check:
- Dialog hugs its content (no empty area below), 28px corners, tonal 34×32 close button.
- Passkey row: orange key tile, ⋯ opens Hernoemen / Verwijderen; "Passkey toevoegen" shows a spinner while the browser prompt is open.
- Current browser first with orange icon + "Dit apparaat" chip, meta e.g. "met QR-code"; other rows show phone/tablet/laptop icons.
- Log out one other browser: its row folds away, outer corners stay rounded; when none are left, the red "Alle andere browsers uitloggen" row folds away.
- Unpair the phone: the "Gekoppelde telefoons" group folds away without a jump.
- Loading skeletons and error state (stop the server) look tonal; "Opnieuw" retries.
- Phone: same content in the bottom drawer on `bg-card`.

- [ ] **Step 6: Commit**

```bash
git add src/components/account/AccountDialog.tsx
git commit -m "feat(account): restyle Account dialog with tonal rows and device icons"
```
