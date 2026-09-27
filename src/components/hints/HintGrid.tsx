import { CheckIcon, TriangleAlertIcon } from 'lucide-react';
import { HintArticle, HintCell } from '@/types/HintCell';
import { areaOptions, cn, getColorFromArea } from '@/lib/utils';
import { formatCountdown, remainingMs } from '@/lib/hints';

export type CellKey = { articleId: number; area: string };

interface HintGridProps {
  articles: HintArticle[];
  cells: HintCell[];
  now: number;
  selected?: CellKey;
  onSelect: (key: CellKey) => void;
}

const statusClass: Record<HintCell['status'], string> = {
  open: 'bg-muted hover:bg-muted/70',
  solving: 'bg-amber-200 hover:bg-amber-300 dark:bg-amber-900 dark:hover:bg-amber-800',
  solved: 'bg-green-200 hover:bg-green-300 dark:bg-green-900 dark:hover:bg-green-800',
  none: 'bg-background border border-dashed text-muted-foreground',
};

export default function HintGrid({ articles, cells, now, selected, onSelect }: HintGridProps) {
  const cellsByKey = new Map(cells.map((cell) => [`${cell.articleId}:${cell.area}`, cell]));

  return (
    <table className="w-full border-separate border-spacing-1 text-sm">
      <thead>
        <tr>
          <th className="p-2 text-left">Hint</th>
          {areaOptions.map((area) => (
            <th key={area.value} className="p-2 font-medium">
              <span className="mr-1 inline-block size-2 rounded-full" style={{ backgroundColor: getColorFromArea(area.value) }} />
              {area.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {articles.map((article) => (
          <tr key={article.id}>
            <td className="p-2 whitespace-nowrap align-top">
              <div className="font-medium">
                {new Date(article.publishAt).toLocaleString('nl-NL', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="max-w-40 truncate text-xs text-muted-foreground">{article.title}</div>
            </td>
            {areaOptions.map((area) => {
              const cell = cellsByKey.get(`${article.id}:${area.value}`);
              if (!cell) return <td key={area.value} />;
              const left = remainingMs(cell.publishAt, now);
              const showTimer = (cell.status === 'open' || cell.status === 'solving') && left > 0;
              const isSelected = selected?.articleId === article.id && selected.area === area.value;
              return (
                <td key={area.value} className="p-0">
                  <button
                    type="button"
                    onClick={() => onSelect({ articleId: article.id, area: area.value })}
                    className={cn(
                      'flex h-16 w-full flex-col justify-between rounded-md p-2 text-left transition-colors',
                      statusClass[cell.status],
                      isSelected && 'ring-2 ring-primary',
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs">{cell.status === 'none' ? 'geen hint' : (cell.claimedBy?.name ?? '')}</span>
                      {cell.check === 'verified' && (
                        <CheckIcon className="size-4 text-green-700 dark:text-green-400" role="img" aria-label="Klopt" />
                      )}
                      {cell.check === 'disputed' && <TriangleAlertIcon className="size-4 text-red-600" role="img" aria-label="Twijfel" />}
                    </div>
                    <div className="flex items-end justify-between gap-1 text-xs">
                      <span className="truncate font-mono">{cell.status === 'solved' ? cell.answer : ''}</span>
                      {showTimer && (
                        <span className={cn('font-mono', left < 5 * 60 * 1000 && 'font-bold text-red-600')}>{formatCountdown(left)}</span>
                      )}
                    </div>
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
