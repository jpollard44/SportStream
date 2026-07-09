# Coldstream ❄

**Cold email that lands, warms, and converts.** A full cold-outreach platform in the spirit of Instantly.ai — rebuilt from scratch with its own product angles rather than a copy: intent-labeled replies, a deliverability health score with actionable fixes, an AI sequence writer on every plan, and one flat price with no lead caps.

Lives in its own directory so the SportStream app is untouched. Same stack (React 18 + Vite + Tailwind), zero backend required to run.

## Run it

```bash
cd coldstream
npm install
npm run dev        # app at http://localhost:5173
npm test           # vitest unit tests (spintax, CSV import, intent classifier)
npm run build      # production bundle
```

`/` is the marketing landing page (with waitlist capture); `/app` is the product.

## What's inside

| Area | What works today |
|---|---|
| **Campaigns** | 4-step wizard: CSV lead import → multi-step sequence editor (merge tags + spintax, live preview, missing-tag warnings) → account rotation, schedule window, daily limits, stop-on-reply → launch. Pause/resume, per-campaign analytics, funnel. |
| **Leads** | CSV import with header-alias mapping (`Email Address` → `email`, unknown columns become custom merge tags), validation, dedupe, search/filter, verification flags. |
| **Unibox** | All replies in one inbox, auto-classified by intent (Interested / Meeting / Question / Not now / Not interested / OOO / Wrong person / Unsubscribe), intent filters, AI reply drafts. |
| **Email accounts** | Unlimited simulated inboxes, per-account daily limits, warmup toggles, deliverability health score. |
| **Warmup** | Per-inbox health breakdown (auth, warmup maturity, volume discipline, spam rescue, engagement) with the *next fix* surfaced, not just a number. |
| **Analytics** | Workspace charts (validated CVD-safe palette), reply-intent breakdown, campaign leaderboard ranked by reply rate. |
| **AI writer** | Brief → 3-step sequence with spintax/merge tags. Client-side template engine today; drop-in Claude API integration documented in `src/lib/ai.js`. |
| **Demo engine** | `src/lib/engine.js` advances the workspace on wall-clock time — sends, opens, replies, warmup progress — so the product feels alive between visits. |

## How it differs from Instantly (the pitch)

1. **Positive-reply-rate first.** Every screen ranks by the metric that pays, not send volume.
2. **Reply intent built in** — no add-on tier for knowing who said yes.
3. **Deliverability score + the fix**, not just a red/green dot.
4. **One flat plan ($47/mo positioning)** vs. tiered lead caps.
5. **AI writer on every plan.**

## Architecture / path to production

The app is deliberately backend-light so it can demo (and collect waitlist interest) immediately:

- **State**: single store (`src/lib/store.js`) persisted to `localStorage`, subscribed via `useSyncExternalStore`. Every mutation funnels through `update()`, so swapping persistence for Firestore/Postgres is one function.
- **Sending**: `src/lib/engine.js` simulates the queue worker. Production replacement: a worker that pulls due sequence steps, renders spintax/merge tags (`src/lib/spintax.js` is production-ready and tested), and sends over SMTP (nodemailer) or Gmail/Graph APIs, respecting per-account limits and schedule windows.
- **Warmup**: production needs a peer pool — accounts exchange mail via the same sending layer, with IMAP polling to open/reply/rescue-from-spam.
- **Intent classification**: `src/lib/intent.js` is a keyword classifier; swap for a Claude call (see `src/lib/ai.js` header for the exact API shape — `claude-opus-4-8`, adaptive thinking, streaming) behind a serverless endpoint.
- **Waitlist**: stored locally + shown in Settings; wire the landing form to Formspree/ConvertKit/Firestore before sharing the link.

## Go-to-market starters (pulling in customers)

- The landing page is conversion-structured: differentiated hero, social-proof strip, comparison table vs. incumbent, single-plan pricing, waitlist CTA above the fold.
- Positioning wedge: *"the Instantly alternative that measures what actually converts"* — target people complaining about lead caps and add-on pricing.
- The live demo **is** the funnel: every CTA drops visitors into a seeded workspace where the product sells itself.
