import ReactDOM from 'react-dom/client';
import './index.css';
import Routes from './Routes.tsx';
import createStore from 'react-auth-kit/createStore';
import AuthProvider from 'react-auth-kit';
import {registerSW} from 'virtual:pwa-register';
import {TooltipProvider} from "@/components/ui/tooltip.tsx";
import {Toaster} from "@/components/ui/sonner.tsx";
import {toast} from 'sonner';
import ErrorBoundary from '@/components/ErrorBoundary';
import {MotionConfig} from 'motion/react';

// Service worker registration. A new version waits for the user: an automatic reload mid-hunt
// would throw away a half-entered hunt photo or hint answer.
const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
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

ReactDOM.createRoot(document.getElementById('root')!).render(
    // Users who ask for less motion get fades only: motion drops transform and layout animations
    <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={700}>
            <AuthProvider store={authStore}>
                <ErrorBoundary variant="page">
                    <Routes/>
                </ErrorBoundary>
            </AuthProvider>
        </TooltipProvider>
        <Toaster />
    </MotionConfig>,
);
