import { cx } from '../utils/format.js'

/**
 * Horizontal confidence bar. Fills in the accent colour when the value is
 * at or above the decision threshold, grey otherwise. Shows the threshold
 * as a thin tick.
 */
export default function ConfidenceMeter({ value, threshold = 0.79, showValue = true, className, style }) {
  const v = Math.max(0, Math.min(1, Number(value) || 0))
  const below = v < threshold
  return (
    <span
      className={cx('meter', below && 'meter--below', className)}
      style={style}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={v}
      aria-label={`Confidence ${v.toFixed(2)}${below ? ' (below threshold)' : ''}`}
    >
      <span className="meter__track">
        <span className="meter__fill" style={{ width: `${v * 100}%` }} />
        {threshold > 0 && threshold < 1 ? <span className="meter__threshold" style={{ left: `${threshold * 100}%` }} /> : null}
      </span>
      {showValue ? <span className="meter__value">{v.toFixed(2)}</span> : null}
    </span>
  )
}
