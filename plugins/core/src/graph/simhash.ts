export class SimHash {
    private static FNV_PRIME = 1099511628211n;
    private static FNV_OFFSET_BASIS = 14695981039346656037n;
    private static MAX_UINT64 = 0xffffffffffffffffn;

    /**
     * Generates a 64-bit FNV-1a hash for a given string token.
     */
    static fnv1a64(token: string): bigint {
        let hash = this.FNV_OFFSET_BASIS;
        const len = token.length;
        for (let i = 0; i < len; i++) {
            hash ^= BigInt(token.charCodeAt(i));
            // BigInt safe multiplication modulo 2^64
            hash = (hash * this.FNV_PRIME) & this.MAX_UINT64;
        }
        return hash;
    }

    /**
     * Generates a 64-bit SimHash from an array of tokens.
     */
    static generate(tokens: string[]): bigint {
        const v = new Int32Array(64);

        for (const token of tokens) {
            const hash = this.fnv1a64(token);
            for (let i = 0n; i < 64n; i++) {
                const bit = (hash >> i) & 1n;
                if (bit === 1n) {
                    v[Number(i)]++;
                } else {
                    v[Number(i)]--;
                }
            }
        }

        let simhash = 0n;
        for (let i = 0n; i < 64n; i++) {
            if (v[Number(i)] > 0) {
                simhash |= (1n << i);
            }
        }

        return simhash;
    }

    /**
     * Computes the Hamming distance between two 64-bit hashes.
     */
    static hammingDistance(a: bigint, b: bigint): number {
        let xor = a ^ b;
        let distance = 0;
        while (xor > 0n) {
            // Kernighan's bit counting
            xor &= xor - 1n;
            distance++;
        }
        return distance;
    }
}
