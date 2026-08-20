import {
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';

@Catch()
export class GraphqlExceptionFilter implements GqlExceptionFilter {
  private readonly logger = new Logger(GraphqlExceptionFilter.name);

  catch(exception: unknown, _host: ArgumentsHost) {
    if (exception instanceof GraphQLError) {
      return exception;
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] }).message ??
            'Request failed');
      const customCode =
        typeof response === 'object' &&
        response !== null &&
        'code' in response &&
        typeof (response as { code?: unknown }).code === 'string'
          ? String((response as { code: string }).code)
          : undefined;

      return new GraphQLError(
        Array.isArray(message) ? message.join(', ') : message,
        {
          extensions: {
            code: customCode ?? exception.getStatus(),
          },
        },
      );
    }

    // PayloadTooLargeError from Express body-parser (e.g. large file upload)
    if (
      exception instanceof Error &&
      (exception as Error & { type?: string }).type === 'entity.too.large'
    ) {
      return new GraphQLError('File is too large. Please upload a smaller file.', {
        extensions: { code: HttpStatus.PAYLOAD_TOO_LARGE },
      });
    }

    this.logger.error('Unhandled exception', exception);

    return new GraphQLError('Something went wrong. Please try again.', {
      extensions: { code: HttpStatus.INTERNAL_SERVER_ERROR },
    });
  }
}
