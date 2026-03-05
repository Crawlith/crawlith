export function withSiteId(pathname: string, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();

  if (typeof window !== 'undefined') {
    const current = new URLSearchParams(window.location.search);
    const siteId = current.get('siteId');
    if (siteId) params.set('siteId', siteId);
  }

  for (const [key, value] of Object.entries(extra)) {
    params.set(key, value);
  }

  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}`;
}
