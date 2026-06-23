import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'

mkdirSync('public/icons', { recursive: true })

function generateIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#7F77DD'
  ctx.fillRect(0, 0, size, size)

  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${size * 0.45}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('H', size / 2, size / 2)

  writeFileSync(`public/icons/icon-${size}.png`, canvas.toBuffer('image/png'))
  console.log(`icon-${size}.png erstellt`)
}

generateIcon(192)
generateIcon(512)
