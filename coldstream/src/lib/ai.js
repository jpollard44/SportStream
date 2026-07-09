// AI sequence writer.
//
// Ships with a client-side template engine so the product works with zero
// backend. For production, point `generateSequence` at a small serverless
// endpoint that calls the Claude API (never call it from the browser with a
// raw key). Reference implementation for that endpoint:
//
//   import Anthropic from '@anthropic-ai/sdk'
//   const client = new Anthropic() // ANTHROPIC_API_KEY from env
//   const stream = client.messages.stream({
//     model: 'claude-opus-4-8',
//     max_tokens: 64000,
//     thinking: { type: 'adaptive' },
//     system: SEQUENCE_WRITER_SYSTEM_PROMPT,
//     messages: [{ role: 'user', content: JSON.stringify(brief) }],
//   })
//   const message = await stream.finalMessage()

const OPENERS = [
  '{Hi|Hey} {{firstName|there}},',
  '{{firstName|Hi there}} —',
]

const HOOKS = {
  pain: (b) => `{Noticed|Saw} that ${b.audience.toLowerCase()} teams usually ${b.pain.toLowerCase()} — it's one of the most common things we hear from folks like {{company|your team}}.`,
  social: (b) => `We help ${b.audience.toLowerCase()} ${b.outcome.toLowerCase()}${b.proof ? ` — ${b.proof}` : ''}.`,
  question: (b) => `Quick question — how is {{company|your team}} currently handling ${b.pain.toLowerCase()}?`,
}

export const SEQUENCE_WRITER_SYSTEM_PROMPT = `You write cold email sequences. Rules: under 90 words per email, one specific pain point, one clear ask, no buzzwords, sound like a human wrote it on a Tuesday. Use {{firstName}}, {{company}} merge tags and {option|option} spintax. Return JSON: {steps:[{subject, body, waitDays}]}.`

// brief: { product, audience, pain, outcome, proof, senderName, tone }
export function generateSequence(brief) {
  const b = {
    product: brief.product || 'our product',
    audience: brief.audience || 'teams',
    pain: brief.pain || 'spend hours on manual work',
    outcome: brief.outcome || 'save hours every week',
    proof: brief.proof || '',
    senderName: brief.senderName || '{{senderName}}',
    tone: brief.tone || 'direct',
  }
  const casual = b.tone === 'casual'
  const signoff = casual ? '{Cheers|Thanks},\n' + b.senderName : '{Best|Thanks},\n' + b.senderName

  return {
    steps: [
      {
        subject: `{Quick question|Question} for {{company|you}}`,
        waitDays: 0,
        body: [
          OPENERS[casual ? 0 : 1],
          '',
          HOOKS.question(b),
          '',
          `${b.product} helps ${b.audience.toLowerCase()} ${b.outcome.toLowerCase()}${b.proof ? ` (${b.proof})` : ''}.`,
          '',
          `{Worth a quick look|Open to seeing how it works}? {Happy to send over a 2-min demo|Can share a short walkthrough} — no meeting needed.`,
          '',
          signoff,
        ].join('\n'),
      },
      {
        subject: '',
        waitDays: 3,
        body: [
          '{Hi|Hey} {{firstName|there}},',
          '',
          `{Floating this back up|Bumping this} in case it got buried. The short version: ${b.audience.toLowerCase()} use ${b.product} to ${b.outcome.toLowerCase()}.`,
          '',
          `If ${b.pain.toLowerCase()} isn't a problem for {{company|your team}} right now, no worries at all — just let me know and I'll close the loop.`,
          '',
          signoff,
        ].join('\n'),
      },
      {
        subject: `{Last one|Closing the loop}, {{firstName|promise}}`,
        waitDays: 4,
        body: [
          '{{firstName|Hi}} —',
          '',
          `Last note from me. {Three|A few} things people usually want to know about ${b.product}:`,
          '',
          `1. Setup takes minutes, not weeks`,
          `2. ${b.outcome[0].toUpperCase() + b.outcome.slice(1)}${b.proof ? ` — ${b.proof}` : ''}`,
          `3. You can try it free, no card required`,
          '',
          `If the timing's wrong, {no hard feelings|all good} — reply "later" and I'll check back next quarter.`,
          '',
          signoff,
        ].join('\n'),
      },
    ],
  }
}

// Suggested reply drafts for the Unibox, keyed by detected intent.
export function draftReply(intent, lead = {}) {
  const name = lead.firstName || 'there'
  switch (intent) {
    case 'interested':
    case 'question':
      return `Hi ${name},\n\nGreat to hear from you! Happy to answer anything — here's a link to grab 15 minutes whenever suits: [your calendar link]\n\nIn the meantime, the short answer to most questions: setup takes about 10 minutes and you can start free.\n\nBest,`
    case 'meeting':
      return `Hi ${name},\n\nPerfect — looking forward to it. I'll send over a short agenda beforehand so we make the most of the time.\n\nBest,`
    case 'not_now':
      return `Hi ${name},\n\nTotally understand — timing is everything. I'll make a note to check back next quarter. If anything changes before then, just reply here.\n\nBest,`
    case 'wrong_person':
      return `Hi ${name},\n\nThanks for letting me know — sorry for the misfire. If you can point me to the right person I'd really appreciate it; otherwise I'll do my homework.\n\nBest,`
    case 'not_interested':
    case 'unsubscribe':
      return `Hi ${name},\n\nUnderstood — I've removed you from our list and you won't hear from me again. Thanks for the direct reply, and all the best.\n`
    default:
      return `Hi ${name},\n\nThanks for the reply — `
  }
}
