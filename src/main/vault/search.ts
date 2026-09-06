import { Document } from 'flexsearch'
import type { NoteMeta, SearchResult, VaultTree } from '../../shared/types'

// flexsearch's TS generics are awkward for a dynamic document shape; `any` keeps this pragmatic.
const INDEX_CONFIG: any = {
  document: {
    id: 'id',
    index: ['section', 'body', 'subject', 'title']
  },
  tokenize: 'forward'
}

const SNIPPET_CONTEXT_CHARS = 60

/** Plain-text excerpt of `body` centered on the first occurrence of `query`, for the search
 * results list — the renderer highlights the matched word within it. Falls back to the start of
 * the body when the match is only in another indexed field (title, subject, section). */
function buildSnippet(body: string, query: string): string {
  const trimmedQuery = query.trim()
  const idx = trimmedQuery ? body.toLowerCase().indexOf(trimmedQuery.toLowerCase()) : -1
  if (idx === -1) return body.slice(0, SNIPPET_CONTEXT_CHARS * 2).trim()

  const start = Math.max(0, idx - SNIPPET_CONTEXT_CHARS)
  const end = Math.min(body.length, idx + trimmedQuery.length + SNIPPET_CONTEXT_CHARS)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < body.length ? '…' : ''
  return prefix + body.slice(start, end).trim() + suffix
}

/** In-memory full-text index over the vault, rebuilt whenever notes change. */
export class SearchIndex {
  private index: any = new Document(INDEX_CONFIG)
  private meta = new Map<string, NoteMeta>()
  private bodies = new Map<string, string>()

  async rebuild(tree: VaultTree, readBody: (id: string) => Promise<string>): Promise<void> {
    this.index = new Document(INDEX_CONFIG)
    this.meta.clear()
    this.bodies.clear()

    for (const subject of Object.keys(tree)) {
      for (const title of Object.keys(tree[subject])) {
        for (const noteMeta of tree[subject][title]) {
          const body = await readBody(noteMeta.id)
          this.meta.set(noteMeta.id, noteMeta)
          this.bodies.set(noteMeta.id, body)
          this.index.add({
            id: noteMeta.id,
            section: noteMeta.section,
            body,
            subject: noteMeta.subject,
            title: noteMeta.title
          })
        }
      }
    }
  }

  search(query: string, limit = 20): SearchResult[] {
    if (!query.trim()) return []
    const results = this.index.search(query, { limit, enrich: false }) as Array<{
      field: string
      result: string[]
    }>

    const ids = new Set<string>()
    for (const r of results) for (const id of r.result) ids.add(id)

    return Array.from(ids)
      .map((id) => this.meta.get(id))
      .filter((m): m is NoteMeta => !!m)
      .slice(0, limit)
      .map((m) => ({
        id: m.id,
        section: m.section,
        subject: m.subject,
        title: m.title,
        snippet: buildSnippet(this.bodies.get(m.id) ?? '', query)
      }))
  }
}
