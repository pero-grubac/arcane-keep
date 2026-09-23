// ─── Persistence ──────────────────────────────────────────────────────────────
// Every access is wrapped: localStorage throws in private mode, when cookies are
// blocked, and when the quota is full. Losing saved records must never take the
// game down with it.

const KEY = 'arcane-keep/v1'

const EMPTY = {
  settings: {
    sound: true,
    speed: 1,
    sfxVolume: 1,
    ambientVolume: 1,
    // 'system' follows prefers-reduced-motion; 'reduced' and 'full' override it.
    motion: 'system',
    // Adds shapes to status effects so none depend on colour alone.
    statusShapes: false,
  },
  records: {},   // mapId → { bestWave, runs, bestKills }
  daily: {},     // yyyy-mm-dd → bestWave
  lastSeed: null,
  totals: { runs: 0, kills: 0, waves: 0 },
}

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(EMPTY)
    const parsed = JSON.parse(raw)
    return {
      ...structuredClone(EMPTY),
      ...parsed,
      settings: { ...EMPTY.settings, ...(parsed.settings ?? {}) },
      records: parsed.records ?? {},
      daily: parsed.daily ?? {},
      totals: { ...EMPTY.totals, ...(parsed.totals ?? {}) },
    }
  } catch {
    return structuredClone(EMPTY)
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* saving is best-effort */
  }
}

export function loadSave() {
  return read()
}

export function saveSettings(patch) {
  const data = read()
  data.settings = { ...data.settings, ...patch }
  write(data)
  return data.settings
}

export function rememberSeed(seed) {
  const data = read()
  data.lastSeed = seed
  write(data)
}

// Records the finished run. Returns what improved, so the UI can say so.
export function recordRun({ mapId, wave, kills, dailyKey }) {
  const data = read()
  const prev = data.records[mapId] ?? { bestWave: 0, runs: 0, bestKills: 0 }
  const isBestWave = wave > prev.bestWave
  const isBestKills = kills > prev.bestKills

  data.records[mapId] = {
    bestWave: Math.max(prev.bestWave, wave),
    bestKills: Math.max(prev.bestKills, kills),
    runs: prev.runs + 1,
  }
  data.totals = {
    runs: (data.totals.runs ?? 0) + 1,
    kills: (data.totals.kills ?? 0) + kills,
    waves: (data.totals.waves ?? 0) + wave,
  }

  let isBestDaily = false
  if (dailyKey) {
    const prevDaily = data.daily[dailyKey] ?? 0
    isBestDaily = wave > prevDaily
    data.daily[dailyKey] = Math.max(prevDaily, wave)
  }

  write(data)
  return { isBestWave, isBestKills, isBestDaily, record: data.records[mapId] }
}

export function getRecord(mapId) {
  return read().records[mapId] ?? null
}

// ─── Run in progress ──────────────────────────────────────────────────────────
// Kept under its own key: a run snapshot is rewritten constantly between waves,
// and a bad one must never be able to take the records down with it.

const RUN_KEY = 'arcane-keep/run/v1'

export function saveRun(data) {
  if (!data) return
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(data))
  } catch {
    /* best-effort */
  }
}

export function loadRun() {
  try {
    const raw = localStorage.getItem(RUN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearRun() {
  try {
    localStorage.removeItem(RUN_KEY)
  } catch {
    /* best-effort */
  }
}

// ─── Daily challenge ──────────────────────────────────────────────────────────
// Same map and same waves for everyone, every day. Free to implement because
// buildWave is already a pure function of (seed, waveNumber).

export function dailyKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function dailySeed(date = new Date()) {
  const key = dailyKey(date)
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function getDailyBest(key = dailyKey()) {
  return read().daily[key] ?? 0
}
