import {Outlet, useLocation, useNavigate} from 'react-router';
import {toast} from "sonner"
import {lazy, Suspense, useEffect, useMemo, useRef, useState} from 'react';
import {mutate, SWRConfig, type SWRConfiguration} from 'swr';
import Map, {MapRef} from './components/Map';
import PWAPrompt from 'react-ios-pwa-prompt';
import {Loader2Icon} from 'lucide-react';
import BeheerDialog from './components/beheer/BeheerDialog';
import IntelDialog from './components/intel-window/IntelDialog';
import EditionReloader from '@/components/EditionReloader';
import AddPasskeyPrompt from './components/AddPasskeyPrompt';
import ErrorBoundary from './components/ErrorBoundary';
import StaleDataBadge from './components/StaleDataBadge';
import NotificationsDialog from './components/notifications/NotificationsDialog';
import AccountDialog from './components/account/AccountDialog';
import LayersDialog from './components/map/layers/LayersDialog';
import AndroidPromoDialog from './components/android-promo/AndroidPromoDialog';
import {useNotificationsPrompt} from './components/notifications/useNotificationsPrompt';
import {useTheme} from "@/hooks/theme.hook.ts";
import {useNotificationFeed} from '@/hooks/notification-feed.hook';
import {useIsMobile} from '@/hooks/media.hook';
import useIntelStore from '@/stores/intel.store';
import useMobileNavStore from '@/stores/mobile-nav.store';
import {useFetcher} from '@/hooks/utils/api.hook';
import {isUnauthorized} from '@/lib/session';
import {useSessionExpired} from '@/hooks/session.hook';
import {useSentryUser} from '@/hooks/sentry-user.hook';
import {resyncPush} from '@/lib/push';
import type {OutletContextType} from '@/hooks/outlet.hook.ts';
import TourOverlay from './components/tour/TourOverlay';
import {useTourAutoStart} from './components/tour/useTour';
import {createFetchErrorToastState, fetchErrorToastText} from '@/lib/fetch-error-toast';
import AndroidPromoAutoOpen from './components/android-promo/AndroidPromoAutoOpen';

const QrConfirmDrawer = lazy(() => import('./components/auth/QrConfirmDrawer'));

const FETCH_ERROR_TOAST_ID = 'fetch-error';

