import {
    BugIcon,
    CogIcon,
    DownloadIcon,
    KeyIcon,
    LogOutIcon,
    CompassIcon,
    BellIcon,
    Volume2Icon,
} from 'lucide-react';
import {siDiscord} from "simple-icons"
import {Button} from './ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import useSettingsStore from '@/stores/settings.store';
import {User} from '@/types/User';
import usePWA from 'react-pwa-install-prompt';
import {Dialog, DialogTrigger} from './ui/dialog';
import DebugInfo from './DebugInfo';
import ResetPassword from './ResetPassword';
import {useState} from 'react';
import useNotificationsDialogStore from '@/stores/notifications-dialog.store';
import useSettingsMenuStore from '@/stores/settings-menu.store';
import useTourStore from '@/components/tour/tour.store';
import {tourTarget} from '@/components/tour/targets';
import {useLogout} from '@/hooks/logout.hook';
import LayersSubmenu from './settings/LayersSubmenu';
import MapStyleSubmenu from './settings/MapStyleSubmenu';
import AdminSubmenu from './settings/AdminSubmenu';
import ReloadTeamsDialog from './settings/ReloadTeamsDialog';
import DemoModeDialog from './settings/DemoModeDialog';

const DISCORD_URL = import.meta.env.DISCORD_URL;

interface SettingsProps {
    /** Shows a "Rondleiding opnieuw" item when given */
    onReplayTour?: () => void;
}

export default function Settings({onReplayTour}: SettingsProps) {
    const menuOpen = useSettingsMenuStore((state) => state.open);
    const setMenuOpen = useSettingsMenuStore((state) => state.setOpen);

    // While the tour shows this menu, clicks on the tour card count as "outside"; the tour closes it itself
    function handleMenuOpenChange(open: boolean) {
        if (!open && useTourStore.getState().active) return;
        setMenuOpen(open);
    }

    const openNotifications = useNotificationsDialogStore((state) => state.setOpen);
    const soundMuted = useSettingsStore((state) => state.soundMuted);
    const setSoundMuted = useSettingsStore((state) => state.setSoundMuted);
    const {isStandalone, isInstallPromptSupported, promptInstall} = usePWA();
    const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
    const [reloadTeamsOpen, setReloadTeamsOpen] = useState(false);
    const [demoDialogOpen, setDemoDialogOpen] = useState(false);

    const auth = useAuthUser<User>();
    const logout = useLogout();

    return (
        <Dialog>
            <DropdownMenu modal={false} open={menuOpen} onOpenChange={handleMenuOpenChange}>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" aria-label="Instellingen">
                        <CogIcon/>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Hoi, {auth?.name}</DropdownMenuLabel>
                    <DropdownMenuSeparator/>
                    {!isStandalone && isInstallPromptSupported && (
                        <DropdownMenuItem onClick={promptInstall}>
                            <DownloadIcon/>
                            Installeer app
                        </DropdownMenuItem>
                    )}
                    <LayersSubmenu/>
                    <MapStyleSubmenu/>
                    <DropdownMenuSeparator/>
                    <DropdownMenuItem onClick={() => openNotifications(true)}>
                        <BellIcon/>
                        Meldingen
                    </DropdownMenuItem>
                    <DropdownMenuCheckboxItem checked={!soundMuted}
                                              onCheckedChange={(checked) => setSoundMuted(!checked)}
                                              onSelect={(e) => e.preventDefault()}>
                        <Volume2Icon/>
                        Geluid
                    </DropdownMenuCheckboxItem>
                    {onReplayTour && (
                        <DropdownMenuItem {...tourTarget('settings.replayItem')} onClick={() => {
                            setMenuOpen(false);
                            onReplayTour();
                        }}>
                            <CompassIcon/>
                            Rondleiding opnieuw
                        </DropdownMenuItem>
                    )}
                    {auth?.admin && (
                        <>
                            <AdminSubmenu onToggleDemo={() => setDemoDialogOpen(true)}
                                          onReloadTeams={() => setReloadTeamsOpen(true)}/>
                            <DialogTrigger asChild>
                                <DropdownMenuItem>
                                    <BugIcon/>
                                    Debug
                                </DropdownMenuItem>
                            </DialogTrigger>
                            <DropdownMenuSeparator/>
                        </>
                    )}
                    {DISCORD_URL && (
                        <DropdownMenuItem asChild>
                            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
                                <span className={"fill-foreground"} dangerouslySetInnerHTML={{__html: siDiscord.svg}}></span>
                                Join de Discord
                            </a>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setResetPasswordOpen(true)}>
                        <KeyIcon/> Wachtwoord wijzigen
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-500" onClick={logout}>
                        <LogOutIcon/>
                        Uitloggen
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <ResetPassword open={resetPasswordOpen} setIsOpen={setResetPasswordOpen} allowClose={true}/>
            <DebugInfo/>
            <ReloadTeamsDialog open={reloadTeamsOpen} onOpenChange={setReloadTeamsOpen}/>
            <DemoModeDialog open={demoDialogOpen} onOpenChange={setDemoDialogOpen}/>
        </Dialog>
    );
}
