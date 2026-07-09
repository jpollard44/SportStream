// One-off brand-asset generator. Renders HTML to PNG with the pre-installed
// Chromium via playwright-core, so no rasterizer or app dependency is needed.
//
//   npm i playwright-core --no-save
//   node scripts/generate-assets.mjs
//
// Outputs (committed to the repo):
//   public/icons/icon-192.png, icon-512.png   — PWA / home-screen icons (maskable)
//   public/icons/apple-touch-icon.png         — iOS home-screen icon (180, no transparency)
//   public/og-image.png                       — 1200x630 social share card
import { chromium } from 'playwright-core'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pub = resolve(__dirname, '../public')
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

// A maskable icon: the launcher may crop to a circle, so keep the glyph inside
// the safe zone (~80% center) and let the gradient bleed to the edges.
function iconHTML({ maskable = true } = {}) {
  const pad = maskable ? 12 : 0 // % padding reserved for maskable safe zone
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%}
    .wrap{width:100%;height:100%;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(145deg,#2563eb 0%,#1e3a8a 100%)}
    .glyph{width:${100 - pad * 2}%;height:${100 - pad * 2}%;display:flex;align-items:center;justify-content:center;
      font-family:'Inter',system-ui,sans-serif;font-weight:800;color:#fff;
      font-size:62vmin;line-height:1;letter-spacing:-0.04em;
      text-shadow:0 4px 18px rgba(0,0,0,0.28)}
  </style></head><body><div class="wrap"><div class="glyph">S</div></div></body></html>`
}

const OG_HTML = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;font-family:'Inter',system-ui,sans-serif;
    background:radial-gradient(120% 120% at 0% 0%,#141b2e 0%,#0f1117 55%);color:#fff;overflow:hidden}
  .frame{width:100%;height:100%;padding:64px 72px;display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;align-items:center;gap:16px}
  .logo{width:56px;height:56px;border-radius:14px;background:linear-gradient(145deg,#2563eb,#1e3a8a);
    display:flex;align-items:center;justify-content:center;font-weight:800;font-size:32px;
    box-shadow:0 8px 24px rgba(37,99,235,0.4)}
  .brand{font-size:30px;font-weight:800;letter-spacing:-0.02em}
  h1{font-size:76px;font-weight:800;letter-spacing:-0.03em;line-height:1.02;max-width:900px}
  h1 .accent{color:#60a5fa}
  .sub{font-size:30px;color:#94a3b8;margin-top:20px;font-weight:600}
  .board{display:flex;align-items:center;gap:24px;margin-top:8px}
  .score{display:flex;align-items:center;gap:28px;background:#1a1f2e;border:1px solid rgba(255,255,255,0.08);
    border-radius:20px;padding:22px 34px}
  .team{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:120px}
  .team .name{font-size:22px;font-weight:700;color:#e2e8f0}
  .team .pts{font-size:52px;font-weight:800;font-variant-numeric:tabular-nums}
  .vs{font-size:20px;color:#64748b;font-weight:700}
  .live{display:inline-flex;align-items:center;gap:10px;background:rgba(220,38,38,0.15);
    border:1px solid rgba(220,38,38,0.35);color:#fca5a5;border-radius:999px;padding:8px 18px;
    font-size:20px;font-weight:800}
  .dot{width:12px;height:12px;border-radius:999px;background:#ef4444}
</style></head><body>
  <div class="frame">
    <div class="top"><div class="logo">S</div><div class="brand">SportStream</div></div>
    <div>
      <h1>Live scores &amp; stats for <span class="accent">every team.</span></h1>
      <div class="sub">Scorekeeping · leagues · brackets · streaming — for the teams that don't make ESPN.</div>
    </div>
    <div class="board">
      <div class="live"><span class="dot"></span>LIVE</div>
      <div class="score">
        <div class="team"><div class="name">Hawks</div><div class="pts">58</div></div>
        <div class="vs">—</div>
        <div class="team"><div class="name">Wolves</div><div class="pts">54</div></div>
      </div>
    </div>
  </div>
</body></html>`

async function shoot(browser, html, width, height, out, omitBackground = false) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.screenshot({ path: out, omitBackground, clip: { x: 0, y: 0, width, height } })
  await page.close()
  console.log('wrote', out)
}

const browser = await chromium.launch({ executablePath: EXECUTABLE })
try {
  await shoot(browser, iconHTML({ maskable: true }), 192, 192, `${pub}/icons/icon-192.png`)
  await shoot(browser, iconHTML({ maskable: true }), 512, 512, `${pub}/icons/icon-512.png`)
  await shoot(browser, iconHTML({ maskable: false }), 180, 180, `${pub}/icons/apple-touch-icon.png`)
  await shoot(browser, OG_HTML, 1200, 630, `${pub}/og-image.png`)
} finally {
  await browser.close()
}
