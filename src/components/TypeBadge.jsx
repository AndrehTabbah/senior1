import { KIND_LABEL } from '../utils/detectInput.js'
import { cx } from '../utils/format.js'

/** Small uppercase label with a coloured dot: drug / compound / disease / smiles. */
export default function TypeBadge({ kind, label, className }) {
  const k = kind || 'auto'
  return <span className={cx('badge', `badge--${k}`, className)}>{label || KIND_LABEL[k] || k}</span>
}
