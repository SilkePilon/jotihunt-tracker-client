import { FlaskConicalIcon, MapPinnedIcon, MegaphoneIcon, MonitorIcon, RefreshCwIcon, ShieldIcon, SparklesIcon, UsersIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import useAdminStore from '@/stores/admin.store';
import { useDemo } from '@/hooks/demo.hook';
import { usePredictionSetting } from '@/hooks/predictions.hook';

interface AdminSubmenuProps {
  /** Open the demo mode confirmation (the dialog lives outside the menu so it survives the menu closing) */
  onToggleDemo: () => void;
  /** Open the reload-teams confirmation */
  onReloadTeams: () => void;
}

/** Settings → Admin tools: admin dialogs, demo mode, the AI prediction switch and reloading teams. */
export default function AdminSubmenu({ onToggleDemo, onReloadTeams }: AdminSubmenuProps) {
  const openAdminDialog = useAdminStore((state) => state.openDialog);
  const { demo } = useDemo();
  const { enabled: predictionEnabled, setEnabled: setPredictionEnabled } = usePredictionSetting();

  async function handleTogglePrediction(enabled: boolean) {
    try {
      await setPredictionEnabled(enabled);
    } catch {
      toast.error('AI-voorspelling wisselen is mislukt');
    }
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <ShieldIcon />
        Admin tools
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          <DropdownMenuItem onClick={() => openAdminDialog('hunters')}>
            <MapPinnedIcon />
            Hunters
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openAdminDialog('users')}>
            <UsersIcon />
            Gebruikers
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openAdminDialog('broadcast')}>
            <MegaphoneIcon />
            Bericht versturen
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.open('/hq', '_blank', 'noopener')}>
            <MonitorIcon />
            HQ-scherm
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={!!demo?.enabled} disabled={!demo} onCheckedChange={onToggleDemo}>
            <FlaskConicalIcon />
            Demo mode
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={predictionEnabled !== false}
            disabled={predictionEnabled === undefined}
            onCheckedChange={(checked) => void handleTogglePrediction(checked)}
            onSelect={(e) => e.preventDefault()}
          >
            <SparklesIcon />
            AI-voorspelling
          </DropdownMenuCheckboxItem>
          <DropdownMenuItem onClick={onReloadTeams}>
            <RefreshCwIcon />
            Herlaad teams uit API
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
