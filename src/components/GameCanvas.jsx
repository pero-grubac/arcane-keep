import { useCallback, useEffect, useRef } from 'react'
import { tick } from '../game/engine.js'
import { makeView, render, screenToTile } from '../game/renderer.js'

// Input runs on pointer events rather than mouse events, so a finger, a pen and
// a mouse all take the same path. Touch has no hover, so press-and-drag moves
// the placement preview and lifting commits it — which also gives touch players
// a way to see a tower's range before paying for it.
export default function GameCanvas({
  gameRef, callbacks, audio, onFrame, onPlaceTower, onSelectTower, onDeselect, onCastAtTile,
}) {
  const canvasRef = useRef(null)
  const viewRef = useRef({ cell: 40, ox: 0, oy: 0, w: 0, h: 0 })
  const hoverRef = useRef(null)
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const pointerRef = useRef({ down: false, touch: false })

  // Backing store matches devicePixelRatio, so the board is crisp on high-DPI
  // screens instead of being upscaled from CSS pixels.
  const resize = useCallback(() => {
    const canvas = canvasRef.current
    const s = gameRef.current
    if (!canvas || !s) return
    const parent = canvas.parentElement
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = parent.clientWidth
    const h = parent.clientHeight
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    viewRef.current = makeView(canvas.width, canvas.height, s.currentMap, dpr)
  }, [gameRef])

  useEffect(() => {
    resize()
    const ro = new ResizeObserver(resize)
    if (canvasRef.current?.parentElement) ro.observe(canvasRef.current.parentElement)
    // Rotating a phone changes the viewport before the observer settles.
    window.addEventListener('orientationchange', resize)
    return () => {
      ro.disconnect()
      window.removeEventListener('orientationchange', resize)
    }
  }, [resize])

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')

    const loop = (ts) => {
      rafRef.current = requestAnimationFrame(loop)
      const s = gameRef.current
      if (!s) return

      const last = lastRef.current || ts
      lastRef.current = ts
      const rawDt = Math.min((ts - last) / 1000, 0.1)

      tick(s, rawDt, callbacks.current)
      // The engine queues sound events rather than calling audio itself, which
      // keeps the simulation headless.
      if (s.sfx.length) audio.drain(s.sfx)

      render(ctx, s, viewRef.current, {
        selectedTowerId: s.selectedTowerId,
        hoverCell: hoverRef.current,
        buildType: s.selectedBuild,
      })
      onFrame()
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [gameRef, callbacks, audio, onFrame])

  const cellAt = useCallback((ev) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return screenToTile(viewRef.current, ev.clientX - rect.left, ev.clientY - rect.top)
  }, [])

  // What a press resolves to once the pointer lifts.
  const commit = useCallback((cell) => {
    const s = gameRef.current
    if (!s || s.phase !== 'playing' || !cell) return
    const { col, row } = cell
    const map = s.currentMap
    if (col < 0 || row < 0 || col >= map.cols || row >= map.rows) return

    // An armed ability takes the press before anything else.
    if (s.pendingAbility && onCastAtTile(col, row)) return

    const existing = s.towers.find((t) => t.col === col && t.row === row)
    if (existing) {
      onSelectTower(existing.id)
      return
    }
    if (s.selectedBuild) onPlaceTower(col, row)
    else onDeselect()
  }, [gameRef, onSelectTower, onPlaceTower, onDeselect, onCastAtTile])

  const handlePointerDown = useCallback((ev) => {
    pointerRef.current = { down: true, touch: ev.pointerType !== 'mouse' }
    hoverRef.current = cellAt(ev)
    // Keep receiving moves even if the finger slides off the canvas.
    try { ev.currentTarget.setPointerCapture(ev.pointerId) } catch { /* not critical */ }
  }, [cellAt])

  const handlePointerMove = useCallback((ev) => {
    // A mouse hovers continuously; a finger only while pressed.
    if (ev.pointerType === 'mouse' || pointerRef.current.down) {
      hoverRef.current = cellAt(ev)
    }
  }, [cellAt])

  const handlePointerUp = useCallback((ev) => {
    const { down, touch } = pointerRef.current
    pointerRef.current.down = false
    try { ev.currentTarget.releasePointerCapture(ev.pointerId) } catch { /* not critical */ }
    if (!down) return
    commit(cellAt(ev))
    // A finger leaves no cursor behind, so drop the preview once it lifts.
    if (touch) hoverRef.current = null
  }, [cellAt, commit])

  const handlePointerLeave = useCallback(() => {
    if (!pointerRef.current.down) hoverRef.current = null
  }, [])

  const handlePointerCancel = useCallback(() => {
    pointerRef.current.down = false
    hoverRef.current = null
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        cursor: 'crosshair',
        // Stops the browser claiming the gesture for scrolling or pinch-zoom.
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerCancel}
      onContextMenu={(e) => { e.preventDefault(); onDeselect() }}
    />
  )
}
