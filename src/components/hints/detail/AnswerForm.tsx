import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRdPreview } from '@/hooks/hints.hook';

interface AnswerFormProps {
  answer: string;
  onAnswerChange: (answer: string) => void;
  busy: boolean;
  onSubmit: () => void;
}

export default function AnswerForm({ answer, onAnswerChange, busy, onSubmit }: AnswerFormProps) {
  const rd = useRdPreview(answer);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (answer.trim()) onSubmit();
      }}
    >
      <label className="sr-only" htmlFor="hint-answer">
        Antwoord
      </label>
      <div className="flex gap-2">
        <Input
          id="hint-answer"
          value={answer}
          onChange={(event) => onAnswerChange(event.target.value)}
          placeholder="1234 5678 of woord"
          maxLength={200}
          autoComplete="off"
          className="font-mono"
        />
        <Button type="submit" disabled={busy || !answer.trim()}>
          Oplossen
        </Button>
      </div>
      <p className="min-h-4 text-xs text-muted-foreground">
        {rd ? (
          <>
            RD {rd.x}, {rd.y} → {rd.lat.toFixed(5)}, {rd.lng.toFixed(5)} · <span className="font-medium text-foreground">wordt hint-marker</span>
          </>
        ) : answer.trim() ? (
          'Geen coördinaat: wordt als tekst-antwoord opgeslagen.'
        ) : (
          ''
        )}
      </p>
    </form>
  );
}
