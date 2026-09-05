import type { AIProvider } from './provider'
import type { AINoteContext, QuizQuestion } from '../../shared/types'

const DEFAULT_QUESTION_COUNT = 5

// The model names the correct answer and the wrong ones as separate fields rather than
// picking an index — a small local model is unreliable at tracking which shuffled slot
// holds the right answer. We shuffle and compute correctIndex ourselves instead.
const QUIZ_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          correctAnswer: { type: 'string' },
          wrongAnswers: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
          explanation: { type: 'string' }
        },
        required: ['question', 'correctAnswer', 'wrongAnswers']
      }
    }
  },
  required: ['questions']
}

interface RawQuestion {
  question: string
  correctAnswer: string
  wrongAnswers: string[]
  explanation?: string
}

function isValidRawQuestion(q: unknown): q is RawQuestion {
  if (!q || typeof q !== 'object') return false
  const candidate = q as Record<string, unknown>
  const nonEmpty = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0
  if (!nonEmpty(candidate.question) || !nonEmpty(candidate.correctAnswer)) return false
  if (!Array.isArray(candidate.wrongAnswers) || candidate.wrongAnswers.length !== 3) return false
  if (!candidate.wrongAnswers.every(nonEmpty)) return false

  const allAnswers = [candidate.correctAnswer, ...candidate.wrongAnswers] as string[]
  const distinct = new Set(allAnswers.map((a) => a.trim().toLowerCase()))
  return distinct.size === 4
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function toQuizQuestion(raw: RawQuestion): QuizQuestion {
  const options = shuffle([raw.correctAnswer, ...raw.wrongAnswers])
  return {
    question: raw.question,
    options,
    correctIndex: options.indexOf(raw.correctAnswer),
    explanation: raw.explanation
  }
}

export async function generateQuiz(
  provider: AIProvider,
  model: string,
  noteContext: AINoteContext,
  count: number = DEFAULT_QUESTION_COUNT
): Promise<QuizQuestion[]> {
  const system =
    'You are Owly, a study assistant that writes multiple-choice quizzes. You will be given ' +
    'exactly one note — a single section the student wrote. Every fact you test must come from ' +
    "that note — do not test outside facts, even true ones, if they aren't written in the note.\n\n" +
    'For each question, give the correct answer and exactly 3 wrong answers as separate fields ' +
    '(you do not choose their order — that is handled separately). The correct answer must be ' +
    'true according to the note. Each of the 3 wrong answers must be CLEARLY AND DEFINITELY ' +
    'FALSE according to the note — being merely "different" from the correct answer is not ' +
    'enough. The single most common mistake to avoid: pulling several different true facts from ' +
    'the note and listing them as separate options — if two options both describe something the ' +
    'note actually says, the question is broken, even if they answer slightly different aspects ' +
    "of the topic.\n\n" +
    'Build wrong answers using tricks like these: negate or invert the correct answer; swap in a ' +
    "different number, name, or term that genuinely appears elsewhere in the note (so it's " +
    'plausible but answers a different question than the one asked); state a common ' +
    'misconception about the topic; or alter one true detail — a date, a cause, a category — so ' +
    'it reads naturally but is factually wrong per the note. Make wrong answers tempting and ' +
    'plausible, not silly, but never accidentally correct.\n\n' +
    'Write every answer, correct and wrong alike, as a complete, natural, coherent phrase in ' +
    'your own words that a student would recognize as a real answer — do not copy sentence ' +
    "fragments verbatim from the note, and do not make the correct answer's wording, length, or " +
    'style stand out from the wrong ones. Each of the 4 answers must be meaningfully different ' +
    'from the other 3 — never repeat the same answer twice, and never write a wrong answer that ' +
    'just paraphrases the correct answer in different words (e.g. "halves the search space" vs. ' +
    '"reduces the number of elements each step" describe the same fact and are just as broken as ' +
    'an outright duplicate) — a wrong answer must change an actual fact, not just the phrasing.\n\n' +
    'Before finalizing each question, re-check it: could more than one of the 4 answers be ' +
    'considered correct, even partially or by rewording, based on the note? If so, rewrite the ' +
    'wrong answers until exactly one is unambiguously correct.\n\n' +
    'If the note is too short or thin to support a question without leaving its content, ask a ' +
    'more literal, direct question about that content rather than inventing a deeper one.'

  const prompt = `The note (the only source you may draw facts from):\n\nSubject: ${noteContext.subject}\nTitle: ${noteContext.title}\nSection: ${noteContext.section}\n\n${noteContext.body}\n\n---\n\nWrite ${count} multiple-choice questions testing understanding of the note above, staying strictly within what it actually says. Return them via the required JSON schema.`

  const result = await provider.generateJSON({ system, prompt, model, schema: QUIZ_SCHEMA })
  const raw = (result as { questions?: unknown[] })?.questions

  if (!Array.isArray(raw)) {
    throw new Error("Owly's quiz came back in an unexpected format. Try again.")
  }

  const questions = raw.filter(isValidRawQuestion).slice(0, count).map(toQuizQuestion)
  if (questions.length === 0) {
    throw new Error("Owly couldn't generate a valid quiz from this note. Try again.")
  }

  return questions
}
