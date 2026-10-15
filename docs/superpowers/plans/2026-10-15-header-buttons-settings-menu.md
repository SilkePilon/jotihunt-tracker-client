# Header Buttons + Settings Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the sidebar header's theme + settings buttons as one joined tonal group (option B) and the settings dropdown as a Beheer-style card with quick tiles and tonal rows (M3 v2).

**Architecture:** Pure presentation change. The Radix `DropdownMenu`, `useSettingsMenuStore`, tour wiring and all actions stay. A small `menu-parts.tsx` holds the shared row/tile/card styles so `Settings.tsx` and the two phone submenus use the same look. The header buttons share one class constant.

**Tech Stack:** React 19, Tailwind v4, Radix (`radix-ui`) dropdown, `motion/react`, lucide-react, bun.

Spec: `docs/superpowers/specs/2026-10-15-header-buttons-settings-menu-design.md`. Mockups: `.superpowers/brainstorm/103612-1792098779/content/header-buttons.html` (B) and `settings-menu-v2.html`.

## Global Constraints

- Tokens only, no new colours: `bg-beheer-row`, `bg-beheer-row-high`, `var(--map-selected-bg/-fg)` (light orange "on/open"), `var(--map-danger-bg/-fg)` (Uitloggen), `bg-card`, `--border`.
- Radii: `rounded-lg` = 12px (`--radius`), inner corners 6px, rows `rounded-md first:rounded-t-2xl last:rounded-b-2xl`, card `rounded-3xl`.
- Every state change animates (theme icon swap, trigger open state, Geluid tile, menu open/close); respect `motion-reduce`.
- Dutch UI copy, exactly: "Donkere modus", "Lichte modus", "Instellingen", "Geluid aan", "Geluid uit", "Meldingen", "Rondleiding", "Account", "Installeer app", "Zichtbare lagen", "Kaartstijl", "Beheer", "Debug", "Join de Discord", "Uitloggen".
- No "Hoi, naam" label, no separators in the menu.
- Discord row only when `DISCORD_URL` is set (unchanged gating).
- Tools: `bun` is not on PATH, use `npx --yes bun ...`. Never restart the docker stack (it is the user's live instance).
- Code style: match the file you edit (Settings.tsx uses 4-space indent and no spaces in import braces; the other files 2-space). Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Testing note

The client has no DOM/component test setup (`bun test` only covers `src/lib/*.test.ts`), and this change has no logic to unit-test. Each task is verified with `tsc -b`, lint, the existing test suite, and a browser check (Task 4). Do not add a DOM test framework for this.

---

### Task 1: Header button group (B)

**Files:**
- Create: `src/components/sidebar/header-button.ts`
- Modify: `src/components/sidebar/ThemeToggle.tsx` (whole file)
- Modify: `src/components/sidebar/SidebarHeader.tsx:18-20`
- Modify: `src/components/Settings.tsx` (trigger only, lines 71-75, plus imports)

**Interfaces:**
- Produces: `HEADER_BUTTON: string` (shared class list); `ThemeToggle({ className?: string })`.

- [ ] **Step 1: Create the shared button class**

`src/components/sidebar/header-button.ts`:

```ts
/** One half of the joined tonal button group in the sidebar header (theme + settings); the caller sets the corners. */
export const HEADER_BUTTON =
  'relative grid h-8 w-[34px] shrink-0 cursor-pointer place-items-center bg-beheer-row text-foreground outline-none transition-[background-color,color,border-radius] duration-200 hover:bg-beheer-row-high focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none';
```

- [ ] **Step 2: Rewrite ThemeToggle**

`src/components/sidebar/ThemeToggle.tsx`:

```tsx
import { MoonStarIcon, SunIcon } from 'lucide-react';
import { useDarkMode } from '@/hooks/utils/darkmode.hook';
import useSettingsStore from '@/stores/settings.store';
import { cn } from '@/lib/utils';
import { HEADER_BUTTON } from './header-button';

/** Both icons stay mounted and cross-swap: the leaving one turns away and shrinks, the other turns in. */
const ICON = 'absolute size-[18px] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none';

/** Switches between light and dark mode; the first click overrides the system preference. */
export default function ThemeToggle({ className }: { className?: string }) {
  const isDarkMode = useDarkMode();
  const setDarkMode = useSettingsStore((state) => state.setDarkMode);
  const label = isDarkMode ? 'Lichte modus' : 'Donkere modus';

  return (
    <button type="button" aria-label={label} title={label} onClick={() => setDarkMode(!isDarkMode)} className={cn(HEADER_BUTTON, className)}>
      <MoonStarIcon className={cn(ICON, isDarkMode && 'scale-40 rotate-90 opacity-0')} />
      <SunIcon className={cn(ICON, !isDarkMode && 'scale-40 -rotate-90 opacity-0')} />
    </button>
  );
}
```

- [ ] **Step 3: Restyle the settings trigger**

In `src/components/Settings.tsx`, in the `lucide-react` import replace `CogIcon,` with `Settings2Icon,`. Replace the `import {Button} from './ui/button';` line with:

```tsx
import {cn} from '@/lib/utils';
import {HEADER_BUTTON} from './sidebar/header-button';
```

Replace the trigger (currently `<Button variant="outline" size="sm" aria-label="Instellingen"><CogIcon/></Button>`) with:

```tsx
                <DropdownMenuTrigger asChild>
                    {/* Right half of the header group; while open it turns light orange with all corners round */}
                    <button type="button" aria-label="Instellingen" title="Instellingen"
                            className={cn(HEADER_BUTTON, 'rounded-l-[6px] rounded-r-lg data-[state=open]:rounded-lg data-[state=open]:bg-(--map-selected-bg) data-[state=open]:text-(--map-selected-fg)')}>
                        <Settings2Icon className="size-[18px]"/>
                    </button>
                </DropdownMenuTrigger>
```

(Radix sets `data-state="open"` on the trigger while the menu is open.)

- [ ] **Step 4: Group the two buttons in SidebarHeader**

In `src/components/sidebar/SidebarHeader.tsx` replace

```tsx
      <ThemeToggle />
      <Settings onReplayTour={() => startTour('replay')} />
```

with

```tsx
      {/* Joined tonal group: 2px seam, 12px outer and 6px inner corners */}
      <div className="flex shrink-0 gap-0.5">
        <ThemeToggle className="rounded-l-lg rounded-r-[6px]" />
        <Settings onReplayTour={() => startTour('replay')} />
      </div>
```

- [ ] **Step 5: Typecheck, lint, tests**

Run: `npx --yes bun x tsc -b && npx --yes bun run lint && npx --yes bun test`
Expected: no type errors, no lint errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/sidebar/header-button.ts src/components/sidebar/ThemeToggle.tsx src/components/sidebar/SidebarHeader.tsx src/components/Settings.tsx
git commit -m "feat(header): joined tonal theme + settings buttons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Settings menu card (M3 v2)

**Files:**
- Create: `src/components/settings/menu-parts.tsx`
- Modify: `src/components/Settings.tsx` (imports + `DropdownMenuContent` body)

**Interfaces:**
- Consumes: Task 1's trigger in `Settings.tsx` (leave it as is).
- Produces (used by Task 3): `MENU_CARD: string`, `MENU_ROW: string`, `MenuRows({ className?, children })`, `MenuRow(props: ComponentProps<typeof DropdownMenuItem>)`, `MenuSubRow(props: ComponentProps<typeof DropdownMenuSubTrigger>)`, `MenuTile(props: ComponentProps<typeof DropdownMenuItem>)`.

- [ ] **Step 1: Create the shared menu parts**

`src/components/settings/menu-parts.tsx`:

```tsx
import type { ComponentProps, ReactNode } from 'react';
import { DropdownMenuItem, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/** The settings menu and its phone submenus: a rounded-3xl card like the map layers popover. */
export const MENU_CARD = 'rounded-3xl border-0 bg-card p-3 text-card-foreground shadow-[0_0_0_1px_var(--border),0_10px_30px_rgb(0_0_0/0.28)]';

/** A Beheer row: tonal block, 6px corners, 16px on the outer ends of its group (see MenuRows). */
export const MENU_ROW =
  'gap-2.5 rounded-md bg-beheer-row px-3 py-2.5 text-[13.5px] font-semibold transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl focus:bg-beheer-row-high';

/** Groups rows with 2px seams. Conditional rows render nothing, so first/last corners stay right. */
export function MenuRows({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex flex-col gap-0.5', className)}>{children}</div>;
}

export function MenuRow({ className, ...props }: ComponentProps<typeof DropdownMenuItem>) {
  return <DropdownMenuItem className={cn(MENU_ROW, className)} {...props} />;
}

/** Row that opens a submenu (phones: Zichtbare lagen, Kaartstijl); stays highlighted while its submenu is open. */
export function MenuSubRow({ className, ...props }: ComponentProps<typeof DropdownMenuSubTrigger>) {
  return <DropdownMenuSubTrigger className={cn(MENU_ROW, 'data-[state=open]:bg-beheer-row-high', className)} {...props} />;
}

/** Quick tile: icon above a short label. Give the icon `size-5` itself. */
export function MenuTile({ className, ...props }: ComponentProps<typeof DropdownMenuItem>) {
  return (
    <DropdownMenuItem
      className={cn('flex-col justify-center gap-1.5 rounded-2xl bg-beheer-row px-1 pt-3 pb-2.5 text-[11.5px] font-semibold transition-colors duration-200 focus:bg-beheer-row-high', className)}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Update Settings.tsx imports**

In the `lucide-react` import: remove nothing else, but add `VolumeXIcon` next to `Volume2Icon`. In the `./ui/dropdown-menu` import keep only `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuTrigger` (the label, separator, item and checkbox item are no longer used directly). Add:

```tsx
import {AnimatePresence, motion} from 'motion/react';
import {SWAP} from '@/lib/motion';
import {MENU_CARD, MenuRow, MenuRows, MenuTile} from './settings/menu-parts';
```

- [ ] **Step 3: Replace the menu content**

Replace the whole `<DropdownMenuContent align="start"> … </DropdownMenuContent>` block with:

```tsx
                <DropdownMenuContent align="start" className={cn(MENU_CARD, 'w-[290px]')}>
                    {/* Quick tiles for what you change most */}
                    <div className={cn('mb-2 grid gap-1.5', onReplayTour ? 'grid-cols-3' : 'grid-cols-2')}>
                        <MenuTile onSelect={(e) => {
                            e.preventDefault();
                            setSoundMuted(!soundMuted);
                        }}
                                  className={cn(!soundMuted && 'bg-(--map-selected-bg) text-(--map-selected-fg) focus:bg-(--map-selected-bg) focus:text-(--map-selected-fg)')}>
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.span key={soundMuted ? 'off' : 'on'} {...SWAP} className="flex flex-col items-center gap-1.5">
                                    {soundMuted ? <VolumeXIcon className="size-5"/> : <Volume2Icon className="size-5 text-current"/>}
                                    {soundMuted ? 'Geluid uit' : 'Geluid aan'}
                                </motion.span>
                            </AnimatePresence>
                        </MenuTile>
                        <MenuTile onClick={() => openNotifications(true)}>
                            <BellIcon className="size-5"/>
                            Meldingen
                        </MenuTile>
                        {onReplayTour && (
                            <MenuTile {...tourTarget('settings.replayItem')} onClick={() => {
                                setMenuOpen(false);
                                onReplayTour();
                            }}>
                                <CompassIcon className="size-5"/>
                                Rondleiding
                            </MenuTile>
                        )}
                    </div>

                    <MenuRows>
                        <MenuRow onClick={() => openAccount(true)}>
                            <UserRoundIcon/>
                            Account
                            <span className="ml-auto truncate text-xs font-medium text-muted-foreground">
                                {auth?.name}{auth?.admin && ' · Admin'}
                            </span>
                        </MenuRow>
                        {!isStandalone && isInstallPromptSupported && (
                            <MenuRow onClick={promptInstall}>
                                <DownloadIcon/>
                                Installeer app
                            </MenuRow>
                        )}
                        {/* Desktop has the layers button on the map; phones have no map controls */}
                        {isMobile && (
                            <>
                                <LayersSubmenu/>
                                <MapStyleSubmenu/>
                            </>
                        )}
                        {auth?.admin && (
                            <>
                                <MenuRow onClick={() => {
                                    setMenuOpen(false);
                                    openAdminDialog('algemeen');
                                }}>
                                    <ShieldIcon/>
                                    Beheer
                                </MenuRow>
                                <DialogTrigger asChild>
                                    <MenuRow>
                                        <BugIcon/>
                                        Debug
                                    </MenuRow>
                                </DialogTrigger>
                            </>
                        )}
                        {DISCORD_URL && (
                            <MenuRow asChild>
                                <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
                                    <span className={"fill-muted-foreground [&>svg]:size-4"} dangerouslySetInnerHTML={{__html: siDiscord.svg}}></span>
                                    Join de Discord
                                </a>
                            </MenuRow>
                        )}
                    </MenuRows>

                    <MenuRows className="mt-2">
                        <MenuRow onClick={logout}
                                 className="bg-(--map-danger-bg) text-(--map-danger-fg) focus:bg-[color-mix(in_oklab,var(--map-danger-bg)_85%,var(--map-danger-fg))] focus:text-(--map-danger-fg) [&_svg]:text-(--map-danger-fg)!">
                            <LogOutIcon/>
                            Uitloggen
                        </MenuRow>
                    </MenuRows>
                </DropdownMenuContent>
```

Notes for the implementer:
- `MenuRow` with `asChild` works because shadcn's `DropdownMenuItem` passes `asChild` through to Radix.
- `Volume2Icon` gets `text-current` so the base item's `[&_svg:not([class*='text-'])]:text-muted-foreground` rule doesn't grey it out on the orange tile. Do the same if any other tile icon needs the tile colour.
- `DropdownMenuContent` already has Radix fade + zoom open/close animations; `cn` (tailwind-merge) overrides its `rounded-md border p-1 shadow-md bg-popover`.

- [ ] **Step 4: Typecheck, lint, tests**

Run: `npx --yes bun x tsc -b && npx --yes bun run lint && npx --yes bun test`
Expected: all pass. If lint flags unused imports (`DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuCheckboxItem`, `Button`), remove them.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/menu-parts.tsx src/components/Settings.tsx
git commit -m "feat(settings): Beheer-style settings menu with quick tiles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Phone submenus in the same style

**Files:**
- Modify: `src/components/settings/LayersSubmenu.tsx` (whole file)
- Modify: `src/components/settings/MapStyleSubmenu.tsx` (whole file)

**Interfaces:**
- Consumes: `MENU_CARD`, `MENU_ROW`, `MenuRows`, `MenuSubRow` from `@/components/settings/menu-parts` (Task 2); `BeheerSwitch` from `@/components/beheer/controls/BeheerSwitch`.

- [ ] **Step 1: Rewrite LayersSubmenu**

```tsx
import { EyeIcon } from 'lucide-react';
import { DropdownMenuCheckboxItem, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import BeheerSwitch from '@/components/beheer/controls/BeheerSwitch';
import { cn } from '@/lib/utils';
import { useLayerToggles } from './layer-toggles';
import { MENU_CARD, MENU_ROW, MenuRows, MenuSubRow } from './menu-parts';

/** Keep the menu open while toggling layers */
const keepOpen = (e: Event) => e.preventDefault();

/** Settings → Zichtbare lagen (phones): Beheer rows with an M3 switch per map layer. */
export default function LayersSubmenu() {
  // Fetched while the settings menu is open, so the Life360 item also appears when the layer is off
  const toggles = useLayerToggles(true);

  return (
    <DropdownMenuSub>
      <MenuSubRow>
        <EyeIcon />
        Zichtbare lagen
      </MenuSubRow>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className={cn(MENU_CARD, 'w-[270px]')}>
          <MenuRows>
            {toggles.map((layer) => (
              // The row is the menuitemcheckbox; the switch is only its picture (the built-in check indicator is hidden)
              <DropdownMenuCheckboxItem
                key={layer.id}
                checked={layer.checked}
                onCheckedChange={layer.toggle}
                onSelect={keepOpen}
                className={cn(MENU_ROW, 'justify-between py-2 pl-3 [&>span:first-child]:hidden')}
              >
                {layer.label}
                <BeheerSwitch checked={layer.checked} tabIndex={-1} aria-hidden className="pointer-events-none" />
              </DropdownMenuCheckboxItem>
            ))}
          </MenuRows>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
```

- [ ] **Step 2: Rewrite MapStyleSubmenu**

```tsx
import { LayersIcon } from 'lucide-react';
import { DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSub, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import useSettingsStore from '@/stores/settings.store';
import { MapStyle } from '@/types/MapStyle';
import { cn } from '@/lib/utils';
import { MENU_CARD, MENU_ROW, MenuSubRow } from './menu-parts';

const STYLES: { value: MapStyle | ''; label: string }[] = [
  { value: '', label: 'Automatisch (Material)' },
  { value: MapStyle.Streets, label: 'Straten' },
  { value: MapStyle.Outdoors, label: 'Outdoor' },
  { value: MapStyle.Satellite, label: 'Satelliet' },
];

/** Settings → Kaartstijl (phones): pick the map style ('' = automatic: the Material map, light or dark with the theme). */
export default function MapStyleSubmenu() {
  const mapStyle = useSettingsStore((state) => state.mapStyle);
  const setMapStyle = useSettingsStore((state) => state.setMapStyle);

  return (
    <DropdownMenuSub>
      <MenuSubRow>
        <LayersIcon />
        Kaartstijl
      </MenuSubRow>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className={cn(MENU_CARD, 'w-[240px]')}>
          {/* The chosen style is the light-orange row (built-in radio dot hidden) */}
          <DropdownMenuRadioGroup value={mapStyle} onValueChange={(style) => setMapStyle(style as MapStyle)} className="flex flex-col gap-0.5">
            {STYLES.map((style) => (
              <DropdownMenuRadioItem
                key={style.value}
                value={style.value}
                className={cn(
                  MENU_ROW,
                  'pl-3 [&>span:first-child]:hidden data-[state=checked]:bg-(--map-selected-bg) data-[state=checked]:text-(--map-selected-fg)',
                )}
              >
                {style.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
```

Check before writing: open `src/components/ui/dropdown-menu.tsx` and confirm `DropdownMenuCheckboxItem` and `DropdownMenuRadioItem` render the indicator `<span>` as their **first** child (so `[&>span:first-child]:hidden` hides it). If not, adjust the selector to match.

- [ ] **Step 3: Typecheck, lint, tests**

Run: `npx --yes bun x tsc -b && npx --yes bun run lint && npx --yes bun test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/LayersSubmenu.tsx src/components/settings/MapStyleSubmenu.tsx
git commit -m "feat(settings): phone layer + map style submenus in the menu card style

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Browser check

**Files:** none (fix-ups only if something is off; commit them as `fix(settings): …`).

- [ ] **Step 1: Run the client dev server** against the local server (`npx --yes bun run dev` in the client; the docker stack's server on :3000 is fine to read from, never restart it). Log in as an admin.

- [ ] **Step 2: Desktop (≥1024px), light and dark:**
  - Header shows one joined grey block, 2px seam, no border/shadow; the theme icon swaps MoonStar ↔ Sun with a rotate/scale.
  - Opening the menu turns the sliders half light orange with all corners round; closing reverts with animation.
  - Menu is a rounded card: 3 tiles, rows (Account with "naam · Admin", Beheer, Debug), red Uitloggen row; no "Hoi" label, no separators, no Discord row (`DISCORD_URL` empty).
  - Geluid tile toggles with the swap animation and the menu stays open.
  - Meldingen opens the notifications dialog; Account opens the account dialog; Beheer opens Beheer; Debug opens the debug dialog.
  - "Rondleiding" replays the tour and the settings step still points at the Rondleiding tile.

- [ ] **Step 3: Phone width (≤ 640px):** open the phone menu, open settings: Zichtbare lagen and Kaartstijl rows show a chevron; their submenus are cards; layer switches toggle and the menu stays open; the chosen map style row is light orange.

- [ ] **Step 4: Non-admin check:** with a non-admin account (or by temporarily reading `auth.admin` as false in devtools state), Beheer and Debug rows are absent and the Account row shows only the name.

- [ ] **Step 5: Final verification**

Run: `npx --yes bun x tsc -b && npx --yes bun run lint && npx --yes bun test`
Expected: all pass.
