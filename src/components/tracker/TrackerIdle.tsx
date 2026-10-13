import { SmartphoneIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppRelease } from '@/hooks/app-pairing.hook';
import { absoluteUrl } from '@/lib/app-pairing';
import { inlineLinkClass } from './styles';

const apiBase = import.meta.env.API_BASE_URL;

interface TrackerIdleProps {
  onPair: () => void;
  /** Opens the Traccar Client guide (iPhone) */
  onOpenGuide: () => void;
}

/** Not paired: one button, plus the APK download and the iPhone (Traccar) route as links. */
export default function TrackerIdle({ onPair, onOpenGuide }: TrackerIdleProps) {
  const { release } = useAppRelease();
  return (
    <div className="flex flex-col gap-2.5" data-tracker-state="idle">
      <p className="text-xs text-muted-foreground">Deel je locatie met het team zodat iedereen ziet waar je bent.</p>
      <Button size="lg" onClick={onPair}>
        <SmartphoneIcon />
        Koppel je telefoon
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {release && (
          <>
            Nog geen app?{' '}
            <a className={inlineLinkClass} href={absoluteUrl(apiBase, release.url, window.location.origin)} download>
              Download ({release.versionName})
            </a>
            {' · '}
          </>
        )}
        iPhone?{' '}
        <button type="button" className={inlineLinkClass} onClick={onOpenGuide}>
          Traccar
        </button>
      </p>
    </div>
  );
}
