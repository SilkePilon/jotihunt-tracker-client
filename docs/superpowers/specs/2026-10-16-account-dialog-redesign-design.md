# Account dialog redesign

Date: 2026-10-16
Mockup: `.superpowers/brainstorm/272358-1792104227/content/account.html` (options A/B/C, picked **A: tonal rows**).

## Problem

`AccountDialog` still uses the Beheer v3 look: bordered `divide-y` boxes, shadcn outline/ghost `sm` buttons, the
default close icon and a fixed `h-[80dvh]` height that leaves a big empty area under the content. The rest of the app
(settings menu, Beheer, layers popover, Meldingen redesign) uses tonal rows without borders, 12px button radii and
rounded cards.

## Design (A: tonal rows)

Same store, `useAccount` hook, confirm/rename dialogs, toasts and actions. Only layout and styling change, plus the
paired phones move into their own group.

### Shell

Same treatment as the Meldingen redesign (`2026-10-16-notifications-dialog-redesign-design.md`):

- `ResponsiveDialog` gets `compact`, so the dialog hugs its content (max 80dvh desktop / 92dvh drawer, scrolls inside).
- Desktop `className`: `sm:max-w-md` (was `sm:max-w-2xl`), `rounded-[28px]`, `bg-card`, no border, Meldingen dialog
  shadow (`0 0 0 1px var(--border), 0 18px 50px rgb(0 0 0/.35)`).
- Close button via `[&>[data-slot=dialog-close]]`: 34×32, `rounded-xl`, `bg-beheer-row`, hover `bg-beheer-row-high`,
  muted icon, full opacity, no offset ring (focus-visible ring like the header buttons).
- Description: "Je passkeys en waar je bent ingelogd."
- Phone: same content in the existing bottom drawer.

### Building blocks (local to `AccountDialog.tsx`)

- **Group**: muted label (`text-xs font-semibold text-muted-foreground`, `mx-1.5 mb-1.5`), then a
  `flex flex-col gap-0.5` list. Groups are 16px apart.
- **Row**: `bg-beheer-row`, `rounded-md` (6px), first child top corners 18px, last child bottom corners 18px,
  `px-3 py-2.5`, `gap-3`. Left a 34px icon tile (`rounded-xl`, `bg-beheer-row-high`, muted 18px icon); orange variant
  uses `--map-selected-bg` / `--map-selected-fg`. Middle: title `text-[13.5px] font-semibold` truncated, meta
  `text-[11.5px] text-muted-foreground`. Right: action. Rows keep the current fold in/out (height + fade,
  `REVEAL_TRANSITION`) with padding inside so height can reach zero; corner radii are on the inner element so they
  stay right while a neighbour folds away.
- **Small button**: `h-8 px-3 rounded-xl bg-beheer-row-high text-[12.5px] font-semibold`, hover a step darker;
  icon variant 34×32.
- **Action row**: a whole-row `<button>` (hover `bg-beheer-row-high`), used for add / log out all.

### Content, top to bottom

1. **Passkeys**
   - Each passkey: orange `KeyRoundIcon` tile, name, `passkeyMeta`, 34×32 tonal ⋯ button opening the existing
     dropdown (Hernoemen / Verwijderen, last-passkey lock text unchanged).
   - No passkeys: a plain row with "Nog geen passkey. Voeg er een toe om sneller in te loggen."
   - Last row: action row "Passkey toevoegen" with a `PlusIcon` tile (transparent, 1.5px inset `--border` ring,
     primary icon) and primary title text. While adding, the icon swaps to a spinning `Loader2Icon` and the row is
     disabled. Hidden when `passkeysSupported()` is false.
2. **Ingelogd op** (browser sessions only, `orderSessions` order)
   - Icon from the label via `sessionIcon(label)`: Android / iPhone → `SmartphoneIcon`, iPad → `TabletIcon`,
     anything else → `LaptopIcon`.
   - Current browser: orange icon tile and a "Dit apparaat" chip after the name (`h-[18px] px-[7px] rounded-full
     text-[10.5px] font-bold`, map-selected colours). Its meta drops the "Dit apparaat ·" prefix.
   - Each row: small button "Uitloggen", same confirms as now.
   - Last row: destructive action row "Alle andere browsers uitloggen" (`LogOutIcon` tile, `text-destructive`
     title and icon), only when there are other sessions; folds in/out. Same confirm as now.
3. **Gekoppelde telefoons** (only when there are devices; the whole group folds in/out)
   - Each device: `SmartphoneIcon` tile, `device.name`, `deviceMeta`, small button "Ontkoppelen", same confirm.

### Loading and error

- Loading: two groups of skeletons (label bar + `rounded-[18px]` block), tonal instead of bordered.
- Error: muted text plus a small tonal "Opnieuw" button (12px radius).
- The view swap keeps `SWAP` with `AnimatePresence mode="wait"`.

### Data (`src/lib/account.ts`)

- `sessionMeta`: for the current session return only the via text ("met QR-code"); others unchanged
  ("7 uur geleden · met QR-code").
- New `sessionDevice(label): 'phone' | 'tablet' | 'computer'` (no React in lib); the component maps it to icons.
  Matching is case-insensitive on `android`, `iphone` → phone; `ipad` → tablet.

### Scope

- Only `AccountDialog.tsx` and `lib/account.ts`. No server, hook, `ResponsiveDialog`, `ConfirmDialog` or
  `RenamePasskeyDialog` changes.
- Light and dark use the same tokens.

## Testing

- Unit tests in `src/lib/account.test.ts` for `sessionDevice` and the changed `sessionMeta`.
- Typecheck, lint, existing tests.
- Visual check in the browser, light and dark, desktop and phone width: dialog hugs content, close button, add passkey
  (spinner), rename/remove via ⋯, log out one / all others (row folds away, "alle" row disappears), unpair phone
  (group folds away), loading and error states.
