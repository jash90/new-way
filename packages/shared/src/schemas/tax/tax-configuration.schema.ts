import { z } from 'zod';

// ===========================================================================
// VAT STATUS
// ===========================================================================

export const vatStatusSchema = z.enum([
  'active',           // Czynny płatnik VAT
  'exempt',           // Zwolniony z VAT
  'not_registered',   // Niezarejestrowany
  'invalid',          // Nieprawidłowy (wykreślony)
]);

export type VATStatus = z.infer<typeof vatStatusSchema>;

// ===========================================================================
// VAT PERIOD
// ===========================================================================

export const vatPeriodSchema = z.enum([
  'monthly',    // Rozliczenie miesięczne (JPK_V7M)
  'quarterly',  // Rozliczenie kwartalne (JPK_V7K) - tylko dla małych podatników
]);

export type VATPeriod = z.infer<typeof vatPeriodSchema>;

// ===========================================================================
// INCOME TAX FORM
// ===========================================================================

export const incomeTaxFormSchema = z.enum([
  'CIT',  // Podatek dochodowy od osób prawnych
  'PIT',  // Podatek dochodowy od osób fizycznych
]);

export type IncomeTaxForm = z.infer<typeof incomeTaxFormSchema>;

// ===========================================================================
// PIT TAX OPTION
// ===========================================================================

export const pitTaxOptionSchema = z.enum([
  'progressive',  // Skala podatkowa (12%/32%)
  'flat',         // Podatek liniowy (19%)
  'lump_sum',     // Ryczałt od przychodów ewidencjonowanych
]);

export type PITTaxOption = z.infer<typeof pitTaxOptionSchema>;

// ===========================================================================
// ZUS TYPE
// ===========================================================================

export const zusTypeSchema = z.enum([
  'standard',      // Pełne składki ZUS
  'preferential',  // Mały ZUS Plus (preferencyjne składki)
  'ulga_na_start', // Ulga na start (6 miesięcy bez składek społecznych)
  'employer',      // Składki pracodawcy
  'none',          // Brak składek ZUS (np. umowa o dzieło)
]);

export type ZUSType = z.infer<typeof zusTypeSchema>;

// ===========================================================================
// SUBMISSION METHOD
// ===========================================================================

export const submissionMethodSchema = z.enum([
  'automatic',        // Automatyczne wysyłanie
  'manual',           // Ręczne wysyłanie
  'manual_approval',  // Wymagana akceptacja przed wysyłką
]);

export type SubmissionMethod = z.infer<typeof submissionMethodSchema>;

// ===========================================================================
// AUTHORIZATION SCOPE
// ===========================================================================

export const authorizationScopeSchema = z.enum([
  'VAT',  // Pełnomocnictwo do VAT
  'CIT',  // Pełnomocnictwo do CIT
  'PIT',  // Pełnomocnictwo do PIT
  'ZUS',  // Pełnomocnictwo do ZUS
]);

export type AuthorizationScope = z.infer<typeof authorizationScopeSchema>;

// ===========================================================================
// AUDIT ACTION
// ===========================================================================

export const auditActionSchema = z.enum([
  'CREATE',   // Utworzenie konfiguracji
  'UPDATE',   // Aktualizacja konfiguracji
  'DELETE',   // Usunięcie konfiguracji
  'RESTORE',  // Przywrócenie poprzedniej wersji
]);

export type AuditAction = z.infer<typeof auditActionSchema>;

// ===========================================================================
// NIP VALIDATION HELPER
// ===========================================================================

/**
 * Validates Polish NIP (Tax Identification Number) using checksum algorithm
 * NIP format: 10 digits with checksum on position 10
 * Weights: 6, 5, 7, 2, 3, 4, 5, 6, 7
 */
export const validateNIP = (nip: string): boolean => {
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7] as const;
  const digits = nip.replace(/\D/g, '');

  if (digits.length !== 10) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const digit = digits.charAt(i);
    const weight = weights[i];
    if (weight !== undefined) {
      sum += parseInt(digit, 10) * weight;
    }
  }

  const checksum = sum % 11;
  // Checksum 10 is invalid
  if (checksum === 10) return false;

  return checksum === parseInt(digits.charAt(9), 10);
};

