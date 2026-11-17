// src/components/android-promo/AndroidPromoDialog.tsx
import { useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BellIcon, CarIcon, LayoutGridIcon, MapPinIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { toast } from 'sonner';
import { useMarkerPalette } from '@/components/layers/marker-icons';
import { useAppRelease, usePairingCode } from '@/hooks/app-pairing.hook';
import { useAccount } from '@/hooks/account.hook';
import { absoluteUrl, buildPairingUrl } from '@/lib/app-pairing';
import { DIALOG_SHELL } from '@/lib/dialog-shell';
import { SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useBackEntry } from '@/hooks/back-entry.hook';
import useAndroidPromoStore from '@/stores/android-promo.store';
import AndroidPromoHero from './AndroidPromoHero';
import DownloadSplitButton from './DownloadSplitButton';
import { usePairLaunch } from './pair-launch';
import { AutoHeight, DoneStep, DownloadingStep, InstallStep, PairStep, StepClose, Stepper } from './PromoSteps';

const apiBase: string = import.meta.env.API_BASE_URL;

/** The dialog's cap: the dynamic viewport minus the safe areas and a 16px margin on both ends */
const PROMO_SCROLL = 'max-h-[calc(100dvh-32px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain';

/** The one-time Android-app popup (design B + split button), see the android-app-promo spec. */
export default function AndroidPromoDialog() {
  const { open, step, setStep, close, neverWithUndo } = useAndroidPromoStore();
  // Phones: Back closes the popup (as "Later", or "paired" once done) instead of leaving the site
  useBackEntry('android-promo', open, () => close(step === 'done' ? 'paired' : 'later'));
  const { release } = useAppRelease();
  const { account, refresh } = useAccount(open);
  const { create } = usePairingCode();
  const deviceCount = account?.devices.length;
  // Closing before the end = remind later; after pairing = never again
  const dismiss = () => close(step === 'done' ? 'paired' : 'later');

  // Stable callback: PairStep uses it as an effect dep (a new arrow per render would restart its effect)
  const onPaired = useCallback(() => setStep('done'), [setStep]);

  const releaseHref = release ? absoluteUrl(apiBase, release.url, window.location.origin) : '';
  const download = useCallback(() => {
    if (!releaseHref) return;
    const a = document.createElement('a');
    a.href = releaseHref;
    a.download = '';
    a.click();
    setStep('download');
  }, [releaseHref, setStep]);

  const pair = usePairLaunch(
    async () => {
      const pairing = await create();
      return pairing ? buildPairingUrl(apiBase, pairing.code, window.location.origin) : null;
    },
    () => {
      const { open: stillOpen, step: current } = useAndroidPromoStore.getState();
      return stillOpen && current === 'pair';
    },
  );
  const startPair = () => {
    pair.start();
    setStep('pair');
  };

  // "Niet meer tonen" is easy to tap by mistake: an undo, and where the app can still be found
  const never = () => {
    const undo = neverWithUndo();
    toast('Deze popup komt niet meer terug', {
      description: 'De app download je ook via Mijn tracker in de zijbalk.',
      action: { label: 'Ongedaan maken', onClick: undo },
    });
  };

  const shown = open && !!release;

  // Radix Dialog for the focus trap, Escape, outside click and focus restore; forceMount + asChild hand the mount and
  // unmount to AnimatePresence so the motion enter/exit stays.
  return (
    <DialogPrimitive.Root open={shown} onOpenChange={(next) => !next && dismiss()}>
      <AnimatePresence>
        {open && release && (
          <DialogPrimitive.Portal key="android-promo" forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div key="scrim" className="fixed inset-0 z-50 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                key="dialog"
                className={cn(DIALOG_SHELL, 'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-[360px] overflow-hidden bg-beheer-window outline-none')}
                initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-46%' }}
                animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-48%' }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              >
                <DialogPrimitive.Title className="sr-only">Android-app</DialogPrimitive.Title>
                {/* Short screens (landscape phone): the dialog stops 16px from the safe area and its content scrolls inside */}
                <AutoHeight scrollClassName={PROMO_SCROLL}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={step} {...SWAP}>
                      {step === 'intro' ? (
                        <>
                          <AndroidPromoHero onClose={() => close('later')} />
                          <div className="px-5 pb-4 pt-[18px]">
                            <b className="block text-xl leading-tight">De Jotihunt-app voor Android</b>
                            <p className="mb-3 mt-1.5 text-[13.5px] text-muted-foreground">Je telefoon als tracker, ook als het scherm uit is.</p>
                            <FeatureChips />
                            <DownloadSplitButton version={release.versionName} onDownload={download} onLater={() => close('later')} onNever={never} />
                          </div>
                        </>
                      ) : (
                        <div className="p-5">
                          {/* Sticks while the step scrolls, so its close button stays in reach */}
                          <div className="sticky top-0 z-10 -mx-5 -mt-5 flex items-center gap-3 bg-beheer-window px-5 pb-3.5 pt-5">
                            {step === 'done' ? <span className="flex-1" /> : <Stepper step={step} />}
                            <StepClose onClose={dismiss} />
                          </div>
                          {step === 'download' && <DownloadingStep href={releaseHref} onNext={() => setStep('install')} />}
                          {step === 'install' && <InstallStep onPair={startPair} onRedownload={download} />}
                          {step === 'pair' && (
                            <PairStep
                              phase={pair.phase}
                              startedAt={pair.startedAt}
                              onPhase={pair.setPhase}
                              onRetry={pair.start}
                              deviceCount={deviceCount}
                              refresh={() => void refresh()}
                              onPaired={onPaired}
                              onBack={() => setStep('install')}
                            />
                          )}
                          {step === 'done' && <DoneStep onClose={() => close('paired')} />}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </AutoHeight>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

function FeatureChips() {
  const p = useMarkerPalette();
  const chips = [
    { icon: MapPinIcon, label: 'Achtergrond-tracker', bg: p.secondaryContainer, fg: p.onSecondaryContainer },
    { icon: BellIcon, label: 'Meldingen', bg: p.warnContainer, fg: p.onWarnContainer },
    { icon: LayoutGridIcon, label: 'Widgets', bg: p.tertiaryContainer, fg: p.onTertiaryContainer },
    { icon: CarIcon, label: 'Android Auto', bg: p.primaryContainer, fg: p.onPrimaryContainer },
  ];
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {chips.map(({ icon: Icon, label, bg, fg }) => (
        <span key={label} className="inline-flex h-8 items-center gap-1.5 rounded-full pl-2 pr-3 text-[12.5px] font-semibold" style={{ background: bg, color: fg }}>
          <Icon className="size-4" /> {label}
        </span>
      ))}
    </div>
  );
}
