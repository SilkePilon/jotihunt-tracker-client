# Map Chrome Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the desktop top bar, map buttons and sidebar Hints/Hunts buttons per spec
`docs/superpowers/specs/2026-10-16-map-chrome-redesign-design.md`.

**Architecture:** Shared class strings in `src/lib/tonal-button.ts` and `src/lib/map-chrome.ts`; map controls styled in
`src/index.css` with `:has()` selectors on MapLibre's control groups (layers container gets a `map-layers-ctrl` class).

**Tech Stack:** React 19, Tailwind v4, MapLibre (react-map-gl), @mapbox-controls/ruler.

## Global Constraints
- Buttons 12px radius, never rounded-full. Every state change animates (colour fades).

---

### Task 1: Sidebar buttons (B)
Files: create `src/lib/tonal-button.ts` (`TONAL_BUTTON`, `SOFT_PRIMARY_BUTTON`); modify `src/components/sidebar/HintMiniGrid.tsx`,
`src/components/hunts/HuntsSection.tsx`. Verify lint/build; commit `feat(sidebar): tonal + soft orange Hints/Hunts buttons`.

### Task 2: Top bar (C)
Files: create `src/lib/map-chrome.ts` (`MAP_TILE`, `MAP_CHIP`); rewrite markup of `CoordinatesCard.tsx` (form tile, chip,
plain input, soft-orange Bekijk) and `SearchCard.tsx` (trigger tile). Verify; commit `feat(map): M3 top bar tiles`.

### Task 3: Map buttons (C)
Files: `src/index.css` control block; `src/components/map/MapLayersControl.tsx` container class `map-layers-ctrl`.
Verify with headless screenshots light + dark; commit `feat(map): segmented map buttons`.
