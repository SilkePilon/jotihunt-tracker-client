# Confirm Dialog Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every confirm popup to option A (28px shell, window surface, tonal 12px buttons, pop-in motion).

**Architecture:** All 16 confirm popups render `src/components/ConfirmDialog.tsx`. Pass `className` overrides to the
stock shadcn AlertDialog parts there; `ui/alert-dialog.tsx` and call sites stay untouched.

**Tech Stack:** React 19, Radix AlertDialog (shadcn), Tailwind v4 + tw-animate-css, tailwind-merge via `cn`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-16-confirm-dialog-redesign-design.md`.
- Buttons 12px radius (`rounded-xl`), never `rounded-full`.
- Every state change animates (enter + exit).
- Props API of `ConfirmDialog` unchanged.

---

### Task 1: Restyle ConfirmDialog

**Files:**
- Modify: `src/components/ConfirmDialog.tsx`

**Interfaces:**
- Consumes: `AlertDialog*` parts from `@/components/ui/alert-dialog` (accept `className`).
- Produces: nothing new; same default export and props.

Note: `cn` (tailwind-merge) only replaces classes with the same variant prefix, so variant-prefixed defaults
(`data-[size=default]:sm:max-w-lg`, `data-[state=open]:zoom-in-95`, `sm:place-items-start`) must be overridden with the
same prefix.

- [ ] **Step 1: Add class constants and apply them**

```tsx
const CONTENT =
  'gap-0 rounded-[28px] border-0 bg-beheer-window p-6 shadow-[0_0_0_1px_var(--border),0_18px_50px_rgb(0_0_0/0.35)] data-[size=default]:sm:max-w-[400px] data-[state=open]:duration-[320ms] data-[state=open]:ease-[cubic-bezier(0.2,0.9,0.3,1.2)] data-[state=open]:zoom-in-[0.92] data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:duration-150 data-[state=closed]:ease-[cubic-bezier(0.3,0,0.8,0.15)] data-[state=closed]:zoom-out-[0.92] data-[state=closed]:slide-out-to-bottom-2 motion-reduce:animate-none';
const HEADER = 'place-items-start gap-1.5 text-left';
const BUTTON = 'h-10 rounded-xl px-[18px] font-semibold shadow-none';
const CANCEL = `${BUTTON} border-0 bg-beheer-row-high text-foreground hover:bg-[color-mix(in_oklab,var(--foreground)_14%,var(--card))] hover:text-foreground dark:bg-beheer-row-high dark:hover:bg-[color-mix(in_oklab,var(--foreground)_14%,var(--card))]`;
const DESTRUCTIVE = 'dark:bg-[color-mix(in_oklab,var(--destructive)_75%,black)] dark:hover:bg-[color-mix(in_oklab,var(--destructive)_65%,black)]';
```

JSX: `<AlertDialogContent className={CONTENT}>`, `<AlertDialogHeader className={HEADER}>`,
`<AlertDialogTitle className="text-lg font-bold tracking-tight">`,
`<AlertDialogDescription className="leading-relaxed">`, children wrapped as before,
`<AlertDialogFooter className="mt-6 flex-row justify-end">`, `<AlertDialogCancel className={CANCEL}>`,
`<AlertDialogAction className={cn(BUTTON, destructive && DESTRUCTIVE)}>`. When `children` is set, wrap in
`<div className="mt-4">` since the content gap becomes 0.

- [ ] **Step 2: Verify**

Run: `npx bun run lint && npx bun run build && npx bun test`
Expected: all pass.

Then open the app (dev server), trigger IntelChat "Nieuw gesprek" (destructive) and Demo mode (normal), screenshot
light + dark at desktop and 390px width. Check: 28px corners, left text, buttons side by side, pop-in animation,
computed `--tw-enter-scale` is 0.92.

- [ ] **Step 3: Commit**

```bash
git add src/components/ConfirmDialog.tsx
git commit -m "feat(confirm-dialog): tonal 28px shell + 12px buttons (option A)"
```
