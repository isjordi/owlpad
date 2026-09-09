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
        required: ['question', 'correctAnswer', 'wrongAnswers', 'explanation']
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

// A local model will often lift its "correct answer" almost word-for-word from the note while
// writing the wrong answers in its own words — the mismatch in phrasing alone gives the answer
// away. We can't trust the model to police this itself, so we check it: any answer that shares a
// long run of consecutive words with the note is rejected, whichever answer it is.
const VERBATIM_NGRAM_SIZE = 6

// A local model will satisfy "paraphrase" by answering with a single bare term or number lifted
// straight from the note ("Chlorophyll", "Two", "The stroma") — that dodges the n-gram check
// (too short to match) but is still pure fact-lookup, not a test of understanding. Require every
// answer to be a fuller phrase, which in practice forces the model to actually explain the fact
// rather than just name it.
const MIN_ANSWER_WORDS = 4

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function ngramSet(words: string[], n: number): Set<string> {
  const set = new Set<string>()
  for (let i = 0; i + n <= words.length; i++) {
    set.add(words.slice(i, i + n).join(' '))
  }
  return set
}

function copiesNoteVerbatim(answer: string, noteNgrams: Set<string>): boolean {
  const words = normalizeWords(answer)
  for (let i = 0; i + VERBATIM_NGRAM_SIZE <= words.length; i++) {
    if (noteNgrams.has(words.slice(i, i + VERBATIM_NGRAM_SIZE).join(' '))) return true
  }
  return false
}

