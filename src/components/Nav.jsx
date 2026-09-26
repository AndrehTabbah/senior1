import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import Logo from './Logo.jsx'
import { Icon } from './Icons.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { cx } from '../utils/format.js'

const LINKS = [
  { to: '/database', label: 'Database' },
  { to: '/model', label: 'Model' },
  { to: '/docs', label: 'Docs' },
  { to: '/history', label: 'History' },
]

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('')
}

export default function Nav() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setOpen(false)
    setMenu(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menu) return undefined
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false)
    }
    const onKey = (e) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const linkClass = ({ isActive }) => cx('nav__link', isActive && 'is-active')

  return (
    <header className="nav">
      <div className="container nav__inner">
        <Link to="/" aria-label="Dawa home">
          <Logo />
        </Link>

        <nav className="nav__links" aria-label="Primary">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav__right">
          {user ? (
            <div className="nav__user" ref={menuRef}>
              <button
                type="button"
                className="nav__user-btn"
                aria-haspopup="menu"
                aria-expanded={menu}
                onClick={() => setMenu((m) => !m)}
              >
                <span className="avatar">{initials(user.name)}</span>
                <span className="hide-mobile">{user.name.split(' ')[0]}</span>
                <Icon.ChevronDown size={14} />
              </button>
              {menu && (
                <div className="nav__menu" role="menu">
                  <div className="nav__menu-head">
                    <strong>{user.name}</strong>
                    {user.email}
                  </div>
                  <Link to="/history" className="nav__menu-item" role="menuitem">
                    <Icon.Clock size={16} /> Query history
                  </Link>
                  <button
                    type="button"
                    className="nav__menu-item"
                    role="menuitem"
                    onClick={async () => {
                      await signOut()
                      navigate('/')
                    }}
                  >
                    <Icon.ArrowRight size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/signin" className="btn btn--ghost btn--sm">
              Sign in
            </Link>
          )}

          <button
            type="button"
            className="nav__burger"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <Icon.X size={20} /> : <Icon.Menu size={20} />}
          </button>
        </div>
      </div>

      <div id="mobile-nav" className={cx('nav__mobile', open && 'is-open')}>
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} className={linkClass}>
            {l.label}
          </NavLink>
        ))}
        {user ? (
          <button
            type="button"
            className="nav__link"
            onClick={async () => {
              await signOut()
              navigate('/')
            }}
          >
            Sign out ({user.name})
          </button>
        ) : (
          <NavLink to="/signin" className={linkClass}>
            Sign in
          </NavLink>
        )}
      </div>
    </header>
  )
}
