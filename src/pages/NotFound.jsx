import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container page-head">
      <div className="eyebrow">404</div>
      <h1 className="h1">There is nothing at this address.</h1>
      <p className="lede">Check the link, or start again from the search box.</p>
      <p style={{ marginTop: 'var(--s-5)' }}>
        <Link to="/" className="btn btn--primary">Back to search</Link>
      </p>
    </div>
  )
}
