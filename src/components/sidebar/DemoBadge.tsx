import {useDemo} from '@/hooks/demo.hook';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';

export default function DemoBadge() {
    const {demo} = useDemo();
    if (!demo?.enabled) return null;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    className="shrink-0 rounded-badge bg-primary px-2 py-0.5 text-xs font-bold tracking-wide text-primary-foreground">
                    DEMO
                </span>
            </TooltipTrigger>
            <TooltipContent>Demo mode: dit zijn geen echte gegevens</TooltipContent>
        </Tooltip>
    );
}
