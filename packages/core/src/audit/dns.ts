import dns from 'node:dns/promises';
import { DnsDiagnostics } from './types.js';

export async function resolveDns(hostname: string): Promise<DnsDiagnostics> {
  const start = performance.now();

  const result: DnsDiagnostics = {
    a: [],
    aaaa: [],
    cname: [],
    reverse: [],
    ipCount: 0,
    ipv6Support: false,
    resolutionTime: 0
  };

  try {
    // We run these in parallel
    const [a, aaaa, cname] = await Promise.all([
      dns.resolve4(hostname).catch(() => [] as string[]),
      dns.resolve6(hostname).catch(() => [] as string[]),
      dns.resolveCname(hostname).catch(() => [] as string[])
    ]);

    result.a = a;
    result.aaaa = aaaa;
    result.cname = cname;
    result.ipCount = a.length + aaaa.length;
    result.ipv6Support = aaaa.length > 0;

    // Try reverse lookup on first IP if available
    const ipToReverse = a.length > 0 ? a[0] : (aaaa.length > 0 ? aaaa[0] : null);

    if (ipToReverse) {
      try {
        result.reverse = await dns.reverse(ipToReverse);
      } catch {
        // Reverse lookup failed, ignore
      }
    }

  } catch (_error) {
    // DNS resolution failed entirely or other error
    // We return empty result but with time measured
  }

  result.resolutionTime = performance.now() - start;
  return result;
}
