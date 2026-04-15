import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const isDev = process.env.NODE_ENV !== 'production';
    const internalDetail =
      isDev && !(exception instanceof HttpException)
        ? String((exception as any)?.message ?? exception)
        : undefined;

    if (!(exception instanceof HttpException)) {
      console.error('[HttpExceptionFilter]', exception);
    }

    response.status(status).json({
      error: {
        code: status,
        message: typeof message === 'string' ? message : (message as any).message,
        details: typeof message === 'object' ? message : internalDetail,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
