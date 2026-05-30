# Mobile Foundation — Design

## Background

The Sync app is built for desktop. The shell components (`AppShell`, `Sidebar`, `TopBar`, `GlobalPrimaryActions`) contain no responsive Tailwind classes (`md:`, `lg:`) — the sidebar is always visible at full width, and there is no mobile navigation pattern. Pages render below 1024px but the chrome of the app is unusable on phones and iPad portrait.

**Goal:** Make the *shell* of the app mobile-friendly. After this work, the navigation experience on phone and iPad portrait should feel native (hamburger drawer + bottom nav), while iPad landscape and desktop continue to use the existing sidebar exactly as today.

This is the **foundation** for a larger mobile effort. Page-level content (calendar grid, chat split view, projects board, etc.) is explicitly out of scope — each page will get its own brainstorm / spec / plan / implementation cycle later, on top of this foundation.

## Scope

**In scope:**
- One breakpoint (`lg:` = ≥1024px) governs desktop vs. mobile chrome.
- Replace persistent sidebar with hamburger-triggered drawer on mobile.
- New bottom navigation bar on mobile with four destinations: Calendar, Notes, Chat, Dashboard.
- Hamburger button in `TopBar` on mobile.
- Drawer slides in from the left, contains the existing sidebar nav content (DRY via shared `SidebarContent` component).
- Drawer auto-closes on route change and on overlay/Escape.
- Body scroll locked while drawer is open.
- iOS safe-area handling (notch top, home-indicator bottom) via `env(safe-area-inset-*)`.
- `100dvh` instead of `100vh` to handle mobile address bars.
- All interactive elements meet 44×44pt minimum touch target.
- `<main>` content area gets bottom padding on mobile so content does not hide beneath bottom nav.
- Active state on bottom nav matches existing sidebar's purple active styling.

**Out of scope:**
- Individual page layouts (calendar grid, chat panes, projects board, etc.) — each is its own future project.
- Touch-friendly replacements for hover-only states inside pages.
- Drag-and-drop on touch (project-folder DnD will likely not work on mobile, deferred).
- Forms / inputs / modals inside pages.
- Tablet-specific (not phone, not desktop) treatments beyond the `lg:` breakpoint.
- Notes page — already mobile-optimized; we only verify it still works after shell changes.

## Breakpoint policy

| Width | Mode | Sidebar | TopBar hamburger | Bottom nav |
|---|---|---|---|---|
| `< 1024px` (phone, iPad portrait) | Mobile | Hidden, opens via drawer | Visible | Visible |
| `≥ 1024px` (iPad landscape, desktop) | Desktop | Visible (as today) | Hidden | Hidden |

Only the `lg:` Tailwind prefix is used. No `md:` or `sm:`. One threshold = one mental model = fewer edge cases.

## Architecture

### Components

```
components/layout/
├── AppShell.tsx              — modify: conditional render + bottom padding for mobile main
├── Sidebar.tsx               — modify: lift nav body into SidebarContent
├── SidebarContent.tsx        — NEW: the nav list itself, no outer chrome
├── TopBar.tsx                — modify: add hamburger button (lg:hidden)
├── MobileDrawer.tsx          — NEW: portal-based slide-in drawer wrapping SidebarContent
├── BottomNav.tsx             — NEW: fixed bottom tab bar (lg:hidden)
└── GlobalPrimaryActions.tsx  — unchanged
```

### Composition

`AppShell` after refactor:

```tsx
<div className="flex h-[100dvh] bg-gray-50 dark:bg-gray-950 overflow-hidden">
  {/* Desktop sidebar — hidden below lg */}
  <Sidebar className="hidden lg:flex" ... />

  {/* Mobile drawer — hidden at lg+; controlled by drawerOpen state */}
  <MobileDrawer
    open={drawerOpen}
    onClose={() => setDrawerOpen(false)}
    profile={profile}
    onSignOut={handleSignOut}
    signingOut={signingOut}
  />

  <main className="flex-1 flex flex-col overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
    <TopBar onOpenDrawer={() => setDrawerOpen(true)} />
    <GlobalPrimaryActions />
    {children}
  </main>

  {/* Mobile bottom nav — hidden at lg+ */}
  <BottomNav className="lg:hidden" />
</div>
```

