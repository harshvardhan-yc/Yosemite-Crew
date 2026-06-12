import { AppError } from './app-error.js';

export class HttpError extends AppError {
  constructor(message: string, statusCode: number, code?: string) {
    super(message, { statusCode, code });
    this.name = 'HttpError';
  }
}
