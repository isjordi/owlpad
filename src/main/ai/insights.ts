import type { AIProvider } from './provider'
import type { AINoteContext, Insight } from '../../shared/types'

const MAX_INSIGHTS_PER_CALL = 1
const MAX_EXISTING_FACTS_SHOWN = 20

const INSIGHTS_SCHEMA = {
  type: 'object',
  properties: {
    insights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fact: { type: 'string' }
        },
        required: ['fact']
      }
    }
  },
  required: ['insights']
}

function isValidInsight(i: unknown): i is Insight {
  if (!i || typeof i !== 'object') return false
  const candidate = i as Record<string, unknown>
  return typeof candidate.fact === 'string' && candidate.fact.trim().length > 0
}

export async function generateInsights(
  provider: AIProvider,
  model: string,
  noteContext: AINoteContext,
  existingFacts: string[] = []
): Promise<Insight[]> {
  // Unlike quizzes/flashcards, insights are *supposed* to add outside knowledge — the
  // opposite grounding direction — so we don't forbid facts beyond the note here.
  const system =
    'You are Owly, a study companion that surfaces brief, genuinely interesting facts related ' +
    "to what a student is writing in their notes, to help build their understanding beyond just " +
    "what they already wrote. Facts should stay closely relevant to the note's actual topic — " +
    "not generic trivia — and should add something the note doesn't already say, not restate it. " +
    'Each fact must be true to the best of your knowledge and a single short, self-contained ' +
    `sentence or two (plain text, no markdown). Suggest at most ${MAX_INSIGHTS_PER_CALL} facts. ` +
    "If the note doesn't give you enough to go on yet, or you have nothing genuinely new and " +
    'relevant to add, return an empty list rather than forcing something generic or repetitive.'

  const existingBlock =
    existingFacts.length > 0
      ? `\n\nFacts already shown to the student for this note — do not repeat these or anything very similar:\n${existingFacts
          .slice(-MAX_EXISTING_FACTS_SHOWN)
          .map((f) => `- ${f}`)
          .join('\n')}`
      : ''

  const prompt = `The student's note:\n\nSubject: ${noteContext.subject}\nTitle: ${noteContext.title}\nSection: ${noteContext.section}\n\n${noteContext.body}${existingBlock}\n\n---\n\nSuggest up to ${MAX_INSIGHTS_PER_CALL} new, relevant, interesting facts to help the student learn more about this topic. Return them via the required JSON schema.`

  const result = await provider.generateJSON({ system, prompt, model, schema: INSIGHTS_SCHEMA })
  const raw = (result as { insights?: unknown[] })?.insights

  if (!Array.isArray(raw)) {
    throw new Error("Owly's insights came back in an unexpected format.")
  }

  return raw.filter(isValidInsight).slice(0, MAX_INSIGHTS_PER_CALL)
}
