const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore')
const { setGlobalOptions }              = require('firebase-functions/v2')
const { defineSecret }                  = require('firebase-functions/params')
const admin                             = require('firebase-admin')
const crypto                            = require('crypto')

admin.initializeApp()
setGlobalOptions({ region: 'us-central1' })
const db = admin.firestore()

// ── Secrets ───────────────────────────────────────────────────────────────────
// Set via: firebase functions:secrets:set CHIPINPOOL_API_KEY
// Set via: firebase functions:secrets:set CHIPINPOOL_WEBHOOK_SECRET
// Optional: firebase functions:secrets:set RESEND_API_KEY
// Optional: firebase functions:secrets:set TWILIO_ACCOUNT_SID
// Optional: firebase functions:secrets:set TWILIO_AUTH_TOKEN
// Optional: firebase functions:secrets:set TWILIO_FROM_PHONE
const CHIPINPOOL_API_KEY       = defineSecret('CHIPINPOOL_API_KEY')
const CHIPINPOOL_WEBHOOK_SECRET = defineSecret('CHIPINPOOL_WEBHOOK_SECRET')
const RESEND_API_KEY           = defineSecret('RESEND_API_KEY')
const TWILIO_ACCOUNT_SID       = defineSecret('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN        = defineSecret('TWILIO_AUTH_TOKEN')
const TWILIO_FROM_PHONE        = defineSecret('TWILIO_FROM_PHONE')

const CHIPINPOOL_BASE = 'https://www.chipinpool.com/api/v1'
const APP_URL         = 'https://sportstream-91d22.web.app'

// ── createTournamentPool ──────────────────────────────────────────────────────
// Called from the frontend (via callable) after a team is registered.
// 1. Creates ONE ChipInPool checkout session for the total entry fee.
// 2. Sends the checkout link to every player via email (Resend) + SMS (Twilio).
// 3. Updates the team doc with session info.
exports.createTournamentPool = onCall(
  {
    secrets: [
      CHIPINPOOL_API_KEY,
      RESEND_API_KEY,
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_FROM_PHONE,
    ],
  },
  async (request) => {
    const {
      col,              // 'tournaments' | 'leagues'
      parentId,         // tourId or leagueId
      teamId,
      amount,           // total entry fee in USD
      productTitle,     // shown on ChipInPool checkout page
      managerEmail,
    } = request.data

    if (!['tournaments', 'leagues'].includes(col)) {
      throw new HttpsError('invalid-argument', 'col must be "tournaments" or "leagues"')
    }
    if (!parentId || !teamId || !amount) {
      throw new HttpsError('invalid-argument', 'parentId, teamId, and amount are required')
    }

    // ── 1. Fetch the team doc to get the roster ───────────────────────────────
    const teamRef  = db.doc(`${col}/${parentId}/teams/${teamId}`)
    const teamSnap = await teamRef.get()
    if (!teamSnap.exists) throw new HttpsError('not-found', 'Team not found')

    const teamData = teamSnap.data()
    const players  = teamData.players || []

    // ── 2. Create one ChipInPool checkout session for the total amount ────────
    const prefix    = col === 'tournaments' ? 'tournament' : 'league'
    const returnUrl = `${APP_URL}/${prefix}/${parentId}`

    const sessionPayload = {
      orderId:                `${col}_${parentId}_${teamId}`,
      amount:                 Math.round(parseFloat(amount) * 100) / 100,
      productTitle:           productTitle || 'Team Entry Fee',
      productDescription:     `Entry fee for ${teamData.name || 'your team'}`,
      collectionDeadlineHours: 168, // 7 days
      successUrl:             returnUrl,
      cancelUrl:              returnUrl,
      metadata:               { col, parentId, teamId },
    }
    if (managerEmail) sessionPayload.customerEmail = managerEmail

    const sessionRes = await fetch(`${CHIPINPOOL_BASE}/merchant/checkout`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${CHIPINPOOL_API_KEY.value()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionPayload),
    })

    if (!sessionRes.ok) {
      const text = await sessionRes.text()
      throw new HttpsError('internal', `ChipInPool error: ${text}`)
    }

    const session = await sessionRes.json()
    const checkoutUrl = session.checkoutUrl

    // ── 3. Store webhook lookup ───────────────────────────────────────────────
    await db.doc(`chipInSessions/${session.sessionId}`).set({
      col, parentId, teamId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // ── 4. Update team doc with session info ──────────────────────────────────
    await teamRef.update({
      chipInSessionId:   session.sessionId,
      chipInCheckoutUrl: checkoutUrl,
      chipInStatus:      'pending',
      chipInAmount:      session.amount,
      chipInFeeAmount:   session.feeAmount,
      chipInNetAmount:   session.netAmount,
      chipInDeadline:    session.collectionDeadline,
    })

    // ── 5. Notify each player with the shared checkout link ───────────────────
    const eventName = teamData.name || productTitle || 'your event'
    const perPlayer = players.length > 0
      ? `$${(parseFloat(amount) / players.length).toFixed(2)}`
      : `$${parseFloat(amount).toFixed(2)}`
    let notified = 0

    for (const player of players) {
      const firstName = (player.name || '').split(' ')[0] || 'there'
      let sent = false

      // Email
      if (player.email && RESEND_API_KEY.value()) {
        try {
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization:  `Bearer ${RESEND_API_KEY.value()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from:    'SportStream <noreply@sportstream-91d22.web.app>',
              to:      player.email,
              subject: `Chip in for ${eventName} — your share is ${perPlayer}`,
              html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:32px 24px">
  <div style="margin-bottom:24px">
    <span style="font-size:28px">🏆</span>
    <span style="font-size:20px;font-weight:700;color:#f8fafc;margin-left:8px">SportStream</span>
  </div>
  <h2 style="color:#f8fafc;font-size:22px;margin:0 0 8px">Hey ${firstName}!</h2>
  <p style="color:#94a3b8;font-size:15px;line-height:1.5;margin:0 0 24px">
    You're on <strong style="color:#e2e8f0">${teamData.name || 'your team'}</strong> and your entry fee is ready to collect.
    Your estimated share is <strong style="color:#e2e8f0">${perPlayer}</strong>.
  </p>
  <div style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center">
    <p style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px">Your share (est.)</p>
    <p style="color:#f8fafc;font-size:36px;font-weight:800;margin:0">${perPlayer}</p>
  </div>
  <a href="${checkoutUrl}" style="display:block;text-align:center;background:#2563eb;color:#fff;font-weight:700;font-size:16px;padding:14px 28px;border-radius:10px;text-decoration:none;margin-bottom:24px">
    Chip In Now →
  </a>
  <p style="color:#475569;font-size:13px;line-height:1.5">
    Payments are collected securely through ChipInPool. Once everyone chips in, the pool is complete.
  </p>
  <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0">
  <p style="color:#334155;font-size:12px;text-align:center;margin:0">SportStream · Powered by ChipInPool</p>
</div></body></html>`,
            }),
          })
          if (r.ok) sent = true
          else console.error('Resend error for', player.email, await r.text())
        } catch (e) { console.error('Resend fetch error:', e) }
      }

      // SMS
      if (
        player.phone &&
        TWILIO_ACCOUNT_SID.value() &&
        TWILIO_AUTH_TOKEN.value() &&
        TWILIO_FROM_PHONE.value()
      ) {
        try {
          const sid  = TWILIO_ACCOUNT_SID.value()
          const auth = TWILIO_AUTH_TOKEN.value()
          const from = TWILIO_FROM_PHONE.value()
          const digits = player.phone.replace(/\D/g, '')
          const e164   = digits.startsWith('1') ? `+${digits}` : `+1${digits}`
          const body   = `Hey ${firstName}! Chip in ${perPlayer} for ${eventName}. Pay here: ${checkoutUrl}`
          const r = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                Authorization:  `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({ To: e164, From: from, Body: body }).toString(),
            }
          )
          if (r.ok) sent = true
          else console.error('Twilio error for', player.phone, await r.text())
        } catch (e) { console.error('Twilio fetch error:', e) }
      }

      if (sent) notified++
    }

    await teamRef.update({ poolNotifiedCount: notified })

    return {
      sessionId:   session.sessionId,
      checkoutUrl,
      feeAmount:   session.feeAmount,
      netAmount:   session.netAmount,
      deadline:    session.collectionDeadline,
      notified,
    }
  }
)

// ── chipInWebhook ─────────────────────────────────────────────────────────────
// Register this URL in the ChipInPool Merchant Dashboard.
// URL is shown in the Firebase console after deploy.
exports.chipInWebhook = onRequest(
  { secrets: [CHIPINPOOL_WEBHOOK_SECRET] },
  async (req, res) => {
    if (req.method !== 'POST') { res.sendStatus(405); return }

    const sig   = req.headers['x-chipinpay-signature'] || ''
    const event = req.headers['x-chipinpay-event']    || ''

    // Verify HMAC — format: "t=timestamp,v1=hmac_sha256"
    const parts     = Object.fromEntries(sig.split(',').map((p) => p.split('=')))
    const timestamp = parts.t
    const provided  = parts.v1

    if (!timestamp || !provided) { res.sendStatus(400); return }

    const rawBody  = req.rawBody
    const expected = crypto
      .createHmac('sha256', CHIPINPOOL_WEBHOOK_SECRET.value())
      .update(`${timestamp}.${rawBody}`)
      .digest('hex')

    try {
      if (!crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'))) {
        res.sendStatus(403); return
      }
    } catch {
      res.sendStatus(403); return
    }

    if (event === 'session.completed') {
      const { sessionId, netAmount, completedAt } = req.body
      const snap = await db.doc(`chipInSessions/${sessionId}`).get()
      if (snap.exists) {
        const { col, parentId, teamId } = snap.data()
        await db.doc(`${col}/${parentId}/teams/${teamId}`).update({
          chipInStatus:      'completed',
          fullyFunded:       true,
          totalPaid:         netAmount,
          chipInCompletedAt: completedAt,
        })
      }
    }

    res.sendStatus(200)
  }
)

// ── createChipInSession (plan upgrades — SettingsPage) ────────────────────────
// Kept for the existing plan upgrade flow in SettingsPage.
exports.createChipInSession = onRequest(
  { secrets: [CHIPINPOOL_API_KEY], invoker: 'public' },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*')
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST')
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      return res.status(204).send('')
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { plan, uid, email } = req.body
    if (!plan || !uid) return res.status(400).json({ error: 'Missing plan or uid' })

    const PLANS = {
      team:    { amount: 5.00,  label: 'SportStream Team Plan — $5/mo' },
      premium: { amount: 20.00, label: 'SportStream Premium Plan — $20/mo' },
    }
    const planConfig = PLANS[plan]
    if (!planConfig) return res.status(400).json({ error: 'Invalid plan' })

    try {
      const r = await fetch(`${CHIPINPOOL_BASE}/merchant/checkout`, {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${CHIPINPOOL_API_KEY.value()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId:      `plan_${uid}_${plan}_${Date.now()}`,
          amount:       planConfig.amount,
          productTitle: planConfig.label,
          successUrl:   `${APP_URL}/settings?upgraded=${plan}`,
          cancelUrl:    `${APP_URL}/settings`,
          metadata:     { uid, plan, email: email || '', type: 'plan_upgrade' },
          ...(email ? { customerEmail: email } : {}),
        }),
      })
      if (!r.ok) {
        const text = await r.text()
        console.error('ChipInPool API error:', text)
        return res.status(502).json({ error: 'Payment provider error' })
      }
      const session = await r.json()
      return res.status(200).json({ url: session.checkoutUrl })
    } catch (e) {
      console.error('createChipInSession error:', e)
      return res.status(500).json({ error: 'Internal error' })
    }
  }
)

// ── onNewPlay — notify player followers on notable plays ──────────────────────
const NOTABLE_PLAY_LABELS = {
  // baseball / softball
  home_run:   'hit a HOME RUN',
  triple:     'hit a TRIPLE',
  double:     'hit a DOUBLE',
  strikeout:  'struck out',
  // basketball
  '3pt':      'hit a 3-pointer',
  '3pt_miss': null, // not notable
  // soccer / flag-football
  goal:       'scored a goal',
  touchdown:  'scored a touchdown',
  // volleyball
  ace:        'hit an ace',
  kill:       'got a kill',
}

exports.onNewPlay = onDocumentCreated('games/{gameId}/plays/{playId}', async (event) => {
  const play = event.data.data()
  if (!play || play.undone) return

  const label = NOTABLE_PLAY_LABELS[play.type]
  if (!label) return // not a notable play type

  const playerId  = play.playerId
  const clubId    = play.clubId
  const gameId    = event.params.gameId

  if (!playerId) return

  // ── Auto-generate highlight document for notable plays ───────────────────
  const HIGHLIGHT_TYPES = {
    // Baseball / Softball
    homeRun:     'crushed a HOME RUN 💥',
    triple:      'legged out a TRIPLE 🔥',
    // Basketball
    score_3:     'drained a 3-POINTER 🎯',
    block:       'threw down a BLOCK 🛡',
    steal:       'picked a STEAL ✋',
    // Soccer
    goal:        'scored a GOAL ⚽',
    // Flag-football
    touchdown:   'scored a TOUCHDOWN 🏈',
    field_goal:  'nailed a FIELD GOAL 🏈',
    interception: 'made an INTERCEPTION 🙌',
    sack:        'recorded a SACK 💪',
    // Volleyball
    ace:         'served an ACE 🎾',
    kill:        'hammered a KILL 💥',
  }

  const highlightDesc = HIGHLIGHT_TYPES[play.type]
  if (highlightDesc) {
    try {
      const gameSnap = await db.collection('games').doc(gameId).get()
      const game = gameSnap.exists ? gameSnap.data() : {}

      const now = new Date()
      // ISO week number
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
      const dn = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dn)
      const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      const weekNum = Math.ceil((((d - ys) / 86400000) + 1) / 7)

      // Build game context string
      let gameContext = ''
      if (game.sport === 'baseball' || game.sport === 'softball') {
        const half = game.inningHalf === 'top' ? 'Top' : 'Bot'
        gameContext = `${half} ${game.inning || 1} · ${game.homeTeam} ${game.homeScore || 0}, ${game.awayTeam} ${game.awayScore || 0}`
      } else {
        const period = game.period ? `Q${game.period}` : ''
        gameContext = `${period ? period + ' · ' : ''}${game.homeTeam} ${game.homeScore || 0}, ${game.awayTeam} ${game.awayScore || 0}`
      }

      await db.collection('highlights').add({
        playerId:          playerId,
        playerName:        play.playerName || '',
        playerPhoto:       play.playerPhoto || null,
        clubId:            play.clubId || game.clubId || '',
        clubName:          game.homeTeam || '',
        gameId:            gameId,
        sport:             game.sport || '',
        playType:          play.type,
        playDescription:   highlightDesc,
        gameContext:       gameContext,
        homeTeam:          game.homeTeam || '',
        awayTeam:          game.awayTeam || '',
        leagueId:          game.leagueId || null,
        tournamentId:      game.tournamentId || null,
        createdAt:         admin.firestore.FieldValue.serverTimestamp(),
        reactions:         { fire: 0, electric: 0, clutch: 0, unbelievable: 0, applause: 0 },
        reactionCount:     0,
        nominatedForAward: false,
        weekNumber:        weekNum,
        year:              now.getFullYear(),
        manualVideoUrl:    null,
      })
    } catch (e) {
      console.error('onNewPlay highlight creation error:', e)
    }
  }

  // Find users who follow this player
  const usersSnap = await db.collection('users')
    .where('followedPlayers', 'array-contains-any',
      // Firestore doesn't support direct object match in array-contains-any;
      // we do a broader query and filter client-side
      // Instead, store follower lists on player doc — use collectionGroup workaround:
      // Fall back to scanning users (acceptable for MVP scale)
      [{ playerId }]
    )
    .get()
    .catch(() => null)

  // Fallback: scan users whose followedPlayers contains an object with this playerId
  // Since Firestore can't query nested array objects efficiently, we use a known pattern:
  // users store followedPlayers as array of objects. We query all users and filter client-side.
  // For scale, a separate followers/{playerId}/users subcollection would be better.
  // For MVP: fetch users with any followedPlayers entry (limit 500).
  const allUsersSnap = await db.collection('users')
    .where('followedPlayers', '!=', [])
    .limit(500)
    .get()
    .catch(() => null)

  if (!allUsersSnap || allUsersSnap.empty) return

  const allTokens = []
  const userDocs  = []

  for (const userDoc of allUsersSnap.docs) {
    const data    = userDoc.data()
    const follows = data.followedPlayers || []
    const isFollowing = follows.some((f) => f.playerId === playerId)
    if (!isFollowing) continue
    const tokens = data.fcmTokens || []
    if (tokens.length === 0) continue
    allTokens.push(...tokens)
    userDocs.push({ ref: userDoc.ref, tokens })
  }

  if (allTokens.length === 0) return

  const playerName = play.playerName || 'A player'
  const gameUrl    = `${APP_URL}/game/${gameId}`

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: allTokens,
      notification: {
        title: `${playerName} ${label}!`,
        body:  play.clockAtPlay ? `Game clock: ${play.clockAtPlay}` : 'Check the play-by-play →',
      },
      data:  { url: gameUrl },
      webpush: {
        notification: { icon: `${APP_URL}/favicon.svg` },
        fcmOptions:   { link: gameUrl },
      },
    })

    // Clean stale tokens
    const staleTokens = new Set()
    response.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          staleTokens.add(allTokens[idx])
        }
      }
    })
    if (staleTokens.size > 0) {
      const batch = db.batch()
      for (const { ref, tokens } of userDocs) {
        const cleaned = tokens.filter((t) => !staleTokens.has(t))
        if (cleaned.length !== tokens.length) batch.update(ref, { fcmTokens: cleaned })
      }
      await batch.commit()
    }
  } catch (e) {
    console.error('onNewPlay FCM error:', e)
  }
})

// ── onGameComplete — season stats aggregation + stat summary push ─────────────
exports.onGameComplete = onDocumentUpdated('games/{gameId}', async (event) => {
  const before = event.data.before.data()
  const after  = event.data.after.data()

  if (before.status === 'final' || after.status !== 'final') return

  const gameId     = event.params.gameId
  const gameUrl    = `${APP_URL}/game/${gameId}`
  const home       = after.homeTeam || 'Home'
  const away       = after.awayTeam || 'Away'
  const sport      = after.sport || 'basketball'
  const clubId     = after.clubId || null
  const awayClubId = after.awayClubId || null

  // ── Season stats aggregation ───────────────────────────────────────────────
  try {
    const playsSnap = await db.collection('games').doc(gameId).collection('plays').get()
    const plays = playsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p) => !p.undone && p.playerId)

    const BB_HIT_TYPES    = new Set(['single', 'double', 'triple', 'homeRun'])
    const BB_AT_BAT_TYPES = new Set(['single', 'double', 'triple', 'homeRun', 'strikeout', 'groundOut', 'flyOut', 'lineOut'])
    const isBaseball = sport === 'baseball' || sport === 'softball'

    const playerStats = {}
    for (const play of plays) {
      const pid = play.playerId
      if (!playerStats[pid]) {
        playerStats[pid] = {
          name: play.playerName || '',
          number: play.playerNumber || '',
          team: play.team || 'home',
          ...(isBaseball
            ? { ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, k: 0 }
            : { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, foul: 0, to: 0 }),
        }
      }
      const s = playerStats[pid]
      if (isBaseball) {
        if (BB_AT_BAT_TYPES.has(play.type)) s.ab++
        if (BB_HIT_TYPES.has(play.type))    s.h++
        if (play.type === 'homeRun')         s.hr++
        if (play.type === 'walk' || play.type === 'hitByPitch') s.bb++
        if (play.type === 'strikeout')       s.k++
        if (play.points)                     s.rbi += play.points
      } else {
        if (play.points)               s.pts  += play.points
        if (play.type === 'rebound')   s.reb  += 1
        if (play.type === 'assist')    s.ast  += 1
        if (play.type === 'steal')     s.stl  += 1
        if (play.type === 'block')     s.blk  += 1
        if (play.type === 'foul')      s.foul += 1
        if (play.type === 'turnover')  s.to   += 1
      }
    }

    const batch = db.batch()
    for (const [pid, stats] of Object.entries(playerStats)) {
      const targetClubId = stats.team === 'home' ? clubId : awayClubId
      if (!targetClubId) continue
      const ref = db.collection('clubs').doc(targetClubId).collection('seasonStats').doc(pid)
      const inc = admin.firestore.FieldValue.increment
      const update = {
        name: stats.name,
        number: stats.number,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        gamesPlayed: inc(1),
        ...(isBaseball
          ? { ab: inc(stats.ab), h: inc(stats.h), hr: inc(stats.hr), rbi: inc(stats.rbi), bb: inc(stats.bb), k: inc(stats.k) }
          : { pts: inc(stats.pts), reb: inc(stats.reb), ast: inc(stats.ast), stl: inc(stats.stl), blk: inc(stats.blk), foul: inc(stats.foul), to: inc(stats.to) }),
      }
      batch.set(ref, update, { merge: true })
    }
    if (Object.keys(playerStats).length > 0) await batch.commit()
  } catch (e) {
    console.error('onGameComplete season stats error:', e)
  }

  // Collect all playerIds from both lineups
  const homeLineup = after.homeLineup || []
  const awayLineup = after.awayLineup || []
  const allPlayers = [...homeLineup, ...awayLineup]
  const playerIds  = [...new Set(allPlayers.map((p) => p.playerId).filter(Boolean))]

  if (playerIds.length === 0) return

  // Find users who follow any of these players
  const allUsersSnap = await db.collection('users')
    .where('followedPlayers', '!=', [])
    .limit(500)
    .get()
    .catch(() => null)

  if (!allUsersSnap || allUsersSnap.empty) return

  const playerIdSet = new Set(playerIds)
  const allTokens   = []
  const userDocs    = []

  for (const userDoc of allUsersSnap.docs) {
    const data    = userDoc.data()
    const follows = data.followedPlayers || []
    const matchedPlayers = follows.filter((f) => playerIdSet.has(f.playerId))
    if (matchedPlayers.length === 0) continue
    const tokens = data.fcmTokens || []
    if (tokens.length === 0) continue
    allTokens.push(...tokens)
    userDocs.push({ ref: userDoc.ref, tokens })
  }

  if (allTokens.length === 0) return

  const finalScore = `${after.homeScore ?? 0}–${after.awayScore ?? 0}`

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: allTokens,
      notification: {
        title: `Final: ${home} ${finalScore} ${away}`,
        body:  'Check the stats for players you follow →',
      },
      data:  { url: gameUrl },
      webpush: {
        notification: { icon: `${APP_URL}/favicon.svg` },
        fcmOptions:   { link: gameUrl },
      },
    })

    // Clean stale tokens
    const staleTokens = new Set()
    response.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          staleTokens.add(allTokens[idx])
        }
      }
    })
    if (staleTokens.size > 0) {
      const batch = db.batch()
      for (const { ref, tokens } of userDocs) {
        const cleaned = tokens.filter((t) => !staleTokens.has(t))
        if (cleaned.length !== tokens.length) batch.update(ref, { fcmTokens: cleaned })
      }
      await batch.commit()
    }
  } catch (e) {
    console.error('onGameComplete FCM error:', e)
  }
})

// ── onGameLive — notify followers when a game goes live ───────────────────────
exports.onGameLive = onDocumentUpdated('games/{gameId}', async (event) => {
  const before = event.data.before.data()
  const after  = event.data.after.data()

  // Only fire when status transitions to 'live'
  if (before.status === 'live' || after.status !== 'live') return

  const clubId = after.clubId
  if (!clubId) return

  // Find all users who follow this club
  const usersSnap = await db.collection('users')
    .where('followedClubs', 'array-contains', clubId)
    .get()

  if (usersSnap.empty) return

  // Collect all FCM tokens
  const allTokens = []
  for (const userDoc of usersSnap.docs) {
    const tokens = userDoc.data().fcmTokens || []
    allTokens.push(...tokens)
  }
  if (allTokens.length === 0) return

  const gameId   = event.params.gameId
  const gameUrl  = `${APP_URL}/game/${gameId}`
  const home     = after.homeTeam || 'Home'
  const away     = after.awayTeam || 'Away'
  const sport    = after.sport    || 'Game'

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: allTokens,
      notification: {
        title: `🔴 Live Now!`,
        body:  `${home} vs ${away} is live — tap to watch!`,
      },
      data:  { url: gameUrl },
      webpush: {
        notification: { icon: `${APP_URL}/favicon.svg` },
        fcmOptions:   { link: gameUrl },
      },
    })

    // Remove stale tokens (registration-token-not-registered)
    const staleTokens = new Set()
    response.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code
        if (code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered') {
          staleTokens.add(allTokens[idx])
        }
      }
    })
    if (staleTokens.size > 0) {
      const batch = db.batch()
      for (const userDoc of usersSnap.docs) {
        const tokens = userDoc.data().fcmTokens || []
        const cleaned = tokens.filter((t) => !staleTokens.has(t))
        if (cleaned.length !== tokens.length) {
          batch.update(userDoc.ref, { fcmTokens: cleaned })
        }
      }
      await batch.commit()
    }
  } catch (e) {
    console.error('onGameLive FCM error:', e)
  }
})

// ── compileWeeklyTop10 — runs every Monday at 12:01 AM UTC ────────────────────
const { onSchedule } = require('firebase-functions/v2/scheduler')

exports.compileWeeklyTop10 = onSchedule('every monday 00:01', async () => {
  const now = new Date()

  // ISO week key
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const dn = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dn)
  const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((d - ys) / 86400000) + 1) / 7)
  const weekKey = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`

  // Week bounds (past 7 days)
  const weekEnd   = new Date(now)
  weekEnd.setHours(0, 1, 0, 0)
  const weekStart = new Date(weekEnd)
  weekStart.setDate(weekStart.getDate() - 7)

  try {
    const snap = await db.collection('highlights')
      .where('createdAt', '>=', weekStart)
      .where('createdAt', '<', weekEnd)
      .orderBy('createdAt')
      .get()

    const sorted = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.reactionCount || 0) - (a.reactionCount || 0))
      .slice(0, 10)

    await db.collection('weeklyTop10').doc(weekKey).set({
      highlights: sorted.map((h) => h.id),
      votingOpen: true,
      weekStart:  admin.firestore.Timestamp.fromDate(weekStart),
      weekEnd:    admin.firestore.Timestamp.fromDate(weekEnd),
      updatedAt:  admin.firestore.FieldValue.serverTimestamp(),
    })

    // Notify all users (best-effort)
    const usersSnap = await db.collection('users').limit(500).get()
    const tokens = []
    usersSnap.docs.forEach((u) => {
      const t = u.data().fcmTokens || []
      tokens.push(...t)
    })

    if (tokens.length > 0) {
      const chunks = []
      for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500))
      await Promise.all(chunks.map((chunk) =>
        admin.messaging().sendEachForMulticast({
          tokens: chunk,
          notification: {
            title: '🏆 Top 10 Plays of the Week!',
            body:  'This week\'s best moments are in — come vote!',
          },
          data: { url: 'https://sportstream-91d22.web.app/wall-of-fame' },
          webpush: {
            notification: { icon: 'https://sportstream-91d22.web.app/favicon.svg' },
            fcmOptions: { link: 'https://sportstream-91d22.web.app/wall-of-fame' },
          },
        }).catch(() => {})
      ))
    }

    console.log(`compileWeeklyTop10: wrote ${sorted.length} highlights for ${weekKey}`)
  } catch (e) {
    console.error('compileWeeklyTop10 error:', e)
  }
})
