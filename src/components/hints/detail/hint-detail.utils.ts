import { HintStepNumber } from '@/lib/hints';

export const STEP_LABELS: Record<HintStepNumber, string> = { 1: 'Claimen', 2: 'Oplossen', 3: 'Controleren' };
export const STEPS: HintStepNumber[] = [1, 2, 3];

export const formatTime = (date: string) => new Date(date).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
