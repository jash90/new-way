// TAX Module Routers

import { router } from '../../trpc';
import { taxConfigurationRouter } from './tax-configuration.router';
import { taxRatesRouter } from './tax-rates.router';
import { taxDeadlinesRouter } from './tax-deadlines.router';
import { vatCalculationRouter } from './vat-calculation.router';
import { whiteListRouter } from './white-list.router';
import { incomeTaxDeclarationRouter } from './income-tax-declaration.router';
import { zusDeclarationRouter } from './zus-declaration.router';
import { jpkReportingRouter } from './jpk-reporting.router';

/**
 * TAX Module Router
 * Manages all tax-related operations including:
 * - TAX-001: Client Tax Configuration
 * - TAX-002: Tax Rates Management
 * - TAX-003: Tax Deadline Management
 * - TAX-004: VAT Calculation Engine
 * - TAX-005: CIT/PIT Declaration
 * - TAX-006: ZUS Declaration
 * - TAX-007: JPK Reporting
 * - TAX-013: White List Verification
 */
export const taxRouter = router({
  configuration: taxConfigurationRouter,
  rates: taxRatesRouter, // TAX-002
  deadlines: taxDeadlinesRouter, // TAX-003
  vatCalculation: vatCalculationRouter, // TAX-004
  whiteList: whiteListRouter, // TAX-013
  incomeTaxDeclaration: incomeTaxDeclarationRouter, // TAX-005
  zusDeclaration: zusDeclarationRouter, // TAX-006
  jpkReporting: jpkReportingRouter, // TAX-007
});

export { taxConfigurationRouter } from './tax-configuration.router';
export { taxRatesRouter } from './tax-rates.router';
export { taxDeadlinesRouter } from './tax-deadlines.router';
export { vatCalculationRouter } from './vat-calculation.router';
export { whiteListRouter } from './white-list.router';
export { incomeTaxDeclarationRouter } from './income-tax-declaration.router';
export { zusDeclarationRouter } from './zus-declaration.router';
export { jpkReportingRouter } from './jpk-reporting.router';

export type TaxRouter = typeof taxRouter;
