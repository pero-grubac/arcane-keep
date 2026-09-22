import { TOWER_DEFS, calcStats, towerArt, towerColor } from './towers.js'
import { buildCheck, terrainAt, pathsOf } from './engine.js'
import { ABILITY_BY_ID } from './abilities.js'

// ─── Renderer ─────────────────────────────────────────────────────────────────
// The only module that converts tiles → pixels. `view` carries the cell size and
// the offset that centres the board, so the simulation never needs to know how
// big the window is.
//
// Deliberately avoids ctx.shadowBlur in per-entity loops — it is the single
// biggest canvas performance trap, and cached radial gradients look the same.

function alpha(hex, a) {
  const v = Math.max(0, Math.min(255, Math.round(a * 255)))
  return hex + v.toString(16).padStart(2, '0')
}

const glowCache = new Map()
function glow(ctx, color, radius) {
  const key = `${color}|${Math.round(radius)}`
  let g = glowCache.get(key)
  if (!g) {
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, radius))
    g.addColorStop(0, alpha(color, 0.45))
    g.addColorStop(0.55, alpha(color, 0.14))
    g.addColorStop(1, alpha(color, 0))
    glowCache.set(key, g)
    if (glowCache.size > 200) glowCache.clear()
  }
  return g
}

export function makeView(canvasW, canvasH, map, dpr = 1) {
  const w = canvasW / dpr
  const h = canvasH / dpr
  const cell = Math.max(8, Math.floor(Math.min(w / map.cols, h / map.rows)))
  return {
    cell,
    ox: Math.floor((w - cell * map.cols) / 2),
    oy: Math.floor((h - cell * map.rows) / 2),
    w,
    h,
  }
}

export function screenToTile(view, px, py) {
  return {
    col: Math.floor((px - view.ox) / view.cell),
    row: Math.floor((py - view.oy) / view.cell),
  }
}

// ─── Board ────────────────────────────────────────────────────────────────────

function drawBoard(ctx, map, view, pathSet, time) {
  const { cell, ox, oy } = view
  const { theme, cols, rows } = map

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (pathSet.has(`${c},${r}`)) continue
      const x = ox + c * cell
      const y = oy + r * cell
      ctx.fillStyle = (c + r) % 2 === 0 ? theme.cellBg : theme.cellAlt
      ctx.fillRect(x, y, cell, cell)
    }
  }

  // Path laid down as a slab with a lip, rather than per-tile squares. Drawn
  // from the deduplicated union so a merge point is not painted twice.
  const roadCells = []
  const seen = new Set()
  for (const [c, r] of pathsOf(map).flat()) {
    const k = `${c},${r}`
    if (seen.has(k)) continue
    seen.add(k)
    roadCells.push([c, r])
  }
  ctx.fillStyle = theme.pathEdge
  for (const [c, r] of roadCells) ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell)
  ctx.fillStyle = theme.pathBg
  for (const [c, r] of roadCells) {
    ctx.fillRect(ox + c * cell + 1, oy + r * cell + 1, cell - 2, cell - 2)
  }
  ctx.fillStyle = theme.pathFg
  const inset = Math.max(2, Math.floor(cell * 0.12))
  for (const [c, r] of roadCells) {
    ctx.fillRect(ox + c * cell + inset, oy + r * cell + inset, cell - inset * 2, cell - inset * 2)
  }

  // Terrain sits on top of the ground but under the path.
  if (map.terrain) {
    for (const [key, kind] of Object.entries(map.terrain)) {
      const [c, r] = key.split(',').map(Number)
      const x = ox + c * cell
      const y = oy + r * cell
      if (kind === 'water') {
        ctx.fillStyle = '#12243c'
        ctx.fillRect(x, y, cell, cell)
        ctx.fillStyle = alpha('#4a90d0', 0.22)
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2)
        // Two offset ripples, drifting on the clock.
        ctx.strokeStyle = alpha('#8ac8ff', 0.28)
        ctx.lineWidth = 1
        for (let i = 0; i < 2; i++) {
          const yy = y + cell * (0.32 + i * 0.34) + Math.sin(time * 1.6 + c + i * 2) * cell * 0.05
          ctx.beginPath()
          ctx.moveTo(x + cell * 0.18, yy)
          ctx.lineTo(x + cell * 0.82, yy)
          ctx.stroke()
        }
      } else if (kind === 'high') {
        ctx.fillStyle = '#1c2029'
        ctx.fillRect(x, y, cell, cell)
        ctx.fillStyle = alpha('#8aa0b8', 0.14)
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2)
        // A lit top edge reads as elevation.
        ctx.fillStyle = alpha('#c0d4e8', 0.35)
        ctx.fillRect(x + 1, y + 1, cell - 2, 2)
        ctx.fillStyle = alpha('#000000', 0.35)
        ctx.fillRect(x + 1, y + cell - 3, cell - 2, 2)
      } else if (kind === 'rubble') {
        ctx.fillStyle = alpha('#6a5a48', 0.18)
        ctx.fillRect(x, y, cell, cell)
        ctx.fillStyle = alpha('#8a7a64', 0.6)
        const u = cell * 0.13
        ctx.fillRect(x + cell * 0.2, y + cell * 0.55, u * 1.7, u)
        ctx.fillRect(x + cell * 0.55, y + cell * 0.3, u * 1.3, u * 0.9)
        ctx.fillRect(x + cell * 0.33, y + cell * 0.25, u, u * 0.8)
      }
    }
  }

  // Faint grid over buildable ground only.
  ctx.strokeStyle = alpha(theme.accent, 0.1)
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let c = 0; c <= cols; c++) {
    ctx.moveTo(ox + c * cell + 0.5, oy)
    ctx.lineTo(ox + c * cell + 0.5, oy + rows * cell)
  }
  for (let r = 0; r <= rows; r++) {
    ctx.moveTo(ox, oy + r * cell + 0.5)
    ctx.lineTo(ox + cols * cell, oy + r * cell + 0.5)
  }
  ctx.stroke()
}

