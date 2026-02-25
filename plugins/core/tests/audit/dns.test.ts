import { describe, it, expect, vi } from 'vitest';
import { resolveDns } from '../../src/audit/dns.js';
import dns from 'node:dns/promises';

vi.mock('node:dns/promises');

describe('DNS Diagnostics', () => {
  it('should resolve all records', async () => {
    vi.spyOn(dns, 'resolve4').mockResolvedValue(['1.1.1.1']);
    vi.spyOn(dns, 'resolve6').mockResolvedValue(['2606::1']);
    vi.spyOn(dns, 'resolveCname').mockRejectedValue(new Error('ENODATA'));
    vi.spyOn(dns, 'reverse').mockResolvedValue(['one.one.one.one']);

    const result = await resolveDns('example.com');
    expect(result.a).toEqual(['1.1.1.1']);
    expect(result.aaaa).toEqual(['2606::1']);
    expect(result.ipv6Support).toBe(true);
    expect(result.reverse).toEqual(['one.one.one.one']);
    expect(result.resolutionTime).toBeGreaterThanOrEqual(0);
  });

  it('should handle failures gracefully', async () => {
    vi.spyOn(dns, 'resolve4').mockRejectedValue(new Error('ENOTFOUND'));
    vi.spyOn(dns, 'resolve6').mockRejectedValue(new Error('ENOTFOUND'));
    vi.spyOn(dns, 'resolveCname').mockRejectedValue(new Error('ENOTFOUND'));

    const result = await resolveDns('invalid.com');
    expect(result.a).toEqual([]);
    expect(result.ipCount).toBe(0);
  });
});
