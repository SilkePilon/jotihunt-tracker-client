import './instrument';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import Routes from './Routes.tsx';
import createStore from 'react-auth-kit/createStore';
import AuthProvider from 'react-auth-kit';
import {registerSW} from 'virtual:pwa-register';
import {TooltipProvider} from "@/components/ui/tooltip.tsx";
import AppToaster from "@/components/AppToaster";
import {toast} from 'sonner';
import ErrorBoundary from '@/components/ErrorBoundary';
import {MotionConfig} from 'motion/react';
import {AppConfigSync} from '@/hooks/app-config.hook';
import {syncShellAttribute} from '@/hooks/media.hook';
import {isHqWall} from '@/lib/hq';
import {captureLaunchShortcut} from '@/lib/launch-shortcut';

// data-shell on <html> before the first paint: CSS follows the mobile shell on landscape phones too (shell-mobile:)
syncShellAttribute();

// A PWA shortcut's ?open=: kept for the sidebar (useLaunchShortcut) and taken out of the URL before the router reads it
captureLaunchShortcut();

// Service worker registration. A new version waits for the user: an automatic reload mid-hunt
// would throw away a half-entered hunt photo or hint answer. The HQ wall has no one at it to tap "Herladen" (and nothing
// to lose): it updates straight away.
const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
        if (isHqWall(window.location.pathname)) {
            void updateSW(true);
            return;
        }
        toast.info('Nieuwe versie beschikbaar', {
            id: 'app-update',
            duration: Infinity,
            action: {label: 'Herladen', onClick: () => void updateSW(true)},
        });
    },
});

// Store auth state
const authStore = createStore({
    authName: '_auth',
    authType: 'cookie',
    cookieDomain: window.location.hostname,
    cookieSecure: window.location.protocol === 'https:',
});

// Crashes outside an ErrorBoundary and errors React recovered from go to Sentry; our ErrorBoundary reports the caught
// ones itself (so no onCaughtError: it would send them twice)
ReactDOM.createRoot(document.getElementById('root')!, {
    onUncaughtError: Sentry.reactErrorHandler(),
    onRecoverableError: Sentry.reactErrorHandler(),
}).render(
    // Users who ask for less motion get fades only: motion drops transform and layout animations
    <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={700}>
            <AuthProvider store={authStore}>
                <AppConfigSync/>
                <ErrorBoundary variant="page">
                    <Routes/>
                </ErrorBoundary>
            </AuthProvider>
        </TooltipProvider>
        <AppToaster />
    </MotionConfig>,
);
