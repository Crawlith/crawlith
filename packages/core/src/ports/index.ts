export interface PageRepositoryPort {}
export interface EdgeRepositoryPort {}
export interface SnapshotRepositoryPort {}
export interface FetcherPort {}
export interface LoggerPort {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}
