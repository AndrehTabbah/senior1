/* Minimal inline icon set (stroke icons, 24px grid). Usage: <Icon.Search size={18} /> */

function base({ size = 18, strokeWidth = 1.75, className, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {children}
    </svg>
  )
}

const make = (paths) => (props) => base({ ...props, children: paths })

export const Icon = {
  Search: make(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>,
  ),
  ArrowRight: make(
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>,
  ),
  ArrowLeft: make(
    <>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </>,
  ),
  ArrowUpRight: make(
    <>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </>,
  ),
  X: make(
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>,
  ),
  Menu: make(
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>,
  ),
  Clock: make(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
  ),
  User: make(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>,
  ),
  Check: make(<path d="m5 12 5 5L20 7" />),
  Alert: make(
    <>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <path d="M12 17.5h.01" />
    </>,
  ),
  Info: make(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>,
  ),
  ChevronDown: make(<path d="m6 9 6 6 6-6" />),
  ChevronRight: make(<path d="m9 6 6 6-6 6" />),
  Copy: make(
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a1 1 0 0 1 1-1h10" />
    </>,
  ),
  Download: make(
    <>
      <path d="M12 4v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 20h16" />
    </>,
  ),
  External: make(
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M18 13v6H5V6h6" />
    </>,
  ),
  Trash: make(
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </>,
  ),
  Refresh: make(
    <>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v5h-5" />
    </>,
  ),
  Flask: make(
    <>
      <path d="M9 3h6" />
      <path d="M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3" />
      <path d="M7 15h10" />
    </>,
  ),
  Graph: make(
    <>
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M7 7l4 9" />
      <path d="M17 7l-4 9" />
      <path d="M7 6h10" />
    </>,
  ),
  Pill: make(
    <>
      <rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)" />
      <path d="m8.5 8.5 7 7" />
    </>,
  ),
  Filter: make(<path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z" />),
  Dot: make(<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />),
}

export default Icon
