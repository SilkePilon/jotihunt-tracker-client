import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { CheckIcon, ChevronDownIcon, CopyIcon, Loader2Icon, PlusIcon, QrCodeIcon, SquareIcon } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import Reveal from '@/components/motion/Reveal';
import TrackerQrCode from '@/components/tracker/TrackerQrCode';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useInvites } from '@/hooks/invites.hook';
import { useTimedValue } from '@/hooks/timed-value.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { apiErrorMessage } from '@/lib/api-error';
import {
  DEFAULT_EXPIRY,
  DEFAULT_MAX_USES,
  EXPIRY_OPTIONS,
  inviteMeta,
  inviteShareText,
  inviteStateText,
  stoppedInviteMeta,
  whatsAppShareUrl,
  type AdminInvite,
  type InviteExpiry,
} from '@/lib/beheer';
import { copyToClipboard, writeClipboard } from '@/lib/clipboard';
import { POP, SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { BeheerCard, BeheerPane, BeheerRow, BeheerRows, BeheerSkeleton, RowFrame } from './BeheerLayout';
import { IconPill, Pill, Tag } from './controls/Pill';
import WhatsAppLogo from './WhatsAppLogo';

/** The pane's card gap (gap-3.5), so a card folding away doesn't leave a gap behind */
const CARD_GAP = 14;
/** A new invite's row pulses (2 × 1 s) once it shows up */
const HIGHLIGHT_MS = 2000;
/** The rows' "nog …" only needs a refresh now and then */
const CLOCK_TICK_MS = 15_000;
/** The copy button shows its check this long */
const COPIED_MS = 1500;
/** The segmented picker works with strings, so "Onbeperkt" travels as this value */
const UNLIMITED = 'onbeperkt';

const usesToValue = (value: number | null) => (value === null ? UNLIMITED : String(value));
const valueToUses = (value: string) => (value === UNLIMITED ? null : Number(value));
const newestFirst = (a: AdminInvite, b: AdminInvite) => Date.parse(b.createdAt) - Date.parse(a.createdAt);

/** The picker shows a short set (mockup I5); the default (1 dag) is always in it. */
const EXPIRY_SEGMENTS: PickerOption[] = (['1h', '1d', '7d', 'never'] as const).map((value) => ({ value, label: EXPIRY_OPTIONS.find((option) => option.value === value)!.label }));
const USES_SEGMENTS: PickerOption[] = [1, 5, null].map((value) => ({ value: usesToValue(value), label: value === null ? 'Onbeperkt' : `${value}×` }));

type PickerOption = { value: string; label: string };

/** A compact "Label  value ⌄" button that opens a short list (mockup N5); the value swaps with a fade. */
function Picker({ label, value, options, onChange, disabled }: { label: string; value: string; options: PickerOption[]; onChange: (value: string) => void; disabled?: boolean }) {
  const current = options.find((option) => option.value === value)?.label ?? '';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={`${label}: ${current}`}
          className="inline-flex h-[38px] items-center gap-1.5 rounded-lg bg-beheer-row pr-2.5 pl-3.5 text-[13px] font-semibold outline-none transition-colors hover:bg-beheer-row-high focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 data-[state=open]:bg-beheer-row-high"
        >
          <span className="font-medium text-muted-foreground">{label}</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={current} {...SWAP}>
              {current}
            </motion.span>
          </AnimatePresence>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Beheer → Invites (I5): make invite links; share (WhatsApp), copy, QR or stop the active ones; the stopped ones of the last 24 h. */
export default function InvitesPane() {
  const { invites, error: loadError, create, revoke } = useInvites(true);
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), CLOCK_TICK_MS);

  const [expiry, setExpiry] = useState<InviteExpiry>(DEFAULT_EXPIRY);
  const [maxUses, setMaxUses] = useState<number | null>(DEFAULT_MAX_USES);
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [qrId, setQrId] = useState<string | null>(null);
  const [copiedId, setCopied] = useTimedValue<string>(COPIED_MS);
  const [showStopped, setShowStopped] = useState(false);
  // The confirm dialog keeps its invite while it fades out
  const [revoking, setRevoking] = useState<AdminInvite | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const view = invites ? 'content' : loadError ? 'error' : 'loading';
  const active = (invites ?? []).filter((invite) => invite.state === 'active').sort(newestFirst);
  const stopped = (invites ?? []).filter((invite) => invite.state !== 'active').sort(newestFirst);

  // The pulse starts once the new row is on screen (it arrives with the list refresh after creating)
  const highlightShown = highlightId !== null && active.some((invite) => invite._id === highlightId);
  useEffect(() => {
    if (!highlightShown) return;
    const timeout = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timeout);
  }, [highlightShown]);

  // A stopped invite (here, expired or used up) loses its QR: forget it, so it doesn't count as open
  // (adjusted while rendering: React re-renders straight away, no effect round trip)
  if (qrId !== null && invites !== undefined && !active.some((invite) => invite._id === qrId)) setQrId(null);

  async function submitCreate() {
    if (busy) return;
    setBusy(true);
    setCreateError(null);
    try {
      const invite = await create(expiry, maxUses);
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

  async function copy(invite: AdminInvite) {
    if (await copyToClipboard(invite.url, 'Link gekopieerd')) setCopied(invite._id);
  }

  async function confirmRevoke() {
    if (!revoking) return;
    try {
      await revoke(revoking._id);
      if (qrId === revoking._id) setQrId(null);
      setRevokeOpen(false);
      toast.success('Invite ingetrokken');
    } catch (failure) {
      toast.error(apiErrorMessage(failure, 'Intrekken is mislukt.'));
    }
  }

  const activeRow = (invite: AdminInvite) => {
    const copied = copiedId === invite._id;
    const qrOpen = qrId === invite._id;
    return (
      <BeheerRow
        key={invite._id}
        title={<span className="font-mono">{invite.code}</span>}
        meta={inviteMeta(invite, now)}
        className={cn(invite._id === highlightId && 'relative z-10 motion-safe:animate-beheer-ring')}
      >
        <Pill variant="whatsapp" aria-label={`Invite ${invite.code} delen via WhatsApp`} onClick={() => window.open(whatsAppShareUrl(inviteShareText(invite.url)), '_blank', 'noopener')}>
          <WhatsAppLogo className="size-4" />
          <span className="hidden sm:inline">WhatsApp</span>
        </Pill>
        <IconPill variant={copied ? 'success' : 'soft'} aria-label={copied ? 'Link gekopieerd' : `Link van invite ${invite.code} kopiëren`} onClick={() => void copy(invite)}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={copied ? 'check' : 'copy'} className="inline-grid" {...POP}>
              {copied ? <CheckIcon /> : <CopyIcon />}
            </motion.span>
          </AnimatePresence>
        </IconPill>
        <IconPill variant={qrOpen ? 'active' : 'soft'} aria-expanded={qrOpen} aria-label={`QR-code van invite ${invite.code}`} onClick={() => setQrId(qrOpen ? null : invite._id)}>
          <QrCodeIcon />
        </IconPill>
        <IconPill
          aria-label={`Invite ${invite.code} stoppen`}
          onClick={() => {
            setRevoking(invite);
            setRevokeOpen(true);
          }}
        >
          <SquareIcon />
        </IconPill>
      </BeheerRow>
    );
  };

  /** The invite's QR code, unfolded as its own block under the row */
  const qrRow = (invite: AdminInvite) => (
    <RowFrame key={`${invite._id}-qr`}>
      <div className="flex flex-col items-center gap-2 px-3 py-4">
        <TrackerQrCode value={invite.url} size={160} label={`QR-code van invite ${invite.code}`} />
        <p className="text-center text-xs text-muted-foreground">Laat iemand deze code scannen om een account te maken.</p>
      </div>
    </RowFrame>
  );

  const stoppedRow = (invite: AdminInvite) => (
    <BeheerRow
      key={invite._id}
      tone="muted"
      title={<span className="font-mono text-muted-foreground line-through decoration-muted-foreground">{invite.code}</span>}
      meta={stoppedInviteMeta(invite)}
    >
      {invite.state !== 'active' && <Tag>{inviteStateText(invite.state)}</Tag>}
    </BeheerRow>
  );

  return (
    <BeheerPane title="Invites" description="Iedereen met een link kan een account maken.">
      <BeheerCard title="Nieuwe invite">
        <div className="flex flex-col gap-2.5 px-1">
          {/* One toolbar line (mockup N5): two pickers and the button; wraps on narrow phones */}
          <div className="flex flex-wrap items-center gap-2">
            <Picker label="Geldig" value={expiry} options={EXPIRY_SEGMENTS} onChange={(value) => setExpiry(value as InviteExpiry)} disabled={busy} />
            <Picker label="Aantal" value={usesToValue(maxUses)} options={USES_SEGMENTS} onChange={(value) => setMaxUses(valueToUses(value))} disabled={busy} />
            <Pill className="ml-auto" variant="primary" size="md" morphKey={busy ? 'busy' : 'idle'} disabled={busy} onClick={() => void submitCreate()}>
              {busy ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
              Invite maken
            </Pill>
          </div>
          <Reveal gap={10}>
            {createError && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {createError}
              </p>
            )}
          </Reveal>
        </div>
      </BeheerCard>

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
          <motion.div key="content" className="flex flex-col gap-3.5" {...SWAP}>
            <BeheerCard title="Actief" count={active.length}>
              <BeheerRows>
                {active.flatMap((invite) => (qrId === invite._id ? [activeRow(invite), qrRow(invite)] : [activeRow(invite)]))}
                {active.length === 0 && <BeheerRow key="empty" title={<span className="font-normal text-muted-foreground">Geen actieve invites.</span>} />}
              </BeheerRows>
            </BeheerCard>
            <Reveal gap={CARD_GAP}>
              {stopped.length > 0 && (
                <BeheerCard title="Gestopt" count={stopped.length} open={showStopped} onToggle={() => setShowStopped((open) => !open)}>
                  <BeheerRows>{stopped.map(stoppedRow)}</BeheerRows>
                </BeheerCard>
              )}
            </Reveal>
          </motion.div>
        )}
      </AnimatePresence>

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
