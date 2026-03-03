import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const CONFIG_DIR = path.join(os.homedir(), '.crawlith');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

interface EncryptedValue {
  salt: string;
  iv: string;
  tag: string;
  data: string;
}

export interface CrawlithConfig {
  [section: string]: {
    key?: string;
    createdAt?: number;
    [key: string]: unknown;
  };
}

/**
 * Resolve the canonical Crawlith config file path.
 */
export function getCrawlithConfigPath(): string {
  return CONFIG_PATH;
}

/**
 * Return section config, or undefined if config file/section does not exist.
 */
export function getConfigSection(section: string): CrawlithConfig[string] | undefined {
  const config = readConfigFile(false);
  if (!config) return undefined;
  return config[section];
}

/**
 * Encrypt and persist a section API key in ~/.crawlith/config.json.
 */
export function setEncryptedConfigKey(section: string, apiKey: string): void {
  const config = readConfigFile(false) || {};
  config[section] = {
    ...(config[section] || {}),
    key: encryptString(apiKey),
    createdAt: Math.floor(Date.now() / 1000)
  };
  writeConfigFile(config);
}

/**
 * Get and decrypt the API key for a config section.
 */
export function getDecryptedConfigKey(section: string): string {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Missing ${section} config. Run: crawlith config ${section} set <api_key>`);
  }

  const config = readConfigFile(true);
  if (!config) {
    throw new Error(`Missing ${section} config. Run: crawlith config ${section} set <api_key>`);
  }
  const payload = config[section]?.key;

  if (!payload || typeof payload !== 'string') {
    throw new Error(`Missing ${section} key in config. Run: crawlith config ${section} set <api_key>`);
  }

  return decryptString(payload);
}

/**
 * Read config file from disk.
 */
function readConfigFile(required: boolean): CrawlithConfig | null {
  if (!fs.existsSync(CONFIG_PATH)) {
    if (required) {
      throw new Error('Missing config file. Run: crawlith config <service> set <api_key>');
    }
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as CrawlithConfig;
  } catch {
    throw new Error('Corrupt config file at ~/.crawlith/config.json. Refusing to continue.');
  }
}

/**
 * Persist config to disk with secure permissions.
 */
function writeConfigFile(config: CrawlithConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(CONFIG_PATH, 0o600);
}

/**
 * Build a machine-bound secret so encrypted config blobs are not portable across systems.
 */
function getMachineSecret(): string {
  return `${os.hostname()}::${os.userInfo().username}`;
}

/**
 * Encrypt plaintext using AES-256-GCM and scrypt-derived key.
 */
function encryptString(plaintext: string): string {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(getMachineSecret(), salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const payload: EncryptedValue = {
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64')
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

/**
 * Decrypt an encrypted base64 payload from config.json.
 */
function decryptString(encodedPayload: string): string {
  let payload: EncryptedValue;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8')) as EncryptedValue;
  } catch {
    throw new Error('Corrupt config payload: unable to parse encrypted key data.');
  }

  if (!payload?.salt || !payload?.iv || !payload?.tag || !payload?.data) {
    throw new Error('Corrupt config payload: required encryption fields are missing.');
  }

  try {
    const salt = Buffer.from(payload.salt, 'base64');
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const data = Buffer.from(payload.data, 'base64');
    const key = crypto.scryptSync(getMachineSecret(), salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Unable to decrypt config key. Config may be invalid or tied to another machine/user.');
  }
}