// NIP schema with validation
export const nipSchema = z.string()
  .transform((val) => val.replace(/[-\s]/g, ''))
  .refine((val) => /^[0-9]{10}$/.test(val), {
    message: 'NIP musi składać się z 10 cyfr',
  })
  .refine(validateNIP, {
    message: 'Nieprawidłowa suma kontrolna NIP',
  });

// ===========================================================================
// TAX REPRESENTATIVE ENTITY
// ===========================================================================

export interface TaxRepresentative {
  id: string;
  clientId: string;
  representativeNip: string;
  representativeName: string;
  authorizationScope: AuthorizationScope[];
  upl1Reference: string | null;
  validFrom: Date;
  validTo: Date | null;
  isActive: boolean;
  createdAt: Date;
  createdBy: string | null;
}

// ===========================================================================
// TAX CONFIGURATION ENTITY
// ===========================================================================

export interface TaxConfiguration {
  id: string;
  clientId: string;
  organizationId: string;

  // VAT Configuration
  vatStatus: VATStatus;
  vatPeriod: VATPeriod | null;
  vatExemptionReason: string | null;
  vatRegistrationDate: Date | null;
  vatDeregistrationDate: Date | null;

  // Income Tax Configuration
  incomeTaxForm: IncomeTaxForm;
  incomeTaxRate: number | null;
  isSmallTaxpayer: boolean;
  estonianCitEnabled: boolean;
  estonianCitStartDate: Date | null;
  pitTaxOption: PITTaxOption | null;
  accountingYearStart: string;  // MM-DD format

  // ZUS Configuration
  zusType: ZUSType | null;
  zusContributionBase: number | null;
  zusAccidentRate: number;
  zusFpEnabled: boolean;
  zusFgspEnabled: boolean;
  zusUlgaExpiryDate: Date | null;

  // e-Declaration Configuration
  submissionMethod: SubmissionMethod;
  autoUpoDownload: boolean;
  notificationEmail: string | null;
  notificationInApp: boolean;
  approvalRequired: boolean;
  approvalDaysBefore: number;

  // Metadata
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;

  // Relations (optional)
  representatives?: TaxRepresentative[];
}

// ===========================================================================
// TAX CONFIGURATION AUDIT ENTRY
// ===========================================================================

export interface TaxConfigurationAudit {
  id: string;
  configurationId: string;
  clientId: string;
  userId: string;
  action: AuditAction;
  fieldChanged: string | null;
  oldValue: unknown;
  newValue: unknown;
  changeReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  createdAt: Date;
}

// ===========================================================================
// CREATE TAX CONFIGURATION
// ===========================================================================

// Base schema without refinements (for use with .omit(), .pick(), etc.)
export const createTaxConfigurationBaseSchema = z.object({
  clientId: z.string().uuid(),

  // VAT Configuration
  vatStatus: vatStatusSchema,
  vatPeriod: vatPeriodSchema.optional(),
  vatExemptionReason: z.string().max(100).optional(),
  vatRegistrationDate: z.coerce.date().optional(),

  // Income Tax Configuration
  incomeTaxForm: incomeTaxFormSchema,
  incomeTaxRate: z.number().min(0).max(100).optional(),
  isSmallTaxpayer: z.boolean().default(false),
  estonianCitEnabled: z.boolean().default(false),
  estonianCitStartDate: z.coerce.date().optional(),
  pitTaxOption: pitTaxOptionSchema.optional(),
  accountingYearStart: z.string().regex(/^\d{2}-\d{2}$/).default('01-01'),

  // ZUS Configuration
  zusType: zusTypeSchema.optional(),
  zusContributionBase: z.number().positive().optional(),
  zusAccidentRate: z.number().min(0.67).max(3.33).default(1.67),
  zusFpEnabled: z.boolean().default(true),
  zusFgspEnabled: z.boolean().default(true),
  zusUlgaExpiryDate: z.coerce.date().optional(),

  // e-Declaration Configuration
  submissionMethod: submissionMethodSchema.default('manual'),
  autoUpoDownload: z.boolean().default(true),
  notificationEmail: z.string().email().optional(),
  notificationInApp: z.boolean().default(true),
  approvalRequired: z.boolean().default(false),
  approvalDaysBefore: z.number().int().min(1).max(30).default(5),

  // Effective dates
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional(),
});

