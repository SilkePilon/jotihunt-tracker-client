import {Outlet} from 'react-router';
import {toast} from "sonner"
import {useEffect, useRef, useState} from 'react';
import {SWRConfig} from 'swr';
import Map, {MapRef} from './components/Map';
import PWAPrompt from 'react-ios-pwa-prompt';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import {User} from './types/User';
import ResetPassword from './components/ResetPassword';
import HintBoardDialog from './components/hints/HintBoardDialog';
import HuntersDialog from './components/admin/HuntersDialog';
import DemoReloader from './components/DemoReloader';
import ErrorBoundary from './components/ErrorBoundary';
import StaleDataBadge from './components/StaleDataBadge';
import UsersDialog from './components/admin/UsersDialog';
import BroadcastDialog from './components/admin/BroadcastDialog';
import NotificationsDialog from './components/notifications/NotificationsDialog';
import {useNotificationsPrompt} from './components/notifications/useNotificationsPrompt';
import {useTheme} from "@/hooks/theme.hook.ts";
import {useNotificationFeed} from '@/hooks/notification-feed.hook';
import {useFetcher} from '@/hooks/utils/api.hook';
import {isUnauthorized} from '@/lib/session';
import {useSessionExpired} from '@/hooks/session.hook';
import {resyncPush} from '@/lib/push';
import type {OutletContextType} from '@/hooks/outlet.hook.ts';
import TourOverlay from './components/tour/TourOverlay';
import {useTourAutoStart} from './components/tour/useTour';

const FETCH_ERROR_TOAST_ID = 'fetch-error';
const ERROR_TOAST_COOLDOWN_MS = 60_000;

export default function Layout() {
    const endSession = useSessionExpired();
    const auth = useAuthUser<User>();
    const mapRef = useRef<MapRef>(null);
    const [resetPasswordOpen, setResetPasswordOpen] = useState(false);

    function sessionExpired() {
        toast.info("Je sessie is verlopen.", {
            id: 'session-expired',
            description: "Log opnieuw in om verder te gaan.",
            duration: Infinity
        })
        endSession();
    }

    useTheme();
    useNotificationFeed({onUnauthorized: sessionExpired});
    const {fetch} = useFetcher();
    useEffect(() => {
        void resyncPush(fetch);
        // Once per page load
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * If reset password is required, open the dialog.
     * It opens after the first commit on purpose: on phones the sidebar is a vaul bottom sheet, which is a
     * modal Radix layer and blocks pointer events and focus for every dialog that registered before it.
     * Opening one tick later puts the password dialog on top of the sheet.
     */
    const requiresPasswordChange = !!auth?.requiresPasswordChange;
    useEffect(() => {
        if (!requiresPasswordChange) return;
        const timeout = setTimeout(() => setResetPasswordOpen(true), 0);
        return () => clearTimeout(timeout);
    }, [requiresPasswordChange]);

    const tour = useTourAutoStart();
    useNotificationsPrompt(tour.pending || requiresPasswordChange);

    // When the fetch error toast was last shown, or null while none is up. A ref: every poll passes through here.
    const errorToastAt = useRef<number | null>(null);
    const lastErrorToastAt = useRef(0);

    function onSWRError(error: unknown) {
        // Only a 401 means the session is gone; 500/503, timeouts and network errors keep the user signed in
        if (isUnauthorized(error)) {
            sessionExpired();
            return;
        }
        // One toast at a time, and not again within a minute when the connection flaps
        if (errorToastAt.current !== null || Date.now() - lastErrorToastAt.current < ERROR_TOAST_COOLDOWN_MS) return;
        errorToastAt.current = lastErrorToastAt.current = Date.now();
        toast.error("Oeps! Er is iets misgegaan.", {
            id: FETCH_ERROR_TOAST_ID,
            duration: Infinity,
            description: 'Er is een fout opgetreden bij het ophalen van de data, probeer het later opnieuw. (Foutmelding: ' + (error instanceof Error ? error.message : String(error)) + ')',
            onDismiss: () => { errorToastAt.current = null; },
        })
    }

    function onSWRSuccess() {
        // Data comes in again: clear the error, so a later outage shows a new one
        if (errorToastAt.current === null) return;
        errorToastAt.current = null;
        toast.dismiss(FETCH_ERROR_TOAST_ID);
    }

    return (
        <SWRConfig value={{onError: onSWRError, onSuccess: onSWRSuccess}}>
            <StaleDataBadge/>
            {/* Separate boundaries: one crashing part (a dialog, the map, a sidebar section) must not take the rest down */}
            <ErrorBoundary name="Dit venster" variant="floating">
                <ResetPassword open={resetPasswordOpen} setIsOpen={setResetPasswordOpen} allowClose={false}/>
            </ErrorBoundary>
            <ErrorBoundary variant="floating">
                <DemoReloader/>
            </ErrorBoundary>
            <ErrorBoundary name="Deze pagina" variant="floating">
                <Outlet context={{mapRef} satisfies OutletContextType}/>
            </ErrorBoundary>
            <ErrorBoundary name="De kaart" className="mx-auto mt-[40dvh] w-fit">
                <Map ref={mapRef}/>
            </ErrorBoundary>
            <ErrorBoundary name="Het hintbord" variant="floating">
                <HintBoardDialog mapRef={mapRef}/>
            </ErrorBoundary>
            <ErrorBoundary name="Dit venster" variant="floating">
                <HuntersDialog mapRef={mapRef}/>
                <UsersDialog/>
                <BroadcastDialog/>
                <NotificationsDialog/>
            </ErrorBoundary>
            <ErrorBoundary name="De rondleiding" variant="floating">
                <TourOverlay mapRef={mapRef}/>
            </ErrorBoundary>
            {/* Held back until the onboarding tour is done so they don't overlap */}
            {!tour.pending && (
                <PWAPrompt
                    promptOnVisit={1}
                    appIconPath="/icon_maskable.png"
                    copyTitle="Installeer als app"
                    copySubtitle="Jotihunt Tracker"
                    copyDescription="Deze website kan als app geïnstalleerd worden. Volg de onderstaande instructies om deze app te installeren."
                    copyShareStep='Druk op de "Deel" knop in de menubalk'
                    copyAddToHomeScreenStep='Druk op "Zet op beginscherm"'
                />
            )}
        </SWRConfig>
    );
}
