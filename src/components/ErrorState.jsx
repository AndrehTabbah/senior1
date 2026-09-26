import { Link } from 'react-router-dom'

/** Inline error / empty state used by pages. */
export default function ErrorState({ title = 'Something went wrong', text, error, onRetry, backTo = '/', backLabel = 'Back to search' }) {
  const message = text || error?.message
  return (
    <div className="state" role="alert">
      <h2 className="state__title">{title}</h2>
      {message ? <p className="state__text">{message}</p> : null}
      <div className="state__actions">
        {onRetry ? (
          <button type="button" className="btn btn--primary btn--sm" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        {backTo ? (
          <Link to={backTo} className="btn btn--ghost btn--sm">
            {backLabel}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
