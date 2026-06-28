#!/usr/bin/env node
// Generates icon-192.png and icon-512.png with orange background + white house
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dir, '../frontend/public/icons')

// CRC32 table
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  crcTable[n] = c
}
function crc32(buf) {
  let c = 0xFFFFFFFF
  for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crcInput = Buffer.concat([t, data])
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(crcInput))
  return Buffer.concat([len, t, data, crcBuf])
}

function pointInPolygon(px, py, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi))
      inside = !inside
  }
  return inside
}

function inRoundedRect(x, y, w, h, r) {
  if (x < r && y < r) return Math.hypot(x - r, y - r) <= r
  if (x > w - r && y < r) return Math.hypot(x - (w - r), y - r) <= r
  if (x < r && y > h - r) return Math.hypot(x - r, y - (h - r)) <= r
  if (x > w - r && y > h - r) return Math.hypot(x - (w - r), y - (h - r)) <= r
  return true
}

function generatePNG(size) {
  const scale = size / 192
  const radius = Math.round(40 * scale)

  // House polygon points (from SVG viewBox 0 0 192 192)
  const poly = [
    [96,36],[164,100],[148,100],[148,156],[112,156],[112,116],[80,116],[80,156],[44,156],[44,100],[28,100]
  ].map(([x,y]) => [x * scale, y * scale])

  // Build raw scanlines (RGBA, filter byte 0 per row)
  const rowBytes = 1 + size * 4
  const raw = Buffer.alloc(size * rowBytes)

  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      const off = y * rowBytes + 1 + x * 4
      if (!inRoundedRect(x + 0.5, y + 0.5, size, size, radius)) {
        raw.writeUInt32BE(0x00000000, off) // transparent
        continue
      }
      if (pointInPolygon(x + 0.5, y + 0.5, poly)) {
        raw[off] = 255; raw[off+1] = 255; raw[off+2] = 255; raw[off+3] = 255 // white
      } else {
        raw[off] = 234; raw[off+1] = 88; raw[off+2] = 12; raw[off+3] = 255  // #EA580C
      }
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  const sig = Buffer.from([137,80,78,71,13,10,26,10])
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'icon-192.png'), generatePNG(192))
writeFileSync(join(OUT, 'icon-512.png'), generatePNG(512))
console.log('Icons generiert: icon-192.png, icon-512.png')
