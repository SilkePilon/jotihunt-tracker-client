import { useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { CheckIcon, LinkIcon, Loader2Icon, PencilIcon, ShieldIcon, ShieldOffIcon, Trash2Icon } from 'lucide-react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import Reveal from '@/components/motion/Reveal';
import { useAdmin, type UserChanges } from '@/hooks/admin.hook';
import { useTimedValue } from '@/hooks/timed-value.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { isActiveNow, passkeyText, splitUsers, userActivity, usersSummary } from '@/lib/beheer';
import { copyToClipboard, writeClipboard } from '@/lib/clipboard';
import { formatClock } from '@/lib/format';
import { SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { User } from '@/types/User';
import { BeheerCard, BeheerExpandableRow, BeheerPane, BeheerRows, BeheerSkeleton, InlineConfirm } from './BeheerLayout';
import { Pill, Tag } from './controls/Pill';

/** The pane's card gap (gap-3.5), so a card folding away doesn't leave a gap behind */
const CARD_GAP = 14;
/** The rows' "nu actief" / "… geleden" only needs a refresh now and then */
const CLOCK_TICK_MS = 15_000;
/** "Link gekopieerd ✓" stays this long */
const LINK_DONE_MS = 1800;

/** Beheer → Gebruikers (G3): admins and members; tap a row for herstel-link, rename, admin and delete. */
export default function UsersPane() {
  const me = useAuthUser<User>();
  const { users, isError, updateUser, deleteUser, createRecoveryLink } = useAdmin();
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [linkDoneId, setLinkDone] = useTimedValue<string>(LINK_DONE_MS);

  const view = users ? 'content' : isError ? 'error' : 'loading';
  const { admins, members } = splitUsers(users ?? []);

  // Users whose admin change is on its way: a second tap meanwhile is ignored
  const adminSaving = useRef(new Set<string>());

  async function toggleAdmin(user: User) {
    if (adminSaving.current.has(user._id)) return;
    adminSaving.current.add(user._id);
    try {
      const error = await updateUser(user._id, { admin: !user.admin });
      if (error) toast.error(apiErrorMessage(error, 'Opslaan is mislukt.'));
      else toast.success(user.admin ? `${user.name} is geen admin meer` : `${user.name} is nu admin`);
    } finally {
      adminSaving.current.delete(user._id);
    }
  }

  async function confirmDelete(user: User) {
    const error = await deleteUser(user._id);
    // On failure the confirm stays, so trying again is one tap; on success the row folds away with it
    if (error) {
      toast.error(apiErrorMessage(error, 'De gebruiker kon niet worden verwijderd.'));
      return;
    }
    toast.success(`${user.name} verwijderd`);
  }

  /** A fresh one-time herstel-link, straight to the clipboard (the pill confirms). */
  async function recoveryLink(user: User) {
    if (linkBusyId) return;
    setLinkBusyId(user._id);
    try {
      const link = await createRecoveryLink(user._id);
      const description = `Geldig tot ${formatClock(link.expiresAt)}, werkt één keer.`;
      if (await writeClipboard(link.url)) {
        setLinkDone(user._id);
        toast.success(`Herstel-link voor ${user.name} gekopieerd`, { description });
      } else {
        // iOS Safari refuses clipboard writes this long after the tap: offer a copy button (a fresh tap)
        toast.success(`Herstel-link voor ${user.name} gemaakt`, {
          description,
          action: { label: 'Kopieer link', onClick: () => void copyToClipboard(link.url, 'Link gekopieerd') },
        });
      }
    } catch (failure) {
      toast.error(apiErrorMessage(failure, 'Herstel-link maken is mislukt, probeer het opnieuw.'));
    } finally {
      setLinkBusyId(null);
    }
  }

  function row(user: User) {
    const isMe = user._id === me?._id;
    const renaming = renamingId === user._id;
    const linkBusy = linkBusyId === user._id;
    const linkDone = linkDoneId === user._id;
    return (
      <BeheerExpandableRow
        key={user._id}
        id={user._id}
        // 12px padding + 8px dot + 12px gap
        indentClassName="pl-8"
        headerStatic={renaming}
        leading={
          <span
            aria-hidden
            className={cn('size-2 shrink-0 rounded-full transition-colors duration-300', isActiveNow(user, now) ? 'bg-green-500 shadow-[0_0_0_3px_rgb(34_197_94/0.18)]' : 'bg-muted-foreground/50')}
          />
        }
        title={
          <>
            <AnimatePresence mode="wait" initial={false}>
              {renaming ? (
                <motion.span key="rename" className="inline-flex" {...SWAP}>
                  <NameInput user={user} updateUser={updateUser} onDone={() => setRenamingId(null)} />
                </motion.span>
              ) : (
                <motion.span key="name" className="truncate" {...SWAP}>
                  {user.name}
                </motion.span>
              )}
            </AnimatePresence>
            {user.admin && <Tag tone="primary">Admin</Tag>}
            {isMe && <Tag>jij</Tag>}
          </>
        }
        meta={
          <>
            <span className={cn(!user.passkeyCount && 'text-amber-600 dark:text-amber-400')}>{passkeyText(user.passkeyCount)}</span> · {userActivity(user, now)}
          </>
        }
        confirm={
          deletingId === user._id && (
            <InlineConfirm
              title={`${user.name} verwijderen?`}
              description="Account en alle sessies worden verwijderd."
              confirmLabel="Verwijder"
              confirmIcon={<Trash2Icon />}
              onCancel={() => setDeletingId(null)}
              onConfirm={() => confirmDelete(user)}
            />
          )
        }
      >
        <Pill morphKey={linkDone ? 'done' : linkBusy ? 'busy' : 'idle'} variant={linkDone ? 'success' : 'secondary'} disabled={linkBusy} onClick={() => void recoveryLink(user)}>
          {linkDone ? (
            <>
              <CheckIcon />
              Link gekopieerd
            </>
          ) : linkBusy ? (
            <>
              <Loader2Icon className="animate-spin" />
              Link maken…
            </>
          ) : (
            <>
              <LinkIcon />
              Herstel-link
            </>
          )}
        </Pill>
        <Pill disabled={renaming} onClick={() => setRenamingId(user._id)}>
          <PencilIcon />
          Naam wijzigen
        </Pill>
        {!isMe && (
          <>
            <Pill onClick={() => void toggleAdmin(user)}>
              {user.admin ? <ShieldOffIcon /> : <ShieldIcon />}
              {user.admin ? 'Geen admin meer' : 'Admin maken'}
            </Pill>
            <Pill variant="danger-outline" onClick={() => setDeletingId(user._id)}>
              <Trash2Icon />
              Verwijderen
            </Pill>
          </>
        )}
      </BeheerExpandableRow>
    );
  }

  return (
    <BeheerPane title="Gebruikers" description={view === 'content' ? usersSummary(users ?? [], now) : view === 'loading' ? 'Laden…' : 'Nieuwe mensen komen binnen via een invite.'}>
      <AnimatePresence mode="wait" initial={false}>
        {view === 'loading' && (
          <motion.div key="loading" {...SWAP}>
            <BeheerSkeleton groups={2} />
          </motion.div>
        )}
        {view === 'error' && (
          <motion.p key="error" className="text-sm text-muted-foreground" {...SWAP}>
            Kan de gebruikers niet laden.
          </motion.p>
        )}
        {view === 'content' && (
          <motion.div key="content" className="flex flex-col gap-3.5" {...SWAP}>
            {/* A role change folds the row out of one card and into the other */}
            <Reveal gap={CARD_GAP}>
              {admins.length > 0 && (
                <BeheerCard title="Admins" count={admins.length}>
                  <BeheerRows>{admins.map(row)}</BeheerRows>
                </BeheerCard>
              )}
            </Reveal>
            <Reveal gap={CARD_GAP}>
              {members.length > 0 && (
                <BeheerCard title="Leden" count={members.length}>
                  <BeheerRows>{members.map(row)}</BeheerRows>
                </BeheerCard>
              )}
            </Reveal>
          </motion.div>
        )}
      </AnimatePresence>
    </BeheerPane>
  );
}

/** The name in the row while renaming: Enter or leaving the field saves, Escape cancels (the window stays open). */
function NameInput({ user, onDone, updateUser }: { user: User; onDone: () => void; updateUser: (id: string, changes: UserChanges) => Promise<unknown> }) {
  const [value, setValue] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // Escape or a finished save unmounts the field; a blur that may follow must not save (again)
  const cancelled = useRef(false);
  const done = useRef(false);
  // A ref, so the blur right after Enter sees it before the re-render
  const busy = useRef(false);

  function finish() {
    done.current = true;
    onDone();
  }

  async function save() {
    if (busy.current || done.current || cancelled.current) return;
    const trimmed = value.trim();
    if (!trimmed || trimmed === user.name) {
      finish();
      return;
    }
    busy.current = true;
    setSaving(true);
    const failure = await updateUser(user._id, { name: trimmed });
    busy.current = false;
    setSaving(false);
    if (failure) {
      toast.error(apiErrorMessage(failure, 'De naam kon niet worden opgeslagen.'));
      // Back in the field, so trying again (Enter) or giving up (Escape) is one key away
      input.current?.focus();
      return;
    }
    toast.success('Naam opgeslagen');
    finish();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelled.current = true;
      onDone();
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        ref={input}
        autoFocus
        data-inline-edit
        maxLength={40}
        value={value}
        // Not disabled: that drops the focus (and the row would be stuck after a failed save)
        readOnly={saving}
        aria-busy={saving}
        aria-label={`Nieuwe naam voor ${user.name}`}
        autoComplete="off"
        data-1p-ignore
        onFocus={(event) => event.target.select()}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => void save()}
        className="h-7 w-40 rounded-lg border-[1.5px] border-primary bg-card px-2 text-[13.5px] font-semibold outline-none read-only:opacity-60"
      />
      {saving && <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />}
    </span>
  );
}
