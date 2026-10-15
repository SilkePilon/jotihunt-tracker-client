import {
    BugIcon,
    Settings2Icon,
    DownloadIcon,
    LogOutIcon,
    CompassIcon,
    BellIcon,
    Volume2Icon,
    UserRoundIcon,
    ShieldIcon,
} from 'lucide-react';
import {siDiscord} from "simple-icons"
import {cn} from '@/lib/utils';
import {HEADER_BUTTON} from './sidebar/header-button';
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
import useNotificationsDialogStore from '@/stores/notifications-dialog.store';
import useAccountDialogStore from '@/stores/account-dialog.store';
import useSettingsMenuStore from '@/stores/settings-menu.store';
import useTourStore from '@/components/tour/tour.store';
import {tourTarget} from '@/components/tour/targets';
import {useLogout} from '@/hooks/logout.hook';
import LayersSubmenu from './settings/LayersSubmenu';
import MapStyleSubmenu from './settings/MapStyleSubmenu';
import useAdminStore from '@/stores/admin.store';
import {useIsMobile} from '@/hooks/media.hook';

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
    const openAccount = useAccountDialogStore((state) => state.setOpen);
    const soundMuted = useSettingsStore((state) => state.soundMuted);
    const setSoundMuted = useSettingsStore((state) => state.setSoundMuted);
    const {isStandalone, isInstallPromptSupported, promptInstall} = usePWA();
    const openAdminDialog = useAdminStore((state) => state.openDialog);
    const isMobile = useIsMobile();

    const auth = useAuthUser<User>();
    const logout = useLogout();

    return (
        <Dialog>
            <DropdownMenu modal={false} open={menuOpen} onOpenChange={handleMenuOpenChange}>
                <DropdownMenuTrigger asChild>
                    {/* Right half of the header group; while open it turns light orange with all corners round */}
                    <button type="button" aria-label="Instellingen" title="Instellingen"
                            className={cn(HEADER_BUTTON, 'rounded-l-[6px] rounded-r-lg data-[state=open]:rounded-lg data-[state=open]:bg-(--map-selected-bg) data-[state=open]:text-(--map-selected-fg)')}>
                        <Settings2Icon className="size-[18px]"/>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Hoi, {auth?.name}</DropdownMenuLabel>
                    <DropdownMenuSeparator/>
                    <DropdownMenuItem onClick={() => openAccount(true)}>
                        <UserRoundIcon/>
                        Account
                    </DropdownMenuItem>
                    {!isStandalone && isInstallPromptSupported && (
                        <DropdownMenuItem onClick={promptInstall}>
                            <DownloadIcon/>
                            Installeer app
                        </DropdownMenuItem>
                    )}
                    {/* Desktop has the layers button on the map; phones have no map controls */}
                    {isMobile && (
                        <>
                            <LayersSubmenu/>
                            <MapStyleSubmenu/>
                        </>
                    )}
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
                            <DropdownMenuItem onClick={() => {
                                setMenuOpen(false);
                                openAdminDialog('algemeen');
                            }}>
                                <ShieldIcon/>
                                Beheer
                            </DropdownMenuItem>
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
                    <DropdownMenuItem className="text-red-500" onClick={logout}>
                        <LogOutIcon/>
                        Uitloggen
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <DebugInfo/>
        </Dialog>
    );
}
