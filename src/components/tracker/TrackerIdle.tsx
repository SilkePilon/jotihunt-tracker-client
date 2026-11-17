import { SmartphoneIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppRelease } from '@/hooks/app-pairing.hook';
import { absoluteUrl } from '@/lib/app-pairing';
import { COARSE_HIT_AREA } from '@/lib/hit-area';
import { IOS_PAIR_LABEL } from '@/lib/tracker';
import { cn } from '@/lib/utils';
import { inlineLinkClass } from './styles';

const apiBase = import.meta.env.API_BASE_URL;

interface TrackerIdleProps {
  onPair: () => void;
  /** Opens the Traccar Client guide (iPhone) */
  onOpenGuide: () => void;
  /** An iPhone/iPad: no Android app, so the main action is the Traccar guide and the APK line is left out */
  ios?: boolean;
}

/** Not paired: one button, plus the APK download and the iPhone (Traccar) route as links. */
export default function TrackerIdle({ onPair, onOpenGuide, ios = false }: TrackerIdleProps) {
  const { release } = useAppRelease();
  // 44px touch areas around the small inline links; isolate keeps them above the card's background
  const link = cn(inlineLinkClass, COARSE_HIT_AREA);
  return (
    <div className="isolate flex flex-col gap-2.5" data-tracker-state="idle">
      <p className="text-xs text-muted-foreground">Deel je locatie met het team zodat iedereen ziet waar je bent.</p>
      {/* The card's main action: a full 44px on touch screens */}
      <Button size="lg" className="pointer-coarse:h-11" onClick={ios ? onOpenGuide : onPair}>
        <SmartphoneIcon />
        {ios ? IOS_PAIR_LABEL : 'Koppel je telefoon'}
      </Button>
      {!ios && (
        <p className="text-center text-xs text-muted-foreground">
          {release && (
            <>
              Nog geen app?{' '}
              <a className={link} href={absoluteUrl(apiBase, release.url, window.location.origin)} download>
                Download ({release.versionName})
              </a>
              {' · '}
            </>
          )}
          iPhone?{' '}
          <button type="button" className={link} onClick={onOpenGuide}>
            Traccar
          </button>
        </p>
      )}
    </div>
  );
}