export default function Layout() {
    useSentryUser();
    const endSession = useSessionExpired();
    const mapRef = useRef<MapRef>(null);

    function sessionExpired() {
        toast.info("Je sessie is verlopen.", {
            id: 'session-expired',
            description: "Log opnieuw in om verder te gaan.",
            duration: Infinity
        })
        endSession();
    }

    useTheme();
    const isMobile = useIsMobile();
    const {fetch} = useFetcher();
    useEffect(() => {
        void resyncPush(fetch);
        // Once per page load
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const location = useLocation();
    const {pathname} = location;
    const navigate = useNavigate();

    /** Phone: the Hints page on top of the sheet (push also raises the sheet to full; already on top stays as is) */
    function openHintsPage() {
        if (pathname !== '/') navigate('/');
        useMobileNavStore.getState().push({id: 'hints'});
    }

    // Laptop: "Openen" on a hint/news toast opens the article; phone: a hint toast opens the Hints page (solving stays laptop-only)
    useNotificationFeed({
        onUnauthorized: sessionExpired,
        openArticle: isMobile ? undefined : (articleId) => useIntelStore.getState().openIntel(articleId),
        openHints: isMobile ? openHintsPage : undefined,
    });
    // Set by /l/:code: a laptop's QR code was scanned with this phone
    const qrLogin = (location.state as {qrLogin?: unknown} | null)?.qrLogin;
    const tour = useTourAutoStart();
    // Like the tour, the notifications prompt only opens on the map page
    useNotificationsPrompt(tour.pending || pathname !== '/');

    // Which SWR keys are failing, and whether the error toast is up. Mutable, not state: every poll passes through here.
    const [errorToast] = useState(createFetchErrorToastState);

    function onSWRError(error: unknown, key: string) {
        // Only a 401 means the session is gone; 500/503, timeouts and network errors keep the user signed in
        if (isUnauthorized(error)) {
            sessionExpired();
            return;
        }
        // The technical details are for the console (Sentry has its own capture); the user gets short Dutch copy
        console.warn(`[SWR] ${key} failed`, error);
        // One toast per outage, and not again within a minute when the connection flaps
        if (!errorToast.error(key)) return;
        errorToastText.current = fetchErrorToastText(error);
        showErrorToast(false);
    }

    // The toast's copy for this outage, kept for the pending state of "Opnieuw"
    const errorToastText = useRef({title: '', description: ''});
    const retrying = useRef(false);

    function showErrorToast(pending: boolean) {
        const {title, description} = errorToastText.current;
        toast.error(title, {
            id: FETCH_ERROR_TOAST_ID,
            duration: Infinity,
            description,
            action: {
                label: pending ? (
                    <span className="inline-flex items-center gap-1.5"><Loader2Icon className="size-3.5 animate-spin" aria-hidden/>Opnieuw proberen…</span>
                ) : 'Opnieuw',
                onClick: (event) => {
                    // The toast stays: it goes by itself once the failing keys load
                    event.preventDefault();
                    void retryFailing();
                },
            },
        });
    }

    /** Refetch only the keys that are failing now instead of waiting for their next poll; repeat taps wait for it */
    async function retryFailing() {
        if (retrying.current) return;
        retrying.current = true;
        showErrorToast(true);
        try {
            await Promise.allSettled(errorToast.failingKeys().map((key) => mutate(key)));
        } finally {
            retrying.current = false;
            // Still failing: back to "Opnieuw" (when everything loaded, onSWRSuccess already dismissed the toast)
            if (errorToast.showing()) showErrorToast(false);
        }
    }

    function onSWRSuccess(_data: unknown, key: string) {
        // Only when the failing endpoints themselves load again; another endpoint working says nothing about them
        if (errorToast.success(key)) toast.dismiss(FETCH_ERROR_TOAST_ID);
    }

    // One SWRConfig value for the app's lifetime: a new object every render would re-render every SWR consumer.
    // The handlers close over this render's values, so they're reached through a ref.
    const swrHandlersRef = useRef({onError: onSWRError, onSuccess: onSWRSuccess});
    useEffect(() => {
        swrHandlersRef.current = {onError: onSWRError, onSuccess: onSWRSuccess};
    });
    const swrConfig = useMemo<SWRConfiguration>(() => ({
        onError: (error: unknown, key: string) => swrHandlersRef.current.onError(error, key),
        onSuccess: (data: unknown, key: string) => swrHandlersRef.current.onSuccess(data, key),
    }), []);

    return (
        <SWRConfig value={swrConfig}>
            {/* Separate boundaries: one crashing part (a dialog, the map, a sidebar section) must not take the rest down */}
            <ErrorBoundary variant="floating">
                <EditionReloader/>
                <AddPasskeyPrompt/>
                {/* Here and not on the map page: hunts registered while another page is open are announced too */}
            </ErrorBoundary>
            <ErrorBoundary name="Deze pagina" variant="floating">
                <Outlet context={{mapRef} satisfies OutletContextType}/>
            </ErrorBoundary>
            {/* After the outlet: at the same z-index the later element is on top */}
            <StaleDataBadge/>
            {/* Landmark + page heading for screen readers; <main> is unstyled, so the map's layout is unchanged */}
            <main>
                <h1 className="sr-only">Jotihunt Tracker</h1>
                <ErrorBoundary name="De kaart" className="mx-auto mt-[40dvh] w-fit">
                    <Map ref={mapRef}/>
                </ErrorBoundary>
            </main>
            <ErrorBoundary name="Dit venster" variant="floating">
                <BeheerDialog mapRef={mapRef}/>
                <IntelDialog mapRef={mapRef}/>
                <NotificationsDialog/>
                <AccountDialog/>
                <LayersDialog/>
                <AndroidPromoDialog/>
                <AndroidPromoAutoOpen/>
                {typeof qrLogin === 'string' && (
                    <Suspense fallback={null}>
                        <QrConfirmDrawer key={qrLogin} code={qrLogin} onClose={() => navigate('/', {replace: true, state: null})}/>
                    </Suspense>
                )}
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
