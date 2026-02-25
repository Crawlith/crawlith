import { describe, it, expect } from 'vitest';
import { DomainFilter } from '../src/core/scope/domainFilter.js';
import { SubdomainPolicy } from '../src/core/scope/subdomainPolicy.js';
import { ScopeManager } from '../src/core/scope/scopeManager.js';

describe('DomainFilter', () => {
    it('should normalize hostnames', () => {
        const filter = new DomainFilter(['EXAMPLE.COM.'], ['DENY.COM.']);
        expect(filter.isAllowed('example.com')).toBe(true);
        expect(filter.isAllowed('deny.com')).toBe(false);
    });

    it('should respect precedence (deny wins)', () => {
        const filter = new DomainFilter(['example.com'], ['example.com']);
        expect(filter.isAllowed('example.com')).toBe(false);
    });

    it('should handle punycode', () => {
        // xn--80ak6aa92e.com is punycode for пример.com
        const filter = new DomainFilter(['xn--80ak6aa92e.com']);
        expect(filter.isAllowed('XN--80AK6AA92E.COM')).toBe(true);
    });

    it('should block if not in allow list (when list not empty)', () => {
        const filter = new DomainFilter(['allowed.com']);
        expect(filter.isAllowed('other.com')).toBe(false);
    });
});

describe('SubdomainPolicy', () => {
    it('should enforce exact match by default', () => {
        const policy = new SubdomainPolicy('https://example.com');
        expect(policy.isAllowed('example.com')).toBe(true);
        expect(policy.isAllowed('sub.example.com')).toBe(false);
    });

    it('should allow valid subdomains when enabled', () => {
        const policy = new SubdomainPolicy('https://example.com', true);
        expect(policy.isAllowed('example.com')).toBe(true);
        expect(policy.isAllowed('sub.example.com')).toBe(true);
        expect(policy.isAllowed('deep.sub.example.com')).toBe(true);
    });

    it('should reject malicious suffix matches', () => {
        const policy = new SubdomainPolicy('https://example.com', true);
        expect(policy.isAllowed('evil-example.com')).toBe(false);
        expect(policy.isAllowed('example.com.evil.com')).toBe(false);
    });
});

describe('ScopeManager', () => {
    it('should compose policies correctly', () => {
        const manager = new ScopeManager({
            rootUrl: 'https://example.com',
            allowedDomains: ['example.com', 'sub.example.com', 'other.com'],
            deniedDomains: ['bad.example.com'],
            includeSubdomains: true
        });

        expect(manager.isUrlEligible('https://example.com/')).toBe('allowed');
        expect(manager.isUrlEligible('https://sub.example.com/')).toBe('allowed');
        expect(manager.isUrlEligible('https://bad.example.com/')).toBe('blocked_by_domain_filter');
        expect(manager.isUrlEligible('https://other.com/')).toBe('allowed');
        expect(manager.isUrlEligible('https://google.com/')).toBe('blocked_by_domain_filter');
    });
});
