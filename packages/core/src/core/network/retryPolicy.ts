export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
}

export class RetryPolicy {
    static DEFAULT_CONFIG: RetryConfig = {
        maxRetries: 3,
        baseDelay: 500
    };

    static async execute<T>(
        operation: (attempt: number) => Promise<T>,
        isRetryable: (error: any) => boolean,
        config: RetryConfig = RetryPolicy.DEFAULT_CONFIG
    ): Promise<T> {
        let lastError: any;

        for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            try {
                return await operation(attempt);
            } catch (error) {
                lastError = error;

                if (attempt === config.maxRetries || !isRetryable(error)) {
                    throw error;
                }

                const delay = config.baseDelay * Math.pow(2, attempt);
                const jitter = delay * 0.1 * (Math.random() * 2 - 1);
                const finalDelay = Math.max(0, delay + jitter);

                await new Promise(resolve => setTimeout(resolve, finalDelay));
            }
        }

        throw lastError;
    }

    static isRetryableStatus(status: number): boolean {
        return status === 429 || (status >= 500 && status <= 599);
    }

    static isNetworkError(error: any): boolean {
        const code = error?.code || error?.cause?.code;
        return [
            'ETIMEDOUT',
            'ECONNRESET',
            'EADDRINUSE',
            'ECONNREFUSED',
            'EPIPE',
            'ENOTFOUND',
            'ENETUNREACH',
            'EAI_AGAIN'
        ].includes(code);
    }
}
