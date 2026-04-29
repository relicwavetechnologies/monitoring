import pino, { type Logger } from "pino";

const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

const baseLogger: Logger = pino({
  level: process.env.LOG_LEVEL ?? (isTest ? "silent" : isProd ? "info" : "debug"),
  base: { service: "visawatch" },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "*.apiKey", "*.password"],
    remove: true,
  },
  ...(isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss.l", ignore: "pid,hostname,service" },
        },
      }),
});

export function getLogger(component: string, bindings?: Record<string, unknown>): Logger {
  return baseLogger.child({ component, ...bindings });
}

export const logger = baseLogger;
