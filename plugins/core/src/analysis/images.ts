import { load } from 'cheerio';

export interface ImageAltAnalysis {
  totalImages: number;
  missingAlt: number;
  emptyAlt: number;
}

export function analyzeImageAlts(html: string): ImageAltAnalysis {
  const $ = load(html);
  let missingAlt = 0;
  let emptyAlt = 0;

  $('img').each((_idx, el) => {
    const alt = $(el).attr('alt');
    if (alt === undefined) {
      missingAlt += 1;
      return;
    }

    if (!alt.trim()) {
      emptyAlt += 1;
    }
  });

  const totalImages = $('img').length;
  return { totalImages, missingAlt, emptyAlt };
}
