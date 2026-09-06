import type { ReactNode } from 'react'

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Wraps every case-insensitive occurrence of `query` in `text` with a <mark>, for highlighting
 * search matches in note previews. Returns `text` unchanged when there's nothing to match. */
export function highlightMatches(text: string, query: string): ReactNode {
  const trimmed = query.trim()
  if (!trimmed) return text

  const parts = text.split(new RegExp(`(${escapeRegExp(trimmed)})`, 'gi'))
  if (parts.length === 1) return text

  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="owl-search-highlight">
        {part}
      </mark>
    ) : (
      part
    )
  )
}
