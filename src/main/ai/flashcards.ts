import type { AIProvider } from './provider'
import type { AINoteContext, FlashCard } from '../../shared/types'

const DEFAULT_CARD_COUNT = 6
const DUPLICATE_WORD_OVERLAP_THRESHOLD = 0.6

const FLASHCARD_SCHEMA = {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' }
        },
        required: ['question', 'answer']
      }
    }
  },
  required: ['cards']
}

function isValidCard(c: unknown): c is FlashCard {
  if (!c || typeof c !== 'object') return false
  const candidate = c as Record<string, unknown>
  return (
    typeof candidate.question === 'string' &&
    candidate.question.trim().length > 0 &&
    typeof candidate.answer === 'string' &&
    candidate.answer.trim().length > 0
  )
}

function wordSet(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean))
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const word of a) if (b.has(word)) intersection++
  return intersection / (a.size + b.size - intersection)
}

/**
 * Drops cards whose question closely overlaps an earlier one. Near-duplicate questions are a
 * quality problem on their own, and empirically also correlate with the model cross-wiring
 * answers between the two similar questions.
 */
function dropNearDuplicates(cards: FlashCard[]): FlashCard[] {
  const kept: FlashCard[] = []
  const keptWordSets: Set<string>[] = []
  for (const card of cards) {
    const words = wordSet(card.question)
    const isDuplicate = keptWordSets.some(
      (existing) => jaccardSimilarity(existing, words) >= DUPLICATE_WORD_OVERLAP_THRESHOLD
    )
    if (!isDuplicate) {
      kept.push(card)
      keptWordSets.push(words)
    }
  }
  return kept
}

export async function generateFlashcards(
  provider: AIProvider,
  model: string,
  noteContext: AINoteContext,
  count: number = DEFAULT_CARD_COUNT
): Promise<FlashCard[]> {
  const system =
    'You are Owly, a study assistant that writes active-recall flashcards. You will be given ' +
    'exactly one note — a single section the student wrote. Every fact must come from that note ' +
    "— do not test outside facts, even true ones, if they aren't written in the note. Write " +
    'prompts that make the student retrieve the answer from memory, not recognize it — avoid ' +
    "yes/no or true/false questions, since those don't exercise real recall. Each answer must be " +
    'a complete, coherent, self-contained statement in your own words (not a copied fragment) ' +
    'that would make sense to someone who has never seen the note. If the note is too short or ' +
    'thin to support a deep question, ask a more literal, direct question about its content ' +
    'rather than inventing something not stated. Every card must ask about a clearly different ' +
    'fact from every other card — two cards must never ask near-identical questions, even ' +
    'reworded, since that causes answers to get mixed up between them. Before moving to the next ' +
    'card, re-read the current question and re-check that its answer — and only its answer — ' +
    'actually responds to it.'

  const prompt = `The note (the only source you may draw facts from):\n\nSubject: ${noteContext.subject}\nTitle: ${noteContext.title}\nSection: ${noteContext.section}\n\n${noteContext.body}\n\n---\n\nWrite ${count} active-recall flashcards (question + answer) covering this note, staying strictly within what it actually says. Return them via the required JSON schema.`

  const result = await provider.generateJSON({ system, prompt, model, schema: FLASHCARD_SCHEMA })
  const raw = (result as { cards?: unknown[] })?.cards

  if (!Array.isArray(raw)) {
    throw new Error("Owly's flashcards came back in an unexpected format. Try again.")
  }

  const cards = dropNearDuplicates(raw.filter(isValidCard)).slice(0, count)
  if (cards.length === 0) {
    throw new Error("Owly couldn't generate valid flashcards from this note. Try again.")
  }

  return cards
}