// Full schema with business rule refinements
export const createTaxConfigurationSchema = createTaxConfigurationBaseSchema.refine((data) => {
  // Quarterly VAT only for small taxpayers
  if (data.vatPeriod === 'quarterly' && !data.isSmallTaxpayer) {
    return false;
  }
  return true;
}, {
  message: 'Rozliczenie kwartalne VAT dostępne tylko dla małych podatników',
  path: ['vatPeriod'],
}).refine((data) => {
  // Estonian CIT only for CIT payers
  if (data.estonianCitEnabled && data.incomeTaxForm !== 'CIT') {
    return false;
  }
  return true;
}, {
  message: 'Estoński CIT dostępny tylko dla podatników CIT',
  path: ['estonianCitEnabled'],
}).refine((data) => {
  // PIT tax option required for PIT payers
  if (data.incomeTaxForm === 'PIT' && !data.pitTaxOption) {
    return false;
  }
  return true;
}, {
  message: 'Wybór formy opodatkowania PIT jest wymagany',
  path: ['pitTaxOption'],
}).refine((data) => {
  // VAT period required for active VAT payers
  if (data.vatStatus === 'active' && !data.vatPeriod) {
    return false;
  }
  return true;
}, {
  message: 'Okres rozliczeniowy VAT jest wymagany dla czynnych podatników',
  path: ['vatPeriod'],
}).refine((data) => {
  // VAT exemption reason required for exempt status
  if (data.vatStatus === 'exempt' && !data.vatExemptionReason) {
    return false;
  }
  return true;
}, {
  message: 'Podstawa zwolnienia z VAT jest wymagana',
  path: ['vatExemptionReason'],
});

export type CreateTaxConfigurationInput = z.infer<typeof createTaxConfigurationSchema>;

export interface CreateTaxConfigurationResult {
  success: boolean;
  configuration: TaxConfiguration;
  message: string;
}

// ===========================================================================
// GET TAX CONFIGURATION
// ===========================================================================

export const getTaxConfigurationSchema = z.object({
  id: z.string().uuid(),
  includeRepresentatives: z.boolean().default(false),
});

export type GetTaxConfigurationInput = z.infer<typeof getTaxConfigurationSchema>;

// ===========================================================================
// GET TAX CONFIGURATION BY CLIENT
// ===========================================================================

export const getTaxConfigurationByClientSchema = z.object({
  clientId: z.string().uuid(),
  includeRepresentatives: z.boolean().default(true),
  includeInactive: z.boolean().default(false),
});

export type GetTaxConfigurationByClientInput = z.infer<typeof getTaxConfigurationByClientSchema>;

// ===========================================================================
// LIST TAX CONFIGURATIONS
// ===========================================================================

export const listTaxConfigurationsSchema = z.object({
  vatStatus: vatStatusSchema.optional(),
  incomeTaxForm: incomeTaxFormSchema.optional(),
  zusType: zusTypeSchema.optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  includeRepresentatives: z.boolean().default(false),
});

export type ListTaxConfigurationsInput = z.infer<typeof listTaxConfigurationsSchema>;

export interface ListTaxConfigurationsResult {
  items: TaxConfiguration[];
  total: number;
  limit: number;
  offset: number;
}

// ===========================================================================
// UPDATE TAX CONFIGURATION
// ===========================================================================

