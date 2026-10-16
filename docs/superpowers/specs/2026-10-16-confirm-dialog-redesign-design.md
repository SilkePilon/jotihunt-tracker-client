# Confirm dialog redesign (option A)

Date: 2026-10-16. Picked via visual companion (`.superpowers/brainstorm/571436-1792165138/content/confirm-dialog.html`, option **A — Tonal, rustig**).

## Goal

Bring every confirm popup in line with the redesigned windows (Beheer, Account, Meldingen, Intel): 28px shell,
window surface, 12px tonal buttons. Today they render the stock shadcn AlertDialog (8px corners, outline cancel).

## Scope

- Only `src/components/ConfirmDialog.tsx` changes. All 16 confirm popups go through it (IntelChat, HintPane,
  PointCard, MarkerPopup, Life360Card, TelegramCard, ReloadTeamsDialog, DemoModeDialog, InvitesPane, AccountDialog ×5).
- `src/components/ui/alert-dialog.tsx` stays stock shadcn; styling is passed via `className`.
- Call sites and the `ConfirmDialog` props API do not change.
- Out of scope: inline confirms that do not use `ConfirmDialog` (JotiboardActions step confirm, QrConfirmDrawer,
  BeheerLayout danger Pill).

## Design

**Shell (AlertDialogContent)**
- `rounded-[28px] border-0`, shadow `0 0 0 1px var(--border), 0 18px 50px rgb(0 0 0/0.35)` (same as `DIALOG_SHELL`).
- `bg-beheer-window`, `p-6`, `sm:max-w-[400px]` (mobile keeps `max-w-[calc(100%-2rem)]`).

**Text**
- Header always left-aligned (also on mobile, overriding the centred default).
- Title: `text-lg font-bold tracking-tight`.
- Description: `text-sm leading-relaxed text-muted-foreground`.
- `children` slot stays between header and footer.

**Footer**
- Always a row, right-aligned, `gap-2`, `mt-2` (no stacking on mobile).
- Both buttons `h-10 rounded-xl px-[18px] font-semibold`.
- Cancel: tonal `bg-beheer-row-high text-foreground`, no border/shadow; hover mixes slightly stronger
  (`hover:bg-[color-mix(in_oklab,var(--foreground)_14%,var(--card))]`).
- Confirm destructive: solid `bg-destructive text-white`; dark mode `color-mix(in oklab, var(--destructive) 75%, black)`
  instead of the default `dark:bg-destructive/60`.
- Confirm normal: orange primary (Button `default`).
- Busy state unchanged: `Loader2Icon` spinner, both buttons disabled, dialog not dismissible.

**Motion**
- Overlay fades (existing).
- Content enters with scale 0.92 + 8px rise and a slight overshoot (`cubic-bezier(.2,.9,.3,1.2)`, ~320ms), exits in
  reverse (fade + scale 0.92). Use tw-animate classes (`zoom-in-[0.92]`, `slide-in-from-bottom-2`, custom ease/duration)
  so Radix still unmounts after the exit animation.

## Verification

- No existing tests cover `ConfirmDialog`; run `tsc`/lint/build and existing test suite.
- Screenshots light + dark of IntelChat "Nieuw gesprek beginnen?" (destructive), DemoModeDialog (normal) and an
  AccountDialog confirm, desktop and mobile width.
