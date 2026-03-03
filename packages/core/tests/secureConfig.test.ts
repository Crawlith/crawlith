import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import {
    setEncryptedConfigKey,
    getDecryptedConfigKey,
    getCrawlithConfigPath,
    getConfigSection
} from '../src/utils/secureConfig.js';

vi.mock('node:os', () => ({
    default: {
        homedir: vi.fn(() => '/home/testuser'),
        hostname: vi.fn(() => 'test-host'),
        userInfo: vi.fn(() => ({ username: 'testuser' })),
    },
    homedir: vi.fn(() => '/home/testuser'),
    hostname: vi.fn(() => 'test-host'),
    userInfo: vi.fn(() => ({ username: 'testuser' })),
}));

vi.mock('node:fs', () => ({
    default: {
        existsSync: vi.fn(),
        writeFileSync: vi.fn(),
        readFileSync: vi.fn(),
        mkdirSync: vi.fn(),
        chmodSync: vi.fn(),
    },
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    chmodSync: vi.fn(),
}));

describe('secureConfig utility', () => {
    const mockHome = '/home/testuser';
    const mockConfigPath = `${mockHome}/.crawlith/config.json`;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return the correct config path', () => {
        expect(getCrawlithConfigPath()).toBe(mockConfigPath);
    });

    it('should encrypt and decrypt a key correctly', () => {
        let storedConfig = '{}';
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.writeFileSync).mockImplementation((path, data) => {
            storedConfig = data as string;
        });
        vi.mocked(fs.readFileSync).mockImplementation(() => {
            return storedConfig;
        });

        const testKey = 'test-api-key-123';
        setEncryptedConfigKey('test-plugin', testKey);

        expect(fs.writeFileSync).toHaveBeenCalled();

        // Now decrypt it
        const decrypted = getDecryptedConfigKey('test-plugin');
        expect(decrypted).toBe(testKey);
    });

    it('should throw error when decryption fails (wrong machine)', () => {
        let storedConfig = '{}';
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.writeFileSync).mockImplementation((path, data) => {
            storedConfig = data as string;
        });
        vi.mocked(fs.readFileSync).mockImplementation(() => storedConfig);

        setEncryptedConfigKey('test-plugin', 'secret');

        // Change machine context
        vi.mocked(os.hostname).mockReturnValue('different-host');

        expect(() => getDecryptedConfigKey('test-plugin')).toThrow('Unable to decrypt config key');
    });

    it('should handle missing config file gracefully', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);
        expect(() => getDecryptedConfigKey('non-existent')).toThrow(/Missing non-existent config/);
        expect(getConfigSection('some-section')).toBeUndefined();
    });

    it('should throw error for corrupt JSON in config file', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue('invalid-json');
        expect(() => getConfigSection('any')).toThrow('Corrupt config file');
    });

    it('should correctly retrieve a config section', () => {
        const mockData = {
            'plugin-a': { key: 'enc-key', someSetting: true }
        };
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockData));

        const section = getConfigSection('plugin-a');
        expect(section).toEqual(mockData['plugin-a']);
    });
});
