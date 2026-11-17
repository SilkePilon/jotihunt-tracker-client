import {Outlet, useLocation, useNavigate} from 'react-router';
import {toast} from "sonner"
import {lazy, Suspense, useEffect, useMemo, useRef, useState} from 'react';
import {mutate, SWRConfig, type SWRConfiguration} from 'swr';
import Map, {MapRef} from './components/Map';
import {Loader2Icon} from 'lucide-react';
import BeheerDialog from './components/beheer/BeheerDialog';
import IntelDialog from './components/intel-window/IntelDialog';
import MarkerRegistrationHost from '@/components/map/MarkerRegistrationHost';
import EditionReloader from '@/components/EditionReloader';
import AddPasskeyPrompt from './components/AddPasskeyPrompt';
import IosInstallPrompt from './components/IosInstallPrompt';
import ErrorBoundary from './components/ErrorBoundary';
import StaleDataBadge from './components/StaleDataBadge';
import PopupAnnouncer from './components/map/popup/PopupAnnouncer';
import NotificationsDialog from './components/notifications/NotificationsDialog';
import AccountDialog from './components/account/AccountDialog';
import LayersDialog from './components/map/layers/LayersDialog';
import AndroidPromoDialog from './components/android-promo/AndroidPromoDialog';
import {useNotificationsPrompt} from './components/notifications/useNotificationsPrompt';
import {useTheme} from "@/hooks/theme.hook.ts";
import {useNotificationFeed} from '@/hooks/notification-feed.hook';
import {routePushClick} from '@/lib/notifications';
import {useIsMobile} from '@/hooks/media.hook';
import {MAP_TILE} from '@/lib/map-chrome';
import {cn} from '@/lib/utils';
import useIntelStore from '@/stores/intel.store';
import useMobileNavStore from '@/stores/mobile-nav.store';
import useSettingsStore from '@/stores/settings.store';
import {useFetcher} from '@/hooks/utils/api.hook';
import {isUnauthorized} from '@/lib/session';
import {useSessionExpired} from '@/hooks/session.hook';
import {useSentryUser} from '@/hooks/sentry-user.hook';
import {resyncPush} from '@/lib/push';
import type {OutletContextType} from '@/hooks/outlet.hook.ts';
import TourOverlay from './components/tour/TourOverlay';
import {useTourAutoStart} from './components/tour/useTour';
import {usePromptQueueHold} from './stores/prompt-queue.store';
import {createFetchErrorToastState, ERROR_TOAST_DELAY_MS, fetchErrorToastText} from '@/lib/fetch-error-toast';
import {isNetworkError} from '@/lib/api-error';
import {isCriticalFeedKey} from '@/lib/connection';
import {MAP_UNAVAILABLE_HEADING_ID} from '@/lib/map-availability';
import AndroidPromoAutoOpen from './components/android-promo/AndroidPromoAutoOpen';
import {LAYER_SELECTOR, shortcutFor, TYPING_SELECTOR} from '@/lib/shortcuts';

const QrConfirmDrawer = lazy(() => import('./components/auth/QrConfirmDrawer'));

const FETCH_ERROR_TOAST_ID = 'fetch-error';

/** Frames to wait for the group search card inside the md compact tile's popover to mount */
const SEARCH_MOUNT_FRAMES = 10;

const isShown = (element: Element) => element.getClientRects().length > 0;

/**
 * "/": open the group search (its popover focuses the search field). Between md and lg the card sits folded in a tile:
 * open that first, then the card once it has mounted.
 */
function openGroupSearch() {
    const findCard = () => [...document.querySelectorAll<HTMLElement>('[data-group-search]')].find(isShown);
    const card = findCard();
    if (card) {
        card.click();
        return;
    }
    const tile = [...document.querySelectorAll<HTMLElement>('[data-group-search-tile]')].find(isShown);
    if (!tile) return;
    tile.click();
    let frames = 0;
    const waitForCard = () => {
        const mounted = findCard();
        if (mounted) mounted.click();
        else if (++frames < SEARCH_MOUNT_FRAMES) requestAnimationFrame(waitForCard);
    };
    requestAnimationFrame(waitForCard);
}

/**
 * The "Naar de kaart" skip link (laptop and phone shell): out of sight (and unclickable) until it has focus, then a map
 * tile sliding in at the top left, below a phone's notch. Not sr-only: that can't animate in; screen readers read it
 * either way.
 */
