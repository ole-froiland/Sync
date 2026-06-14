// components/projects/folder-tree/constants.ts

/** Uniform node box width in px (locked design). */
export const NODE_W = 172
/** Uniform node box height in px. */
export const NODE_H = 42
/** Horizontal gap between sibling boxes. */
export const H_GAP = 28
/** Vertical pitch between row tops (node height + connector gap). */
export const ROW_V = 132
/** Id of the synthetic root node ("Prosjekter"). */
export const ROOT_ID = '__tree_root__'
/** Label of the synthetic root node. */
export const ROOT_LABEL = 'Prosjekter'

/** What the "+" menu can create. Maps to the existing add-flow in the page. */
export type AddKind = 'subfolder' | 'repo' | 'link' | 'app' | 'file'
