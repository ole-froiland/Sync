# Design: Interaktiv trevisning for prosjektmapper

**Dato:** 2026-06-14
**Status:** Godkjent — klar for implementeringsplan

## Mål

Legge til en ekstra visningsmodus i det eksisterende prosjektmappe-systemet: en
knapp («Vis som tre») som åpner hele mappestrukturen som et visuelt, interaktivt
organisasjonstre i et mørkt, minimalistisk overlay. Trevisningen **erstatter ikke**
liste-/grid-visningen — den er en egen visning brukeren kan åpne og lukke.

Den skal bruke **eksisterende mappedata og -handlere**, ikke et nytt system fra bunnen.

## Bakgrunn: dagens system

All relevant logikk finnes i [`app/(app)/projects/page.tsx`](../../../app/(app)/projects/page.tsx)
(stor fil, ~3500 linjer). Kort oppsummert:

- **Datamodell** (allerede et tre via `parentId`):
  - `ProjectFolder`: `{ id, name, description, color, logo?, parentId?, createdAt, members?, sharedFrom?, items: ProjectItem[] }`. Topp-mapper har `parentId === undefined`.
  - `ProjectItem`: innhold i en mappe (`type` ∈ note, link, file, task, github, docs, sheets, word, excel, notion, url, document, folder, local_folder). Vises i dag inne i en åpnet mappe.
- **Lagring:** localStorage-nøkkel `sync-project-folders-v1` + Supabase-tabell
  `project_folder_states` (JSON-blob per bruker) via `/api/project-folders` (GET/PUT/POST).
  API-et degraderer pent hvis tabellen mangler — localStorage er kilden i praksis.
- **Eksisterende visninger:** grid (standard) + en «Preview»-toggle (`previewMode`).
  Navigasjon er drill-down via `activeParentFolderId` / `selectedFolderId`.
- **Handlere som gjenbrukes (ingen nye trengs):** `createChildFolder`,
  `updateFolder` (gi nytt navn = oppdater `name`), `requestDeleteFolder` /
  `confirmDeleteFolder` (kaskaderer til etterkommere), `moveFolderIntoFolder`,
  `canMoveFolderIntoFolder`, `openFolderFromOverview`, `createItem`,
  `requestRemoveItem` / `removeItem`.
- **Hjelpere som gjenbrukes:** `folderDescendantIds`, `folderChildCount`,
  `projectFolderPath`.
- **Modaler som gjenbrukes:** `CreateFolderModal`, `CreateItemModal`, `DeleteItemModal`.
- **Stack:** Next.js 16.2.4, React 19.2.4, Tailwind 4, `framer-motion` 12.38,
  `lucide-react` 1.12, `cn()` i `lib/utils`. Mønster for overlay: `components/ui/Modal.tsx`
  (`createPortal`). Tester: vitest.

## Låst visuelt design

Bestemt via mockups (mørkt, minimalistisk «dashboard»):

- **Stil:** «minimal mono» — flate mørke bokser (`#0f1115`), hårfine kanter, **ingen glød**.
- **Noder:** fast bredde (≈172 px), lik høyde. Innhold = **kun ikon + navn, sentrert**
  (horisontalt og vertikalt). Lange navn kuttes med «…» (fullt navn via `title`/tooltip).
- **Aktiv mappe:** tynn lilla ring (`rgba(167,139,250,.7)`) + litt lysere tekst. Lilla
  matcher appens aksent.
- **Aktiv sti:** linjene + forfedrene fra rot ned til «mappa du står i» får dempet lilla;
  søsken-grener forblir nøytralt dempet.
- **Streker:** tegnes som **presise SVG-segmenter** (vinkel/elbow), møtes eksakt i T-kryss
  (ingen overskytende stubber — CSS-kant-streker ble forkastet pga. nettopp dette).
- **Ekspander/kollaps:** liten knapp **under** boksen. Antall barn vises **kun når mappa er
  kollapset** (liten «N ⌄»-brikke), aldri klemt inni den sentrerte teksten.
- **Innhold som noder:** mapper *og* items (repo/docs/…) vises. Items er løvnoder med
  type-spesifikt ikon (GitHub, fil, lenke …), uten ekspander-knapp.
- **Node-handlinger:** hover-/valgt-verktøylinje over noden — **Åpne · + (Legg til) · Gi
  nytt navn · Slett** — og **høyreklikk** gir samme meny (valg «A»).
- **«+» (Legg til):** åpner full type-meny (Undermappe, Repo, Lenke/URL, Google Docs,
  Sheets, Word, Excel, Notion, Last opp fil, Notat, Oppgave) som **gjenbruker** eksisterende
  `CreateFolderModal` / `CreateItemModal`-flyt.
- **Lerret:** mørkt med diskré prikkemønster (antyder pan/zoom-flate).
- **Kontroller nederst til høyre:** zoom −/100 %/＋ og en egen **«Tilbakestill visning»**.
- **Header:** tittel «Mappetre» + sti (breadcrumb) + lukk-kryss.
- Overlay-et er **alltid mørkt**, uavhengig av appens lys/mørk-tema (bevisst «cockpit»-følelse).

## Tilnærming: egen build (ingen nye avhengigheter)

Bygges med SVG-streker + sentrerte node-bokser + egen pan/zoom + `framer-motion` (allerede
installert). Gir eksakt det låste uttrykket, ingen ekstra pakker, full kontroll på rolige
animasjoner.

Forkastet: **React Flow / @xyflow** (krever mye omstyling + eget layout-bibliotek + 1–2 nye
avhengigheter for et bespoke uttrykk vi allerede har tegnet) og **ren CSS-nested-liste**
(ingen pan/zoom, og strekene skjøt forbi i hjørnene).

