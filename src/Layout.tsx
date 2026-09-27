import {Outlet, useNavigate} from 'react-router';
import {toast} from "sonner"
import {isAxiosError} from 'axios';
import {useRef, useState} from 'react';
import {SWRConfig} from 'swr';
import Map, {MapRef} from './components/Map';
import PWAPrompt from 'react-ios-pwa-prompt';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import {User} from './types/User';
import ResetPassword from './components/ResetPassword';
import {useTheme} from "@/hooks/theme.hook.ts";
import type {OutletContextType} from '@/hooks/outlet.hook.ts';

export default function Layout() {
    const navigate = useNavigate();
    const [errorShown, setErrorShown] = useState(false);
    const auth = useAuthUser<User>();
    const mapRef = useRef<MapRef>(null);
    const [resetPasswordOpen, setResetPasswordOpen] = useState(false);

    useTheme();

    /**
     * If reset password is required, open the dialog.
     * (State is adjusted during render when the flag changes, instead of in an effect.)
     */
    const requiresPasswordChange = !!auth?.requiresPasswordChange;
    const [prevRequiresPasswordChange, setPrevRequiresPasswordChange] = useState(false);
    if (requiresPasswordChange !== prevRequiresPasswordChange) {
        setPrevRequiresPasswordChange(requiresPasswordChange);
        if (requiresPasswordChange) setResetPasswordOpen(true);
    }

    function onSWRError(error: unknown) {
        if (isAxiosError(error) && error.response?.status === 401) {
            toast.info("Je sessie is verlopen.", {
                description: "Log opnieuw in om verder te gaan.",
                duration: Infinity
            })
            navigate('/login');
            return;
        }
        if (errorShown) return;
        setErrorShown(true);
        toast.error("Oeps! Er is iets misgegaan.", {
            duration: Infinity,
            description: 'Er is een fout opgetreden bij het ophalen van de data, probeer het later opnieuw. (Foutmelding: ' + (error instanceof Error ? error.message : String(error)) + ')'
        })
    }

    return (
        <SWRConfig value={{onError: onSWRError}}>
            <ResetPassword open={resetPasswordOpen} setIsOpen={setResetPasswordOpen} allowClose={false}/>
            <Outlet context={{mapRef} satisfies OutletContextType}/>
            <Map ref={mapRef}/>
            <PWAPrompt
                promptOnVisit={1}
                appIconPath="/icon_maskable.png"
                copyTitle="Installeer als app"
                copySubtitle="Jotihunt Tracker"
                copyDescription="Deze website kan als app geïnstalleerd worden. Volg de onderstaande instructies om deze app te installeren."
                copyShareStep='Druk op de "Deel" knop in de menubalk'
                copyAddToHomeScreenStep='Druk op "Zet op beginscherm"'
            />
        </SWRConfig>
    );
}
