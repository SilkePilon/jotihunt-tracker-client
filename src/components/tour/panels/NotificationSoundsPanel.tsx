import { useEffect, useRef, useState, type ComponentType } from 'react';
import { BellRingIcon, FlagIcon, MegaphoneIcon, NewspaperIcon, PlayIcon, PuzzleIcon, SquareIcon, TimerIcon, Volume2Icon } from 'lucide-react';
import { playNotificationSound } from '@/lib/notification-sounds';
import type { SoundKey } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import useSettingsStore from '@/stores/settings.store';

interface SoundItem {
  key: SoundKey;
  label: string;
  when: string;
  icon: ComponentType<{ className?: string }>;
  /** Icon circle colours */
  tone: string;
}

/** Most important first, the same order the app uses when several arrive at once. */
const SOUNDS: SoundItem[] = [
  { key: 'fox-green', label: 'Vos op groen', when: 'Jagen mag! Het belangrijkste geluid.', icon: FlagIcon, tone: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  { key: 'broadcast', label: 'Bericht van HQ', when: 'Altijd aan. Lees het bericht meteen.', icon: MegaphoneIcon, tone: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' },
  { key: 'deadline', label: 'Hunt deadline', when: 'Nog 10 minuten om een hunt in te sturen.', icon: TimerIcon, tone: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  { key: 'fox-status', label: 'Vos rood of oranje', when: 'Een deelgebied verandert van status.', icon: BellRingIcon, tone: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
  { key: 'hint', label: 'Nieuwe hint', when: 'De organisatie heeft een hint gepubliceerd.', icon: PuzzleIcon, tone: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  { key: 'article', label: 'Opdracht of nieuws', when: 'Een nieuwe opdracht of nieuwsbericht.', icon: NewspaperIcon, tone: 'bg-muted text-muted-foreground' },
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
                  'flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:bg-muted/60',
                  active && 'border-primary/40 bg-primary/10 hover:bg-primary/10',
                )}
              >
                <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', tone, active && 'animate-pulse')}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-tight">{label}</span>
                  <span className="block text-xs text-muted-foreground">{when}</span>
                </span>
                <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border', active ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground')}>
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
