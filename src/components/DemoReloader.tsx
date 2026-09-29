import {useEffect, useState} from 'react';
import {useDemo} from '@/hooks/demo.hook';

/** Reloads the page when demo mode flips (e.g. an admin switched it) while the app is open. */
export default function DemoReloader() {
    const {demo} = useDemo();
    const [initial, setInitial] = useState<boolean | undefined>(undefined);

    if (demo && initial === undefined) setInitial(demo.enabled);

    const changed = demo !== undefined && initial !== undefined && demo.enabled !== initial;
    useEffect(() => {
        if (changed) window.location.reload();
    }, [changed]);

    return null;
}
