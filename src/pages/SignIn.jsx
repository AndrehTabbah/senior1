import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { USE_MOCK } from '../api/index.js'
import { Icon } from '../components/Icons.jsx'
import { fmtDate } from '../utils/format.js'
import './signin.css'

const DEMO = { email: 'demo@dawa.ae', password: 'demo1234' }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMPTY = { name: '', email: '', affiliation: '', password: '', confirm: '' }
const ORDER = {
  signin: ['email', 'password'],
  signup: ['name', 'email', 'affiliation', 'password', 'confirm'],
}

const BENEFITS = [
  'Query history synced across devices once the backend lands. Until then it stays in this browser.',
  'Export any results table with the threshold, top-k and model version recorded alongside it.',
  'Your preferred threshold is saved, so the next query starts where the last one ended.',
]

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('')
}

function validateField(key, values, mode) {
  const v = values[key]
  switch (key) {
    case 'name':
      return v.trim() ? null : 'Enter your name.'
    case 'email':
      if (!v.trim()) return 'Enter your email address.'
      return EMAIL_RE.test(v.trim()) ? null : 'Enter a valid email address.'
    case 'password':
      if (!v) return mode === 'signup' ? 'Choose a password.' : 'Enter your password.'
      if (mode === 'signup' && v.length < 8) return 'Use at least 8 characters.'
      return null
    case 'confirm':
      if (!v) return 'Repeat your password.'
      return v === values.password ? null : 'Passwords do not match.'
    default:
      return null
  }
}

function validateAll(values, mode) {
  const errs = {}
  ORDER[mode].forEach((k) => {
    const e = validateField(k, values, mode)
    if (e) errs[k] = e
  })
  return errs
}

/** Where to go after a successful sign-in: `location.state.from` may be a path or a location object. */
function resolveFrom(state) {
  const from = state?.from
  if (!from) return '/'
  if (typeof from === 'string') return from || '/'
  if (from.pathname) return `${from.pathname}${from.search || ''}${from.hash || ''}`
  return '/'
}

