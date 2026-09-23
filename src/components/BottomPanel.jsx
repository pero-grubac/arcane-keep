import { useState } from 'react'
import BuildTab from './BuildTab.jsx'
import { IntelTab, TowersTab, CodexTab } from './Tabs.jsx'
import styles from './BottomPanel.module.css'

const TABS = [
  { id: 'build', label: '⚔ Build' },
  { id: 'intel', label: '📜 Intel' },
  { id: 'towers', label: '🏰 Towers' },
  { id: 'codex', label: '📖 Codex' },
]

export default function BottomPanel({
  ui, seed, onSelectBuild, onSelectTower, onUpgrade, onEvolve, onSell, onSendWave,
  onSetTargeting,
}) {
  const [tab, setTab] = useState('build')
  // On a short screen the panel and the board compete for the same pixels;
  // collapsing hands the board everything but the tab bar.
  const [collapsed, setCollapsed] = useState(false)

  const selectTowerAndShow = (id) => {
    onSelectTower(id)
    setTab('build')
    setCollapsed(false)
  }

  const pickTab = (id) => {
    if (collapsed) setCollapsed(false)
    else if (id === tab) setCollapsed(true)
    setTab(id)
  }

  const nextWave = ui.wave + 1
  const early = ui.waveActive && ui.phase === 'playing'
  const hint = ui.phase !== 'playing'
    ? 'Run over.'
    : early
      ? `Wave ${ui.wave} · ${ui.enemiesLeft} left · call in early for +${ui.earlyBonus}g`
      : ui.wave === 0
        ? 'Place towers, then send the first wave.'
        : `Wave ${nextWave} ready`

  return (
    <div className={styles.panel}>
      <div className={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.tabBtn} ${tab === t.id && !collapsed ? styles.active : ''}`}
            onClick={() => pickTab(t.id)}
            aria-pressed={tab === t.id && !collapsed}
          >
            {t.label}
          </button>
        ))}

        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Show the build panel' : 'Hide the build panel'}
          aria-label={collapsed ? 'Show the build panel' : 'Hide the build panel'}
          aria-expanded={!collapsed}
        >
          {collapsed ? '▲' : '▼'}
        </button>

        <div className={styles.waveArea}>
          <span className={styles.waveHint} aria-live="polite">{hint}</span>
          <button
            className={`${styles.waveBtn} ${early ? styles.earlyBtn : ''}`}
            onClick={onSendWave}
            disabled={ui.phase !== 'playing'}
            title={early
              ? `Call wave ${nextWave} in early for +${ui.earlyBonus} gold (Enter)`
              : 'Send the next wave (Enter)'}
          >
            {early ? `⚡ Send Early +${ui.earlyBonus}g` : `⚔ Send Wave ${nextWave}`}
          </button>
        </div>
      </div>

      <div className={`${styles.tabContent} ${collapsed ? styles.collapsed : ''}`}>
        {tab === 'build' && (
          <BuildTab
            ui={ui}
            onSelectBuild={onSelectBuild}
            onUpgrade={onUpgrade}
            onEvolve={onEvolve}
            onSell={onSell}
            onSetTargeting={onSetTargeting}
          />
        )}
        {tab === 'intel' && <IntelTab wave={nextWave} seed={seed} live={false} />}
        {tab === 'towers' && (
          <TowersTab
            towers={ui.towers}
            selectedTowerId={ui.selectedTowerId}
            onSelectTower={selectTowerAndShow}
          />
        )}
        {tab === 'codex' && <CodexTab />}
      </div>
    </div>
  )
}