// The quiz UI renders these strings as plain text, not markdown, so any markdown syntax the
// model adds (bold/italic emphasis, inline code, a numbering prefix) would show up as literal
// asterisks/backticks/digits on screen instead of being rendered. Strip it before it ever reaches
// validation or the UI.
function stripMarkdown(text: string): string {
  let result = text.trim()

  const wrappers: Array<[string, string]> = [
    ['**', '**'],
    ['__', '__'],
    ['`', '`'],
    ['"', '"'],
    ['“', '”']
  ]
  for (const [open, close] of wrappers) {
    if (result.length > open.length + close.length && result.startsWith(open) && result.endsWith(close)) {
      result = result.slice(open.length, result.length - close.length).trim()
    }
  }

  return result
    .replace(/\*\*(.+?)\*\*/g, '$1') // **bold**
    .replace(/__(.+?)__/g, '$1') // __bold__
    .replace(/`([^`]+)`/g, '$1') // `inline code`
    .replace(/^#{1,6}\s+/, '') // # heading
    .replace(/^(?:[-*+]|\d+[.)])\s+/, '') // list/number prefix
    .trim()
}

function sanitizeRawQuestion(q: unknown): unknown {
  if (!q || typeof q !== 'object') return q
  const candidate = q as Record<string, unknown>
  const clean = (s: unknown): unknown => (typeof s === 'string' ? stripMarkdown(s) : s)
  return {
    ...candidate,
    question: clean(candidate.question),
    correctAnswer: clean(candidate.correctAnswer),
    wrongAnswers: Array.isArray(candidate.wrongAnswers)
      ? candidate.wrongAnswers.map(clean)
      : candidate.wrongAnswers,
    explanation: clean(candidate.explanation)
  }
}

function isValidRawQuestion(q: unknown, noteNgrams: Set<string>): q is RawQuestion {
  if (!q || typeof q !== 'object') return false
  const candidate = q as Record<string, unknown>
  const nonEmpty = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0
  if (!nonEmpty(candidate.question) || !nonEmpty(candidate.correctAnswer)) return false
  if (!Array.isArray(candidate.wrongAnswers) || candidate.wrongAnswers.length !== 3) return false
  if (!candidate.wrongAnswers.every(nonEmpty)) return false

  const allAnswers = [candidate.correctAnswer, ...candidate.wrongAnswers] as string[]
  const distinct = new Set(allAnswers.map((a) => a.trim().toLowerCase()))
  if (distinct.size !== 4) return false

  if (allAnswers.some((a) => normalizeWords(a).length < MIN_ANSWER_WORDS)) return false

  return !allAnswers.some((a) => copiesNoteVerbatim(a, noteNgrams))
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
    'your own words that a student would recognize as a real answer. This applies just as much ' +
    "to the correct answer as to the wrong ones — do NOT lift the correct answer's wording " +
    'straight from the note while inventing fresh phrasing for the wrong answers; that mismatch ' +
    "is exactly what lets a student spot the correct answer without knowing the material. " +
    "Paraphrase every option: same fact, different words than the note used. For example, if the " +
    'note says "Photosynthesis converts light energy into chemical energy stored in glucose," a ' +
    'good correct answer is "Plants turn sunlight into chemical energy they store as sugar" — not ' +
    'a near-copy of the note\'s own sentence. Do not make the correct answer\'s wording, length, ' +
    'or style stand out from the wrong ones. Each of the 4 answers must be meaningfully different ' +
    'from the other 3 — never repeat the same answer twice, and never write a wrong answer that ' +
    'just paraphrases the correct answer in different words (e.g. "halves the search space" vs. ' +
    '"reduces the number of elements each step" describe the same fact and are just as broken as ' +
    'an outright duplicate) — a wrong answer must change an actual fact, not just the phrasing.\n\n' +
    'Before finalizing each question, re-check it: could more than one of the 4 answers be ' +
    'considered correct, even partially or by rewording, based on the note? If so, rewrite the ' +
    'wrong answers until exactly one is unambiguously correct.\n\n' +
    'Never write an answer that is just a bare term, name, or number copied out of the note ' +
    '("Chlorophyll", "The stroma", "Two") — even a true one. Every answer, right or wrong, must ' +
    'be a full explanatory phrase or sentence that says what the term means or why it matters, ' +
    'so a student has to understand the idea, not just recognize a word from the page.\n\n' +
    "Vary the kind of question you ask across the quiz — don't make every question a plain " +
    '"what is X called" / "where does X happen" lookup. Where the note supports it, also ask ' +
    'questions that make the student connect ideas: why something happens, how one part of the ' +
    'note relates to or affects another, what the purpose or consequence of something is, or how ' +
    'two things the note describes compare. This is what makes the quiz reinforce understanding ' +
    'of the note instead of testing surface recall of its wording.\n\n' +
    'Also write a one- or two-sentence "explanation" for each question, shown to the student ' +
    'after they answer, that reinforces the concept in your own words — briefly say why the ' +
    'correct answer is right and, where useful, how it connects to the rest of the note. This is ' +
    'the main way the quiz helps learning stick, so never leave it blank.\n\n' +
    'If the note is too short or thin to support a question without leaving its content, ask a ' +
    'more literal, direct question about that content rather than inventing a deeper one — but ' +
    'still phrase the answers as full explanatory phrases, not bare terms.'

  const noteNgrams = ngramSet(normalizeWords(noteContext.body), VERBATIM_NGRAM_SIZE)
  const seenQuestions = new Set<string>()
  const valid: RawQuestion[] = []

  // The verbatim/word-count filters (and the model's own occasional slip-ups) knock out a
  // meaningful fraction of generated questions, so retry with a generous attempt budget and
  // over-request a little each round rather than silently handing back a shorter quiz.
  const MAX_ATTEMPTS = 6
  for (let attempt = 0; attempt < MAX_ATTEMPTS && valid.length < count; attempt++) {
    const remaining = count - valid.length
    const askFor = attempt === 0 ? remaining : remaining + 2
    const prompt = `The note (the only source you may draw facts from):\n\nSubject: ${noteContext.subject}\nTitle: ${noteContext.title}\nSection: ${noteContext.section}\n\n${noteContext.body}\n\n---\n\nWrite ${askFor} multiple-choice questions testing understanding of the note above, staying strictly within what it actually says. Return them via the required JSON schema.`

    const result = await provider.generateJSON({ system, prompt, model, schema: QUIZ_SCHEMA })
    const raw = (result as { questions?: unknown[] })?.questions
    if (!Array.isArray(raw)) continue

    for (const rawQ of raw) {
      if (valid.length >= count) break
      const q = sanitizeRawQuestion(rawQ)
      if (!isValidRawQuestion(q, noteNgrams)) continue
      const key = q.question.trim().toLowerCase()
      if (seenQuestions.has(key)) continue
      seenQuestions.add(key)
      valid.push(q)
    }
  }

  if (valid.length === 0) {
    throw new Error("Owly couldn't generate a valid quiz from this note. Try again.")
  }

  return valid.map(toQuizQuestion)
}
