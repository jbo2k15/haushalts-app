import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'

mkdirSync('public/icons', { recursive: true })

function generateIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const s = size

  // Background with rounded corners
  const r = s * 0.18
  ctx.fillStyle = '#7F77DD'
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(s - r, 0)
  ctx.quadraticCurveTo(s, 0, s, r)
  ctx.lineTo(s, s - r)
  ctx.quadraticCurveTo(s, s, s - r, s)
  ctx.lineTo(r, s)
  ctx.quadraticCurveTo(0, s, 0, s - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
  ctx.fill()

  const cx = s * 0.5
  const baseY = s * 0.82
  const roofTip = s * 0.18
  const houseW = s * 0.62
  const houseH = s * 0.38

  // House walls
  const wallLeft = cx - houseW / 2
  const wallRight = cx + houseW / 2
  const wallTop = s * 0.44

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(wallLeft, wallTop)
  ctx.lineTo(wallRight, wallTop)
  ctx.lineTo(wallRight, baseY)
  ctx.lineTo(wallLeft, baseY)
  ctx.closePath()
  ctx.fill()

  // Roof
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(cx - houseW * 0.58, wallTop + s * 0.02)
  ctx.lineTo(cx, roofTip)
  ctx.lineTo(cx + houseW * 0.58, wallTop + s * 0.02)
  ctx.closePath()
  ctx.fill()

  // Checkbox inside house
  const cbSize = houseW * 0.52
  const cbX = cx - cbSize / 2
  const cbY = wallTop + (baseY - wallTop) * 0.12
  const cbR = cbSize * 0.15

  // Checkbox background (purple)
  ctx.fillStyle = '#7F77DD'
  ctx.beginPath()
  ctx.roundRect(cbX, cbY, cbSize, cbSize, cbR)
  ctx.fill()

  // Checkmark
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = cbSize * 0.16
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cbX + cbSize * 0.2, cbY + cbSize * 0.5)
  ctx.lineTo(cbX + cbSize * 0.42, cbY + cbSize * 0.72)
  ctx.lineTo(cbX + cbSize * 0.78, cbY + cbSize * 0.28)
  ctx.stroke()

  writeFileSync(`public/icons/icon-${size}.png`, canvas.toBuffer('image/png'))
  console.log(`icon-${size}.png erstellt`)
}

generateIcon(192)
generateIcon(512)
