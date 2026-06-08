export type AppErrorOptions = {
  code?: string;
  statusCode?: number;
  cause?: unknown;
};

export class AppError extends Error {
  public readonly code?: string;
  public readonly statusCode?: number;
  public readonly cause?: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.cause = options.cause;
  }
}