(Bottom nav is a fixed-positioned overlay sibling rather than a flex child, so it floats above `<main>` content without affecting flex layout. `<main>`'s bottom padding reserves vertical space — 4rem for the nav itself plus the iPhone safe-area inset — so the page does not hide under it.)

### Component responsibilities

**`SidebarContent.tsx`** — the navigation list and user actions. No outer container, no width, no border. Takes the same props as `Sidebar` (profile, onSignOut, signingOut). Renders the nav links, project list, settings link, sign-out, etc. Pure composition. Used by both `Sidebar` and `MobileDrawer`.

**`Sidebar.tsx` (after refactor)** — outer chrome only: width, border, background. Inner body is `<SidebarContent />`. Existing visual look on desktop is preserved exactly.

**`MobileDrawer.tsx`** — portal-rendered drawer. Slides in from left. Backdrop overlay closes it. Mounts `<SidebarContent />` inside. Body scroll locked while open. Listens to `usePathname()` and auto-closes when the path changes (so tapping a link in the drawer navigates and closes).

**`BottomNav.tsx`** — fixed bar at `bottom-0 left-0 right-0`, height ~64px including safe-area inset. Four tabs (Calendar, Notes, Chat, Dashboard). Each tab is icon + small label. Active tab highlighted in purple (same shade as Sidebar's active state). `lg:hidden`.

**`TopBar.tsx` (after refactor)** — adds a hamburger `IconButton` on the left, visible only `lg:hidden`. Calls `onOpenDrawer` prop. Everything else in TopBar stays the same; it's just one extra icon at the start.

**`AppShell.tsx` (after refactor)** — owns `drawerOpen` state. Passes setters/getters to TopBar and MobileDrawer. Applies `pb-16` to `<main>` so bottom-nav doesn't overlap content.

### Bottom nav destinations

| Order | Route | Icon (lucide-react) | Label |
|---|---|---|---|
| 1 | `/dashboard` | `LayoutDashboard` | Dashboard |
| 2 | `/calendar` | `CalendarDays` | Calendar |
| 3 | `/notes` | `StickyNote` | Notes |
| 4 | `/chat` | `MessageSquare` | Chat |

Order: Dashboard first because it's "home base," then time-oriented (Calendar), capture (Notes), communication (Chat). Active = `usePathname()` starts with the route.

## Mobile-specific details

### Safe areas

`AppShell`'s outer container uses `h-[100dvh]` instead of `h-screen`. Bottom nav gets `pb-[env(safe-area-inset-bottom)]` so it clears the iPhone home indicator. TopBar may need `pt-[env(safe-area-inset-top)]` only if the app is installed as PWA fullscreen; in browser-with-chrome it's not needed. Apply defensively now to handle both.

### Touch targets

Hamburger button: at least 44×44pt with adequate hit area (padding inside the icon). Bottom-nav tabs: full width of their flex cell, height ≥56px including label. Drawer rows: padding `py-3` ensures tap targets exceed 44pt.

### Scroll-lock

When `drawerOpen` becomes true, set `document.body.style.overflow = 'hidden'`. Restore on close. Use a `useEffect` in `MobileDrawer`, cleanup on unmount. Standard pattern.

### Drawer animation

Slide in from `-translate-x-full` to `translate-x-0` over ~200ms. Backdrop fades from `opacity-0` to `opacity-100`. Use Tailwind's `transition-transform`. No `framer-motion` needed (although it's already a project dep — keep it simple).

### Active state styling

Bottom nav active tab:
- Icon color: `text-purple-600 dark:text-purple-400` (matches sidebar active)
- Label color: same
- Background: subtle (`bg-purple-50 dark:bg-purple-950/40`) only on the rounded icon container, not the whole cell

Inactive: `text-gray-500 dark:text-gray-400`.

### Drawer visual treatment

The drawer should look like the sidebar but full-height. Same width as the existing sidebar (~256px). Same internal padding and typography. No different "mobile look" — keep it consistent so users learn one design language.

## Files touched

| Path | Status | What changes |
|---|---|---|
| `components/layout/AppShell.tsx` | modify | Owns `drawerOpen` state; conditional sidebar visibility; bottom padding for mobile main |
| `components/layout/Sidebar.tsx` | modify | Strip nav body, render `<SidebarContent />`, keep desktop outer chrome only; accept `className` to hide on mobile |
| `components/layout/SidebarContent.tsx` | NEW | All the nav links and user actions, previously inside `Sidebar.tsx` |
| `components/layout/TopBar.tsx` | modify | Add hamburger button on mobile via `onOpenDrawer` prop |
| `components/layout/MobileDrawer.tsx` | NEW | Portal-based slide-in drawer using `<SidebarContent />` |
| `components/layout/BottomNav.tsx` | NEW | Fixed bottom tab bar with 4 destinations |

## Verification

Manual smoke test plan:

1. **Desktop unchanged** (≥1024px viewport): app looks identical to today. Sidebar always visible. No hamburger. No bottom nav.
2. **Phone viewport** (e.g., iPhone 14 = 390×844 in DevTools): sidebar hidden, hamburger visible in TopBar, bottom nav visible. Content has space at the bottom (not hidden under bottom nav).
3. **Open drawer:** tap hamburger → drawer slides in from left. Body does not scroll behind it.
4. **Close drawer:** tap overlay, press Escape, or tap a nav link → drawer closes.
5. **Bottom nav navigation:** tap each of the 4 tabs → navigates to the right page. Active tab is highlighted in purple.
6. **iPad portrait** (810×1080): same as phone — mobile chrome.
7. **iPad landscape** (1180×820): same as desktop — sidebar visible, no hamburger, no bottom nav.
8. **iPhone home indicator:** install as PWA or test in Safari — bottom nav clears the home indicator area, no content cut off.
9. **Notes page** (already mobile-friendly): still works correctly inside the new shell.
10. **No new TypeScript errors:** `npx tsc --noEmit`.
11. **No new lint errors:** `npm run lint`.

## Project conventions

- Per `AGENTS.md`: "This is NOT the Next.js you know" — consult `node_modules/next/dist/docs/` before introducing new App Router patterns.
- Match existing Tailwind class style (dark-mode variants, `border-gray-200 dark:border-gray-800`, purple accents).
- Match existing `lucide-react` icon usage.
- Use `cn()` from `@/lib/utils` for conditional class merging (existing pattern).

## Open decisions resolved with user

| Decision | Choice |
|---|---|
| Mobile nav pattern | Hamburger + bottom nav (both) |
| Bottom nav destinations | Calendar, Notes, Chat, Dashboard |
| iPad behavior | Portrait = mobile; landscape = desktop (governed by `lg:` 1024px breakpoint) |
| Scope of this spec | Foundation only — individual pages are out of scope |
