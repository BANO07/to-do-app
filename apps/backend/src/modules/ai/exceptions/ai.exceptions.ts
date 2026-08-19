import { HttpException, HttpStatus } from '@nestjs/common';

export const AI_LIMIT_REACHED_CODE = 'AI_LIMIT_REACHED';

export class AiLimitReachedException extends HttpException {
  constructor(message: string) {
    super(
      {
        message,
        code: AI_LIMIT_REACHED_CODE,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class AiProviderUnavailableException extends HttpException {
  constructor(
    message = 'AI is not configured. Please contact your administrator.',
  ) {
    super(message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

export class AiProviderException extends HttpException {
  constructor(message = 'AI request failed. Please try again.') {
    super(message, HttpStatus.BAD_GATEWAY);
  }
}
