/**
 * Normalizes a URL string based on specific rules.
 */
export interface NormalizeOptions {
  stripQuery?: boolean;
}

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'msclkid'
]);

const SKIP_EXTENSIONS = new Set([
  '.pdf', '.jpg', '.png', '.svg', '.webp', '.gif',
  '.zip', '.xml', '.json', '.mp4'
]);

export function normalizeUrl(input: string, base: string, options: NormalizeOptions = {}): string | null {
  try {
    // 1. Resolve absolute URL
    let u: URL;
    if (base) {
      u = new URL(input, base);
    } else {
      u = new URL(input);
    }

    // 2. Allow only http/https
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return null;
    }

    // 3. Lowercase hostname
    u.hostname = u.hostname.toLowerCase();

    // 4. Remove default ports
    if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
      u.port = '';
    }

    // 5. Remove hash fragments
    u.hash = '';

    // 6. Query params handling
    const params = new URLSearchParams(u.search);
    const newParams = new URLSearchParams();

    // Check if we should strip all query params
    if (options.stripQuery) {
      u.search = '';
    } else {
      // Filter tracking params
      let hasParams = false;
      for (const [key, value] of params) {
        // Remove utm_* and other tracking params
        if (key.startsWith('utm_') || TRACKING_PARAMS.has(key)) {
          continue;
        }
        newParams.append(key, value);
        hasParams = true;
      }

      // Sort for consistency
      newParams.sort();

      if (hasParams || newParams.toString()) {
        u.search = newParams.toString();
      } else {
        u.search = '';
      }
    }

    // 7. Normalize trailing slash
    // 8. Collapse duplicate slashes in pathname
    let pathname = u.pathname;

    // Collapse duplicate slashes
    pathname = pathname.replace(/\/+/g, '/');

    // Remove trailing slash unless root
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    u.pathname = pathname;

    // 9. Skip non-HTML assets by extension
    const lastDotIndex = u.pathname.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      const ext = u.pathname.slice(lastDotIndex).toLowerCase();
      if (SKIP_EXTENSIONS.has(ext)) {
        return null;
      }
    }

    // 10. Return final string
    return u.toString();

  } catch (_e) {
    return null;
  }
}
