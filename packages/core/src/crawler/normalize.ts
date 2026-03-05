/**
 * Normalizes a URL string based on specific rules.
 */
export interface NormalizeOptions {
  stripQuery?: boolean;
  toPath?: boolean;
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
  '.zip', '.xml', '.json', '.mp4', '.avif', '.ics'
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
    const finalUrl = u.toString();

    // 9. Skip non-HTML assets by extension
    const lastDotIndex = u.pathname.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      const ext = u.pathname.slice(lastDotIndex).toLowerCase();
      if (SKIP_EXTENSIONS.has(ext)) {
        return null;
      }
    }

    // 10. Return path if requested
    if (options.toPath) {
      return u.pathname + u.search;
    }

    // 11. Return final string
    return finalUrl;

  } catch (_e) {
    return null;
  }
}

/**
 * Utility for converting between absolute URLs and relative paths
 * primarily used for database storage.
 */
export class UrlUtil {
  /**
   * Extract a stable domain key from a URL/domain input.
   * Examples:
   *  - "https://www.example.com/a" -> "example.com"
   *  - "example.com" -> "example.com"
   */
  static extractDomain(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return '';

    try {
      const direct = new URL(trimmed);
      return direct.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      // fall through
    }

    try {
      const withProtocol = new URL(`https://${trimmed}`);
      return withProtocol.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return trimmed.toLowerCase().replace(/^www\./, '');
    }
  }

  /**
   * Resolve a site's absolute origin from persisted site fields.
   */
  static resolveSiteOrigin(site: { domain: string; preferred_url?: string | null; ssl?: number | null }): string {
    if (site.preferred_url) {
      try {
        return new URL(site.preferred_url).origin;
      } catch {
        // fall through to domain+ssl fallback
      }
    }
    const protocol = site.ssl === 0 ? 'http' : 'https';
    return `${protocol}://${site.domain}`;
  }

  /**
   * Converts a full URL to a root-relative path if it matches the origin.
   * If it doesn't match the origin, it's considered external and kept absolute.
   */
  static toPath(urlStr: string, origin: string): string {
    try {
      const url = new URL(urlStr);
      const originUrl = new URL(origin);

      if (url.origin === originUrl.origin) {
        return url.pathname + url.search;
      }
      return urlStr;
    } catch {
      return urlStr;
    }
  }

  /**
   * Converts a root-relative path back to an absolute URL relative to the origin.
   * If the input is already an absolute URL, it is returned as-is.
   */
  static toAbsolute(pathOrUrl: string, origin: string): string {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }
    try {
      return new URL(pathOrUrl, origin).toString();
    } catch {
      return pathOrUrl;
    }
  }

  /**
   * Determines if a URL (or path) is internal relative to the origin.
   */
  static isInternal(pathOrUrl: string, origin: string): boolean {
    if (!pathOrUrl.startsWith('http')) return true;
    try {
      const url = new URL(pathOrUrl);
      const originUrl = new URL(origin);
      return url.origin === originUrl.origin;
    } catch {
      return false;
    }
  }

  /**
   * Build normalized lookup candidates for querying pages table.
   * Returns path/absolute/original variants in priority order, deduplicated.
   */
  static toLookupCandidates(input: string, origin: string): string[] {
    const candidates = new Set<string>();
    const raw = input.trim();
    if (!raw) return [];

    const absolute = normalizeUrl(raw, origin, { stripQuery: false }) || UrlUtil.toAbsolute(raw, origin);
    const path = normalizeUrl(raw, origin, { stripQuery: false, toPath: true }) || UrlUtil.toPath(raw, origin);
    const absolutePath = normalizeUrl(absolute, '', { stripQuery: false, toPath: true }) || UrlUtil.toPath(absolute, origin);

    candidates.add(path);
    candidates.add(absolute);
    candidates.add(absolutePath);
    candidates.add(raw);

    return Array.from(candidates).filter(Boolean);
  }
}
