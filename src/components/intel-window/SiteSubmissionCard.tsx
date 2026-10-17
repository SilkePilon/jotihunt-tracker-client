import { BeheerCard } from '@/components/beheer/BeheerLayout';
import { ratingStars } from '@/lib/intel-window';
import type { AssignmentSite } from '@/types/Intel';

/**
 * What we handed in on jotihunt.nl: the photo (opens full size in a new tab), our star rating, the site's judgement and
 * the points once known.
 */
export default function SiteSubmissionCard({ site }: { site: AssignmentSite }) {
  return (
    <BeheerCard>
      <p className="mx-1 text-xs text-muted-foreground">Ingestuurd op jotihunt.nl</p>
      {site.imageUrl && (
        <a href={site.imageUrl} target="_blank" rel="noopener noreferrer" className="mt-2.5 block overflow-hidden rounded-2xl bg-beheer-row outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <img src={site.imageUrl} alt="Ingestuurde foto" loading="lazy" decoding="async" className="max-h-80 w-full object-cover transition-transform duration-300 hover:scale-[1.02]" />
        </a>
      )}
      <div className="mx-1 mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px]">
        {site.judgement && <span className="font-semibold">{site.judgement}</span>}
        {site.points !== null && <span className="font-semibold text-green-700 tabular-nums dark:text-green-300">{site.points} pt</span>}
        {site.rating !== null && (
          <span className="ml-auto text-amber-500" title={`Jullie waardering: ${site.rating} / 5`} aria-label={`Jullie waardering: ${site.rating} van 5`}>
            {ratingStars(site.rating)}
          </span>
        )}
      </div>
    </BeheerCard>
  );
}
