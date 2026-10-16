import {
    BugIcon,
    Settings2Icon,
    DownloadIcon,
    LogOutIcon,
    CompassIcon,
    BellIcon,
    Volume2Icon,
    VolumeXIcon,
    UserRoundIcon,
    ShieldIcon,
} from 'lucide-react';
import {siDiscord} from "simple-icons"
import {cn} from '@/lib/utils';
import {HEADER_BUTTON} from './sidebar/header-button';
import {DropdownMenu, DropdownMenuContent, DropdownMenuTrigger} from './ui/dropdown-menu';
import {AnimatePresence, motion} from 'motion/react';
import {SWAP} from '@/lib/motion';
import {MenuRow, MenuRows, MenuTile} from './settings/menu-parts';
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
import {useAppConfig} from '@/hooks/app-config.hook';

interface SettingsProps {
    /** Shows a "Rondleiding opnieuw" item when given */
    onReplayTour?: () => void;
}

export default function Settings({onReplayTour}: SettingsProps) {
    const menuOpen = useSettingsMenuStore((state) => state.open);
    const {discordUrl} = useAppConfig();
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
                <DropdownMenuContent align="start" className="w-[290px]">
                    {/* Quick tiles for what you change most */}
                    <div className={cn('mb-1.5 grid gap-1.5', onReplayTour ? 'grid-cols-3' : 'grid-cols-2')}>
                        <MenuTile onSelect={(e) => {
                            e.preventDefault();
                            setSoundMuted(!soundMuted);
                        }}
                                  className={cn(!soundMuted && 'bg-(--map-selected-bg) text-(--map-selected-fg) focus:bg-(--map-selected-bg) focus:text-(--map-selected-fg)')}>
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.span key={soundMuted ? 'off' : 'on'} {...SWAP} className="flex flex-col items-center gap-1.5">
                                    {soundMuted ? <VolumeXIcon className="size-5"/> : <Volume2Icon className="size-5 text-current"/>}
                                    {soundMuted ? 'Geluid uit' : 'Geluid aan'}
                                </motion.span>
                            </AnimatePresence>
                        </MenuTile>
                        <MenuTile onClick={() => openNotifications(true)}>
                            <BellIcon className="size-5"/>
                            Meldingen
                        </MenuTile>
                        {onReplayTour && (
                            <MenuTile {...tourTarget('settings.replayItem')} onClick={() => {
                                setMenuOpen(false);
                                onReplayTour();
                            }}>
                                <CompassIcon className="size-5"/>
                                Rondleiding
                            </MenuTile>
                        )}
                    </div>

                    <MenuRows>
                        <MenuRow onClick={() => openAccount(true)}>
                            <UserRoundIcon/>
                            Account
                            <span className="ml-auto truncate text-xs font-medium text-muted-foreground">
                                {auth?.name}{auth?.admin && ' · Admin'}
                            </span>
                        </MenuRow>
                        {!isStandalone && isInstallPromptSupported && (
                            <MenuRow onClick={promptInstall}>
                                <DownloadIcon/>
                                Installeer app
                            </MenuRow>
                        )}
                        {/* Desktop has the layers button on the map; phones have no map controls */}
                        {isMobile && (
                            <>
                                <LayersSubmenu/>
                                <MapStyleSubmenu/>
                            </>
                        )}
                        {auth?.admin && (
                            <>
                                <MenuRow onClick={() => {
                                    setMenuOpen(false);
                                    openAdminDialog('algemeen');
                                }}>
                                    <ShieldIcon/>
                                    Beheer
                                </MenuRow>
                                <DialogTrigger asChild>
                                    <MenuRow>
                                        <BugIcon/>
                                        Debug
                                    </MenuRow>
                                </DialogTrigger>
                            </>
                        )}
                        {discordUrl && (
                            <MenuRow asChild>
                                <a href={discordUrl} target="_blank" rel="noopener noreferrer">
                                    <span className={"fill-muted-foreground [&>svg]:size-4"} dangerouslySetInnerHTML={{__html: siDiscord.svg}}></span>
                                    Join de Discord
                                </a>
                            </MenuRow>
                        )}
                    </MenuRows>

                    <MenuRows className="mt-1.5">
                        <MenuRow variant="destructive" onClick={logout}>
                            <LogOutIcon/>
                            Uitloggen
                        </MenuRow>
                    </MenuRows>
                </DropdownMenuContent>
            </DropdownMenu>

            <DebugInfo/>
        </Dialog>
    );
}