function drawDecor(ctx, map, view) {
  if (!map.decor) return
  const { cell, ox, oy } = view
  const kind = map.theme.decor
  const s = cell * 0.2
  for (const d of map.decor) {
    const x = ox + (d.c + 0.25 + d.jx * 0.5) * cell
    const y = oy + (d.r + 0.25 + d.jy * 0.5) * cell
    ctx.fillStyle = alpha(map.theme.accent, 0.22 + d.variant * 0.07)
    if (kind === 'trees') {
      ctx.beginPath()
      ctx.moveTo(x, y - s)
      ctx.lineTo(x + s * 0.8, y + s * 0.7)
      ctx.lineTo(x - s * 0.8, y + s * 0.7)
      ctx.closePath()
      ctx.fill()
    } else if (kind === 'crystals') {
      ctx.beginPath()
      ctx.moveTo(x, y - s)
      ctx.lineTo(x + s * 0.55, y)
      ctx.lineTo(x, y + s)
      ctx.lineTo(x - s * 0.55, y)
      ctx.closePath()
      ctx.fill()
    } else if (kind === 'rubble') {
      ctx.fillRect(x - s * 0.6, y - s * 0.35, s * 1.2, s * 0.7)
      ctx.fillRect(x - s * 0.2, y - s * 0.8, s * 0.7, s * 0.5)
    } else {
      ctx.fillRect(x - 1, y - s * 0.6, 2, s * 1.2)
      ctx.fillRect(x - s * 0.5, y - s * 0.2, 2, s * 0.8)
      ctx.fillRect(x + s * 0.4, y - s * 0.3, 2, s * 0.9)
    }
  }
}

