import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import DemoModeDialog from '@/components/settings/DemoModeDialog';
import ReloadTeamsDialog from '@/components/settings/ReloadTeamsDialog';
import { useDemo } from '@/hooks/demo.hook';
import { useInvitesPaused } from '@/hooks/invites.hook';
import { usePredictionSetting } from '@/hooks/predictions.hook';
import { BeheerGroup, BeheerPane, BeheerRow } from './BeheerLayout';

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
      <BeheerGroup title="Functies">
        <AnimatePresence initial={false}>
          <BeheerRow key="prediction" title="AI-voorspelling" meta="Laat Gemini bij elke hint voorspellen waar de vos zit.">
            <Switch
              aria-label="AI-voorspelling"
              checked={predictionEnabled !== false}
              disabled={predictionEnabled === undefined || savingPrediction}
              onCheckedChange={(checked) => void handlePrediction(checked)}
            />
          </BeheerRow>
          <BeheerRow key="demo" title="Demo mode" meta="Iedereen ziet demo-gegevens. De echte gegevens blijven bewaard.">
            {/* Stays as it is until the confirmation switches demo mode (and reloads the page) */}
            <Switch aria-label="Demo mode" checked={!!demo?.enabled} disabled={!demo} onCheckedChange={() => setDemoOpen(true)} />
          </BeheerRow>
          <BeheerRow key="invites-paused" title="Invites pauzeren" meta="Alle invite-links werken tijdelijk niet.">
            <Switch
              aria-label="Invites pauzeren"
              checked={!!paused}
              disabled={paused === undefined || savingPaused}
              onCheckedChange={(checked) => void handlePaused(checked)}
            />
          </BeheerRow>
        </AnimatePresence>
      </BeheerGroup>

      <BeheerGroup title="Gegevens">
        <AnimatePresence initial={false}>
          <BeheerRow key="reload-teams" title="Teams herladen uit API" meta="Reset alle ingevulde deelgebieden. Kan niet ongedaan worden gemaakt.">
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setReloadOpen(true)}>
              Herladen
            </Button>
          </BeheerRow>
        </AnimatePresence>
      </BeheerGroup>

      <DemoModeDialog open={demoOpen} onOpenChange={setDemoOpen} />
      <ReloadTeamsDialog open={reloadOpen} onOpenChange={setReloadOpen} />
    </BeheerPane>
  );
}
