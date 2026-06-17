// components/projects/folder-tree/constants.ts

/** Uniform node box width in px (locked design). */
export const NODE_W = 172
/** Uniform node box height in px. */
export const NODE_H = 42
/** Horizontal gap between sibling boxes. */
export const H_GAP = 28
/** Vertical pitch between depth levels (node height + connector gap) — vertical orientation. */
export const ROW_V = 132
/** Horizontal pitch between depth levels (node width + connector gap) — horizontal orientation. */
export const COL_H = 252
/** Vertical gap between stacked siblings — horizontal orientation. */
export const V_GAP = 22
/** Id of the synthetic root node ("Prosjekter"). */
export const ROOT_ID = '__tree_root__'
/** Label of the synthetic root node. */
export const ROOT_LABEL = 'Prosjekter'

/** What the "+" menu can create. Maps to the existing add-flow in the page. */
export type AddKind = 'subfolder' | 'repo' | 'link' | 'app' | 'file'
