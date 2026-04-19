import winston from 'winston';

const baseLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple())
  ),
  transports: [new winston.transports.Console()],
});

function createLogMethod(level: 'debug' | 'info' | 'warn' | 'error') {
  return (messageOrMeta: unknown, maybeMessage?: string) => {
    if (typeof messageOrMeta === 'string') {
      baseLogger.log(level, messageOrMeta);
      return;
    }

    baseLogger.log(level, maybeMessage ?? '', messageOrMeta as object);
  };
}

export const logger = {
  debug: createLogMethod('debug'),
  info: createLogMethod('info'),
  warn: createLogMethod('warn'),
  error: createLogMethod('error'),
};
