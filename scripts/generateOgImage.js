import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

mkdirSync(publicDir, { recursive: true })

const W = 1200
const H = 630
const canvas = createCanvas(W, H)
const ctx = canvas.getContext('2d')

// Background
ctx.fillStyle = '#0f1117'
ctx.fillRect(0, 0, W, H)

// Subtle blue glow
const glow = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, 450)
glow.addColorStop(0, 'rgba(37,99,235,0.18)')
glow.addColorStop(1, 'rgba(37,99,235,0)')
ctx.fillStyle = glow
ctx.fillRect(0, 0, W, H)

// "SportStream" wordmark
ctx.textAlign = 'center'
ctx.textBaseline = 'middle'
ctx.font = 'bold 96px sans-serif'

// "Sport" in white
ctx.fillStyle = '#ffffff'
const sportText = 'Sport'
const streamText = 'Stream'
const sportWidth = ctx.measureText(sportText).width
const streamWidth = ctx.measureText(streamText).width
const totalWidth = sportWidth + streamWidth
const startX = W / 2 - totalWidth / 2

ctx.textAlign = 'left'
ctx.fillStyle = '#ffffff'
ctx.fillText(sportText, startX, H * 0.38)

// "Stream" in blue
ctx.fillStyle = '#2563eb'
ctx.fillText(streamText, startX + sportWidth, H * 0.38)

// Tagline
ctx.textAlign = 'center'
ctx.font = '500 32px sans-serif'
ctx.fillStyle = '#2563eb'
ctx.fillText('Live scores · Season stats · Wall of Fame', W / 2, H * 0.56)

// Sports icons row
ctx.font = '48px sans-serif'
ctx.fillStyle = '#ffffff'
const icons = ['⚾', '🏀', '⚽', '🏈']
const iconSpacing = 72
const iconsStartX = W / 2 - (icons.length - 1) * iconSpacing / 2
icons.forEach((icon, i) => {
  ctx.fillText(icon, iconsStartX + i * iconSpacing, H * 0.74)
})

// Save
const buf = canvas.toBuffer('image/png')
writeFileSync(join(publicDir, 'og-image.png'), buf)
console.log('✅  public/og-image.png written (1200×630)')
