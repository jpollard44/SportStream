// Reply-intent classification for the Unibox. Keyword-scored client-side
// classifier; swap `classifyIntent` for a Claude API call server-side for
// production-grade accuracy (see src/lib/ai.js).

export const INTENTS = {
  interested: { label: 'Interested', tone: 'positive' },
  meeting: { label: 'Meeting booked', tone: 'positive' },
  question: { label: 'Has questions', tone: 'neutral' },
  not_now: { label: 'Not right now', tone: 'neutral' },
  not_interested: { label: 'Not interested', tone: 'negative' },
  unsubscribe: { label: 'Unsubscribe', tone: 'negative' },
  out_of_office: { label: 'Out of office', tone: 'neutral' },
  wrong_person: { label: 'Wrong person', tone: 'neutral' },
}

const RULES = [
  { intent: 'unsubscribe', score: 10, patterns: [/unsubscribe/i, /remove me/i, /stop (emailing|contacting)/i, /take me off/i] },
  { intent: 'out_of_office', score: 9, patterns: [/out of (the )?office/i, /\booo\b/i, /on (vacation|leave|holiday)/i, /automatic reply/i, /auto-?reply/i, /parental leave/i] },
  { intent: 'meeting', score: 8, patterns: [/calendly/i, /book(ed)? a (time|call|meeting)/i, /scheduled/i, /see you (on|at)/i, /invite sent/i, /works for me/i] },
  { intent: 'wrong_person', score: 7, patterns: [/wrong person/i, /not the right (person|contact)/i, /no longer (work|at)/i, /try reaching/i, /forward(ed)? (this|you) to/i] },
  { intent: 'not_interested', score: 6, patterns: [/not interested/i, /no thanks/i, /we're (all set|good)/i, /already (have|using)/i, /please don't/i] },
  { intent: 'not_now', score: 5, patterns: [/not (right )?now/i, /maybe (later|next)/i, /circle back/i, /next (quarter|year)/i, /bad timing/i, /reach out in/i] },
  { intent: 'question', score: 4, patterns: [/\?/, /how (much|does|do)/i, /what('s| is) the (price|cost)/i, /can you (share|send)/i, /more (info|information|details)/i] },
  { intent: 'interested', score: 3, patterns: [/interested/i, /sounds (good|great|interesting)/i, /tell me more/i, /let's (talk|chat)/i, /open to/i, /happy to (connect|chat)/i, /send (over|me) (a|the)/i] },
]

export function classifyIntent(text) {
  const body = text || ''
  let best = null
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(body))) {
      if (!best || rule.score > best.score) best = rule
    }
  }
  return best ? best.intent : 'question'
}

// Positive replies are the metric that matters — sent volume is vanity.
export function isPositive(intent) {
  return INTENTS[intent]?.tone === 'positive'
}
