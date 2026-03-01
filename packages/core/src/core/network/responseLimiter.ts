import { Readable } from 'stream';

export class ResponseLimiter {
    static async streamToString(
        stream: Readable,
        maxBytes: number,
        onOversized?: (bytes: number) => void
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            let accumulated = 0;
            const chunks: Buffer[] = [];

            stream.on('data', (chunk: any) => {
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                accumulated += buffer.length;
                if (accumulated > maxBytes) {
                    stream.destroy();
                    if (onOversized) onOversized(accumulated);
                    reject(new Error('Oversized response'));
                    return;
                }
                chunks.push(buffer);
            });

            stream.on('end', () => {
                resolve(Buffer.concat(chunks).toString('utf-8'));
            });

            stream.on('error', (err) => {
                reject(err);
            });
        });
    }
}
