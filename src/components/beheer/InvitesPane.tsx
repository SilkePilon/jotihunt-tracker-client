import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { EllipsisIcon, Loader2Icon, PlusIcon, QrCodeIcon, Trash2Icon } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import Reveal from '@/components/motion/Reveal';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInvites } from '@/hooks/invites.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { DEFAULT_EXPIRY, DEFAULT_MAX_USES, EXPIRY_OPTIONS, inviteMeta, MAX_USES_OPTIONS, type AdminInvite, type InviteExpiry } from '@/lib/beheer';
import { copyToClipboard, writeClipboard } from '@/lib/clipboard';
import { SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { BeheerGroup, BeheerPane, BeheerRow, BeheerSkeleton } from './BeheerLayout';
import InviteQrDialog from './InviteQrDialog';

/** The pane's flex gap (gap-7), so a block folding away doesn't leave a gap behind */
const GROUP_GAP = 28;
/** A new invite's row stays highlighted this long (after it shows up) before the accent fades out over 1.2 s */
const HIGHLIGHT_MS = 400;
/** The rows' "verloopt over …" only needs a refresh now and then */
const CLOCK_TICK_MS = 15_000;
/** Radix Select can't hold null, so "Onbeperkt" travels as this value */
const UNLIMITED = 'onbeperkt';

const usesToValue = (value: number | null) => (value === null ? UNLIMITED : String(value));
const valueToUses = (value: string) => (value === UNLIMITED ? null : Number(value));
const newestFirst = (a: AdminInvite, b: AdminInvite) => Date.parse(b.createdAt) - Date.parse(a.createdAt);

/** Beheer → Invites: make invite links, copy/QR/revoke the active ones, and the stopped ones of the last 24 h. */
export default function InvitesPane() {
  const { invites, error: loadError, create, revoke } = useInvites(true);
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), CLOCK_TICK_MS);

  const [creating, setCreating] = useState(false);
  const [expiry, setExpiry] = useState<InviteExpiry>(DEFAULT_EXPIRY);
  const [maxUses, setMaxUses] = useState<number | null>(DEFAULT_MAX_USES);
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // The dialogs keep their invite while they fade out
  const [qrInvite, setQrInvite] = useState<AdminInvite | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [revoking, setRevoking] = useState<AdminInvite | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const view = invites ? 'content' : loadError ? 'error' : 'loading';
  const active = (invites ?? []).filter((invite) => invite.state === 'active').sort(newestFirst);
  const stopped = (invites ?? []).filter((invite) => invite.state !== 'active').sort(newestFirst);

  // The highlight starts fading once the new row is on screen (it arrives with the list refresh after creating)
  const highlightShown = highlightId !== null && active.some((invite) => invite._id === highlightId);
  useEffect(() => {
    if (!highlightShown) return;
    const timeout = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timeout);
  }, [highlightShown]);

  function openCreate() {
    setExpiry(DEFAULT_EXPIRY);
    setMaxUses(DEFAULT_MAX_USES);
    setCreateError(null);
    setCreating(true);
  }

  async function submitCreate() {
    if (busy) return;
    setBusy(true);
    setCreateError(null);
    try {
      const invite = await create(expiry, maxUses);
      setCreating(false);
      setHighlightId(invite._id);
      // One toast: iOS Safari refuses clipboard writes this long after the tap, so then offer a copy button (a fresh tap)
      if (await writeClipboard(invite.url)) toast.success('Invite gemaakt', { description: 'De link staat op je klembord.' });
      else toast.success('Invite gemaakt', { action: { label: 'Kopieer link', onClick: () => void copyToClipboard(invite.url, 'Link gekopieerd') } });
    } catch (failure) {
      setCreateError(apiErrorMessage(failure, 'Invite maken is mislukt.'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRevoke() {
    if (!revoking) return;
    try {
      await revoke(revoking._id);
      setRevokeOpen(false);
      toast.success('Invite ingetrokken');
    } catch (failure) {
      toast.error(apiErrorMessage(failure, 'Intrekken is mislukt.'));
    }
  }

  const activeRow = (invite: AdminInvite) => (
    <BeheerRow
      key={invite._id}
      title={<span className="font-mono">{invite.code}</span>}
      meta={inviteMeta(invite, now)}
      className={cn('transition-colors duration-[1200ms] motion-reduce:transition-none', invite._id === highlightId && 'bg-accent')}
    >
      <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => void copyToClipboard(invite.url, 'Link gekopieerd')}>
        Kopieer
      </Button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Opties voor invite ${invite.code}`}>
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setQrInvite(invite);
              setQrOpen(true);
            }}
          >
            <QrCodeIcon />
            QR-code tonen
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setRevoking(invite);
              setRevokeOpen(true);
            }}
          >
            <Trash2Icon />
            Intrekken
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </BeheerRow>
  );

  const stoppedRow = (invite: AdminInvite) => (
    <BeheerRow key={invite._id} title={<span className="font-mono text-muted-foreground">{invite.code}</span>} meta={inviteMeta(invite, now)} />
  );

  return (
    <BeheerPane
      title="Invites"
      description="Iedereen met een link kan een account maken."
      action={
        <AnimatePresence initial={false}>
          {!creating && (
            <motion.div key="new" className="shrink-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <Button size="sm" onClick={openCreate}>
                <PlusIcon />
                Nieuwe invite
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      }
    >
      <Reveal gap={GROUP_GAP}>
        {creating && (
          <div className="flex flex-col gap-3">
            <BeheerGroup title="Nieuwe invite">
              <div className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1 text-sm font-medium">Verloopt na</div>
                <Select value={expiry} onValueChange={(value) => setExpiry(value as InviteExpiry)} disabled={busy}>
                  <SelectTrigger size="sm" className="w-32" aria-label="Verloopt na">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1 text-sm font-medium">Aantal keer</div>
                <Select value={usesToValue(maxUses)} onValueChange={(value) => setMaxUses(valueToUses(value))} disabled={busy}>
                  <SelectTrigger size="sm" className="w-32" aria-label="Aantal keer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAX_USES_OPTIONS.map((option) => (
                      <SelectItem key={usesToValue(option.value)} value={usesToValue(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </BeheerGroup>
            <Reveal gap={12}>
              {createError && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {createError}
                </p>
              )}
            </Reveal>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCreating(false)} disabled={busy}>
                Annuleren
              </Button>
              <Button size="sm" onClick={() => void submitCreate()} disabled={busy}>
                {busy && <Loader2Icon className="animate-spin" />}
                Maken
              </Button>
            </div>
          </div>
        )}
      </Reveal>

      <AnimatePresence mode="wait" initial={false}>
        {view === 'loading' && (
          <motion.div key="loading" {...SWAP}>
            <BeheerSkeleton />
          </motion.div>
        )}
        {view === 'error' && (
          <motion.p key="error" className="text-sm text-muted-foreground" {...SWAP}>
            Kan de invites niet laden.
          </motion.p>
        )}
        {view === 'content' && (
          <motion.div key="content" className="flex flex-col gap-7" {...SWAP}>
            <BeheerGroup title="Actief">
              <AnimatePresence initial={false}>
                {active.map(activeRow)}
                {active.length === 0 && <BeheerRow key="empty" title={<span className="font-normal text-muted-foreground">Geen actieve invites.</span>} />}
              </AnimatePresence>
            </BeheerGroup>
            <Reveal gap={GROUP_GAP}>
              {stopped.length > 0 && (
                <BeheerGroup title="Gestopt">
                  <AnimatePresence initial={false}>{stopped.map(stoppedRow)}</AnimatePresence>
                </BeheerGroup>
              )}
            </Reveal>
          </motion.div>
        )}
      </AnimatePresence>

      <InviteQrDialog open={qrOpen} invite={invites?.find((invite) => invite._id === qrInvite?._id) ?? qrInvite} onOpenChange={setQrOpen} now={now} />
      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title={`Invite ${revoking?.code} intrekken?`}
        description="De link werkt daarna niet meer. Accounts die er al mee gemaakt zijn blijven bestaan."
        confirmLabel="Intrekken"
        destructive
        onConfirm={confirmRevoke}
      />
    </BeheerPane>
  );
}
