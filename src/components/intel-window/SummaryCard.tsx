import { BeheerCard } from '@/components/beheer/BeheerLayout';

/** The AI summary (S1): plain card, no icon, a muted note that it was made automatically */
export default function SummaryCard({ summary }: { summary?: string }) {
  if (!summary) return null;
  return (
    <BeheerCard title="Samenvatting" right={<span className="text-xs text-muted-foreground">automatisch · kan fouten bevatten</span>}>
      <p className="px-1 text-sm leading-relaxed">{summary}</p>
    </BeheerCard>
  );
}