function drawPathMarkers(ctx, map, view, time) {
  const { cell, ox, oy } = view
  const lanes = pathsOf(map)

  for (const path of lanes) drawLaneMarkers(ctx, path, view, time)

  // One portal per lane, one keep for all of them.
  const pulse = 0.6 + Math.sin(time * 2.5) * 0.25
  for (const path of lanes) {
    const [sc, sr] = path[0]
    const sx = ox + (sc + 0.5) * cell
    const sy = oy + (sr + 0.5) * cell
    ctx.save()
    ctx.translate(sx, sy)
    ctx.fillStyle = glow(ctx, '#40d070', cell * 1.1)
    ctx.fillRect(-cell * 1.1, -cell * 1.1, cell * 2.2, cell * 2.2)
    ctx.restore()
    ctx.strokeStyle = alpha('#40d070', pulse)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(sx, sy, cell * 0.3, 0, Math.PI * 2)
    ctx.stroke()
  }

  const main = lanes[0]
  const [ec, er] = main[main.length - 1]
  const ex = ox + (ec + 0.5) * cell
  const ey = oy + (er + 0.5) * cell
  ctx.save()
  ctx.translate(ex, ey)
  ctx.fillStyle = glow(ctx, '#e0a040', cell * 1.2)
  ctx.fillRect(-cell * 1.2, -cell * 1.2, cell * 2.4, cell * 2.4)
  ctx.restore()
  ctx.font = `${Math.floor(cell * 0.6)}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('🏰', ex, ey + 1)
}

function drawLaneMarkers(ctx, path, view, time) {
  const { cell, ox, oy } = view

  // Direction chevrons drifting along the road. Drawn as pale road markings
  // rather than in the theme accent, which made them indistinguishable from the
  // scenery dotted over the buildable ground.
  const drift = (time * 1.4) % 4
  ctx.fillStyle = alpha('#ffffff', 0.16)
  for (let i = 2; i < path.length - 1; i += 4) {
    const idx = Math.min(path.length - 2, Math.floor(i + drift))
    const [c, r] = path[idx]
    const [nc, nr] = path[idx + 1]
    const a = Math.atan2(nr - r, nc - c)
    ctx.save()
    ctx.translate(ox + (c + 0.5) * cell, oy + (r + 0.5) * cell)
    ctx.rotate(a)
    const k = cell * 0.13
    ctx.beginPath()
    ctx.moveTo(k, 0)
    ctx.lineTo(-k * 0.8, -k * 0.75)
    ctx.lineTo(-k * 0.8, k * 0.75)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

}

// ─── Towers ───────────────────────────────────────────────────────────────────
// Each base shape reads differently at a glance, and evolving visibly rebuilds
// the tower: new silhouette details, orbiting motes, a coloured aura.

function drawTowerBody(ctx, art, color, size, t, tower) {
  const recoil = tower.recoil * size * 0.12
  ctx.fillStyle = alpha(color, 0.9)
  ctx.strokeStyle = alpha(art.accent || color, 0.95)
  ctx.lineWidth = Math.max(1, size * 0.045)

  if (art.shape === 'turret') {
    // Barrel first, so the housing sits on top of it.
    ctx.save()
    ctx.rotate(tower.angle)
    const len = size * (art.barrel === 'long' ? 0.58 : 0.46)
    const w = size * 0.13
    ctx.fillStyle = alpha(color, 1)
    if (art.barrel === 'triple') {
      for (const off of [-w * 1.15, 0, w * 1.15]) {
        ctx.fillRect(-recoil, off - w * 0.32, len, w * 0.64)
      }
    } else {
      ctx.fillRect(-recoil, -w / 2, len, w)
      ctx.fillStyle = alpha(art.accent || color, 1)
      ctx.fillRect(len - recoil - size * 0.09, -w * 0.34, size * 0.09, w * 0.68)
    }
    ctx.restore()

    const b = size * 0.24
    ctx.fillStyle = '#12121c'
    ctx.fillRect(-b, -b, b * 2, b * 2)
    ctx.fillStyle = alpha(color, 0.85)
    ctx.fillRect(-b * 0.62, -b * 0.62, b * 1.24, b * 1.24)
    ctx.strokeRect(-b, -b, b * 2, b * 2)
  } else if (art.shape === 'orb') {
    const r = size * 0.3
    ctx.fillStyle = '#12121c'
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.36, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    const breathe = 1 + Math.sin(t * 2.2 + tower.pulse) * 0.09
    ctx.fillStyle = alpha(color, 0.85)
    ctx.beginPath()
    ctx.arc(0, 0, r * breathe, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = alpha(art.accent || color, 0.7)
    ctx.beginPath()
    ctx.arc(-r * 0.3, -r * 0.3, r * 0.34, 0, Math.PI * 2)
    ctx.fill()
  } else if (art.shape === 'crystal') {
    const r = size * 0.38
    ctx.fillStyle = '#101820'
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    const shard = r * (0.5 + Math.sin(t * 1.8 + tower.pulse) * 0.06)
    ctx.fillStyle = alpha(color, 0.95)
    ctx.beginPath()
    ctx.moveTo(0, -shard)
    ctx.lineTo(shard * 0.6, 0)
    ctx.lineTo(0, shard)
    ctx.lineTo(-shard * 0.6, 0)
    ctx.closePath()
    ctx.fill()
  } else if (art.shape === 'obelisk') {
    // A standing stone: tall, narrow, and obviously not a weapon.
    const w = size * 0.2
    const h = size * 0.42
    ctx.fillStyle = '#14181c'
    ctx.beginPath()
    ctx.moveTo(0, -h)
    ctx.lineTo(w, -h * 0.35)
    ctx.lineTo(w * 0.7, h * 0.6)
    ctx.lineTo(-w * 0.7, h * 0.6)
    ctx.lineTo(-w, -h * 0.35)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    const glowAmt = 0.55 + Math.sin(t * 2 + tower.pulse) * 0.25
    ctx.fillStyle = alpha(color, glowAmt)
    ctx.beginPath()
    ctx.moveTo(0, -h * 0.72)
    ctx.lineTo(w * 0.5, -h * 0.2)
    ctx.lineTo(0, h * 0.3)
    ctx.lineTo(-w * 0.5, -h * 0.2)
    ctx.closePath()
    ctx.fill()
  } else {
    // mortar
    const b = size * 0.36
    ctx.fillStyle = '#16140f'
    ctx.beginPath()
    ctx.moveTo(-b, b * 0.7)
    ctx.lineTo(-b * 0.7, -b * 0.6)
    ctx.lineTo(b * 0.7, -b * 0.6)
    ctx.lineTo(b, b * 0.7)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.save()
    ctx.rotate(tower.angle)
    const len = size * (art.barrel === 'wide' ? 0.46 : 0.38)
    const w = size * (art.barrel === 'wide' ? 0.22 : 0.17)
    ctx.fillStyle = alpha(color, 0.95)
    if (art.barrel === 'triple') {
      ctx.save()
      ctx.rotate(t * (art.spin ?? 0) * 0.35)
      for (let i = 0; i < 3; i++) {
        ctx.rotate((Math.PI * 2) / 3)
        ctx.fillRect(-recoil, -w * 0.3, len, w * 0.6)
      }
      ctx.restore()
    } else {
      ctx.fillRect(-recoil, -w / 2, len, w)
    }
    ctx.restore()
  }
}

function drawTower(ctx, tower, view, time, selected, stats) {
  const { cell, ox, oy } = view
  const x = ox + tower.x * cell
  const y = oy + tower.y * cell
  const color = towerColor(tower)
  const art = towerArt(tower)

  // Evolved towers sit in a pool of their own light.
  if (tower.evolved && art.glow) {
    const gr = cell * (0.75 + art.glow * 0.45)
    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = glow(ctx, color, gr)
    ctx.fillRect(-gr, -gr, gr * 2, gr * 2)
    ctx.restore()
  }

  // Base pad — solid, so a tower reads as a built structure rather than an
  // outline floating over the ground texture.
  const pad = cell * 0.44
  ctx.fillStyle = '#0c0c14'
  ctx.fillRect(x - pad, y - pad, pad * 2, pad * 2)
  ctx.fillStyle = alpha(color, tower.evolved ? 0.22 : 0.13)
  ctx.fillRect(x - pad, y - pad, pad * 2, pad * 2)
  // Corner studs read as masonry and make the footprint obvious.
  ctx.fillStyle = alpha(color, tower.evolved ? 0.95 : 0.55)
  const stud = Math.max(2, cell * 0.075)
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ctx.fillRect(x + sx * pad - (sx > 0 ? stud : 0), y + sy * pad - (sy > 0 ? stud : 0), stud, stud)
  }
  ctx.strokeStyle = selected ? '#d4a853' : alpha(color, tower.evolved ? 0.8 : 0.5)
  ctx.lineWidth = selected ? 2 : 1
  ctx.strokeRect(x - pad + 0.5, y - pad + 0.5, pad * 2 - 1, pad * 2 - 1)

  ctx.save()
  ctx.translate(x, y)
  drawTowerBody(ctx, art, color, cell, time, tower)

  // Orbiting motes — the clearest "this thing evolved" signal in motion.
  if (tower.evolved && art.orbiters) {
    const spin = time * (art.spin ?? 1.6)
    const rad = cell * 0.44
    for (let i = 0; i < art.orbiters; i++) {
      const a = spin + (i / art.orbiters) * Math.PI * 2
      const mx = Math.cos(a) * rad
      const my = Math.sin(a) * rad * 0.62
      ctx.fillStyle = alpha(art.accent || color, 0.9)
      ctx.beginPath()
      ctx.arc(mx, my, cell * 0.055, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()

  // A support tower's radius is always visible — you need to see what it covers.
  if (stats.support) {
    const r = stats.support.radius * cell
    ctx.strokeStyle = alpha(color, 0.16 + Math.sin(time * 1.6 + tower.pulse) * 0.05)
    ctx.lineWidth = 1
    ctx.setLineDash([3, 5])
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Silenced by a Void Overlord.
  if (tower.disabledT > 0) {
    ctx.strokeStyle = alpha('#d03a70', 0.75 + Math.sin(time * 18) * 0.25)
    ctx.lineWidth = 2
    const k = pad * 0.7
    ctx.beginPath()
    ctx.moveTo(x - k, y - k)
    ctx.lineTo(x + k, y + k)
    ctx.moveTo(x + k, y - k)
    ctx.lineTo(x - k, y + k)
    ctx.stroke()
  }

  // A buffed tower gets a small chevron so the aura is legible at a glance.
  if (stats.buffed) {
    ctx.fillStyle = alpha('#7fe0c0', 0.9)
    ctx.beginPath()
    ctx.moveTo(x + pad - 4, y - pad + 1)
    ctx.lineTo(x + pad, y - pad + 1)
    ctx.lineTo(x + pad, y - pad + 5)
    ctx.closePath()
    ctx.fill()
  }

  // Blizzard's field is always on, so it is always drawn.
  if (stats.traits.aura) {
    const r = stats.range * cell
    ctx.strokeStyle = alpha(color, 0.18 + Math.sin(time * 3) * 0.06)
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Upgrade pips along the base.
  const total = tower.upgrades.dmg + tower.upgrades.spd + tower.upgrades.rng
  if (total > 0 && cell >= 22) {
    const pw = (cell * 0.62) / 6
    for (let i = 0; i < Math.min(total, 6); i++) {
      ctx.fillStyle = i < total ? alpha(tower.evolved ? color : '#d4a853', 0.95) : '#20202c'
      ctx.fillRect(x - cell * 0.31 + i * pw, y + pad - 3, pw - 1.5, 2)
    }
  }
}

// ─── Enemies ──────────────────────────────────────────────────────────────────

function drawEnemy(ctx, e, view, time) {
  const { cell, ox, oy } = view
  const x = ox + e.x * cell
  const y = oy + e.y * cell
  const r = e.r * cell

  const chilled = e.slowT > 0
  const frozen = e.freezeT > 0 || e.stunT > 0
  const burning = e.burns.length > 0

  if (e.tags.includes('boss')) {
    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = glow(ctx, e.color, r * 2.4)
    ctx.fillRect(-r * 2.4, -r * 2.4, r * 4.8, r * 4.8)
    ctx.restore()
  }

  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = e.hitFlash > 0 ? '#ffffffcc' : alpha(frozen ? '#8fd8f8' : e.color, 0.82)
  ctx.fill()
  ctx.strokeStyle = frozen ? '#c8f0ff' : chilled ? '#7fd0f0' : alpha(e.color, 1)
  ctx.lineWidth = frozen ? 2 : 1.4
  ctx.stroke()

  if (burning) {
    ctx.strokeStyle = alpha('#ff7a20', 0.5 + Math.sin(time * 14 + e.id) * 0.25)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, r + 2.5, 0, Math.PI * 2)
    ctx.stroke()
  }
  if (e.markT > 0) {
    ctx.strokeStyle = alpha('#ff40c0', 0.8)
    ctx.lineWidth = 1.2
    const k = r * 1.5
    ctx.beginPath()
    ctx.moveTo(x - k, y - k)
    ctx.lineTo(x - k * 0.45, y - k)
    ctx.moveTo(x + k, y - k)
    ctx.lineTo(x + k * 0.45, y - k)
    ctx.moveTo(x - k, y + k)
    ctx.lineTo(x - k * 0.45, y + k)
    ctx.moveTo(x + k, y + k)
    ctx.lineTo(x + k * 0.45, y + k)
    ctx.stroke()
  }

  if (cell >= 18) {
    ctx.font = `${Math.floor(r * 1.25)}px serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(e.emoji, x, y + 1)
  }

  // Health, with the shield stacked above it.
  const bw = Math.max(10, r * 2.4)
  const by = y - r - (e.maxShield > 0 ? 9 : 6)
  ctx.fillStyle = '#05050a'
  ctx.fillRect(x - bw / 2, by, bw, 3)
  const pct = Math.max(0, e.hp / e.maxHp)
  ctx.fillStyle = pct > 0.5 ? '#3a9a3a' : pct > 0.25 ? '#b09020' : '#c03020'
  ctx.fillRect(x - bw / 2, by, bw * pct, 3)
  if (e.maxShield > 0 && e.shield > 0) {
    ctx.fillStyle = '#05050a'
    ctx.fillRect(x - bw / 2, by - 4, bw, 3)
    ctx.fillStyle = '#50d0c0'
    ctx.fillRect(x - bw / 2, by - 4, bw * (e.shield / e.maxShield), 3)
  }
}

