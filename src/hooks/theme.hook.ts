import useSettingsStore from "@/stores/settings.store.ts";
import {useEffect} from "react";
import {syncThemeColor} from "@/lib/theme-color";

export const useTheme = () => {
    const {darkMode} = useSettingsStore();

    /**
     * Update the body class based on darkMode or system preference
     */
    useEffect(() => {
        const updateDarkMode = () => {
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const dark = darkMode === true || (darkMode === undefined && systemPrefersDark);
            document.body.classList.toggle('dark', dark);
            // Browser chrome (Android status bar, Safari tab bar) follows the app's theme, not only the OS one
            syncThemeColor(dark);
        };

        // Update immediately
        updateDarkMode();

        // Listen for system preference changes when darkMode is null
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (darkMode === undefined) {
                updateDarkMode();
            }
        };

        if (darkMode === undefined) {
            mediaQuery.addEventListener('change', handleChange);
        }

        // Cleanup the event listener on unmount
        return () => {
            mediaQuery.removeEventListener('change', handleChange);
        };
    }, [darkMode]);
}