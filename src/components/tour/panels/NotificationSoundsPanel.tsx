import { useEffect, useRef, useState, type ComponentType } from 'react';
import { PlayIcon, SquareIcon, Volume2Icon } from 'lucide-react';
import { FoxIcon } from '@/components/MaterialGlyph';
import { NOTIFICATION_ICON } from '@/components/notifications/notification-icons';
import { playNotificationSound } from '@/lib/notification-sounds';
import type { SoundKey } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import useSettingsStore from '@/stores/settings.store';

interface SoundItem {
  key: SoundKey;
  label: string;
  when: string;
  icon: ComponentType<{ className?: string }>;
  /** Icon circle colours: the app's fox-status, Intel and toast tile tokens (on-colour >= 4.5:1 on its container) */
  tone: string;
}

/** Most important first, the same order the app uses when several arrive at once. */
const SOUNDS: SoundItem[] = [
  { key: 'fox-green', label: 'Vos op groen', when: 'Jagen mag! Het belangrijkste geluid.', icon: NOTIFICATION_ICON['fox-status'], tone: 'bg-fox-ok-container text-fox-on-ok' },
  { key: 'counter-hunt', label: 'Tegenhunt', when: 'Er is een tegenhunt bij ons clubhuis, met de richting.', icon: NOTIFICATION_ICON['counter-hunt'], tone: 'bg-fox-error-container text-fox-on-error' },
  { key: 'broadcast', label: 'Bericht van HQ', when: 'Altijd aan. Lees het bericht meteen.', icon: NOTIFICATION_ICON.broadcast, tone: 'bg-(--intel-news-container) text-(--intel-news)' },
  { key: 'happy-hour', label: 'Happy hour', when: 'Hunts tellen dubbel. Tegenhunts tellen niet mee.', icon: NOTIFICATION_ICON['happy-hour'], tone: 'bg-[color-mix(in_oklab,var(--happy-hour)_22%,var(--card))] text-status-warn-text' },
  { key: 'hunt', label: 'Hunt', when: 'Een hunt komt binnen op jotihunt.nl of is beoordeeld.', icon: FoxIcon, tone: 'bg-primary-container text-on-primary-container' },
  { key: 'fox-status', label: 'Vos rood of oranje', when: 'Een deelgebied verandert van status.', icon: NOTIFICATION_ICON['fox-status'], tone: 'bg-fox-warn-container text-fox-on-warn' },
  { key: 'hint', label: 'Nieuwe hint', when: 'De organisatie heeft een hint gepubliceerd.', icon: NOTIFICATION_ICON.hint, tone: 'bg-(--intel-hint-container) text-(--intel-hint)' },
  { key: 'article', label: 'Opdracht of nieuws', when: 'Een nieuwe opdracht of nieuwsbericht.', icon: NOTIFICATION_ICON.article, tone: 'bg-muted text-muted-foreground' },
];

/** Tour step: try every notification sound, so users recognise them on the road without looking. */
export default function NotificationSoundsPanel() {
  const soundMuted = useSettingsStore((state) => state.soundMuted);
  const [playing, setPlaying] = useState<SoundKey | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  function stop() {
    audio.current?.pause();
    audio.current = null;
    setPlaying(null);
  }

  function play(key: SoundKey) {
    const wasPlaying = playing === key;
    stop();
    if (wasPlaying) return;
    const element = playNotificationSound(key);
    element.addEventListener('ended', () => {
      if (audio.current === element) stop();
    });
    audio.current = element;
    setPlaying(key);
  }

  // Leaving the step stops the sound
  useEffect(() => () => audio.current?.pause(), []);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Volume2Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold leading-tight">Leer de geluiden</p>
          <p className="text-xs text-muted-foreground">Tik op een melding om te horen hoe hij klinkt.</p>
        </div>
      </div>
      <ul className="flex flex-col gap-1">
        {SOUNDS.map(({ key, label, when, icon: Icon, tone }) => {
          const active = playing === key;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => play(key)}
                aria-pressed={active}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset',
                  active && 'border-primary/40 bg-primary/10 hover:bg-primary/10',
                )}
              >
                <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', tone, active && 'motion-safe:animate-pulse')}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-tight">{label}</span>
                  <span className="block text-xs text-muted-foreground">{when}</span>
                </span>
                <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border', active ? 'border-primary-text bg-primary-text text-primary-foreground dark:border-primary dark:bg-primary' : 'text-muted-foreground')}>
                  {active ? <SquareIcon className="size-3 fill-current" /> : <PlayIcon className="size-3.5 fill-current" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
        {soundMuted ? 'Geluid staat nu uit. Zet het aan via Instellingen → Geluid, anders hoor je deze meldingen niet.' : 'Tip: zet je telefoon tijdens de hunt niet op stil, en het volume omhoog.'}
      </p>
    </div>
  );
}
