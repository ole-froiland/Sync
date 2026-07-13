export type ExternalOpenTarget = {
  href: string
  revoke?: () => void
}

export function dataUrlToBlobUrl(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/i)
  if (!match) return null

  const [, mime = 'application/octet-stream', base64Flag, payload] = match
  try {
    if (base64Flag) {
      const binary = atob(payload)
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
      return URL.createObjectURL(new Blob([bytes], { type: mime }))
    }

    return URL.createObjectURL(new Blob([decodeURIComponent(payload)], { type: mime }))
  } catch {
    return null
  }
}

/** Converts data URLs to blob URLs because browsers block data URLs in new tabs. */
export function externalOpenTarget(href: string): ExternalOpenTarget {
  if (!href.startsWith('data:')) return { href }

  const blobUrl = dataUrlToBlobUrl(href)
  if (!blobUrl) return { href }

  return {
    href: blobUrl,
    revoke: () => URL.revokeObjectURL(blobUrl),
  }
}

export function openExternalUrl(href: string) {
  const target = externalOpenTarget(href)
  window.open(target.href, '_blank', 'noopener,noreferrer')
  if (target.revoke) window.setTimeout(target.revoke, 60_000)
}