export const updateTaxConfigurationSchema = z.object({
  id: z.string().uuid(),
  data: z.object({
    // VAT Configuration
    vatStatus: vatStatusSchema.optional(),
    vatPeriod: vatPeriodSchema.optional().nullable(),
    vatExemptionReason: z.string().max(100).optional().nullable(),
    vatRegistrationDate: z.coerce.date().optional().nullable(),
    vatDeregistrationDate: z.coerce.date().optional().nullable(),

    // Income Tax Configuration
    incomeTaxForm: incomeTaxFormSchema.optional(),
    incomeTaxRate: z.number().min(0).max(100).optional().nullable(),
    isSmallTaxpayer: z.boolean().optional(),
    estonianCitEnabled: z.boolean().optional(),
    estonianCitStartDate: z.coerce.date().optional().nullable(),
    pitTaxOption: pitTaxOptionSchema.optional().nullable(),
    accountingYearStart: z.string().regex(/^\d{2}-\d{2}$/).optional(),

    // ZUS Configuration
    zusType: zusTypeSchema.optional().nullable(),
    zusContributionBase: z.number().positive().optional().nullable(),
    zusAccidentRate: z.number().min(0.67).max(3.33).optional(),
    zusFpEnabled: z.boolean().optional(),
    zusFgspEnabled: z.boolean().optional(),
    zusUlgaExpiryDate: z.coerce.date().optional().nullable(),

    // e-Declaration Configuration
    submissionMethod: submissionMethodSchema.optional(),
    autoUpoDownload: z.boolean().optional(),
    notificationEmail: z.string().email().optional().nullable(),
    notificationInApp: z.boolean().optional(),
    approvalRequired: z.boolean().optional(),
    approvalDaysBefore: z.number().int().min(1).max(30).optional(),

    // Effective dates
    effectiveFrom: z.coerce.date().optional(),
    effectiveTo: z.coerce.date().optional().nullable(),
  }),
  changeReason: z.string().max(500).optional(),
});

export type UpdateTaxConfigurationInput = z.infer<typeof updateTaxConfigurationSchema>;

export interface UpdateTaxConfigurationResult {
  success: boolean;
  configuration: TaxConfiguration;
  changedFields: string[];
  message: string;
}

// ===========================================================================
// DELETE TAX CONFIGURATION
// ===========================================================================

export const deleteTaxConfigurationSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(10).max(500),
  hardDelete: z.boolean().default(false),  // Soft delete by default
});

export type DeleteTaxConfigurationInput = z.infer<typeof deleteTaxConfigurationSchema>;

export interface DeleteTaxConfigurationResult {
  success: boolean;
  message: string;
}

// ===========================================================================
// TAX REPRESENTATIVE SCHEMAS
// ===========================================================================

