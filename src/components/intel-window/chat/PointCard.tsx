import { type ReactNode, type RefObject, useState } from 'react';
import { CheckIcon, Loader2Icon, MapPinIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { LngLat } from 'maplibre-gl';
import { toast } from 'sonner';
import { Pill, Tag } from '@/components/beheer/controls/Pill';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { MapRef } from '@/components/Map';
import { useHintBoard } from '@/hooks/hints.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { areaLabel, formatDistance, sameAnswer } from '@/lib/intel-chat';
import { INTEL_CLOSE_MS, hasExistingMarker } from '@/lib/intel-window';
import { SWAP } from '@/lib/motion';
import useIntelStore from '@/stores/intel.store';
import type { HintAnswerProposal, PointResult } from '@/types/IntelChat';
import MiniMap from './MiniMap';

interface PointCardProps {
  /** showPoint output, or a proposal's point (null for a text answer) */
  point: PointResult | null;
  /** proposeHintAnswer output: adds "Zet als antwoord" */
  proposal?: HintAnswerProposal;
  mapRef: RefObject<MapRef | null>;
}

/** M3 result card: mini map, RD / Deelgebied / Dichtstbij, "Toon op kaart" and (proposals) "Zet als antwoord" */
export default function PointCard({ point, proposal, mapRef }: PointCardProps) {
  const close = useIntelStore((state) => state.close);

  function showOnMap() {
    if (!point) return;
    const { lng, lat } = point.latLng;
    close();
    setTimeout(() => {
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 2000 });
      mapRef.current?.markPoint({ lng, lat } as LngLat);
    }, INTEL_CLOSE_MS);
  }

  return (
    <div className="overflow-hidden rounded-[18px] bg-beheer-row">
      {point && <MiniMap point={point.latLng} label={point.label} />}
      <div className="grid gap-1.5 px-3 py-2.5 text-[12.5px]">
        {proposal && (
          <Row name={`Antwoord ${areaLabel(proposal.area)}`}>
            <span className="truncate font-mono">{proposal.answer}</span>
          </Row>
        )}
        {point ? (
          <>
            <Row name="RD">
              <span className="font-mono tabular-nums">{point.rdText}</span>
            </Row>
            <Row name="Deelgebied">
              {point.area.area ? areaLabel(point.area.area) : 'onbekend'}
              {point.area.area && point.area.method !== 'hull' && <Tag tone="warn">schatting</Tag>}
            </Row>
            <Row name="Dichtstbij">{point.nearestGroup ? <span className="truncate">{`${point.nearestGroup.name} · ${formatDistance(point.nearestGroup.distanceM)}`}</span> : '—'}</Row>
          </>
        ) : (
          proposal && <Row name="Deelgebied">{areaLabel(proposal.area)}</Row>
        )}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {point && (
            <Pill onClick={showOnMap}>
              <MapPinIcon />
              Toon op kaart
            </Pill>
          )}
          {proposal && <SaveAnswerButton proposal={proposal} />}
        </div>
      </div>
    </div>
  );
}

function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-muted-foreground">
      <span className="shrink-0">{name}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-right font-semibold text-foreground">{children}</span>
    </div>
  );
}

/**
 * Posts the proposal through the existing solve endpoint (the AI never writes itself). An area that already has another
 * answer asks to overwrite first; a hint marker already there for that hour asks to move it (409, as in HintPane). Shows
 * "Opgeslagen ✓" once the board holds this answer.
 */
function SaveAnswerButton({ proposal }: { proposal: HintAnswerProposal }) {
  const { board, solve } = useHintBoard({ live: true });
  const cell = board?.cells.find((existing) => existing.articleId === proposal.articleId && existing.area === proposal.area);
  const stored = cell?.status === 'solved' && cell.answer ? cell.answer : null;
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [ask, setAsk] = useState<'overwrite' | 'marker'>('overwrite');
  const [confirmOpen, setConfirmOpen] = useState(false);
  // The answer being replaced, fixed at the click: the board already holds the new one during the dialog's exit fade
  const [replacing, setReplacing] = useState<string | null>(null);
  const saved = (stored !== null && sameAnswer(stored, proposal.answer)) || (justSaved && stored === null);
  const label = areaLabel(proposal.area);

  async function save(replaceMarker: boolean) {
    setSaving(true);
    try {
      await solve(proposal.articleId, proposal.area, proposal.answer, replaceMarker);
      setJustSaved(true);
      setConfirmOpen(false);
    } catch (error) {
      if (!replaceMarker && hasExistingMarker(error)) {
        setAsk('marker');
        setConfirmOpen(true);
      } else toast.error(apiErrorMessage(error, 'Antwoord opslaan mislukt'));
    } finally {
      setSaving(false);
    }
  }

  function click() {
    if (saved || saving) return;
    if (stored) {
      setReplacing(stored);
      setAsk('overwrite');
      setConfirmOpen(true);
    } else void save(false);
  }

  return (
    <>
      <Pill variant={saved ? 'success' : 'primary'} disabled={saving} aria-disabled={saved} onClick={click} morphKey={saved ? 'saved' : saving ? 'saving' : 'idle'}>
        {saved ? (
          <>
            Opgeslagen
            <CheckIcon />
          </>
        ) : saving ? (
          <Loader2Icon className="animate-spin" aria-label="Opslaan…" />
        ) : (
          <>
            <CheckIcon />
            Zet als antwoord
          </>
        )}
      </Pill>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        // Overwrite → 409 swaps to the marker question while the dialog stays open
        title={
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={ask} {...SWAP} className="block">
              {ask === 'overwrite' ? 'Antwoord vervangen?' : 'Bestaande marker vervangen?'}
            </motion.span>
          </AnimatePresence>
        }
        description={
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={ask} {...SWAP} className="block">
              {ask === 'overwrite'
                ? `${label} heeft al ${replacing ?? ''} als antwoord. Vervangen door ${proposal.answer}?`
                : `Er staat al een hint-marker voor ${label} op dit uur. Die wordt verplaatst naar dit antwoord.`}
            </motion.span>
          </AnimatePresence>
        }
        confirmLabel="Vervangen"
        onConfirm={() => save(ask === 'marker')}
      />
    </>
  );
}
