import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface IconActionProps {
  /** Tooltip text, also the aria-label unless `ariaLabel` is given */
  label: string;
  /** The icon */
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'icon-xs' | 'icon-sm' | 'icon';
  ariaLabel?: string;
  /** Render as a link that opens in a new tab instead of a button */
  href?: string;
}

/** Small outline icon button (or external link) with a tooltip. */
export default function IconAction({ label, children, onClick, disabled, size = 'icon-xs', ariaLabel, href }: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <Button variant="outline" size={size} aria-label={ariaLabel ?? label} asChild>
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          </Button>
        ) : (
          <Button type="button" variant="outline" size={size} aria-label={ariaLabel ?? label} onClick={onClick} disabled={disabled}>
            {children}
          </Button>
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
