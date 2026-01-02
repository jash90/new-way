import { z } from 'zod';

// ===========================================================================
// FISCAL YEAR STATUS
// ===========================================================================

export const fiscalYearStatusSchema = z.enum([
  'draft',      // Rok przygotowany, nie aktywny
  'open',       // Rok otwarty, można księgować
  'closed',     // Rok zamknięty, można przeglądać
  'locked',     // Rok zablokowany (po audycie)
]);

export type FiscalYearStatus = z.infer<typeof fiscalYearStatusSchema>;

// ===========================================================================
// FISCAL PERIOD STATUS
// ===========================================================================

export const fiscalPeriodStatusSchema = z.enum([
  'open',       // Okres otwarty do księgowania
  'closed',     // Okres zamknięty
  'locked',     // Okres zablokowany
]);

export type FiscalPeriodStatus = z.infer<typeof fiscalPeriodStatusSchema>;

// ===========================================================================
// FISCAL PERIOD
// ===========================================================================

export interface FiscalPeriod {
  id: string;
  fiscalYearId: string;
  name: string;              // np. "Styczeń 2024", "Luty 2024"
  periodNumber: number;      // 1-12
  startDate: Date;
  endDate: Date;
  status: FiscalPeriodStatus;
  closedAt: Date | null;
  closedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================================================
// FISCAL YEAR
// ===========================================================================

export interface FiscalYear {
  id: string;
  organizationId: string;
  name: string;              // np. "Rok obrotowy 2024"
  code: string;              // np. "2024" lub "2024/2025"
  startDate: Date;
  endDate: Date;
  status: FiscalYearStatus;
  isCurrent: boolean;        // Czy to aktualny rok obrotowy
  openedAt: Date | null;
  closedAt: Date | null;
  lockedAt: Date | null;
  openedBy: string | null;
  closedBy: string | null;
  lockedBy: string | null;
  periods?: FiscalPeriod[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================================================
// CREATE FISCAL YEAR
// ===========================================================================

export const createFiscalYearSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  generatePeriods: z.boolean().default(true),  // Auto-generuj okresy miesięczne
}).refine((data) => data.endDate > data.startDate, {
  message: 'Data końcowa musi być późniejsza niż data początkowa',
  path: ['endDate'],
});

export type CreateFiscalYearInput = z.infer<typeof createFiscalYearSchema>;

// ===========================================================================
// GET FISCAL YEAR
// ===========================================================================

export const getFiscalYearSchema = z.object({
  id: z.string().uuid(),
  includePeriods: z.boolean().default(false),
});

export type GetFiscalYearInput = z.infer<typeof getFiscalYearSchema>;

// ===========================================================================
// LIST FISCAL YEARS
// ===========================================================================

export const listFiscalYearsSchema = z.object({
  status: fiscalYearStatusSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  includePeriods: z.boolean().default(false),
});

export type ListFiscalYearsInput = z.infer<typeof listFiscalYearsSchema>;

export interface ListFiscalYearsResult {
  items: FiscalYear[];
  total: number;
  limit: number;
  offset: number;
}

// ===========================================================================
// UPDATE FISCAL YEAR
// ===========================================================================

export const updateFiscalYearSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(1).max(20).optional(),
});

export type UpdateFiscalYearInput = z.infer<typeof updateFiscalYearSchema>;

// ===========================================================================
// OPEN FISCAL YEAR
// ===========================================================================

export const openFiscalYearSchema = z.object({
  id: z.string().uuid(),
});

export type OpenFiscalYearInput = z.infer<typeof openFiscalYearSchema>;

export interface OpenFiscalYearResult {
  success: boolean;
  fiscalYear: FiscalYear;
  message: string;
}

// ===========================================================================
// CLOSE FISCAL YEAR
// ===========================================================================

export const closeFiscalYearSchema = z.object({
  id: z.string().uuid(),
  forceClose: z.boolean().default(false),  // Zamknij nawet jeśli są otwarte okresy
});

export type CloseFiscalYearInput = z.infer<typeof closeFiscalYearSchema>;

export interface CloseFiscalYearResult {
  success: boolean;
  fiscalYear: FiscalYear;
  message: string;
  openPeriodsCount?: number;
}

// ===========================================================================
// LOCK FISCAL YEAR
// ===========================================================================

export const lockFiscalYearSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export type LockFiscalYearInput = z.infer<typeof lockFiscalYearSchema>;

export interface LockFiscalYearResult {
  success: boolean;
  fiscalYear: FiscalYear;
  message: string;
}

// ===========================================================================
// SET CURRENT FISCAL YEAR
// ===========================================================================

export const setCurrentFiscalYearSchema = z.object({
  id: z.string().uuid(),
});

export type SetCurrentFiscalYearInput = z.infer<typeof setCurrentFiscalYearSchema>;

export interface SetCurrentFiscalYearResult {
  success: boolean;
  fiscalYear: FiscalYear;
  previousCurrentId: string | null;
  message: string;
}

// ===========================================================================
// DELETE FISCAL YEAR
// ===========================================================================

export const deleteFiscalYearSchema = z.object({
  id: z.string().uuid(),
});

export type DeleteFiscalYearInput = z.infer<typeof deleteFiscalYearSchema>;

export interface DeleteFiscalYearResult {
  success: boolean;
  message: string;
}

// ===========================================================================
// LIST FISCAL PERIODS
// ===========================================================================

export const listFiscalPeriodsSchema = z.object({
  fiscalYearId: z.string().uuid(),
  status: fiscalPeriodStatusSchema.optional(),
});

export type ListFiscalPeriodsInput = z.infer<typeof listFiscalPeriodsSchema>;

export interface ListFiscalPeriodsResult {
  items: FiscalPeriod[];
  total: number;
}

// ===========================================================================
// CLOSE FISCAL PERIOD
// ===========================================================================

export const closeFiscalPeriodSchema = z.object({
  id: z.string().uuid(),
});

export type CloseFiscalPeriodInput = z.infer<typeof closeFiscalPeriodSchema>;

export interface CloseFiscalPeriodResult {
  success: boolean;
  period: FiscalPeriod;
  message: string;
}

// ===========================================================================
// REOPEN FISCAL PERIOD
// ===========================================================================

export const reopenFiscalPeriodSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

export type ReopenFiscalPeriodInput = z.infer<typeof reopenFiscalPeriodSchema>;

export interface ReopenFiscalPeriodResult {
  success: boolean;
  period: FiscalPeriod;
  message: string;
}

// ===========================================================================
// GET CURRENT FISCAL YEAR
// ===========================================================================

export const getCurrentFiscalYearSchema = z.object({
  includePeriods: z.boolean().default(false),
});

export type GetCurrentFiscalYearInput = z.infer<typeof getCurrentFiscalYearSchema>;

// ===========================================================================
// FISCAL YEAR STATISTICS
// ===========================================================================

export const getFiscalYearStatisticsSchema = z.object({
  id: z.string().uuid(),
});

export type GetFiscalYearStatisticsInput = z.infer<typeof getFiscalYearStatisticsSchema>;

export interface FiscalYearStatistics {
  fiscalYearId: string;
  totalPeriods: number;
  openPeriods: number;
  closedPeriods: number;
  lockedPeriods: number;
  journalEntriesCount: number;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}
