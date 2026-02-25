import * as dns from 'dns';
import * as net from 'net';
import { promisify } from 'util';
import { Agent } from 'undici';

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);

export class IPGuard {
    /**
     * Checks if an IP address is internal/private
     */
    static isInternal(ip: string): boolean {
        if (net.isIPv4(ip)) {
            const parts = ip.split('.').map(Number);

            // 127.0.0.0/8
            if (parts[0] === 127) return true;

            // 10.0.0.0/8
            if (parts[0] === 10) return true;

            // 192.168.0.0/16
            if (parts[0] === 192 && parts[1] === 168) return true;

            // 172.16.0.0 – 172.31.255.255
            if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

            // 169.254.0.0/16
            if (parts[0] === 169 && parts[1] === 254) return true;

            // 0.0.0.0/8
            if (parts[0] === 0) return true;

            return false;
        }

        if (net.isIPv6(ip)) {
            // Normalize IPv6
            const expanded = IPGuard.expandIPv6(ip);

            // ::1
            if (expanded === '0000:0000:0000:0000:0000:0000:0000:0001') return true;

            // fc00::/7 (Unique Local Address) -> fc or fd
            const firstWord = parseInt(expanded.split(':')[0], 16);
            if ((firstWord & 0xfe00) === 0xfc00) return true;

            // fe80::/10 (Link Local)
            if ((firstWord & 0xffc0) === 0xfe80) return true;

            // IPv4-mapped IPv6: ::ffff:0:0/96
            if (expanded.startsWith('0000:0000:0000:0000:0000:ffff:')) {
                const parts = expanded.split(':');
                const p7 = parseInt(parts[6], 16);
                const p8 = parseInt(parts[7], 16);
                const ip4 = `${(p7 >> 8) & 255}.${p7 & 255}.${(p8 >> 8) & 255}.${p8 & 255}`;
                return IPGuard.isInternal(ip4);
            }

            return false;
        }

        return true; // Unknown format, block it for safety
    }

    /**
     * Resolves a hostname and validates all result IPs
     */
    static async validateHost(host: string): Promise<boolean> {
        if (net.isIP(host)) {
            return !IPGuard.isInternal(host);
        }

        try {
            const res4 = await resolve4(host).catch(() => [] as string[]);
            const res6 = await resolve6(host).catch(() => [] as string[]);
            const ips = [...res4, ...res6];

            if (ips.length === 0) return true; // Let the fetcher handle DNS failures

            return ips.every(ip => !IPGuard.isInternal(ip));
        } catch (_e) {
            // If resolution fails drastically, we block for safety or let fetcher try
            return false;
        }
    }

    /**
     * Custom lookup function for undici that validates the resolved IP.
     * Prevents DNS Rebinding attacks by checking the IP immediately before connection.
     */
    static secureLookup(
        hostname: string,
        options: dns.LookupOneOptions | dns.LookupAllOptions,
        callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family: number) => void
    ): void {
        dns.lookup(hostname, options as any, (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family: number) => {
            if (err) {
                return callback(err, address as any, family);
            }

            const checkIP = (ip: string) => {
                if (IPGuard.isInternal(ip)) {
                    return new Error(`Blocked internal IP: ${ip}`);
                }
                return null;
            };

            if (typeof address === 'string') {
                const error = checkIP(address);
                if (error) {
                    // Return a custom error that undici will propagate
                    const blockedError = new Error(`Blocked internal IP: ${address}`);
                    (blockedError as any).code = 'EBLOCKED';
                    return callback(blockedError, address, family);
                }
            } else if (Array.isArray(address)) {
                // Handle array of addresses (if options.all is true)
                for (const addr of address) {
                    const error = checkIP(addr.address);
                    if (error) {
                        const blockedError = new Error(`Blocked internal IP: ${addr.address}`);
                        (blockedError as any).code = 'EBLOCKED';
                        return callback(blockedError, address, family);
                    }
                }
            }

            callback(null, address, family);
        });
    }

    /**
     * Returns an undici Agent configured with secure DNS lookup.
     */
    static getSecureDispatcher(): Agent {
        return new Agent({
            connect: {
                lookup: IPGuard.secureLookup as any
            }
        });
    }

    private static expandIPv6(ip: string): string {
        if (ip === '::') return '0000:0000:0000:0000:0000:0000:0000:0000';

        let normalizedIp = ip;
        if (ip.includes('.')) {
            const lastColonIndex = ip.lastIndexOf(':');
            const lastPart = ip.substring(lastColonIndex + 1);
            if (net.isIPv4(lastPart)) {
                const parts = lastPart.split('.').map(Number);
                const hex1 = ((parts[0] << 8) | parts[1]).toString(16);
                const hex2 = ((parts[2] << 8) | parts[3]).toString(16);
                normalizedIp = ip.substring(0, lastColonIndex + 1) + hex1 + ':' + hex2;
            }
        }

        let full = normalizedIp;
        if (normalizedIp.includes('::')) {
            const parts = normalizedIp.split('::');
            const left = parts[0].split(':').filter(x => x !== '');
            const right = parts[1].split(':').filter(x => x !== '');
            const missing = 8 - (left.length + right.length);
            const middle = Array(missing).fill('0000');
            full = [...left, ...middle, ...right].join(':');
        }
        return full.split(':').map(part => part.padStart(4, '0')).join(':');
    }
}
