import { load } from 'cheerio';
import { normalizeUrl } from '../crawler/normalize.js';

export interface LinkRatioAnalysis {
  internalLinks: number;
  externalLinks: number;
  nofollowCount: number;
  externalRatio: number;
}

export function analyzeLinks(html: string, pageUrl: string, rootUrl: string): LinkRatioAnalysis {
  const $ = load(html);
  const rootOrigin = new URL(rootUrl).origin;

  let internalLinks = 0;
  let externalLinks = 0;
  let nofollowCount = 0;

  $('a[href]').each((_idx, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const normalized = normalizeUrl(href, pageUrl, { stripQuery: false });
    if (!normalized) return;

    const rel = ($(el).attr('rel') || '').toLowerCase();
    if (rel.includes('nofollow')) {
      nofollowCount += 1;
    }

    if (new URL(normalized).origin === rootOrigin) {
      internalLinks += 1;
    } else {
      externalLinks += 1;
    }
  });

  const total = internalLinks + externalLinks;
  const externalRatio = total === 0 ? 0 : externalLinks / total;

  return { internalLinks, externalLinks, nofollowCount, externalRatio };
}
