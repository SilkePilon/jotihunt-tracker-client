import {useAuthSWR} from '@/lib/swr';
import {useFetcher} from './utils/api.hook';

export type DemoState = {
    enabled: boolean;
    enabledAt: string | null;
    startedAt: string | null;
};

export const useDemo = () => {
    const {data, mutate} = useAuthSWR<DemoState>('/demo', {refreshInterval: 30_000});
    const {fetch} = useFetcher();

    /** Switch demo mode on or off (admin). Takes several seconds; throws (axios error) on failure. */
    async function setDemo(enabled: boolean) {
        const result = await fetch<DemoState>('/demo', 'POST', {enabled});
        await mutate(result.data, {revalidate: false});
        return result.data;
    }

    return {demo: data, setDemo};
};
