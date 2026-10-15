// src/components/android-promo/AndroidPromoDialog.tsx
import { useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BellIcon, CarIcon, LayoutGridIcon, MapPinIcon } from 'lucide-react';
import { useMarkerPalette } from '@/components/layers/marker-icons';
import { useAppRelease, usePairingCode } from '@/hooks/app-pairing.hook';
import { useAccount } from '@/hooks/account.hook';
import { absoluteUrl, buildPairingUrl } from '@/lib/app-pairing';
import { SWAP } from '@/lib/motion';
import useAndroidPromoStore from '@/stores/android-promo.store';
import AndroidPromoHero from './AndroidPromoHero';
import DownloadSplitButton from './DownloadSplitButton';
import { DoneStep, DownloadingStep, InstallStep, PairStep, StepClose, Stepper } from './PromoSteps';

const apiBase: string = import.meta.env.API_BASE_URL;

/** The one-time Android-app popup (design B + split button), see the android-app-promo spec. */
export default function AndroidPromoDialog() {
  const { open, step, setStep, close } = useAndroidPromoStore();
  const { release } = useAppRelease();
  const { account, refresh } = useAccount(open);
  const { create } = usePairingCode();
  const deviceCount = account?.devices.length;
  // Closing before the end = remind later; after pairing = never again
  const dismiss = () => close(step === 'done' ? 'paired' : 'later');

  // Stable callbacks: the steps use them as effect deps (a new arrow per render would restart their timer/effect)
  const onDownloaded = useCallback(() => setStep('install'), [setStep]);
  const onPaired = useCallback(() => setStep('done'), [setStep]);

  const download = useCallback(() => {
    if (!release) return;
    const a = document.createElement('a');
    a.href = absoluteUrl(apiBase, release.url, window.location.origin);
    a.download = '';
    a.click();
    setStep('download');
  }, [release, setStep]);

  const openApp = useCallback(async () => {
    const pairing = await create();
    if (!pairing) return false;
    window.location.href = buildPairingUrl(apiBase, pairing.code, window.location.origin);
    return true;
  }, [create]);

  return (
    <AnimatePresence>
      {open && release && (
        <>
          <motion.div key="scrim" className="fixed inset-0 z-50 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={dismiss} />
          <motion.div
            key="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Android-app"
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-[360px] overflow-hidden rounded-[28px] bg-beheer-window"
            initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-46%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-48%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step} {...SWAP}>
                {step === 'intro' ? (
                  <>
                    <AndroidPromoHero onClose={() => close('later')} />
                    <div className="px-5 pb-4 pt-[18px]">
                      <b className="block text-xl leading-tight">De Jotihunt-app voor Android</b>
                      <p className="mb-3 mt-1.5 text-[13.5px] text-muted-foreground">Je telefoon als tracker, ook als het scherm uit is.</p>
                      <FeatureChips />
                      <DownloadSplitButton version={release.versionName} onDownload={download} onLater={() => close('later')} onNever={() => close('never')} />
                    </div>
                  </>
                ) : (
                  <div className="p-5">
                    <div className="mb-3.5 flex items-center gap-3">
                      {step === 'done' ? <span className="flex-1" /> : <Stepper step={step} />}
                      <StepClose onClose={dismiss} />
                    </div>
                    {step === 'download' && <DownloadingStep onDone={onDownloaded} />}
                    {step === 'install' && <InstallStep onPair={() => setStep('pair')} onRedownload={download} />}
                    {step === 'pair' && <PairStep openApp={openApp} deviceCount={deviceCount} refresh={() => void refresh()} onPaired={onPaired} onBack={() => setStep('install')} />}
                    {step === 'done' && <DoneStep onClose={() => close('paired')} />}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
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
