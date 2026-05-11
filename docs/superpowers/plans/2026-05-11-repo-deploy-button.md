# Repo Deploy Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Deploy" button to the repository detail page that hands off to Netlify's "import git repository" flow with the GitHub URL prefilled.

**Architecture:** A new self-contained client component `DeployMenu` holds a `PROVIDERS` list (currently just Netlify). With one provider it renders a single anchor-styled button linking straight to the provider's deploy URL; with 2+ providers it renders a dropdown — both code paths exist from day one so adding Vercel/Cloudflare/Render later is a one-line change to `PROVIDERS`. No backend, no network calls — pure links.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, Tailwind CSS v4, `lucide-react` icons. **Note:** this project has no automated test framework configured (no `vitest`/`jest`, no test script in `package.json`). Verification in this plan is done via `npm run lint`, `npm run build`, and a manual browser check — do **not** add a test framework for this feature.

---

### Task 1: Create the `DeployMenu` component

**Files:**
- Create: `components/repositories/DeployMenu.tsx`

- [ ] **Step 1: Write the component file**

Create `components/repositories/DeployMenu.tsx` with exactly this content:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Rocket, ChevronDown } from 'lucide-react'

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
  // Add Vercel / Cloudflare Pages / Render here later — the dropdown below
  // renders automatically once there is more than one provider.
]

const BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'

export default function DeployMenu({ repoUrl }: { repoUrl: string }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Single provider: render a plain link so middle-click / cmd-click works.
  if (PROVIDERS.length === 1) {
    const provider = PROVIDERS[0]
    return (
      <a
        href={provider.deployUrl(repoUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className={BUTTON_CLASS}
      >
        <Rocket size={13} />
        Deploy
      </a>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={BUTTON_CLASS}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Rocket size={13} />
        Deploy
        <ChevronDown size={12} className="opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {PROVIDERS.map((provider) => (
            <a
              key={provider.id}
              href={provider.deployUrl(repoUrl)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Deploy to {provider.label}
            </a>
          ))}
          <p className="border-t border-gray-100 px-3 pb-1 pt-1.5 text-[11px] text-gray-400 dark:border-gray-800 dark:text-gray-500">
            You&apos;ll finish signing in on the provider&apos;s site.
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check / lint the new file**

Run: `npm run lint`
Expected: no errors or warnings referencing `components/repositories/DeployMenu.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/repositories/DeployMenu.tsx
git commit -m "Add DeployMenu component"
```

---

### Task 2: Mount `DeployMenu` in the repository detail page

**Files:**
- Modify: `app/(app)/repositories/[owner]/[repo]/page.tsx` (import near the top with the other `@/components/...` imports; render inside the action button row, currently around lines 310–346, between the "Share" `<button>` and the `<Button size="sm" onClick={() => summarize('summary')}>` "Summarize" button)

- [ ] **Step 1: Add the import**

In `app/(app)/repositories/[owner]/[repo]/page.tsx`, add this line next to the existing `import ShareRepoModal from '@/components/repositories/ShareRepoModal'` line:

```tsx
import DeployMenu from '@/components/repositories/DeployMenu'
```

- [ ] **Step 2: Render the component in the action row**

In the same file, find the action button row — the `<div className="flex flex-wrap items-center gap-2">` that contains the "GitHub" `<a>`, "VS Code" / "Clone" / "Share" `<button>`s, and the "Summarize" `<Button>`. Insert `<DeployMenu>` immediately **after** the "Share" `<button>` (the one with `onClick={handleShare}`) and immediately **before** the `<Button size="sm" onClick={() => summarize('summary')}>` line:

```tsx
                    <DeployMenu repoUrl={data.html_url} />
```

For reference, the result should look like:

```tsx
                    <button
                      onClick={handleShare}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      <Share2 size={13} />
                      Share
                    </button>
                    <DeployMenu repoUrl={data.html_url} />
                    <Button size="sm" onClick={() => summarize('summary')}>
                      <Sparkles size={13} />
                      Summarize
                    </Button>
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors or warnings referencing `app/(app)/repositories/[owner]/[repo]/page.tsx`.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build completes successfully (no TypeScript or compile errors).

- [ ] **Step 5: Manual browser check**

Run: `npm run dev`, then open a repository detail page (`/repositories/<owner>/<repo>` for a repo you can load).
Expected:
- A "Deploy" button with a rocket icon appears in the action row between "Share" and "Summarize".
- Clicking it opens `https://app.netlify.com/start/deploy?repository=<encoded github url>` in a new tab.
- Middle-click / cmd-click also opens it in a new tab (it's a real `<a>`).

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/repositories/[owner]/[repo]/page.tsx"
git commit -m "Show Deploy button on repository detail page"
```

---

## Self-Review

- **Spec coverage:**
  - "Where it lives" (action row, between Share and Summarize, only when `data` loaded, uses `data.html_url`) → Task 2, Step 2 (the row only renders inside the `!loading && !error && data` block, so the "only when loaded" requirement is satisfied by placement).
  - "Component: `components/repositories/DeployMenu.tsx`" with `repoUrl` prop, `PROVIDERS` list, Netlify entry, `Rocket` icon, anchor button styled like siblings → Task 1.
  - 1-provider vs 2+-provider rendering rules, dropdown closes on outside-click / `Escape`, helper line → Task 1, component body.
  - "No backend / nothing changes on our side" → satisfied; no API routes or state writes anywhere in the plan.
  - "Out of scope" (other providers, deploy tracking, provider config) → not implemented; `PROVIDERS` has only Netlify with a comment for future additions.
  - "Testing" → spec described automated tests, but the project has no test framework; plan substitutes lint + build + manual browser check and explicitly says not to add a framework. This is the only intentional deviation from the spec.
- **Placeholder scan:** No "TBD"/"TODO"/"handle edge cases"/"similar to Task N" — every code step shows full content. ✓
- **Type consistency:** `DeployMenu` is exported default and imported as `DeployMenu`; prop is `repoUrl: string` in both the component definition and the call site `<DeployMenu repoUrl={data.html_url} />`. `PROVIDERS` / `DeployProvider` only used within Task 1. ✓
