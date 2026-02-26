export class DataNotFoundError extends Error {
  public code: string;
  constructor(message: string) {
    super(message);
    this.name = 'DataNotFoundError';
    this.code = 'ENODATA';
  }
}
