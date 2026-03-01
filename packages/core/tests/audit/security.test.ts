import { describe, it, expect } from 'vitest';
import { auditUrl } from '../../src/audit/index.js';

describe('Audit Security', () => {
    it('should block audits of internal IP addresses', async () => {
        await expect(auditUrl('http://127.0.0.1')).rejects.toThrow('Access to internal or private infrastructure is prohibited');
    });

    it('should block audits of link-local addresses', async () => {
        await expect(auditUrl('http://169.254.169.254')).rejects.toThrow('Access to internal or private infrastructure is prohibited');
    });
});