export default function SignIn({ mode = 'signin' }) {
  const { user, ready, signOut } = useAuth()
  const isSignup = mode === 'signup'

  useEffect(() => {
    document.title = user ? 'Account · Dawa' : isSignup ? 'Create account · Dawa' : 'Sign in · Dawa'
  }, [user, isSignup])

  return (
    <section className="signin">
      <div className="container signin__grid">
        <div className="signin__copy">
          <div className="eyebrow">Account</div>
          <h1 className="h1">Keep your queries where you left them.</h1>
        </div>

        <div className="signin__more">
          <ul className="signin__benefits">
            {BENEFITS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="signin__disclaimer small muted">
            Dawa is a research tool. Predictions are hypotheses for further investigation, not clinical advice, and
            must not be used to make treatment decisions.
          </p>
        </div>

        <div className="signin__side">
          {!ready ? (
            <PanelSkeleton isSignup={isSignup} />
          ) : user ? (
            <AccountSummary user={user} signOut={signOut} />
          ) : (
            <AccountForm mode={isSignup ? 'signup' : 'signin'} />
          )}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ form */

function AccountForm({ mode }) {
  const isSignup = mode === 'signup'
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const uid = useId()
  const refs = useRef({})
  const alive = useRef(true)
  const prevMode = useRef(mode)

  const [values, setValues] = useState(() => (!isSignup && location.state?.demo ? { ...EMPTY, ...DEMO } : EMPTY))
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  /* Switching between /signin and /signup reuses this component: clear transient state. */
  useEffect(() => {
    if (prevMode.current === mode) return
    prevMode.current = mode
    setErrors({})
    setServerError(null)
    setShowPw(false)
    setSubmitting(false)
    setValues((v) => ({ ...v, password: '', confirm: '' }))
  }, [mode])

  /* Sent here from the sign-up page's demo button. */
  useEffect(() => {
    if (!isSignup && location.state?.demo) setValues((v) => ({ ...v, email: DEMO.email, password: DEMO.password }))
  }, [isSignup, location.state])

  const ids = {
    name: `${uid}-name`,
    email: `${uid}-email`,
    affiliation: `${uid}-affiliation`,
    password: `${uid}-password`,
    confirm: `${uid}-confirm`,
  }

  const set = (key) => (e) => {
    const val = e.target.value
    setValues((v) => ({ ...v, [key]: val }))
    if (errors[key]) {
      setErrors((er) => {
        const next = { ...er }
        delete next[key]
        return next
      })
    }
    if (serverError) setServerError(null)
  }

  const onBlur = (key) => () => {
    if (!values[key]) return
    const err = validateField(key, values, mode)
    setErrors((er) => {
      const next = { ...er }
      if (err) next[key] = err
      else delete next[key]
      return next
    })
  }

  const inputProps = (key) => ({
    id: ids[key],
    name: key,
    className: 'input',
    value: values[key],
    onChange: set(key),
    onBlur: onBlur(key),
    ref: (el) => {
      refs.current[key] = el
    },
    'aria-invalid': errors[key] ? 'true' : undefined,
  })

  const describedBy = (key, hint) => (errors[key] ? `${ids[key]}-error` : hint ? `${ids[key]}-hint` : undefined)

  async function onSubmit(e) {
    e.preventDefault()
    if (submitting) return
    const errs = validateAll(values, mode)
    setErrors(errs)
    const first = ORDER[mode].find((k) => errs[k])
    if (first) {
      refs.current[first]?.focus()
      return
    }
    setSubmitting(true)
    setServerError(null)
    try {
      if (isSignup) {
        await signUp({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
          affiliation: values.affiliation.trim() || null,
        })
      } else {
        await signIn({ email: values.email.trim(), password: values.password })
      }
      navigate(resolveFrom(location.state), { replace: true })
    } catch (err) {
      if (!alive.current) return
      setServerError(err)
      setSubmitting(false)
    }
  }

  function fillDemo() {
    if (isSignup) {
      navigate('/signin', { state: { ...(location.state || {}), demo: true } })
      return
    }
    setValues((v) => ({ ...v, email: DEMO.email, password: DEMO.password }))
    setErrors({})
    setServerError(null)
    refs.current.submit?.focus()
  }

  const pwType = showPw ? 'text' : 'password'

  return (
    <>
      <form className="signin__panel" onSubmit={onSubmit} noValidate aria-busy={submitting}>
        <h2 className="h3">{isSignup ? 'Create your account' : 'Sign in'}</h2>
        <p className="signin__sub small muted">
          {isSignup ? 'Free for academic and clinical researchers.' : 'Use the email address you registered with.'}
        </p>

        <div className="signin__fields">
          {isSignup ? (
            <Field id={ids.name} label="Name" error={errors.name}>
              <input
                {...inputProps('name')}
                type="text"
                autoComplete="name"
                required
                aria-describedby={describedBy('name')}
              />
            </Field>
          ) : null}

          <Field id={ids.email} label="Email" error={errors.email}>
            <input
              {...inputProps('email')}
              type="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              required
              aria-describedby={describedBy('email')}
            />
          </Field>

          {isSignup ? (
            <Field id={ids.affiliation} label="Affiliation" optional error={errors.affiliation}>
              <input
                {...inputProps('affiliation')}
                type="text"
                autoComplete="organization"
                placeholder="University of Sharjah"
                aria-describedby={describedBy('affiliation')}
              />
            </Field>
          ) : null}

          <Field
            id={ids.password}
            label="Password"
            hint={isSignup ? 'At least 8 characters.' : undefined}
            error={errors.password}
          >
            <div className="signin__pw">
              <input
                {...inputProps('password')}
                type={pwType}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                minLength={isSignup ? 8 : undefined}
                required
                aria-describedby={describedBy('password', isSignup ? 'At least 8 characters.' : undefined)}
              />
              <button
                type="button"
                className="signin__pw-toggle"
                aria-label="Show password"
                aria-pressed={showPw}
                aria-controls={ids.password}
                onClick={() => setShowPw((s) => !s)}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>

          {isSignup ? (
            <Field id={ids.confirm} label="Confirm password" error={errors.confirm}>
              <input
                {...inputProps('confirm')}
                type={pwType}
                autoComplete="new-password"
                required
                aria-describedby={describedBy('confirm')}
              />
            </Field>
          ) : null}
        </div>

        {serverError ? (
          <div className="notice notice--accent signin__server" role="alert">
            {serverError.message || 'Something went wrong. Try again.'}
            {serverError.code === 'conflict' ? (
              <>
                {' '}
                <Link to="/signin" state={location.state} className="link">
                  Sign in instead
                </Link>
                .
              </>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          className="btn btn--primary btn--lg signin__submit"
          disabled={submitting}
          ref={(el) => {
            refs.current.submit = el
          }}
        >
          {submitting ? <span className="spinner" aria-hidden="true" /> : null}
          {submitting ? (isSignup ? 'Creating account…' : 'Signing in…') : isSignup ? 'Create account' : 'Sign in'}
          {submitting ? null : <Icon.ArrowRight size={16} />}
        </button>

        <p className="signin__switch">
          {isSignup ? (
            <>
              Already have an account?{' '}
              <Link to="/signin" state={location.state} className="link">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{' '}
              <Link to="/signup" state={location.state} className="link">
                Create an account
              </Link>
            </>
          )}
        </p>
      </form>

      {USE_MOCK ? (
        <div className="notice signin__demo">
          <span>
            Demo account while the backend is in progress: <span className="mono">{DEMO.email}</span> /{' '}
            <span className="mono">{DEMO.password}</span>
          </span>
          <button type="button" className="btn btn--quiet btn--sm" onClick={fillDemo}>
            Fill demo credentials
          </button>
        </div>
      ) : null}
    </>
  )
}

function Field({ id, label, hint, error, optional, children }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {optional ? <span className="muted"> (optional)</span> : null}
      </label>
      {children}
      {error ? (
        <span id={`${id}-error`} className="field__error">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="field__hint">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ signed in */

function AccountSummary({ user, signOut }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  async function onSignOut() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await signOut()
    } catch (err) {
      if (!alive.current) return
      setError(err)
      setBusy(false)
    }
  }

  const role = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—'

  return (
    <div className="signin__panel">
      <div className="signin__who">
        <span className="avatar signin__avatar" aria-hidden="true">
          {initials(user.name)}
        </span>
        <div className="signin__who-text">
          <h2 className="h3">{user.name}</h2>
          <span className="small muted wrap-anywhere">{user.email}</span>
        </div>
      </div>

      <dl className="dl signin__dl">
        <dt>Affiliation</dt>
        <dd>{user.affiliation || '—'}</dd>
        <dt>Role</dt>
        <dd>{role}</dd>
        <dt>Member since</dt>
        <dd>{fmtDate(user.createdAt)}</dd>
      </dl>

      {error ? (
        <div className="notice notice--accent signin__server" role="alert">
          {error.message || 'Could not sign out. Try again.'}
        </div>
      ) : null}

      <div className="signin__actions">
        <Link to="/history" className="btn btn--primary">
          Query history <Icon.ArrowRight size={16} />
        </Link>
        <button type="button" className="btn btn--ghost" onClick={onSignOut} disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          Sign out
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ loading */

function PanelSkeleton({ isSignup }) {
  const n = isSignup ? 5 : 2
  return (
    <div className="signin__panel" aria-busy="true" aria-label="Loading account">
      <span className="skeleton signin__sk-title">Sign in</span>
      <div className="signin__fields">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="field">
            <span className="skeleton signin__sk-label">Label</span>
            <span className="skeleton signin__sk-input" />
          </div>
        ))}
      </div>
      <span className="skeleton signin__sk-btn" />
    </div>
  )
}
