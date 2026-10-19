import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import AutoHeight from '@/components/motion/AutoHeight';
import { useNightAreas, useRouterStatus } from '@/hooks/night-areas.hook';
import { POP, SWAP } from '@/lib/motion';
import useAdminStore from '@/stores/admin.store';
import { useNightDraw } from '@/stores/night-draw.store';
import type { NightArea, RouterStatus, RoutesSetting } from '@/types/Trail';
import { BeheerCard, BeheerRow, BeheerRows, FadeSwap, InlineConfirm, RowFrame } from './BeheerLayout';
import BeheerSwitch from './controls/BeheerSwitch';
import { IconPill, Pill, Tag } from './controls/Pill';

const builtFormat = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' });

/** The Router row's meta line and tag. */
function routerState(status: RouterStatus | undefined): { meta: string; tag?: { label: string; tone: 'ok' | 'warn' | 'danger' } } {
  if (!status) return { meta: '…' };
  if (!status.configured) return { meta: 'Niet ingesteld (ROUTER_URL)', tag: { label: 'Offline', tone: 'danger' } };
  if (status.building) return { meta: 'Kaartdata wordt gebouwd…', tag: { label: 'Bouwen', tone: 'warn' } };
  if (!status.online) return { meta: 'Niet bereikbaar', tag: { label: 'Offline', tone: 'danger' } };
  const built = status.builtAt ? builtFormat.format(new Date(status.builtAt)).replace(/\.(?=\s|$)/g, '') : null;
  const paths = status.report ? (status.report.nightTagged + status.report.fallbackTagged).toLocaleString('nl-NL') : null;
  const meta = built && paths !== null ? `Kaartdata van ${built} · ${paths} nachtpaden` : built ? `Kaartdata van ${built}` : 'Online';
  return { meta, tag: { label: 'Online', tone: 'ok' } };
}

const KIND_TAG: Record<NightArea['kind'], { label: string; className: string; meta: string }> = {
  closed: { label: "Dicht 's nachts", className: 'bg-[#ffdad6] text-[#93000a]', meta: 'Paden dicht, wegen open' },
  open: { label: "Open 's nachts", className: 'bg-[rgb(27_109_47/0.12)] text-[#1b6d2f] dark:text-green-300', meta: 'Telt niet als gesloten bos' },
};

interface AreaRowProps {
  area: NightArea;
  confirming: boolean;
  disabled: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onDelete: () => Promise<void>;
}

/** One own night area; ✕ turns the row red with an inline "Gebied verwijderen?" (swaps like BeheerExpandableRow's confirm). */
function AreaRow({ area, confirming, disabled, onAsk, onCancel, onDelete }: AreaRowProps) {
  const tag = KIND_TAG[area.kind];
  return (
    <RowFrame tone={confirming ? 'danger' : 'default'}>
      <AutoHeight scene={confirming ? 'confirm' : 'row'}>
        <AnimatePresence mode="wait" initial={false}>
          {confirming ? (
            <motion.div key="confirm" className="px-3 py-2.5" {...SWAP}>
              <InlineConfirm title="Gebied verwijderen?" description={area.name} confirmLabel="Verwijder" onCancel={onCancel} onConfirm={onDelete} />
            </motion.div>
          ) : (
            <motion.div key="row" className="flex items-center gap-3 px-3 py-2.5" {...SWAP}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">{area.name}</div>
                <div className="text-xs text-muted-foreground">{tag.meta}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Tag className={tag.className}>{tag.label}</Tag>
                <IconPill variant="soft" aria-label={`${area.name} verwijderen`} disabled={disabled} onClick={onAsk} className="size-8">
                  <XIcon />
                </IconPill>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </AutoHeight>
    </RowFrame>
  );
}

/** Beheer → Algemeen: routed fox trails on/off, the router's state, and own night areas drawn on the map. */
export default function RoutesCard() {
  const { setting, save } = useNightAreas();
  const { status, rebuild } = useRouterStatus(true);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // The saved areas show on the map while this card is open
  useEffect(() => {
    useNightDraw.getState().setShowAreas(true);
    return () => useNightDraw.getState().setShowAreas(false);
  }, []);

  async function persist(next: RoutesSetting) {
    setSaving(true);
    try {
      await save(next);
    } catch {
      toast.error('Opslaan mislukt');
    } finally {
      setSaving(false);
    }
  }

  async function handleRebuild() {
    setRebuilding(true);
    try {
      const result = await rebuild();
      if (result === 'started') toast.success('Kaartdata wordt vernieuwd');
      else if (result === 'busy') toast.info('Kaartdata wordt al vernieuwd');
      else toast.error('Router niet bereikbaar');
    } finally {
      setRebuilding(false);
    }
  }

  function startDrawing() {
    useNightDraw.getState().start('closed');
    useAdminStore.getState().close();
  }

  const router = routerState(status);
  const areas = setting?.areas ?? [];

  return (
    <BeheerCard title="Routes" description="Lijnen tussen vossenlocaties volgen echte paden. 's Nachts blijven gesloten bossen buiten de route.">
      <BeheerRows>
        <BeheerRow key="enabled" title="Routes tekenen" meta="Uit = rechte lijnen zoals vroeger">
          <BeheerSwitch
            aria-label="Routes tekenen"
            checked={setting?.enabled !== false}
            disabled={!setting || saving}
            onCheckedChange={(enabled) => void persist({ ...setting!, enabled })}
          />
        </BeheerRow>
        <BeheerRow key="router" title="Router" meta={<FadeSwap>{router.meta}</FadeSwap>}>
          <AnimatePresence mode="popLayout" initial={false}>
            {router.tag && (
              <motion.span key={router.tag.label} className="inline-flex" {...POP}>
                <Tag tone={router.tag.tone}>{router.tag.label}</Tag>
              </motion.span>
            )}
          </AnimatePresence>
        </BeheerRow>
      </BeheerRows>
      <div className="mt-3 flex">
        <Pill variant="secondary" morphKey={rebuilding ? 'busy' : 'idle'} disabled={!status?.configured || status.building || rebuilding} onClick={() => void handleRebuild()}>
          {rebuilding && <Loader2Icon className="animate-spin" />}
          Kaartdata vernieuwen
        </Pill>
      </div>

      <div className="mx-1 mt-[18px]">
        <h4 className="text-sm font-bold">Eigen nachtgebieden</h4>
        <p className="text-xs text-muted-foreground">Voor bossen waar OpenStreetMap het mis heeft.</p>
      </div>
      <BeheerRows className="mt-3">
        {areas.length === 0 && setting && (
          <BeheerRow key="empty" tone="muted" title={<span className="font-normal text-muted-foreground">Nog geen eigen gebieden</span>} />
        )}
        {areas.map((area) => (
          <AreaRow
            key={area.id}
            area={area}
            confirming={confirmId === area.id}
            disabled={saving}
            onAsk={() => setConfirmId(area.id)}
            onCancel={() => setConfirmId(null)}
            onDelete={async () => {
              await persist({ ...setting!, areas: setting!.areas.filter((a) => a.id !== area.id) });
              setConfirmId(null);
            }}
          />
        ))}
      </BeheerRows>
      <div className="mt-3 flex">
        <Pill variant="primary" disabled={!setting} onClick={startDrawing}>
          + Gebied tekenen
        </Pill>
      </div>
    </BeheerCard>
  );
}
