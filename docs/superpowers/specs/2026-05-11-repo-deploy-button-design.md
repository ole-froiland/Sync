# Repo "Deploy" button — design

**Date:** 2026-05-11
**Status:** Approved

## Goal

Let a user deploy a repository to a hosting provider in one click from the repository
detail page. The button hands off to the provider's "import git repository" flow with the
GitHub URL prefilled; the user signs in and finishes setup on the provider's side. No API
keys, OAuth, or backend changes on our side.

Scope for the first iteration: **Netlify only**. The component is built so adding more
providers (Vercel, Cloudflare Pages, Render) later is a one-line change.

## Where it lives

In the action button row on the repository detail page
(`app/(app)/repositories/[owner]/[repo]/page.tsx`, the `<div>` around lines 310–346),
placed between the "Share" button and the "Summarize" button. Rendered only when `data`
is loaded. Uses `data.html_url` as the repository URL.

## Component: `components/repositories/DeployMenu.tsx`

Props:

```ts
type DeployMenuProps = {
  repoUrl: string // GitHub html_url, e.g. https://github.com/owner/repo
}
```

Internal provider list:

```ts
type DeployProvider = {
  id: string
  label: string
  deployUrl: (repoUrl: string) => string
}

const PROVIDERS: DeployProvider[] = [
  {
    id: 'netlify',
    label: 'Netlify',
    deployUrl: (repoUrl) =>
      `https://app.netlify.com/start/deploy?repository=${encodeURIComponent(repoUrl)}`,
  },
  // Add Vercel / Cloudflare Pages / Render here later.
]
```

Rendering rules:

- **1 provider** (current state): render a single button labeled **"Deploy"** with the
  `Rocket` icon from `lucide-react`, styled like the other buttons in the row
  (`inline-flex items-center gap-1.5 rounded-lg border ...`). It is an `<a>` with
  `target="_blank" rel="noopener noreferrer"` pointing straight at the provider's deploy
  URL. (Render as `<a>` so middle-click / cmd-click works.)
- **2+ providers**: the same "Deploy" button becomes a toggle that opens a small dropdown
  menu listing each provider as a link (`<a target="_blank">`). The menu closes on click
  outside and on `Escape`, following the dropdown pattern already used elsewhere in the
  app. This branch exists in the component from day one so adding a provider needs no
  structural change.

A short helper line at the bottom of the menu (only shown in the dropdown variant):
"You'll finish signing in on the provider's site."

## Behavior

- Clicking the button (1-provider case) or a menu item opens the provider's import flow in
  a new tab.
- Nothing changes on our side — no records written, no network calls.

## Out of scope

- Vercel, Cloudflare Pages, Render (added in a later iteration).
- Tracking which repos have been deployed / showing deploy status.
- Any provider-specific deploy config (`render.yaml`, `vercel.json`, etc.) — providers
  auto-detect the framework.

## Testing

- Render `DeployMenu` with a sample `repoUrl`; assert the rendered link's `href` is the
  correctly-encoded Netlify deploy URL and that it has `target="_blank"` and
  `rel="noopener noreferrer"`.
- (When the dropdown branch is exercised by a 2nd provider) assert clicking the button
  shows the menu and `Escape` / outside-click hides it.
