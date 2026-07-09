import { useEffect } from 'react'

const BASE = 'SportStream'
const DEFAULT_TITLE = 'SportStream – Live scores, stats & streaming for every team'

/**
 * Sets document.title for the lifetime of a route.
 *
 * Pass the page-specific part only ("Dashboard", "Hawks vs Wolves") and it is
 * suffixed with the brand. Pass a falsy value (e.g. while data is still
 * loading) to leave the title untouched until it resolves. On unmount the
 * title is restored to the app default so a stale page title never lingers.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    if (!title) return
    document.title = title === BASE ? DEFAULT_TITLE : `${title} · ${BASE}`
    return () => { document.title = DEFAULT_TITLE }
  }, [title])
}
