import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { CheckIcon, LockIcon, MonitorPlayIcon, PauseIcon, RefreshCwIcon, SparklesIcon } from 'lucide-react';
import DemoModeDialog from '@/components/settings/DemoModeDialog';
import ReloadTeamsDialog from '@/components/settings/ReloadTeamsDialog';
import { useAppConfig } from '@/hooks/app-config.hook';
import { useDemo } from '@/hooks/demo.hook';
import { useHuntableAreas } from '@/hooks/huntable-areas.hook';
import { useInvitesPaused } from '@/hooks/invites.hook';
import { usePredictionSetting } from '@/hooks/predictions.hook';
import { isHomeTeam, useTeams } from '@/hooks/teams.hook';
import { huntableChips, toggleHuntable } from '@/lib/beheer';
import { AREAS } from '@/lib/marker-style';
import { POP } from '@/lib/motion';
import { capitalizeFirstLetter, cn, getColorFromArea } from '@/lib/utils';
import { BeheerCard, BeheerPane, BeheerRow, BeheerRows, CountSwap } from './BeheerLayout';
import BeheerSwitch from './controls/BeheerSwitch';
import { Pill } from './controls/Pill';

/** Leading icon of a settings row (muted, like the mockup) */
const ROW_ICON = 'size-[18px] shrink-0 text-muted-foreground';

/**
 * Rule 5.1: the other fox teams we may hunt (3 pt); the rest is locked (0 pt). Our own team (6 pt) is always allowed and
 * has no chip. Tapping saves at once: the hook shows the new list straight away and puts the old one back on failure
 * (we toast).
 */
function HuntableAreasCard() {
  const { allowed, setAllowed } = useHuntableAreas();
  const { teams } = useTeams();
  useAppConfig(); // re-render when the home team is configured
  const ownArea = teams?.find(isHomeTeam)?.area;
  const { chips, count } = huntableChips(AREAS, ownArea, allowed);
  const [saving, setSaving] = useState(false);
  // Without the teams our own area isn't known yet (it would show as a chip and be missing from the count)
  const loading = allowed === undefined || teams === undefined;

  async function toggle(area: string) {
    // One PUT at a time: each one sends the whole list
    if (saving) return;
    setSaving(true);
    try {
      await setAllowed(toggleHuntable(AREAS, ownArea, allowed, area));
    } catch {
      toast.error('Opslaan is mislukt, probeer het opnieuw.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BeheerCard
      title="Welke vossen mogen we hunten?"
      description="Tik een vos aan of uit. Vossen met een slotje leveren geen punten op; ons eigen gebied telt altijd mee."
      right={
        <span className="shrink-0 text-xs font-bold text-muted-foreground tabular-nums">
          <CountSwap value={count} />
          /9
        </span>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip.area}
            type="button"
            aria-pressed={chip.allowed}
            aria-label={`${capitalizeFirstLetter(chip.area)}: ${chip.allowed ? 'mogen we hunten' : 'niet toegestaan'}`}
            disabled={loading}
            // Not dimmed while saving (that would flash every chip on each tap); toggle() ignores taps meanwhile
            aria-disabled={saving || undefined}
            onClick={() => void toggle(chip.area)}
            className={cn(
              'inline-flex h-[34px] items-center gap-[7px] rounded-lg px-3.5 text-[13px] font-semibold outline-none transition-[background-color,color,transform] duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97] disabled:opacity-50 motion-reduce:transition-none',
              chip.allowed ? 'bg-foreground/12 text-foreground' : 'bg-beheer-row text-muted-foreground',
            )}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={chip.allowed ? 'check' : 'lock'} className="inline-grid" {...POP}>
                {chip.allowed ? <CheckIcon className="size-[13px]" strokeWidth={3} /> : <LockIcon className="size-3" strokeWidth={2.6} />}
              </motion.span>
            </AnimatePresence>
            <span aria-hidden className={cn('size-2 rounded-full transition-opacity duration-200', !chip.allowed && 'opacity-40')} style={{ background: getColorFromArea(chip.area) }} />
            {capitalizeFirstLetter(chip.area)}
          </button>
        ))}
      </div>
    </BeheerCard>
  );
}

/** Beheer → Algemeen: which other foxes we may hunt, switches that apply to everyone, and reloading the teams. */
export default function AlgemeenPane() {
  const { enabled: predictionEnabled, setEnabled: setPredictionEnabled } = usePredictionSetting();
  const { demo } = useDemo();
  const { paused, setPaused } = useInvitesPaused();
  const [savingPrediction, setSavingPrediction] = useState(false);
  const [savingPaused, setSavingPaused] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [reloadOpen, setReloadOpen] = useState(false);

  async function handlePrediction(enabled: boolean) {
    setSavingPrediction(true);
    try {
      await setPredictionEnabled(enabled);
    } catch {
      toast.error('AI-voorspelling wisselen is mislukt');
    } finally {
      setSavingPrediction(false);
    }
  }

  async function handlePaused(next: boolean) {
    setSavingPaused(true);
    try {
      await setPaused(next);
      toast.success(next ? 'Invites gepauzeerd' : 'Invites werken weer');
    } catch {
      toast.error('Invites pauzeren is mislukt');
    } finally {
      setSavingPaused(false);
    }
  }

  return (
    <BeheerPane title="Algemeen" description="Instellingen die voor iedereen gelden.">
      <HuntableAreasCard />

      <BeheerCard title="Functies">
        <BeheerRows>
          <BeheerRow key="prediction" leading={<SparklesIcon className={ROW_ICON} />} title="AI-voorspelling" meta="Laat Gemini bij elke hint voorspellen waar de vos zit.">
            <BeheerSwitch
              aria-label="AI-voorspelling"
              checked={predictionEnabled !== false}
              disabled={predictionEnabled === undefined || savingPrediction}
              onCheckedChange={(checked) => void handlePrediction(checked)}
            />
          </BeheerRow>
          <BeheerRow key="demo" leading={<MonitorPlayIcon className={ROW_ICON} />} title="Demo mode" meta="Iedereen ziet demo-gegevens. De echte gegevens blijven bewaard.">
            {/* Stays as it is until the confirmation switches demo mode (and reloads the page) */}
            <BeheerSwitch aria-label="Demo mode" checked={!!demo?.enabled} disabled={!demo} onCheckedChange={() => setDemoOpen(true)} />
          </BeheerRow>
          <BeheerRow key="invites-paused" leading={<PauseIcon className={ROW_ICON} />} title="Invites pauzeren" meta="Alle invite-links werken tijdelijk niet.">
            <BeheerSwitch
              aria-label="Invites pauzeren"
              checked={!!paused}
              disabled={paused === undefined || savingPaused}
              onCheckedChange={(checked) => void handlePaused(checked)}
            />
          </BeheerRow>
        </BeheerRows>
      </BeheerCard>

      <BeheerCard title="Gegevens">
        <BeheerRows>
          <BeheerRow key="reload-teams" leading={<RefreshCwIcon className={ROW_ICON} />} title="Teams herladen uit API" meta="Reset alle ingevulde deelgebieden. Kan niet ongedaan worden gemaakt.">
            <Pill variant="danger-soft" onClick={() => setReloadOpen(true)}>
              Herladen
            </Pill>
          </BeheerRow>
        </BeheerRows>
      </BeheerCard>

      <DemoModeDialog open={demoOpen} onOpenChange={setDemoOpen} />
      <ReloadTeamsDialog open={reloadOpen} onOpenChange={setReloadOpen} />
    </BeheerPane>
  );
}
