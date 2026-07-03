import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLoggerService } from '../logging/app-logger.service';

type RequestWithContext = Request & {
  user?: { id?: string; companyId?: string };
  body?: {
    companyId?: string;
    customerPhone?: string;
    senderPhone?: string;
  };
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithContext>();
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const stack = exception instanceof Error ? exception.stack : undefined;
    const stackLocation = this.extractStackLocation(stack);

    this.logger.log({
      level: 'error',
      message: exception instanceof Error ? exception.message : 'Excepcion desconocida',
      module: this.extractModuleFromPath(request.path),
      file: stackLocation.file,
      functionName: stackLocation.functionName,
      companyId: request.user?.companyId ?? request.body?.companyId,
      userId: request.user?.id,
      customerPhone: request.body?.customerPhone ?? request.body?.senderPhone,
      method: request.method,
      path: request.path,
      statusCode,
      stack,
    });

    response.status(statusCode).json({
      statusCode,
      message: this.toUserMessage(exception, statusCode),
      timestamp: new Date().toISOString(),
      path: request.path,
    });
  }

  private toUserMessage(exception: unknown, statusCode: number) {
    if (exception instanceof HttpException && statusCode < HttpStatus.INTERNAL_SERVER_ERROR) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        return exceptionResponse;
      }

      if (
        exceptionResponse &&
        typeof exceptionResponse === 'object' &&
        'message' in exceptionResponse
      ) {
        const message = (exceptionResponse as { message?: unknown }).message;
        if (Array.isArray(message)) return message.join('. ');
        if (typeof message === 'string') return message;
      }
    }

    return 'Ocurrió un error interno. Intenta nuevamente en unos segundos.';
  }

  private extractModuleFromPath(path: string) {
    const [moduleName] = path.split('/').filter(Boolean);
    return moduleName ?? 'app';
  }

  private extractStackLocation(stack?: string) {
    const fallback = { file: undefined, functionName: undefined };
    if (!stack) return fallback;

    const line = stack.split('\n').find((item) => item.includes('fronti-backend'));
    if (!line) return fallback;

    const match = line.match(/at\s+(?:(?<fn>.*?)\s+\()?(.+?)(?::\d+:\d+)?\)?$/);
    return {
      file: match?.[2],
      functionName: match?.groups?.fn,
    };
  }
}