// ─── Effects ──────────────────────────────────────────────────────────────────

function drawEffects(ctx, state, view) {
  const { cell, ox, oy } = view
  for (const f of state.effects) {
    const a = Math.max(0, f.life / f.maxLife)
    if (f.kind === 'beam') {
      ctx.strokeStyle = alpha(f.color, a * 0.95)
      ctx.lineWidth = 1 + a * 2.5
      ctx.beginPath()
      ctx.moveTo(ox + f.x1 * cell, oy + f.y1 * cell)
      ctx.lineTo(ox + f.x2 * cell, oy + f.y2 * cell)
      ctx.stroke()
    } else if (f.kind === 'blast') {
      const r = f.r * cell * (1.15 - a * 0.35)
      ctx.strokeStyle = alpha(f.color, a * 0.7)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(ox + f.x * cell, oy + f.y * cell, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = alpha(f.color, a * 0.13)
      ctx.fill()
    } else if (f.kind === 'pulse') {
      const r = f.r * cell * (1 - a * 0.85)
      ctx.strokeStyle = alpha(f.color, a * 0.5)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(ox + f.x * cell, oy + f.y * cell, r, 0, Math.PI * 2)
      ctx.stroke()
    } else if (f.kind === 'screen') {
      ctx.fillStyle = alpha(f.color, a * 0.22)
      ctx.fillRect(0, 0, view.w, view.h)
    } else if (f.kind === 'muzzle') {
      ctx.save()
      ctx.translate(ox + f.x * cell, oy + f.y * cell)
      ctx.rotate(f.angle)
      ctx.fillStyle = alpha(f.color, a * 0.85)
      ctx.beginPath()
      ctx.moveTo(cell * 0.42, 0)
      ctx.lineTo(cell * 0.26, -cell * 0.1 * a)
      ctx.lineTo(cell * 0.26, cell * 0.1 * a)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
  }
}

function drawHazards(ctx, state, view, time) {
  const { cell, ox, oy } = view
  for (const h of state.hazards) {
    const a = Math.min(1, h.t / h.maxT)
    const x = ox + h.x * cell
    const y = oy + h.y * cell
    const r = h.r * cell
    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = glow(ctx, h.color, r)
    ctx.globalAlpha = 0.5 + Math.sin(time * 8) * 0.12
    ctx.fillRect(-r, -r, r * 2, r * 2)
    ctx.restore()
    ctx.globalAlpha = 1
    ctx.strokeStyle = alpha(h.color, a * 0.4)
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function drawProjectiles(ctx, state, view) {
  const { cell, ox, oy } = view
  for (const p of state.projectiles) {
    const x = ox + p.x * cell
    const y = oy + p.y * cell
    const size = Math.max(2, cell * (p.splash > 0 ? 0.11 : 0.075))

    if (p.kind === 'pierce') {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(p.angle)
      ctx.fillStyle = p.color
      ctx.fillRect(-cell * 0.22, -size * 0.32, cell * 0.3, size * 0.64)
      ctx.restore()
      continue
    }

    // Lobbed shells visibly rise and fall over the battlefield.
    let drawY = y
    if (p.kind === 'arc' && p.totalDist > 0) {
      const t = Math.min(1, p.travelled / p.totalDist)
      drawY = y - Math.sin(t * Math.PI) * cell * 1.5
      ctx.fillStyle = alpha('#000000', 0.25)
      ctx.beginPath()
      ctx.ellipse(x, y, size * 0.9, size * 0.4, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.save()
    ctx.translate(x, drawY)
    ctx.fillStyle = glow(ctx, p.color, size * 3.2)
    ctx.fillRect(-size * 3.2, -size * 3.2, size * 6.4, size * 6.4)
    ctx.restore()
    ctx.beginPath()
    ctx.arc(x, drawY, size, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.fill()
  }
}

// ─── Build preview ────────────────────────────────────────────────────────────

function drawHover(ctx, state, view, hover, buildType) {
  if (!hover) return
  const { cell, ox, oy } = view
  const { col, row } = hover
  const map = state.currentMap
  if (col < 0 || row < 0 || col >= map.cols || row >= map.rows) return

  // Targeting an ability takes priority over the build preview.
  const pending = state.pendingAbility ? ABILITY_BY_ID[state.pendingAbility] : null
  if (pending?.targeted) {
    const x = ox + (col + 0.5) * cell
    const y = oy + (row + 0.5) * cell
    const r = pending.radius * cell
    ctx.strokeStyle = alpha('#ff8030', 0.85)
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = alpha('#ff8030', 0.12)
    ctx.fill()
    // Crosshair.
    ctx.strokeStyle = alpha('#ffc080', 0.9)
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x - cell * 0.3, y)
    ctx.lineTo(x + cell * 0.3, y)
    ctx.moveTo(x, y - cell * 0.3)
    ctx.lineTo(x, y + cell * 0.3)
    ctx.stroke()
    return
  }

  if (!buildType) return

  // Exactly the same check the click handler runs, so the preview can never
  // promise a placement that will then be refused.
  const check = buildCheck(state, col, row)
  const def = TOWER_DEFS[buildType]
  const x = ox + (col + 0.5) * cell
  const y = oy + (row + 0.5) * cell

  if (check.ok) {
    const previewTower = {
      baseType: buildType,
      upgrades: { dmg: 0, spd: 0, rng: 0 },
      evolved: false,
      terrain: check.terrain,
    }
    const st = calcStats(previewTower)
    const radius = st.support ? st.support.radius : st.range
    ctx.strokeStyle = alpha(def.color, 0.4)
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.arc(x, y, radius * cell, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = alpha(def.color, 0.05)
    ctx.fill()
  }

  ctx.fillStyle = check.ok ? alpha(def.color, 0.22) : alpha('#e04030', 0.22)
  ctx.fillRect(ox + col * cell, oy + row * cell, cell, cell)
  ctx.strokeStyle = check.ok ? alpha(def.color, 0.9) : alpha('#e04030', 0.9)
  ctx.lineWidth = 1.5
  ctx.strokeRect(ox + col * cell + 1, oy + row * cell + 1, cell - 2, cell - 2)

  ctx.font = `${Math.floor(cell * 0.45)}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.globalAlpha = check.ok ? 0.75 : 0.35
  ctx.fillText(def.emoji, x, y + 1)
  ctx.globalAlpha = 1

  // Flag the two terrain tiles that change the deal.
  const kind = terrainAt(map, col, row)
  if (check.ok && (kind === 'high' || kind === 'rubble')) {
    ctx.font = "bold 9px 'Share Tech Mono', monospace"
    ctx.fillStyle = kind === 'high' ? '#a8d8ff' : '#e0b070'
    ctx.textBaseline = 'bottom'
    ctx.fillText(kind === 'high' ? '+15% RNG' : '+25g', x, oy + row * cell - 2)
    ctx.textBaseline = 'middle'
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function render(ctx, state, view, opts = {}) {
  const map = state.currentMap
  if (!map) return
  const { selectedTowerId, hoverCell, buildType } = opts
  const time = state.time
  const { cell, ox, oy } = view

  ctx.clearRect(0, 0, view.w, view.h)

  const pathSet = state._pathSet ?? new Set(map.path.map(([c, r]) => `${c},${r}`))
  state._pathSet = pathSet

  drawBoard(ctx, map, view, pathSet, time)
  drawDecor(ctx, map, view)
  drawPathMarkers(ctx, map, view, time)
  drawHazards(ctx, state, view, time)

  // Range ring for the selected tower.
  if (selectedTowerId) {
    const st = state.towers.find((t) => t.id === selectedTowerId)
    if (st) {
      const s = calcStats(st)
      const x = ox + st.x * cell
      const y = oy + st.y * cell
      ctx.beginPath()
      ctx.arc(x, y, s.range * cell, 0, Math.PI * 2)
      ctx.strokeStyle = alpha('#d4a853', 0.35)
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = alpha('#d4a853', 0.04)
      ctx.fill()
    }
  }

  drawHover(ctx, state, view, hoverCell, buildType)

  for (const t of state.towers) {
    drawTower(ctx, t, view, time, t.id === selectedTowerId, calcStats(t))
  }
  for (const e of state.enemies) {
    if (!e.dead) drawEnemy(ctx, e, view, time)
  }
  drawProjectiles(ctx, state, view)
  drawEffects(ctx, state, view)

  for (const p of state.particles) {
    const a = Math.max(0, p.life / p.maxLife)
    const s = p.size * a * (cell / 40) * 2.4
    if (s < 0.3) continue
    ctx.fillStyle = alpha(p.color, a * 0.8)
    ctx.beginPath()
    ctx.arc(ox + p.x * cell, oy + p.y * cell, s, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const n of state.dmgNums) {
    const a = Math.max(0, n.life / n.maxLife)
    const size = (n.crit ? 13 : 10) + (1 - a) * 2
    ctx.font = `bold ${Math.round(size)}px 'Share Tech Mono', monospace`
    ctx.fillStyle = alpha(n.color, a * 0.95)
    ctx.fillText(n.crit ? `${n.val}!` : n.val, ox + n.x * cell, oy + n.y * cell)
  }

  // ── Boss health bar ──
  const boss = state.enemies.find((e) => !e.dead && e.tags.includes('boss'))
  if (boss) {
    const bw = Math.min(460, view.w * 0.42)
    const bx = (view.w - bw) / 2
    const by = 10
    ctx.fillStyle = '#0a0a0fdd'
    ctx.fillRect(bx - 2, by - 2, bw + 4, 20)
    ctx.strokeStyle = alpha(boss.color, 0.8)
    ctx.lineWidth = 1
    ctx.strokeRect(bx - 2.5, by - 2.5, bw + 5, 21)
    ctx.fillStyle = '#1a0a14'
    ctx.fillRect(bx, by, bw, 8)
    ctx.fillStyle = boss.color
    ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.maxHp), 8)
    if (boss.shield > 0) {
      ctx.fillStyle = '#50d0c0'
      ctx.fillRect(bx, by - 3, bw * (boss.shield / boss.maxShield), 2)
    }
    ctx.font = "600 9px 'Cinzel', serif"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#d8c8a8'
    ctx.fillText(`${boss.emoji} ${boss.name.toUpperCase()}`, view.w / 2, by + 10)
    ctx.textBaseline = 'middle'
  }

  if (state.paused) {
    ctx.fillStyle = '#0a0a0f99'
    ctx.fillRect(0, 0, view.w, view.h)
    ctx.fillStyle = '#d4a853'
    ctx.font = "600 20px 'Cinzel', serif"
    ctx.fillText('PAUSED', view.w / 2, view.h / 2)
    ctx.font = "11px 'Share Tech Mono', monospace"
    ctx.fillStyle = '#6a5a3a'
    ctx.fillText('press space to resume', view.w / 2, view.h / 2 + 24)
  }
}
