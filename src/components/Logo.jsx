import { cx } from '../utils/format.js'

export default function Logo({ size = 'md', subtitle = 'Drug repurposing', className }) {
  return (
    <span className={cx('logo', size === 'lg' && 'logo--lg', className)}>
      <img className="logo__mark" src="/logo.png" alt="" width="34" height="34" />
      <span className="logo__text">
        <span className="logo__name">Dawa</span>
        {subtitle ? <span className="logo__sub">{subtitle}</span> : null}
      </span>
    </span>
  )
}
