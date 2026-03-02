import { load } from 'cheerio';

export interface StructuredDataResult {
  present: boolean;
  types: string[];
  valid: boolean;
}

export function analyzeStructuredData($: any): StructuredDataResult {
  const isString = typeof $ === 'string';
  const cheerioObj = isString ? load($ || '<html></html>') : $;

  const scripts = cheerioObj('script[type="application/ld+json"]').toArray();
  if (scripts.length === 0) {
    return { present: false, types: [], valid: false };
  }

  const types = new Set<string>();
  let valid = true;

  for (const script of scripts) {
    const raw = cheerioObj(script).text().trim();
    if (!raw) {
      valid = false;
      continue;
    }

    try {
      const parsed = JSON.parse(raw);
      extractTypes(parsed, types);
    } catch {
      valid = false;
    }
  }

  return {
    present: true,
    valid,
    types: Array.from(types)
  };
}

function extractTypes(input: unknown, types: Set<string>): void {
  if (Array.isArray(input)) {
    input.forEach((item: any) => extractTypes(item, types));
    return;
  }

  if (!input || typeof input !== 'object') return;

  const maybeType = (input as Record<string, unknown>)['@type'];
  if (typeof maybeType === 'string') {
    types.add(maybeType);
  } else if (Array.isArray(maybeType)) {
    for (const item of maybeType) {
      if (typeof item === 'string') types.add(item);
    }
  }

  const graph = (input as Record<string, unknown>)['@graph'];
  if (Array.isArray(graph)) {
    graph.forEach((item: any) => extractTypes(item, types));
  }
}
