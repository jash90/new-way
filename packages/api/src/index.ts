// tRPC exports
export { router, publicProcedure, protectedProcedure, adminProcedure, middleware } from './trpc';
export { createContext } from './context';
export type { Context, Session, CreateContextOptions } from './context';

// AIM module
export { aimRouter } from './routers/aim';
export type { AimRouter } from './routers/aim';

// CRM module
export { crmRouter } from './routers/crm';
export type { CrmRouter } from './routers/crm';

// ACE module
export { aceRouter } from './routers/ace';
export type { AceRouter } from './routers/ace';

// TAX module
export { taxRouter } from './routers/tax';
export type { TaxRouter } from './routers/tax';

// DOC module
export { docRouter } from './routers/doc';
export type { DocRouter } from './routers/doc';

// Services
export { RegistrationService } from './services/aim/registration.service';

// Utilities
export { RateLimiter, rateLimitConfigs } from './utils/rate-limiter';
export { AuditLogger } from './utils/audit-logger';

// Root router
import { router } from './trpc';
import { aimRouter } from './routers/aim';
import { crmRouter } from './routers/crm';
import { aceRouter } from './routers/ace';
import { taxRouter } from './routers/tax';
import { docRouter } from './routers/doc';

export const appRouter = router({
  aim: aimRouter,
  crm: crmRouter,
  ace: aceRouter,
  tax: taxRouter,
  doc: docRouter,
});

export type AppRouter = typeof appRouter;
