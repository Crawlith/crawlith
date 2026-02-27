import { CheerioAPI, load } from 'cheerio';

export interface ImageAltAnalysis {
  totalImages: number;
  missingAlt: number;
  emptyAlt: number;
}

export function analyzeImageAlts($: CheerioAPI | string): ImageAltAnalysis {
  const isString = typeof $ === 'string';
  const cheerioObj = isString ? load($ || '<html></html>') : $;

  let missingAlt = 0;
  let emptyAlt = 0;

  cheerioObj('img').each((_idx, el) => {
    const alt = cheerioObj(el).attr('alt');
    if (alt === undefined) {
      missingAlt += 1;
      return;
    }

    if (!alt.trim()) {
      emptyAlt += 1;
    }
  });

  const totalImages = cheerioObj('img').length;
  return { totalImages, missingAlt, emptyAlt };
}
