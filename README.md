<div align="center">

# ⚔️ Arcane Keep

![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2024-f7df1e?style=flat-square&logo=javascript&logoColor=black)
![Canvas](https://img.shields.io/badge/Canvas-2D-ff6b35?style=flat-square&logo=html5&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-113_passing-6da03e?style=flat-square&logo=vitest&logoColor=white)
![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-deployed-4c1?style=flat-square&logo=github&logoColor=white)

[![Live Demo](https://img.shields.io/badge/⚔️_Live_Demo-arcane--keep-c9973a?style=for-the-badge)](https://pero-grubac.github.io/arcane-keep/)

</div>

---

## 📌 Project Overview

**Arcane Keep** is an endless tower-defense game. Procedurally generated maps, waves that scale into genuinely dangerous territory, and five towers that each branch into three mechanically distinct evolutions — fifteen in total, and none of them are recolours.

The whole simulation runs in tile space on a fixed timestep, with no DOM, no React and no pixels anywhere near it. That is what lets one codebase drive a 60fps canvas, a headless balance bot, and a 113-assertion test suite. Plays with a mouse or on a touchscreen. No backend and no art assets — even the sound is synthesised.

---

## ✨ Features

- 🗺️ **Procedural maps** — a lattice walk that can never produce a path folding back on itself; ~27% of maps get a second lane that merges before the keep
- 🏰 **Five towers, fifteen evolutions** — crits, piercing shots, chain lightning, damage marks, permanent auras, burning ground, spin-up fire rate, lobbed shells
- 🗿 **Support towers** — the Obelisk never fires and buffs everything around it instead
- 👹 **Nine enemy types** — armoured, chill-immune, shield-regenerating, and Brood Mothers that burst into three Imps when killed
- ☄️ **Active abilities** — Meteor, Deep Freeze and Rally on cooldown, so a wave going wrong is something you can answer
- ☠️ **Bosses that do something** — the Dread Lord shields its escort, the Void Overlord heals itself and silences your towers
- 🏔️ **Terrain** — water blocks building, high ground extends range, rubble costs gold to clear
- 🎬 **Replays and share links** — watch any finished run back at up to 16×, or copy a link that replays it in anyone's browser; map seeds can be shared the same way
- ⚡ **Send waves early** for a bonus that scales with how much of the current wave is still standing
- 🎯 **Per-tower targeting** — First, Last, Strongest or Closest
- ☀️ **Daily challenge** — same map and same waves for everyone, seeded from the date
- 🔊 **Synthesised audio** — no sound files; every tower family has its own firing pitch, and a drone rises under a live wave
- 📱 **Touch and desktop** — pointer-driven input and a layout that adapts on both axes
- 💾 **Runs survive a closed tab** — progress autosaves between waves; the menu offers **Continue run**, and the combat RNG picks up exactly where it stopped
- ⏸ **Auto-pause** when the tab is hidden, so switching away never costs the keep
- 📊 **Run report** — damage by tower with an MVP, gold earned vs. spent, the costliest wave, and lives across the run
- 📲 **Installable and offline** — a web manifest and service worker; after one visit it runs with no connection
- ♿ **Accessible** — labelled controls, focus-trapped dialogs, screen-reader announcements, separate effects/ambient volume, a reduced-motion mode, and optional status shapes so chill/freeze/burn never rely on colour alone
- 💾 **Local records** — best wave per map, run and kill totals, settings

---

## 🎮 Controls

| Input | Action |
|-------|--------|
| `1`–`5` | Select Archer / Mage / Frost / Cannon / Obelisk |
| Click / tap tile | Place the selected tower |
| Press and drag | Move the placement preview, lift to commit — shows range before you pay |
| Click a tower | Select it, then upgrade, evolve or sell |
| `Q` `W` `R` | Meteor / Deep Freeze / Rally |
| `Tab` | Cycle the selected tower's target priority |
| `Enter` | Send the next wave — bonus gold if one is already running |
| `E` | Evolve the selected tower |
| `Space` | Pause |
| `F` | Game speed — 1× / 2× / 4× |
| `M` | Mute |
| `Esc` / right-click | Deselect |

Spend **4 upgrade levels** on a tower and it can evolve for 120g. Upgrades are **kept**, so evolving is always a gain — and you pick which of the three branches it takes.

---

## 🏰 Towers

| Base | ⚔ Damage branch | ⚡ Speed branch | ◎ Range branch |
|------|----------------|----------------|----------------|
| 🏹 **Archer** | **Deadeye** — 32% crits at 2.6×, ignores all armour | **Ranger** — fires on 3 separate targets per volley | **Warden** — huge range, arrows pierce 3 enemies |
| 🔮 **Mage** | **Destroyer** — big blast that chains to 3 more foes | **Archmage** — rapid bolts, marks for +25% | **Seer** — near-global range, marks for +40% |
| ❄️ **Frost** | **Rime** — 2.2× against chilled targets, can freeze | **Blizzard** — no projectiles, a permanent damaging aura | **Glacier** — vast field, slows to 30% speed |
| 💣 **Cannon** | **Siege** — shells leave burning ground | **Gatling** — spins up to 1.8× fire rate | **Mortar** — lobbed arcing shells, can stun |
| 🗿 **Obelisk** | **Warstone** — neighbours hit 30% harder | **Metronome** — neighbours fire 45% faster | **Farseer** — neighbours reach 28% further |

> The Obelisk is a **support** tower: it never fires, and buffs every non-support tower inside its radius. Obelisks deliberately do not buff each other, so stacking them cannot spiral.

---

## 👹 Enemies

| Enemy | Unlocks | Trait |
|-------|---------|-------|
| 💀 Wraith | Wave 1 | Rank and file |
| 🐍 Viper | Wave 3 | Fast — outruns slow towers |
| 👺 Imp | Wave 6 | Arrives in packs |
| 🛡 Sentinel | Wave 7 | Flat armour blunts small hits |
| 👻 Wisp | Wave 9 | Cannot be slowed or frozen |
| 🕷 Brood Mother | Wave 11 | Bursts into 3 Imps when killed |
| 🔰 Warded One | Wave 14 | Shield regenerates if left alone |
| 👹 Dread Lord | Every 5th wave | Shields its escort every few seconds |
| 🐉 Void Overlord | Every 10th from 20 | Heals itself, silences your nearest tower |

**Armour** is flat reduction with a 12% damage floor — it blunts chip damage but never makes an enemy immune. Burning ground and Deadeye crits bypass it entirely.

**Wave modifiers** roll from wave 6: Swift Tide, Hardened, Horde and Elite Guard.

---

## ⚙️ How it works

### Three invariants

Everything else follows from these.

| Invariant | Why it matters |
|-----------|----------------|
| **The simulation works in tiles and seconds** | The renderer is the only code that multiplies by cell size, so entity positions survive a window resize untouched |
| **The engine runs on a fixed 1/60s substep** | `tick()` feeds the frame delta into an accumulator and integrates in exact steps, so 30fps, 60fps and 144fps produce the same simulation — there is a test for it |
| **Waves and fights are a pure function of the seed** | `buildWave(seed, n)` is stable, so the Intel panel previews exactly what will spawn; combat rolls come from `state.rng`, so a seed reproduces a whole run |

### Replays

Every player action goes through `dispatch()` in `actions.js`, which applies it and logs it against the substep it happened on. Because of the three invariants, the map, the seed and that log are the whole replay: feeding the actions back in at the same steps reproduces the run exactly, at any frame rate or speed. Towers are addressed by tile rather than id, and a share link is the log deflated and base64url-encoded — a short run is a few hundred characters.

### Map generation

The generator walks a **half-resolution lattice**: path nodes only ever sit on even coordinates, joined through the odd tile between them. A randomised DFS with backtracking always reaches the exit, so there is no "give up and draw a straight line" fallback. Two properties fall out for free:

- Parallel corridors are always separated by exactly one empty tile, so a path can never touch itself
- There is always buildable ground alongside the route

Paths come out 70–110 tiles long. Branching maps reuse the same trick: the tributary may not use any lattice node on the main path *or* adjacent to it, except at the junction it merges into. The junction is capped at 70% along, so the shared run to the keep is always at least ~30% of the path — defending the merge is the play.

**Terrain** is generated as blobs rather than confetti. Water never takes a tile beside the road, because those are the spots the player most needs; a test asserts it across 200 maps.

### Wave generation

Waves are built from a budget that grows with the wave number, spent on enemy types as they unlock.

| Stage | Behaviour |
|-------|-----------|
| Boss cadence | A Dread Lord every 5 waves, a Void Overlord every 10 from wave 20 |
| Budget fill | Types drawn at random from what has unlocked; Imps only ever appear as a clamped pack |
| Entity cap | Hard cap of **52** enemies per wave, so the screen stays readable |
| Overflow | Budget that does not fit becomes per-enemy **strength** rather than more entities |
| Spawn order | Bosses first, the rest interleaved so a wave is not neat same-type blocks |

Health scales quadratically with a capped speed ramp. The result is a real ceiling: tower slots bound your DPS while enemy health keeps climbing. A competent run reaches **wave 30–50**.

### Audio

Everything is synthesised with WebAudio oscillators and generated noise — no sound files ship with the game. Events raised *inside* the simulation are queued on `state.sfx` and drained by the canvas each frame; player-driven sounds play directly, because `tick()` clears that queue every frame and would otherwise swallow them.

---

## 🧪 Tests

```bash
npm test          # single run, ~3.5s
npm run test:watch
```

Nine suites, **113 assertions**, structured around the properties that actually broke during development rather than line coverage.

| Suite | What it pins down |
|-------|-------------------|
| `rng` | Determinism, range, uniformity, seed separation |
| `maps` | Contiguous paths, no self-touching, water never blocks the roadside, branching lanes well-formed |
| `waves` | `buildWave` is pure, the curve rises, the entity cap is hard, armour never fully negates damage |
| `towers` | Evolving never reduces power, auras and terrain apply, a tie suggests no path |
| `engine` | Frame-rate independence, seeded fights, targeting modes, wave merging, boss abilities, splitting |
| `abilities` | Each power does what its description claims, cooldowns behave |
| `save` | A run saved between waves and restored through JSON plays on bit-for-bit identically; the run report ranks correctly |
| `replay` | A varied run replays identically at a different frame rate and speed, through a share link, and across a save and resume |
| `balance` | A bot plays real waves end to end — catches stalls, leaks and unbounded entity growth |

---

## 📁 Project structure

```
arcane-keep/
├── index.html                  # Entry point and document head
├── vite.config.js              # base: './' so the build works from any subpath
├── eslint.config.js
├── package.json
├── .github/
│   └── workflows/
│       └── deploy.yml          # Lint + test + build, then publish to Pages
├── public/
│   ├── favicon.svg             # Hand-drawn SVG keep, legible down to 16px
│   ├── icon-192.png / icon-512.png  # Install icons rendered from the SVG
│   ├── manifest.webmanifest    # Install metadata: fullscreen, landscape
│   └── sw.js                   # Offline cache: page network-first, bundles cache-first
├── src/
│   ├── main.jsx
│   ├── styles/
│   │   └── global.css          # Design tokens, resets, touch rules
│   ├── game/                   # The simulation — no DOM, no React, no pixels
│   │   ├── engine.js           # Fixed-timestep tick, targeting, damage, statuses
│   │   ├── actions.js          # Every player action, applied and logged for replays
│   │   ├── replay.js           # Replaying a log, share-link encoding
│   │   ├── renderer.js         # The only module that converts tiles → pixels
│   │   ├── towers.js           # Tower and evolution data, stat maths, targeting
│   │   ├── enemies.js          # Enemy data, wave scaling, the Enemy class
│   │   ├── waves.js            # Deterministic wave composition
│   │   ├── abilities.js        # Meteor / Deep Freeze / Rally definitions
│   │   ├── audio.js            # WebAudio synth, driven by queued engine events
│   │   ├── storage.js          # localStorage records, settings, saved run, daily seed
│   │   ├── report.js           # Builds the end-of-run report from run stats
│   │   ├── rng.js              # Seeded RNG (mulberry32) and seed hashing
│   │   └── maps/
│   │       ├── generator.js    # Lattice path generation, terrain, themes
│   │       ├── map1.js         # Forest Crossing
│   │       ├── map2.js         # Ruins of Aldrath
│   │       └── index.js
│   └── components/             # React shell — renders around the canvas, not inside it
│       ├── App.jsx             # State bridge between the sim and the UI
│       ├── GameCanvas.jsx      # Render loop and pointer input
│       ├── HUD.jsx
│       ├── BottomPanel.jsx
│       ├── BuildTab.jsx
│       ├── Tabs.jsx            # Intel, Towers and Codex tabs
│       ├── EvolveModal.jsx
│       ├── AbilityBar.jsx
│       ├── MapSelect.jsx
│       ├── GameOver.jsx        # End-of-run dialog
│       ├── RunReport.jsx       # Damage-by-tower bars and the lives sparkline
│       ├── SettingsPanel.jsx   # Volume, motion and status-shape settings
│       ├── useDialog.js        # Focus trap + Escape for every overlay
│       └── Toast.jsx
└── tests/                      # Vitest — 113 assertions across 9 suites
    ├── engine.test.js
    ├── maps.test.js
    ├── towers.test.js
    ├── waves.test.js
    ├── abilities.test.js
    ├── balance.test.js
    ├── save.test.js
    ├── replay.test.js
    ├── bot.js                  # Shared bot that plays through dispatch()
    └── rng.test.js
```

<details>
<summary>🔷 Why React never touches the game loop</summary>

The simulation lives in a `useRef` and runs at 60fps. React only ever sees a small **snapshot** of it, pushed when a cheap fingerprint actually changes — so the UI never re-renders per frame, and the canvas never waits on React.

That fingerprint is load-bearing. When the Obelisk was added, buffed towers kept showing pre-buff numbers in the panel because aura state was not part of it. Anything that changes a tower's live stats has to be in the fingerprint.

</details>

<details>
<summary>🔷 No sprites, no image assets</summary>

Towers are drawn procedurally: five base silhouettes (turret, orb, crystal, mortar, obelisk) plus orbiting motes, glow and aura rings for evolutions. Scenery, terrain, projectiles and effects are all canvas primitives.

Shapes scale to any cell size, theme freely, and cost nothing to extend — adding a sixteenth evolution needs no new art.

</details>

---

## 🚀 Deploy to GitHub Pages

This is a Vite project, so Pages cannot serve the source directly — it has to be built. The included workflow does that on every push.

1. Create a repo named `arcane-keep` and push to the `main` branch
2. Go to **Settings → Pages → Source** → **GitHub Actions**
3. Push — the workflow lints, tests, builds and publishes
4. Site goes live at `https://pero-grubac.github.io/arcane-keep/`

The workflow fails the deploy if lint or tests fail, so a broken build never reaches Pages.

> `vite.config.js` already sets `base: './'`, which makes every asset path relative. That is what lets the same build work at a repo subpath (`/arcane-keep/`), at a domain root, or straight off the filesystem — no config change per environment.

`dist/` is gitignored on purpose, since Actions builds from source. To push a prebuilt `gh-pages` branch instead, remove `dist` from `.gitignore` first.

---

## 🛠️ Local development

```bash
npm install
npm run dev      # http://localhost:5173
```

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built output locally |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Re-run tests on change |
| `npm run lint` | ESLint |

> **Live Server will not work.** `index.html` loads `/src/main.jsx` — raw JSX that no browser can execute. Vite compiles it on the fly; a static file server just hands the browser JSX and you get a blank page. Use `npm run dev`, or `npm run build` and point a static server at `dist/`.

---

## ⚠️ Known limitations

- **Portrait phones are cramped.** The board is 22–23 tiles wide, so a narrow viewport caps cells around 17px. Landscape is the better orientation, and the ▼ button collapses the build panel for about +50% board size.
- **Replays are tied to the game version.** A balance change can make an old recording drift; the replay notices and says so rather than pretending.
- **Branching maps punish a bad opening.** Defending the merge is the correct play, and nothing in the game teaches it.
- **No meta-progression.** Every run starts from the same towers; only local records carry over.

---


*Built as a learning project. Not affiliated with any commercial tower-defense game.*
