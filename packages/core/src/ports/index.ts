export type PageRepositoryPort = Record<string, unknown>;
export type EdgeRepositoryPort = Record<string, unknown>;
export type SnapshotRepositoryPort = Record<string, unknown>;
export type FetcherPort = Record<string, unknown>;
export interface LoggerPort {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}
