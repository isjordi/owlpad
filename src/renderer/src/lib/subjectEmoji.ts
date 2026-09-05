const KEYWORD_EMOJIS: Array<[RegExp, string]> = [
  [/\bit\b|\bict\b|comput|programming|software|coding|\bcode\b|\bcs\b|information technology/i, '💻'],
  // NOTE: "cs" is boundary-anchored on both sides so it doesn't swallow Physics/Statistics/Politics
  [/data|database|analytics/i, '📊'],
  [/network|cyber|security/i, '🔒'],
  [/math|calc|algebra|geometry|statistic/i, '🔢'],
  [/bio|anatom|genetic/i, '🧬'],
  [/chem/i, '⚗️'],
  [/phys(ic)?s/i, '⚛️'],
  [/histor/i, '📜'],
  [/geo(graphy)?/i, '🌍'],
  [/art|paint|draw|design/i, '🎨'],
  [/music|band|choir/i, '🎵'],
  [/english|literature|writing|grammar/i, '📖'],
  [/spanish|french|german|italian|language|linguistic/i, '🗣️'],
  [/econ|finance|business|account/i, '💰'],
  [/psycholog/i, '🧠'],
  [/philosoph/i, '🤔'],
  [/law|legal/i, '⚖️'],
  [/medic|health|nursing/i, '🩺'],
  [/sport|\bpe\b|physical education|gym/i, '🏀'],
  [/religio|theolog/i, '🙏'],
  [/astronom|space/i, '🔭'],
  [/environ|ecolog/i, '🌱'],
  [/engineer|robot|mechanic/i, '⚙️'],
  [/politic|government|civics/i, '🏛️'],
  [/drama|theatre|theater|film|movie/i, '🎭'],
  [/photograph/i, '📷'],
  [/cook|culinary|baking/i, '🍳'],
  [/agricultur|farm/i, '🌾']
]

/** Best-effort emoji for a subject name, based on keyword matching. Falls back to a generic book. */
export function getSubjectEmoji(subject: string): string {
  for (const [pattern, emoji] of KEYWORD_EMOJIS) {
    if (pattern.test(subject)) return emoji
  }
  return '📘'
}
