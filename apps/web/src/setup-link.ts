/** A private first-use proof stays in memory; the fragment never reaches HTTP logs. */
export function consumeSetupLink(
  location: Pick<Location, 'hash' | 'pathname' | 'search'>,
  history: Pick<History, 'replaceState'>,
) {
  if (!location.hash.startsWith('#setup=')) return '';
  const value = location.hash.slice(7);
  history.replaceState(null, '', location.pathname + location.search);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
}