const SKIP_LINK = cn(
    MAP_TILE,
    'fixed top-[calc(env(safe-area-inset-top)+12px)] left-3 z-[70] inline-flex h-11 items-center rounded-2xl px-4 text-sm font-semibold outline-none',
    'pointer-events-none -translate-y-[calc(100%+1rem)] opacity-0 transition-[translate,opacity] duration-200 ease-out motion-reduce:transition-none',
    'focus:pointer-events-auto focus:translate-y-0 focus:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring',
);

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

    // Back online: refetch the critical feeds now (mutate skips SWR's dedupe and error-retry backoff), so the stale
    // notice clears with the first answers instead of after each feed's next poll
    useEffect(() => {
        const refetchCritical = () => void mutate(isCriticalFeedKey);
        window.addEventListener('online', refetchCritical);
        return () => window.removeEventListener('online', refetchCritical);
    }, []);

    const location = useLocation();
    const {pathname} = location;
    const navigate = useNavigate();

    // Laptop shortcuts: "/" the group search (map page), "i" the Intel window (lib/shortcuts.ts says when not); the
    // settings menu's "Sneltoetsen" switch turns them off (WCAG 2.1.4: speech input can type these letters by accident)
    const shortcutsEnabled = useSettingsStore((state) => state.shortcutsEnabled);
    useEffect(() => {
        if (isMobile || !shortcutsEnabled) return;
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target instanceof Element ? event.target : null;
            const shortcut = shortcutFor(event, {
                typing: !!target?.closest(TYPING_SELECTOR),
                layerOpen: !!document.querySelector(LAYER_SELECTOR),
            });
            // The group search is on the map page only; elsewhere "/" stays the browser's
            if (!shortcut || (shortcut === 'search' && pathname !== '/')) return;
            // "/" is Firefox's quick find otherwise
            event.preventDefault();
            if (shortcut === 'search') openGroupSearch();
            else useIntelStore.getState().openIntel();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isMobile, pathname, shortcutsEnabled]);

    /** Phone: the Hints page on top of the sheet (push also raises the sheet to full; already on top stays as is) */
    function openHintsPage() {
        if (pathname !== '/') navigate('/');
        useMobileNavStore.getState().push({id: 'hints'});
    }

    // A tapped push notification while the app was open in the background: the service worker focuses it and posts what was
    // tapped; open it like the toast's "Openen" would (public/push-sw.js)
    const openHintsPageRef = useRef(openHintsPage);
    useEffect(() => {
        openHintsPageRef.current = openHintsPage;
    });
    useEffect(() => {
        const worker = navigator.serviceWorker;
        if (!worker) return;
        const onMessage = (event: MessageEvent) => {
            routePushClick(event.data, isMobile ? {openHints: () => openHintsPageRef.current()} : {openIntel: (articleId) => useIntelStore.getState().openIntel(articleId)});
        };
        worker.addEventListener('message', onMessage);
        return () => worker.removeEventListener('message', onMessage);
    }, [isMobile]);

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
    // The follow-up prompts (Meldingen, Android app, iOS install, passkey) wait for the tour, then come one at a time
    usePromptQueueHold(tour.pending);

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
        // Phones: a lost connection is the stale-data badge's job; a toast there would cover the sheet
        const quiet = isMobile && isNetworkError(error);
        if (!quiet) errorToastText.current = fetchErrorToastText(error);
        // One toast per outage, only once a key failed twice or for 15 s, and not again within a minute when the connection flaps
        if (errorToast.error(key, undefined, {quiet})) {
            showErrorToast(false);
            return;
        }
        // A first failure: check again once it has been failing for 15 s (its second failure usually comes sooner)
        if (!quiet) {
            window.clearTimeout(dueTimer.current);
            dueTimer.current = window.setTimeout(() => {
                if (errorToast.due()) showErrorToast(false);
            }, ERROR_TOAST_DELAY_MS);
        }
    }
    const dueTimer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(dueTimer.current), []);

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
            {/* Landmark for screen readers around the page (with the sidebar's "Zijbalk" aside) and the map; <main> is
                unstyled and not positioned, so nothing moves */}
            <main>
            {/* Page heading for screen readers, before the sidebar's section headings (h2) in the outlet */}
            <h1 className="sr-only">Jotihunt Tracker</h1>
            {/* Past the sidebar (laptop) or the sheet (phone, e.g. a keyboard or switch user) straight onto the map.
                Hidden until focused, then it slides in as a map tile */}
            <a href="#" className={SKIP_LINK} onClick={(e) => {
                e.preventDefault();
                // No usable map (not created yet, or style/tiles failed): its "Kaart niet beschikbaar" card instead
                if (!mapRef.current?.focusCanvas()) document.getElementById(MAP_UNAVAILABLE_HEADING_ID)?.focus();
            }}>
                Naar de kaart
            </a>
            <ErrorBoundary name="Deze pagina" variant="floating">
                <Outlet context={{mapRef} satisfies OutletContextType}/>
            </ErrorBoundary>
            {/* After the outlet: at the same z-index the later element is on top */}
            <StaleDataBadge/>
                {/* Always mounted: map popups announce "<titel> geopend" here */}
                <PopupAnnouncer/>
                <ErrorBoundary name="De kaart" className="mx-auto mt-[40dvh] w-fit">
                    <Map ref={mapRef}/>
                </ErrorBoundary>
            </main>
            <ErrorBoundary name="Dit venster" variant="floating">
                <BeheerDialog mapRef={mapRef}/>
                <IntelDialog mapRef={mapRef}/>
                {/* The Hunt / Spot dialog outside map popups: a kept draft's line, the phone's "Hunt hier" */}
                <MarkerRegistrationHost mapRef={mapRef}/>
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
            {/* iOS "Installeer als app": a follow-up prompt, after the tour and one at a time with the others */}
            <IosInstallPrompt/>
        </SWRConfig>
    );
}