export const addTaxRepresentativeSchema = z.object({
  clientId: z.string().uuid(),
  representativeNip: nipSchema,
  representativeName: z.string().min(2).max(200),
  authorizationScope: z.array(authorizationScopeSchema).min(1),
  upl1Reference: z.string().max(50).optional(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
});

export type AddTaxRepresentativeInput = z.infer<typeof addTaxRepresentativeSchema>;

export interface AddTaxRepresentativeResult {
  success: boolean;
  representative: TaxRepresentative;
  message: string;
}

export const updateTaxRepresentativeSchema = z.object({
  id: z.string().uuid(),
  data: z.object({
    representativeNip: nipSchema.optional(),
    representativeName: z.string().min(2).max(200).optional(),
    authorizationScope: z.array(authorizationScopeSchema).min(1).optional(),
    upl1Reference: z.string().max(50).optional().nullable(),
    validFrom: z.coerce.date().optional(),
    validTo: z.coerce.date().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export type UpdateTaxRepresentativeInput = z.infer<typeof updateTaxRepresentativeSchema>;

export interface UpdateTaxRepresentativeResult {
  success: boolean;
  representative: TaxRepresentative;
  message: string;
}

export const removeTaxRepresentativeSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export type RemoveTaxRepresentativeInput = z.infer<typeof removeTaxRepresentativeSchema>;

export interface RemoveTaxRepresentativeResult {
  success: boolean;
  message: string;
}

export const listTaxRepresentativesSchema = z.object({
  clientId: z.string().uuid(),
  includeInactive: z.boolean().default(false),
  scope: authorizationScopeSchema.optional(),
});

export type ListTaxRepresentativesInput = z.infer<typeof listTaxRepresentativesSchema>;

export interface ListTaxRepresentativesResult {
  items: TaxRepresentative[];
  total: number;
}

// ===========================================================================
// CONFIGURATION HISTORY
// ===========================================================================

export const getConfigurationHistorySchema = z.object({
  configurationId: z.string().uuid(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  fieldName: z.string().optional(),
  action: auditActionSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});

export type GetConfigurationHistoryInput = z.infer<typeof getConfigurationHistorySchema>;

export interface ConfigurationHistoryEntry {
  id: string;
  action: AuditAction;
  fieldChanged: string | null;
  oldValue: unknown;
  newValue: unknown;
  changeReason: string | null;
  userName: string;
  userEmail: string;
  createdAt: Date;
}

export interface GetConfigurationHistoryResult {
  items: ConfigurationHistoryEntry[];
  nextCursor: string | null;
  total: number;
}

// ===========================================================================
// RESTORE CONFIGURATION
// ===========================================================================

export const restoreConfigurationSchema = z.object({
  configurationId: z.string().uuid(),
  auditEntryId: z.string().uuid(),
  restoreReason: z.string().min(10).max(500),
});

export type RestoreConfigurationInput = z.infer<typeof restoreConfigurationSchema>;

export interface RestoreConfigurationResult {
  success: boolean;
  configuration: TaxConfiguration;
  restoredField: string;
  message: string;
}

// ===========================================================================
// VALIDATE CONFIGURATION
// ===========================================================================

export const validateConfigurationSchema = z.object({
  clientId: z.string().uuid(),
  data: createTaxConfigurationBaseSchema.omit({ clientId: true }),
});

export type ValidateConfigurationInput = z.infer<typeof validateConfigurationSchema>;

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidateConfigurationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

// ===========================================================================
// CHECK SMALL TAXPAYER STATUS
// ===========================================================================

export const checkSmallTaxpayerStatusSchema = z.object({
  clientId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100).optional(),
});

export type CheckSmallTaxpayerStatusInput = z.infer<typeof checkSmallTaxpayerStatusSchema>;

export interface CheckSmallTaxpayerStatusResult {
  isEligible: boolean;
  revenue: number;
  threshold: number;
  currency: string;
  year: number;
  message: string;
}

// ===========================================================================
// CHECK ESTONIAN CIT ELIGIBILITY
// ===========================================================================

export const checkEstonianCitEligibilitySchema = z.object({
  clientId: z.string().uuid(),
});

export type CheckEstonianCitEligibilityInput = z.infer<typeof checkEstonianCitEligibilitySchema>;

export interface EstonianCitRequirements {
  isPolishCompany: boolean;
  noPartnershipIncome: boolean;
  employmentLevel: boolean;
  hasQualifiedRevenue: boolean;
}

export interface CheckEstonianCitEligibilityResult {
  isEligible: boolean;
  requirements: EstonianCitRequirements;
  legalForm: string;
  message: string;
}

// ===========================================================================
// TAX CONFIGURATION RESPONSE (for API)
// ===========================================================================

export interface TaxConfigurationResponse {
  id: string;
  clientId: string;
  clientName: string;
  clientNip: string;

  // VAT Configuration
  vatStatus: VATStatus;
  vatPeriod: VATPeriod | null;
  vatExemptionReason: string | null;
  vatRegistrationDate: string | null;

  // Income Tax Configuration
  incomeTaxForm: IncomeTaxForm;
  incomeTaxRate: number | null;
  isSmallTaxpayer: boolean;
  estonianCitEnabled: boolean;
  pitTaxOption: PITTaxOption | null;

  // ZUS Configuration
  zusType: ZUSType | null;
  zusContributionBase: number | null;
  zusAccidentRate: number;

  // e-Declaration Configuration
  submissionMethod: SubmissionMethod;
  autoUpoDownload: boolean;
  approvalRequired: boolean;

  // Representatives
  representatives: Array<{
    id: string;
    representativeNip: string;
    representativeName: string;
    authorizationScope: AuthorizationScope[];
    validFrom: string;
    validTo: string | null;
    isActive: boolean;
  }>;

  // Metadata
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
