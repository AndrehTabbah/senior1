import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Scrolls the window to the top on every route change (React Router keeps scroll otherwise).
export default function ScrollToTop() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, search])
  return null
}
