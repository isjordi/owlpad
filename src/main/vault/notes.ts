import { promises as fs } from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { nanoid } from 'nanoid'
import type { Note, NoteMeta, NewNoteInput, UpdateNoteInput, VaultTree } from '../../shared/types'

interface FrontMatter {
  id: string
  section: string
  subject: string
  title: string
  createdAt: string
  updatedAt: string
}

export function sanitizeSegment(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').slice(0, 80)
  return cleaned || 'Untitled'
}

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'note'
}

/** Reads/writes the on-disk vault: <root>/<Subject>/<Title>/<slug>-<id>.md */
export class VaultManager {
  private idToPath = new Map<string, string>()

  constructor(private root: string) {}

  private async ensureRoot(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true })
  }

  private async exists(p: string): Promise<boolean> {
    try {
      await fs.access(p)
      return true
    } catch {
      return false
    }
  }

  private async listDirs(dir: string): Promise<string[]> {
    if (!(await this.exists(dir))) return []
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name)
  }

  async scan(): Promise<VaultTree> {
    await this.ensureRoot()
    this.idToPath.clear()
    const tree: VaultTree = {}

    const subjects = await this.listDirs(this.root)
    for (const subject of subjects) {
      const subjectPath = path.join(this.root, subject)
      const titles = await this.listDirs(subjectPath)
      // Titles are ordered by their earliest note's createdAt — a title's "creation" is really
      // just the creation of its first note — so the oldest title stays on top and new ones stack
      // to the bottom. Plain objects preserve string-key insertion order, so building tree[subject]
      // in this order is what makes Object.keys(...) downstream reflect it.
      const titleEntries: { title: string; metas: NoteMeta[]; earliestCreatedAt: string }[] = []
      for (const title of titles) {
        const titlePath = path.join(subjectPath, title)
        const files = (await fs.readdir(titlePath)).filter((f) => f.endsWith('.md'))
        const metas: NoteMeta[] = []
        for (const file of files) {
          const filePath = path.join(titlePath, file)
          try {
            const raw = await fs.readFile(filePath, 'utf-8')
            const parsed = matter(raw)
            const fm = parsed.data as Partial<FrontMatter>
            if (!fm.id) continue
            this.idToPath.set(fm.id, filePath)
            metas.push({
              id: fm.id,
              section: fm.section ?? path.basename(file, '.md'),
              subject,
              title,
              path: filePath,
              createdAt: fm.createdAt ?? '',
              updatedAt: fm.updatedAt ?? ''
            })
          } catch {
            // skip unreadable/corrupt file rather than failing the whole scan
          }
        }
        metas.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        titleEntries.push({ title, metas, earliestCreatedAt: metas[0]?.createdAt ?? '￿' })
      }
      titleEntries.sort((a, b) => a.earliestCreatedAt.localeCompare(b.earliestCreatedAt))
      tree[subject] = {}
      for (const entry of titleEntries) {
        tree[subject][entry.title] = entry.metas
      }
    }
    return tree
  }

  async readNote(id: string): Promise<Note | null> {
    const filePath = this.idToPath.get(id)
    if (!filePath) return null
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = matter(raw)
    const fm = parsed.data as FrontMatter
    return {
      id: fm.id,
      section: fm.section,
      subject: fm.subject,
      title: fm.title,
      path: filePath,
      createdAt: fm.createdAt,
      updatedAt: fm.updatedAt,
      body: parsed.content.replace(/^\n+/, '')
    }
  }

  async createNote(input: NewNoteInput): Promise<Note> {
    const subject = sanitizeSegment(input.subject)
    const title = sanitizeSegment(input.title)
    const id = nanoid(10)
    const now = new Date().toISOString()
    const dir = path.join(this.root, subject, title)
    await fs.mkdir(dir, { recursive: true })

    const filename = `${slugify(input.section)}-${id}.md`
    const filePath = path.join(dir, filename)

    const fm: FrontMatter = {
      id,
      section: input.section.trim() || 'Untitled',
      subject,
      title,
      createdAt: now,
      updatedAt: now
    }
    const content = matter.stringify(input.body ?? '', fm)
    await fs.writeFile(filePath, content, 'utf-8')
    this.idToPath.set(id, filePath)

    return { ...fm, path: filePath, body: input.body ?? '' }
  }

  async updateNote(id: string, patch: UpdateNoteInput): Promise<Note> {
    const filePath = this.idToPath.get(id)
    if (!filePath) throw new Error('Note not found')

    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = matter(raw)
    const fm = parsed.data as FrontMatter

    const updatedFm: FrontMatter = {
      ...fm,
      section: patch.section !== undefined ? patch.section.trim() || fm.section : fm.section,
      updatedAt: new Date().toISOString()
    }
    const body = patch.body !== undefined ? patch.body : parsed.content

    const content = matter.stringify(body, updatedFm)
    await fs.writeFile(filePath, content, 'utf-8')

    return { ...updatedFm, path: filePath, body }
  }

  async deleteNote(id: string): Promise<void> {
    const filePath = this.idToPath.get(id)
    if (!filePath) return
    await fs.unlink(filePath)
    this.idToPath.delete(id)
  }

  async renameTitle(subject: string, oldTitle: string, newTitle: string): Promise<void> {
    const subjectDir = sanitizeSegment(subject)
    const from = path.join(this.root, subjectDir, sanitizeSegment(oldTitle))
    const cleanNewTitle = sanitizeSegment(newTitle)
    const to = path.join(this.root, subjectDir, cleanNewTitle)
    if (from === to) return
    if (await this.exists(to)) {
      throw new Error(`"${cleanNewTitle}" already exists in this subject.`)
    }
    await fs.rename(from, to)

    const files = (await fs.readdir(to)).filter((f) => f.endsWith('.md'))
    for (const file of files) {
      const filePath = path.join(to, file)
      try {
        const raw = await fs.readFile(filePath, 'utf-8')
        const parsed = matter(raw)
        const fm = parsed.data as FrontMatter
        const content = matter.stringify(parsed.content, { ...fm, title: cleanNewTitle })
        await fs.writeFile(filePath, content, 'utf-8')
      } catch {
        // skip unreadable/corrupt file rather than failing the whole rename
      }
    }
  }

  async deleteTitle(subject: string, title: string): Promise<void> {
    const dir = path.join(this.root, sanitizeSegment(subject), sanitizeSegment(title))
    await fs.rm(dir, { recursive: true, force: true })
  }

  async deleteSubject(subject: string): Promise<void> {
    const dir = path.join(this.root, sanitizeSegment(subject))
    await fs.rm(dir, { recursive: true, force: true })
  }
}
