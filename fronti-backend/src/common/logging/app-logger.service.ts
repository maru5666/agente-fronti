export type AppLogLevel = 'error' | 'warn' | 'info';

export type AppLogPayload = {
  level: AppLogLevel;
  message: string;
  module?: string;
  file?: string;
  functionName?: string;
  companyId?: string;
  userId?: string;
  customerPhone?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  stack?: string;
  metadata?: Record<string, unknown>;
};

export class AppLoggerService {
  log(payload: AppLogPayload) {
    const entry = {
      timestamp: new Date().toISOString(),
      ...payload,
    };

    if (payload.level === 'error') {
      console.error(JSON.stringify(entry));
      return;
    }

    if (payload.level === 'warn') {
      console.warn(JSON.stringify(entry));
      return;
    }

    console.log(JSON.stringify(entry));
  }
}