## Arkitektur — modulær, koblet på det eksisterende

Alt nytt i én mappe: **`components/projects/folder-tree/`**

| Fil | Ansvar | Avhenger av |
|---|---|---|
| `FolderTreeOverlay.tsx` | Full-skjerm overlay: header, lerret, kontroller, lukk. Eier pan/zoom- og kollaps-tilstand. Limet mellom de andre enhetene. | de øvrige + props fra siden |
| `buildTreeLayout.ts` | **Ren funksjon:** `(folders, collapsed, currentId) → { nodes: {id,kind,x,y,…}[], edges: Edge[], activePath: Set<string> }`. Top-down «tidy tree» med fast nodebredde. | kun datamodellen |
| `TreeConnectors.tsx` | SVG-lag som tegner edges som presise elbow-paths; lilla på aktiv sti, dempet ellers. | `buildTreeLayout`-output |
| `TreeNode.tsx` | Én boks (mappe ELLER item): sentrert ikon + navn, ring på aktiv, ekspander-knapp, hover-verktøylinje, høyreklikk. | `lucide-react`, callbacks |
| `CreateMenu.tsx` | «+»-type-menyen; velger åpner riktig eksisterende modal. | `CreateItemModal`/`CreateFolderModal` |
| `usePanZoom.ts` | Dra/panorer + hjul-zoom (mot peker) + `fitToView()`/`reset()`. Flyktig tilstand. | — |

**Eneste fil som endres:** [`app/(app)/projects/page.tsx`](../../../app/(app)/projects/page.tsx)
- Ny **«Vis som tre»**-knapp i oversikts-verktøylinjen (ved siden av «Preview»).
- Ny `treeOpen`-state.
- Render `<FolderTreeOverlay open={treeOpen} … />` med `folders` + eksisterende handlere
  sendt inn som props.
- Vurder å trekke ut mappe-state/handlere til en `useProjectFolders`-hook for å holde siden
   slank og dele logikk — kun hvis det ikke øker risiko; ellers send props direkte.

## Dataflyt

Overlay-et er **presentasjon over samme `folders`-array**. Alle mutasjoner går gjennom sidens
eksisterende `setFolders`-baserte handlere → localStorage- + Supabase-synking virker
**uendret**. Treet bygges av `parentId` (mapper) + `folder.items` (items som løvnoder) under
én syntetisk rot.

## Layout-algoritme (`buildTreeLayout`)

1. Bygg node-tre fra syntetisk rot «Prosjekter» → topp-mapper → undermapper → items.
2. Skjul barn under kollapsede mapper.
3. `y = depth * radHøyde`.
4. `x` via post-order: løvnoder får sekvensielle slots (`nodebredde + gap`); en forelder
   sentreres over barna sine (midtpunkt). Start med enkel variant; oppgrader til full
   Reingold–Tilford bare hvis subtrær overlapper.
5. Edges: for hver synlig forelder→barn, elbow `forelder bunn-senter → buss-y → barn x → barn
   topp-senter`.
6. `activePath`: noder/edges fra rot til `currentId` markeres.

## Oppførsel / interaksjon (godkjente defaults)

1. **Rot:** én syntetisk «Prosjekter»-node øverst samler alle topp-mapper.
2. **Standard-ekspansjon ved åpning:** stien til mappa brukeren sto i er åpen, resten kollapset.
3. **Åpne:** kaller `openFolderFromOverview(folderId)` (eller item-åpning) og lukker overlay-et
   — hopper til mappa i det vanlige systemet. (Ingen Next-router nødvendig; sidens egen state.)
4. **Pan/zoom:** åpner i `fitToView`; «Tilbakestill visning» = `fitToView`; tilstanden huskes
   ikke mellom åpninger.
5. **Klikk på mappe** = ekspander/kollaps. **Klikk på item** = åpne. Verktøylinje/høyreklikk
   for handlinger.
6. **Items (løvnoder):** Åpne / Slett (gjenbruker `requestRemoveItem`). Mapper har i tillegg
   «Gi nytt navn» + «+».
7. **Sletting** bruker eksisterende bekreftelse + kaskade (`confirmDeleteFolder`).

## Tilgjengelighet / tema

- `Escape` lukker (som `Modal`). Fokusfelle i overlay-et. Noder er tastatur-fokuserbare med
  `aria-label`; kontroller har `aria-label`.
- Overlay alltid mørkt (bevisst), uavhengig av appens tema.

## Testing

- **`buildTreeLayout`** enhetstestes (vitest): gitt mappe-fixture + `collapsed` + `currentId`
  → forventet antall noder, relativ posisjonering, edges og `activePath`. Ren funksjon =
  lett å teste isolert.
- Lett røyktest av `usePanZoom`-matematikk (fit/zoom-mot-peker) der det er praktisk.

## Utenfor scope (YAGNI)

Dra-og-slipp omorganisering inne i treet (beholdes i grid-visningen), minikart, og
multi-select. Kan legges til senere uten å endre arkitekturen over.

## Implementeringsnotater

- Prosjektets `AGENTS.md`: «This is NOT the Next.js you know» — **les relevant guide i
  `node_modules/next/dist/docs/` før koding** (særlig client-component-/portal-detaljer).
  Trevisningen er en `'use client'`-komponent, så Next-spesifikke API-er er minimale.
- Følg eksisterende stil: `cn()`, Tailwind-klasser, `lucide-react`-ikoner, Modal/`createPortal`-mønster.
