import {useEffect, useRef} from 'react';
import {useDemo} from '@/hooks/demo.hook';

/** Reloads the page when demo mode flips (e.g. an admin switched it) while the app is open. */
export default function DemoReloader() {
    const {demo} = useDemo();
    // The first known state; a ref, not state: setting state during render looped forever on a malformed answer
    const initial = useRef<boolean | undefined>(undefined);
    const enabled = typeof demo?.enabled === 'boolean' ? demo.enabled : undefined;

    useEffect(() => {
        if (enabled === undefined) return;
        if (initial.current === undefined) initial.current = enabled;
        else if (enabled !== initial.current) window.location.reload();
    }, [enabled]);

    return null;
}
