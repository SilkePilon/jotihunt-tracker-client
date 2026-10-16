import { useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useAdminConfig } from '@/hooks/app-config.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { Pill, Tag } from './controls/Pill';

const FIELD = 'h-9 rounded-lg bg-beheer-row-high font-mono text-[12.5px]';
const LABEL = 'mb-1 ml-0.5 block text-[11.5px] font-semibold text-muted-foreground';

/**
 * T1: API ID / hash / bot of the group's Telegram app (my.telegram.org), as step 1 of "Koppelen" or to change them later.
 * Sits in IntegrationCard's panel box (which gives it the tonal background).
 */
export default function TelegramAppForm({ step, onSaved, onCancel }: { step?: boolean; onSaved: () => void; onCancel: () => void }) {
  const admin = useAdminConfig();
  const plain = admin.config?.plain;
  const hash = admin.config?.secrets.telegramApiHash;
  const [apiId, setApiId] = useState(plain?.telegramApiId.value ?? '');
  const [apiHash, setApiHash] = useState('');
  const [bot, setBot] = useState(plain?.telegramBotUsername.value ? `@${plain.telegramBotUsername.value}` : '@Jotihunt_bot');
  const [saving, setSaving] = useState(false);
  // An undecryptable hash doesn't work: ask for it again
  const hashUsable = !!hash?.set && !hash.undecryptable;
  const valid = /^\d+$/.test(apiId.trim()) && (hashUsable || apiHash.trim().length > 0);

  async function save() {
    setSaving(true);
    try {
      if (apiHash.trim()) await admin.saveSecret('telegramApiHash', apiHash.trim());
      await admin.savePlain({ telegramApiId: apiId.trim(), telegramBotUsername: bot.trim() || null });
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Opslaan is mislukt.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !saving) void save();
      }}
    >
      {step && (
        <div className="mb-2.5 flex items-center gap-2.5">
          <span aria-hidden className="flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <i key={i} className={`h-[5px] w-6 rounded-full ${i === 0 ? 'bg-primary' : 'bg-beheer-row-high'}`} />
            ))}
          </span>
          <span className="text-xs text-muted-foreground">Stap 1 van 4</span>
        </div>
      )}
      <b className="mb-2.5 block text-sm">App-gegevens van Telegram</b>
      <div className="grid gap-2.5 sm:grid-cols-[1fr_1.6fr_1fr]">
        <label>
          <span className={LABEL}>API ID</span>
          <Input className={FIELD} inputMode="numeric" value={apiId} onChange={(event) => setApiId(event.target.value)} placeholder="1234567" />
        </label>
        <label>
          <span className={LABEL}>API hash</span>
          <Input
            className={FIELD}
            value={apiHash}
            onChange={(event) => setApiHash(event.target.value)}
            placeholder={hashUsable ? `${hash.hint ?? '••••'} (laat leeg om te houden)` : '32 tekens'}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          <span className={LABEL}>Bot</span>
          <Input className={FIELD} value={bot} onChange={(event) => setBot(event.target.value)} />
        </label>
      </div>
      <p className="mt-2 ml-0.5 text-xs text-muted-foreground">
        Maak een app op{' '}
        <a className="underline" href="https://my.telegram.org/apps" target="_blank" rel="noopener noreferrer">
          my.telegram.org
        </a>{' '}
        → API development tools. {plain?.telegramApiId.source === 'env' && <Tag tone="info">uit .env</Tag>}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Pill variant="secondary" onClick={onCancel}>
          Annuleer
        </Pill>
        <Pill type="submit" variant="primary" disabled={!valid || saving || !admin.config?.settingsKeyOk} morphKey={saving ? 'busy' : 'idle'}>
          {saving && <Loader2Icon className="animate-spin" />}
          {step ? 'Volgende' : 'Opslaan'}
        </Pill>
      </div>
    </form>
  );
}
