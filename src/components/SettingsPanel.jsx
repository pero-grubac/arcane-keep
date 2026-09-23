import { useId, useRef } from 'react'
import { useDialog } from './useDialog.js'
import styles from './SettingsPanel.module.css'

const MOTION = [
  { id: 'system', label: 'System' },
  { id: 'reduced', label: 'Reduced' },
  { id: 'full', label: 'Full' },
]

export default function SettingsPanel({ settings, onChange, onClose }) {
  const ref = useRef(null)
  const titleId = useId()
  useDialog(ref, onClose)

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={ref}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className={styles.title}>Settings</h2>

        <Slider
          label="Effects volume"
          value={settings.sfxVolume}
          onChange={(v) => onChange({ sfxVolume: v })}
        />
        <Slider
          label="Ambient volume"
          value={settings.ambientVolume}
          onChange={(v) => onChange({ ambientVolume: v })}
        />

        <fieldset className={styles.group}>
          <legend className={styles.label}>Motion</legend>
          <div className={styles.segmented}>
            {MOTION.map((m) => (
              <label key={m.id} className={settings.motion === m.id ? styles.on : ''}>
                <input
                  type="radio"
                  name="motion"
                  value={m.id}
                  checked={settings.motion === m.id}
                  onChange={() => onChange({ motion: m.id })}
                />
                {m.label}
              </label>
            ))}
          </div>
          <span className={styles.hint}>Reduced hides particles and screen flashes.</span>
        </fieldset>

        <label className={styles.check}>
          <input
            type="checkbox"
            checked={settings.statusShapes}
            onChange={(e) => onChange({ statusShapes: e.target.checked })}
          />
          <span>
            Status shapes
            <span className={styles.hint}>
              Dashed ring = chilled · square = frozen or stunned · spike = burning
            </span>
          </span>
        </label>

        <button className={styles.done} onClick={onClose} data-autofocus>Done</button>
      </div>
    </div>
  )
}

function Slider({ label, value, onChange }) {
  const id = useId()
  const pct = Math.round(value * 100)
  return (
    <div className={styles.group}>
      <label htmlFor={id} className={styles.label}>
        {label} <span className={styles.value}>{pct}%</span>
      </label>
      <input
        id={id}
        type="range"
        min="0"
        max="100"
        step="5"
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className={styles.range}
      />
    </div>
  )
}
