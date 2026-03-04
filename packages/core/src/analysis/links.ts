import { load } from 'cheerio';
import { normalizeUrl, UrlUtil } from '../crawler/normalize.js';

export interface LinkRatioAnalysis {
  internalLinks: number;
  externalLinks: number;
  nofollowCount: number;
  externalRatio: number;
}

export function analyzeLinks($: any, pageUrl: string, rootUrl: string): LinkRatioAnalysis {
  const isString = typeof $ === 'string';
  const cheerioObj = isString ? load($ || '<html></html>') : $;

  let internalLinks = 0;
  let externalLinks = 0;
  let nofollowCount = 0;

  cheerioObj('a[href]').each((_idx: number, el: any) => {
    const href = cheerioObj(el).attr('href');
    if (!href) return;
    const normalized = normalizeUrl(href, pageUrl, { stripQuery: false });
    if (!normalized) return;

    const rel = (cheerioObj(el).attr('rel') || '').toLowerCase();
    if (rel.includes('nofollow')) {
      nofollowCount += 1;
    }

    if (UrlUtil.isInternal(normalized, rootUrl)) {
      internalLinks += 1;
    } else {
      externalLinks += 1;
    }
  });

  const total = internalLinks + externalLinks;
  const externalRatio = total === 0 ? 0 : externalLinks / total;

  return { internalLinks, externalLinks, nofollowCount, externalRatio };
}
