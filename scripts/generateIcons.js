import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

mkdirSync(publicDir, { recursive: true })

function drawIcon(size, { maskable = false } = {}) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Blue circle background
  ctx.fillStyle = '#2563eb'
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.fill()

  // White "S" lettermark
  // For maskable, safe zone is inner 80% (40% padding each side)
  // For regular icons, use 72% of size for the letter
  const letterScale = maskable ? 0.42 : 0.52
  const fontSize = Math.round(size * letterScale)

  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Slight visual centering nudge
  ctx.fillText('S', size / 2, size / 2 + fontSize * 0.04)

  return canvas.toBuffer('image/png')
}

const icons = [
  { name: 'favicon-16x16.png',     size: 16 },
  { name: 'favicon-32x32.png',     size: 32 },
  { name: 'apple-touch-icon.png',  size: 180 },
  { name: 'icon-192.png',          size: 192 },
  { name: 'icon-512.png',          size: 512 },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
]

for (const { name, size, maskable } of icons) {
  const buf = drawIcon(size, { maskable })
  writeFileSync(join(publicDir, name), buf)
  console.log(`✅  public/${name} (${size}×${size}${maskable ? ' maskable' : ''})`)
}

// Generate favicon.ico (32x32 raw PNG named .ico — browsers accept it)
const icoBuf = drawIcon(32)
writeFileSync(join(publicDir, 'favicon.ico'), icoBuf)
console.log('✅  public/favicon.ico (32×32)')
