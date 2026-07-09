// Generates static, crawlable SEO landing pages into public/ plus robots.txt
// and sitemap.xml. These are real HTML files served directly by Firebase
// Hosting (the SPA rewrite only applies when no file matches), so search
// engines get fully-rendered content without running JS.
//
//   node scripts/generate-landing.mjs
//
// Edit PAGES below and re-run; commit the generated files.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pub = resolve(__dirname, '../public')
const SITE = 'https://sportstream-91d22.web.app'

const NAV_LINKS = [
  ['/scorekeeper-app', 'Scorekeeper'],
  ['/bracket-maker', 'Bracket maker'],
  ['/league-manager', 'League manager'],
]

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function faqJsonLd(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }
}

function appJsonLd(page) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SportStream',
    applicationCategory: 'SportsApplication',
    operatingSystem: 'Web, iOS, Android (PWA)',
    description: page.metaDescription,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    url: `${SITE}${page.slug}`,
  }
}

function render(page) {
  const canonical = `${SITE}${page.slug}`
  const nav = NAV_LINKS.map(([href, label]) =>
    `<a href="${href}"${href === page.slug ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('')
  const features = page.features.map(
    ([t, d]) => `<li><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`).join('')
  const steps = page.steps.map((s, i) =>
    `<li><span class="n">${i + 1}</span><p>${esc(s)}</p></li>`).join('')
  const faqs = page.faqs.map(
    ([q, a]) => `<div class="faq"><h3>${esc(q)}</h3><p>${esc(a)}</p></div>`).join('')
  const related = NAV_LINKS.filter(([href]) => href !== page.slug)
    .map(([href, label]) => `<a href="${href}">${esc(label)} →</a>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.metaDescription)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.metaDescription)}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.title)}">
