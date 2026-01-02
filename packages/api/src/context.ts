import type { inferAsyncReturnType } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { AuditLogger } from './utils/audit-logger';

/**
 * Session data structure
 */
export interface Session {
  userId: string;
  email: string;
  roles: string[];
  organizationId: string;
  sessionId: string;
  permissions?: string[];
}

/**
 * Context options passed from HTTP handler
 */
export interface CreateContextOptions {
  req: {
    headers: Record<string, string | string[] | undefined>;
    ip?: string;
  };
  res: {
    setHeader: (name: string, value: string) => void;
  };
  prisma: PrismaClient;
  redis: Redis;
  session: Session | null;
  auditLogger?: AuditLogger;
}

/**
 * Create context for each request
 */
export function createContext(opts: CreateContextOptions) {
  const { req, res, prisma, redis, session, auditLogger: providedAuditLogger } = opts;

  // Extract correlation ID or generate new one
  const correlationId =
    (req.headers['x-correlation-id'] as string) ||
    crypto.randomUUID();

  // Extract client IP
  const ipAddress =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown';

  // Create audit logger instance if not provided, with context
  const auditLogger = providedAuditLogger ?? new AuditLogger(prisma, { ipAddress, correlationId });

  // Set context on existing audit logger if provided
  if (providedAuditLogger) {
    auditLogger.setContext(ipAddress, correlationId);
  }

  // Extract user agent
  const userAgent = req.headers['user-agent'] as string | undefined;

  // Extract access token from Authorization header
  const authHeader = req.headers['authorization'] as string | undefined;
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : undefined;

  return {
    prisma,
    redis,
    session,
    correlationId,
    ipAddress,
    userAgent,
    accessToken,
    req,
    res,
    auditLogger,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
