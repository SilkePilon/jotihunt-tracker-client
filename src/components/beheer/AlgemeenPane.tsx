import { useState } from 'react';
import { toast } from 'sonner';
import { MonitorPlayIcon, PauseIcon, RefreshCwIcon, SparklesIcon } from 'lucide-react';
import DemoModeDialog from '@/components/settings/DemoModeDialog';
import ReloadTeamsDialog from '@/components/settings/ReloadTeamsDialog';
import { useDemo } from '@/hooks/demo.hook';
import { useInvitesPaused } from '@/hooks/invites.hook';
import { usePredictionSetting } from '@/hooks/predictions.hook';
import { BeheerCard, BeheerPane, BeheerRow, BeheerRows } from './BeheerLayout';
import BeheerSwitch from './controls/BeheerSwitch';
import { Pill } from './controls/Pill';

/** Leading icon of a settings row (muted, like the mockup) */
const ROW_ICON = 'size-[18px] shrink-0 text-muted-foreground';

/** Beheer → Algemeen: switches that apply to everyone, and reloading the teams. */
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
