import ReactDOM from 'react-dom/client';
import './index.css';
import Routes from './Routes.tsx';
import createStore from 'react-auth-kit/createStore';
import AuthProvider from 'react-auth-kit';
import proj4 from 'proj4';
import {registerSW} from 'virtual:pwa-register';
import {TooltipProvider} from "@/components/ui/tooltip.tsx";
import {Toaster} from "@/components/ui/sonner.tsx";
import {setWorkerUrl} from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// MapLibre resolves its worker relative to its own module, which bundlers don't emit;
// let Vite bundle the worker and hand MapLibre the resulting URL
setWorkerUrl(maplibreWorkerUrl);

// Service worker registration
registerSW({immediate: true});

// Define projection for RD coordinates
proj4.defs(
    'RD',
    '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs',
);

// Store auth state
const authStore = createStore({
    authName: '_auth',
    authType: 'cookie',
    cookieDomain: window.location.hostname,
    cookieSecure: window.location.protocol === 'https:',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <>
        <TooltipProvider delayDuration={700}>
            <AuthProvider store={authStore}>
                <Routes/>
            </AuthProvider>
        </TooltipProvider>
        <Toaster />
    </>,
);
