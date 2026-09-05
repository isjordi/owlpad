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

/** In-memory full-text index over the vault, rebuilt whenever notes change. */
export class SearchIndex {
  private index: any = new Document(INDEX_CONFIG)
  private meta = new Map<string, NoteMeta>()

  async rebuild(tree: VaultTree, readBody: (id: string) => Promise<string>): Promise<void> {
    this.index = new Document(INDEX_CONFIG)
    this.meta.clear()

    for (const subject of Object.keys(tree)) {
      for (const title of Object.keys(tree[subject])) {
        for (const noteMeta of tree[subject][title]) {
          const body = await readBody(noteMeta.id)
          this.meta.set(noteMeta.id, noteMeta)
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
      .map((m) => ({ id: m.id, section: m.section, subject: m.subject, title: m.title, snippet: '' }))
  }
}