<meta name="twitter:description" content="${esc(page.metaDescription)}">
<meta name="twitter:image" content="${SITE}/og-image.png">
<script type="application/ld+json">${JSON.stringify(appJsonLd(page))}</script>
<script type="application/ld+json">${JSON.stringify(faqJsonLd(page.faqs))}</script>
<style>
  :root{--bg:#0f1117;--card:#1a1f2e;--line:rgba(255,255,255,.08);--blue:#2563eb;--blue2:#60a5fa;--muted:#94a3b8;--muted2:#64748b}
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{background:var(--bg);color:#fff;font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased}
  a{color:var(--blue2);text-decoration:none}
  .wrap{max-width:960px;margin:0 auto;padding:0 20px}
  header{position:sticky;top:0;z-index:10;background:rgba(15,17,23,.85);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
  header .wrap{display:flex;align-items:center;gap:20px;height:60px}
  .logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:19px;color:#fff}
  .logo .mark{width:30px;height:30px;border-radius:8px;background:linear-gradient(145deg,#2563eb,#1e3a8a);display:flex;align-items:center;justify-content:center;font-size:17px}
  nav{margin-left:auto;display:flex;gap:18px;font-size:14px;font-weight:600}
  nav a{color:var(--muted)}nav a[aria-current]{color:#fff}
  .cta{background:var(--blue);color:#fff!important;padding:9px 18px;border-radius:10px;font-weight:700;font-size:14px}
  .hero{padding:72px 0 56px;text-align:center}
  .hero .badge{display:inline-block;background:rgba(37,99,235,.15);border:1px solid rgba(37,99,235,.35);color:var(--blue2);font-size:13px;font-weight:700;padding:6px 14px;border-radius:999px;margin-bottom:22px}
  h1{font-size:clamp(34px,6vw,58px);font-weight:800;letter-spacing:-.03em;line-height:1.05;max-width:760px;margin:0 auto}
  h1 .accent{color:var(--blue2)}
  .lede{font-size:clamp(17px,2.4vw,21px);color:var(--muted);max-width:620px;margin:20px auto 0}
  .btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:32px}
  .btn{padding:14px 28px;border-radius:12px;font-weight:700;font-size:16px}
  .btn.primary{background:var(--blue);color:#fff}
  .btn.ghost{background:var(--card);color:#fff;border:1px solid var(--line)}
  section{padding:44px 0;border-top:1px solid var(--line)}
  h2{font-size:clamp(26px,4vw,36px);font-weight:800;letter-spacing:-.02em;margin-bottom:8px}
  .sub{color:var(--muted);margin-bottom:28px;max-width:640px}
  ul.features{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
  ul.features li{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px}
  ul.features h3{font-size:17px;margin-bottom:6px}
  ul.features p{color:var(--muted);font-size:15px}
  ol.steps{list-style:none;display:grid;gap:14px;counter-reset:s}
  ol.steps li{display:flex;gap:16px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px}
  ol.steps .n{flex:0 0 auto;width:30px;height:30px;border-radius:999px;background:var(--blue);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px}
  ol.steps p{padding-top:3px}
  .sports{display:flex;flex-wrap:wrap;gap:10px}
  .sports span{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:8px 16px;font-size:14px;font-weight:600;color:#e2e8f0}
  .faq{padding:18px 0;border-bottom:1px solid var(--line)}
  .faq h3{font-size:17px;margin-bottom:6px}
  .faq p{color:var(--muted);font-size:15px}
  .final{text-align:center;padding:64px 0}
  .related{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;margin-top:16px;font-weight:600}
  footer{border-top:1px solid var(--line);padding:28px 0;color:var(--muted2);font-size:13px;text-align:center}
  footer a{color:var(--muted)}
</style>
</head>
<body>
<header><div class="wrap">
  <a class="logo" href="/"><span class="mark">S</span>SportStream</a>
  <nav>${nav}<a class="cta" href="/login">Start free</a></nav>
</div></header>

<main class="wrap">
  <div class="hero">
    <span class="badge">${esc(page.badge)}</span>
    <h1>${page.h1}</h1>
    <p class="lede">${esc(page.lede)}</p>
    <div class="btns">
      <a class="btn primary" href="/login">Get started — it's free</a>
      <a class="btn ghost" href="/find">See a live demo</a>
    </div>
  </div>

  <section>
    <h2>${esc(page.featuresTitle)}</h2>
    <p class="sub">${esc(page.featuresSub)}</p>
    <ul class="features">${features}</ul>
  </section>

  <section>
    <h2>How it works</h2>
    <p class="sub">Up and running in minutes — no installs, no spreadsheets.</p>
    <ol class="steps">${steps}</ol>
  </section>

  <section>
    <h2>Every sport your community plays</h2>
    <p class="sub">One app for the whole season, across sports.</p>
    <div class="sports">${page.sports.map((s) => `<span>${esc(s)}</span>`).join('')}</div>
  </section>

  <section>
    <h2>Frequently asked questions</h2>
    ${faqs}
  </section>

  <div class="final">
    <h2>${esc(page.finalTitle)}</h2>
    <p class="sub" style="margin:12px auto 24px">${esc(page.finalSub)}</p>
    <a class="btn primary" href="/login">Create your free account</a>
    <div class="related">${related}</div>
  </div>
</main>

<footer><div class="wrap">
  &copy; SportStream — live scores, stats &amp; streaming for every team.
  &nbsp;·&nbsp; <a href="/">Home</a> &nbsp;·&nbsp; <a href="/find">Find a game</a> &nbsp;·&nbsp; <a href="/tournaments">Tournaments</a> &nbsp;·&nbsp; <a href="/leagues">Leagues</a>
</div></footer>
</body>
</html>
`
}

const SPORTS = ['Basketball', 'Baseball', 'Softball', 'Soccer', 'Volleyball', 'Flag Football']

const PAGES = [
  {
    slug: '/scorekeeper-app',
    title: 'Free Live Scorekeeper App for Basketball, Baseball, Soccer & More | SportStream',
    metaDescription:
      'Keep score live from your phone and share a real-time scoreboard with fans. Free scorekeeper app for basketball, baseball, softball, soccer, volleyball and flag football — play-by-play, stats and box scores included.',
    badge: 'Free live scorekeeping',
    h1: 'The free live <span class="accent">scorekeeper app</span> for every rec team',
    lede: 'Tap to score from your phone, and parents, players and fans follow a live scoreboard with play-by-play and stats — no clipboard, no spreadsheet, no cost.',
    featuresTitle: 'Everything you need to keep score',
    featuresSub: 'Purpose-built for coaches, team parents and volunteer scorekeepers.',
    features: [
      ['Tap-to-score', 'Big, fast buttons for points, fouls, hits, goals and more. Score one-handed from the sideline.'],
      ['Live public scoreboard', 'Share one link. Fans watch the score, clock and play-by-play update in real time.'],
      ['Automatic stats', 'Per-player and per-team stats and box scores are computed as you score — nothing to tally by hand.'],
      ['Undo anything', 'Mis-tap? One tap to undo. The score and stats correct themselves instantly.'],
      ['Works offline', 'Lost signal in the gym? Keep scoring — plays sync automatically when you reconnect.'],
      ['Push notifications', 'Followers get a ping when your team goes live and when big plays happen.'],
    ],
    steps: [
      'Create a free account and add your team roster.',
      'Start a game and pick your sport — basketball, baseball, soccer and more.',
      'Tap to score. Share the game link so anyone can follow live.',
      'The final box score and player stats save automatically to your team page.',
    ],
    sports: SPORTS,
    faqs: [
      ['Is SportStream really free?', 'Yes — live scorekeeping and public scoreboards are free forever. Paid plans add extras like CSV export and multi-camera streaming.'],
      ['Do fans need an app?', 'No. Fans open a link in any browser to watch the live scoreboard and play-by-play. Coaches can install the app to their home screen for quick access.'],
      ['Which sports are supported?', 'Basketball, baseball, softball, soccer, volleyball and flag football, each with a sport-specific scoring interface.'],
      ['Can more than one person keep score?', 'Each game has a scorekeeper, and admins on your team can take over or run other games at the same time.'],
    ],
    finalTitle: 'Give your team a real scoreboard',
    finalSub: 'Join the rec, school and pickup teams keeping score and sharing the game on SportStream.',
  },
  {
    slug: '/bracket-maker',
    title: 'Free Tournament Bracket Maker — Single & Double Elimination | SportStream',
    metaDescription:
      'Create and run tournament brackets free. Auto-seeded single elimination, double elimination and round robin with live scores, standings and an auto-scheduler for courts and fields.',
    badge: 'Free bracket maker',
    h1: 'The free <span class="accent">tournament bracket maker</span> that runs the whole event',
    lede: 'Generate single-elimination, double-elimination or round-robin brackets, auto-seed teams, schedule every court, and update the bracket live as scores come in.',
    featuresTitle: 'From registration to trophy',
    featuresSub: 'Everything a tournament director needs in one link.',
    features: [
      ['Single & double elimination', 'Auto-generate a clean bracket with byes handled correctly, plus round robin for pool play.'],
      ['Auto-seeding', 'Seed by rank and the bracket pairs teams automatically — or drag to set your own matchups.'],
      ['Smart scheduler', 'Assign games across multiple courts or fields with start times, respecting rest between rounds.'],
      ['Live bracket updates', 'Winners advance automatically as games go final. Everyone sees the current bracket in real time.'],
      ['Open team registration', 'Share a join code or link and let teams register themselves — no data entry for you.'],
      ['Entry fees', 'Optionally collect entry fees online when teams sign up.'],
    ],
    steps: [
      'Create a tournament and choose your format and sport.',
      'Let teams register with a join code, or add them yourself and set seeds.',
      'Generate the bracket and auto-schedule games across your courts.',
      'Scores update the bracket live — fans follow every round from one link.',
    ],
    sports: SPORTS,
    faqs: [
      ['Is the bracket maker free?', 'Yes. Building brackets, scheduling and live scoring are free. Optional paid features add exports and streaming extras.'],
      ['What bracket formats are supported?', 'Single elimination, double elimination (with a losers bracket and grand final), and round robin with standings.'],
      ['Can teams register themselves?', 'Yes — share a 6-character join code or a registration link and teams sign up on their own.'],
      ['Can I schedule multiple courts or fields?', 'Yes. The auto-scheduler places games across the number of courts or fields you set, with start times and rest between rounds.'],
    ],
    finalTitle: 'Run your next tournament the easy way',
    finalSub: 'Build the bracket, schedule the games, and keep every team and fan in the loop.',
  },
  {
    slug: '/league-manager',
    title: 'Free League Management Software — Schedules, Standings & Stats | SportStream',
    metaDescription:
      'Run your recreational or youth sports league online for free. Auto-generate round-robin schedules, track live standings, manage rosters and share real-time scores with families.',
    badge: 'Free league management',
    h1: 'Run your rec league online — <span class="accent">schedules, standings & stats</span>',
    lede: 'Auto-build the season schedule, keep standings up to date as games finish, manage team rosters, and give every family a live link to follow along.',
    featuresTitle: 'Your whole league in one place',
    featuresSub: 'Built for parks & rec coordinators, club directors and league organizers.',
    features: [
      ['Auto round-robin scheduling', 'Generate a balanced season schedule in seconds and adjust with drag-and-drop.'],
      ['Live standings', 'Wins, losses, ties and point differential update automatically as games go final.'],
      ['Team registration', 'Teams sign up with a join code — you approve them and the roster fills itself.'],
      ['Live scores for families', 'Every game has a public scoreboard, so parents follow from work or the road.'],
      ['Season stats & team pages', 'Each team gets a public page with record, schedule, results and player stats.'],
      ['Push notifications', 'Followers are notified when games go live and when their team plays.'],
    ],
    steps: [
      'Create your league and set the season and sport.',
      'Invite teams to register with a join code and approve them.',
      'Auto-generate the schedule and start the season.',
      'Standings and stats update live as scores come in — share one link with everyone.',
    ],
    sports: SPORTS,
    faqs: [
      ['How much does it cost to run a league?', 'Creating and running a league is free, including scheduling, standings and live scores.'],
      ['Do standings update automatically?', 'Yes. As each game is marked final, standings recompute — wins, losses, ties and point differential.'],
      ['Can I collect registration fees?', 'Yes, you can optionally collect entry or registration fees online when teams sign up.'],
      ['Can families follow games without an account?', 'Yes. Anyone with the link can watch live scores and view team pages; no account required.'],
    ],
    finalTitle: 'Give your league a modern home',
    finalSub: 'Schedules, standings, rosters and live scores — free, and all in one link.',
  },
]

// Write landing pages
for (const page of PAGES) {
  const dir = resolve(pub, `.${page.slug}`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'index.html'), render(page), 'utf-8')
  console.log('wrote', `public${page.slug}/index.html`)
}

// robots.txt
writeFileSync(resolve(pub, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`, 'utf-8')
console.log('wrote public/robots.txt')

// sitemap.xml — landing pages + key public routes
const urls = [
  '/', '/find', '/tournaments', '/leagues', '/wall-of-fame',
  ...PAGES.map((p) => p.slug),
]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><changefreq>${u === '/' ? 'daily' : 'weekly'}</changefreq></url>`).join('\n')}
</urlset>
`
writeFileSync(resolve(pub, 'sitemap.xml'), sitemap, 'utf-8')
console.log('wrote public/sitemap.xml')
