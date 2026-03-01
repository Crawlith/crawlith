import type { CLIWriter, ReportWriter, BaseReport } from './types.js';

type LogLevel = 'debug' | 'verbose' | 'info' | 'warn' | 'error';

const LEVEL_MAP: Record<LogLevel, number> = {
    debug: 0,
    verbose: 1,
    info: 2,
    warn: 3,
    error: 4
};

export class ConsoleCLIWriter implements CLIWriter {
    private levelValue: number;

    constructor(private readonly level: string = 'info') {
        this.levelValue = LEVEL_MAP[level as LogLevel] ?? LEVEL_MAP['info'];
    }

    private shouldLog(msgLevel: LogLevel): boolean {
        return LEVEL_MAP[msgLevel] >= this.levelValue;
    }

    info(message: string): void {
        if (this.shouldLog('info')) console.log(message);
    }

    warn(message: string): void {
        if (this.shouldLog('warn')) console.warn(message);
    }

    error(message: string): void {
        if (this.shouldLog('error')) console.error(message);
    }

    verbose(message: string): void {
        if (this.shouldLog('verbose')) console.log(message);
    }

    debug(message: string): void {
        if (this.shouldLog('debug')) console.debug(message);
    }

    section(title: string, data: unknown): void {
        if (this.shouldLog('info')) {
            console.log(`\n=== ${title} ===`);
            console.dir(data, { depth: null, colors: true });
        }
    }

    table(data: unknown[]): void {
        if (this.shouldLog('info')) {
            console.table(data);
        }
    }
}

export interface ScoreContribution {
    label: string;
    score: number;
    weight: number;
}

export class CoreReportBuilder implements ReportWriter {
    private scores: ScoreContribution[] = [];

    constructor(private readonly report: BaseReport) {
        if (!report.plugins) {
            report.plugins = {};
        }
    }

    addSection(pluginName: string, data: unknown): void {
        if (pluginName in this.report.plugins) {
            throw new Error(`Duplicate plugin section: "${pluginName}" already exists in the report.`);
        }
        this.report.plugins[pluginName] = data;
    }

    contributeScore(input: ScoreContribution): void {
        if (input.score < 0 || input.score > 100) {
            console.debug(`[ReportWriter] Invalid score contribution from ${input.label}: score must be exactly between 0 and 100.`);
            return;
        }
        if (input.weight <= 0) {
            console.debug(`[ReportWriter] Invalid score contribution from ${input.label}: weight must be > 0.`);
            return;
        }
        this.scores.push(input);
    }

    finalizeScore(): void {
        if (this.scores.length === 0) return;

        let totalWeight = 0;
        let weightedScoreSum = 0;

        for (const s of this.scores) {
            totalWeight += s.weight;
            weightedScoreSum += s.score * s.weight;
        }

        if (totalWeight > 0) {
            const finalScore = Math.round(weightedScoreSum / totalWeight);
            this.report.summary.healthScore = finalScore;

            let status: 'good' | 'warning' | 'critical' = 'good';
            if (finalScore < 50) status = 'critical';
            else if (finalScore < 80) status = 'warning';

            this.report.summary.status = status;
        }
    }

    getReport(): BaseReport {
        return this.report;
    }
}
