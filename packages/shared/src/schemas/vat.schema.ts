import { z } from 'zod';

// ===========================================
// CRM-003: VAT/VIES Validation
// ===========================================

// EU Country codes for VIES validation
export const euCountryCodeSchema = z.enum([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES',
  'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'XI' // XI = Northern Ireland
]);

export type EuCountryCode = z.infer<typeof euCountryCodeSchema>;

// VAT Status enum
export const vatStatusSchema = z.enum([
  'ACTIVE',         // VAT number is valid and active
  'NOT_REGISTERED', // VAT number not registered in VIES
  'INVALID',        // VAT number format is invalid
  'EXEMPT',         // Company is VAT exempt
  'UNKNOWN'         // Could not determine status (API error)
]);

export type VatStatus = z.infer<typeof vatStatusSchema>;

// ===========================================
// VAT NUMBER PATTERNS BY COUNTRY
// ===========================================

// VAT number validation regex patterns per EU country
const vatPatterns: Record<string, RegExp> = {
  AT: /^U\d{8}$/,                           // Austria
  BE: /^[01]\d{9}$/,                        // Belgium
  BG: /^\d{9,10}$/,                         // Bulgaria
  CY: /^\d{8}[A-Z]$/,                       // Cyprus
  CZ: /^\d{8,10}$/,                         // Czech Republic
  DE: /^\d{9}$/,                            // Germany
  DK: /^\d{8}$/,                            // Denmark
  EE: /^\d{9}$/,                            // Estonia
  EL: /^\d{9}$/,                            // Greece
  ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/,           // Spain
  FI: /^\d{8}$/,                            // Finland
  FR: /^[A-Z0-9]{2}\d{9}$/,                // France
  HR: /^\d{11}$/,                           // Croatia
  HU: /^\d{8}$/,                            // Hungary
  IE: /^(\d{7}[A-Z]{1,2}|\d[A-Z+*]\d{5}[A-Z])$/, // Ireland
  IT: /^\d{11}$/,                           // Italy
  LT: /^(\d{9}|\d{12})$/,                  // Lithuania
  LU: /^\d{8}$/,                            // Luxembourg
  LV: /^\d{11}$/,                           // Latvia
  MT: /^\d{8}$/,                            // Malta
  NL: /^\d{9}B\d{2}$/,                     // Netherlands
  PL: /^\d{10}$/,                           // Poland (NIP without prefix)
  PT: /^\d{9}$/,                            // Portugal
  RO: /^\d{2,10}$/,                         // Romania
  SE: /^\d{12}$/,                           // Sweden
  SI: /^\d{8}$/,                            // Slovenia
  SK: /^\d{10}$/,                           // Slovakia
  XI: /^(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,  // Northern Ireland
};

// Custom VAT number validator
export const vatNumberSchema = z.string()
  .min(4, 'Numer VAT jest za krótki')
  .max(15, 'Numer VAT jest za długi')
  .transform((val) => val.toUpperCase().replace(/[^A-Z0-9]/g, ''));

// ===========================================
// INPUT SCHEMAS
// ===========================================

// Validate VAT number (standalone validation)
export const validateVatSchema = z.object({
  countryCode: euCountryCodeSchema,
  vatNumber: vatNumberSchema,
});

export type ValidateVatInput = z.infer<typeof validateVatSchema>;

// Validate VAT for a specific client
export const validateClientVatSchema = z.object({
  clientId: z.string().uuid(),
  countryCode: euCountryCodeSchema.optional(), // If not provided, use client's country
  vatNumber: vatNumberSchema.optional(),       // If not provided, use client's NIP
  force: z.boolean().default(false),           // Force re-validation even if cached
});

export type ValidateClientVatInput = z.infer<typeof validateClientVatSchema>;

// Get VAT status for client
export const getVatStatusSchema = z.object({
  clientId: z.string().uuid(),
});

export type GetVatStatusInput = z.infer<typeof getVatStatusSchema>;

// Refresh VAT status for client
export const refreshVatStatusSchema = z.object({
  clientId: z.string().uuid(),
});

export type RefreshVatStatusInput = z.infer<typeof refreshVatStatusSchema>;

// Batch VAT validation
export const batchValidateVatSchema = z.object({
  clientIds: z.array(z.string().uuid()).min(1).max(50),
  force: z.boolean().default(false),
});

export type BatchValidateVatInput = z.infer<typeof batchValidateVatSchema>;

// ===========================================
// OUTPUT SCHEMAS
// ===========================================

// VIES API response data
export const viesDataSchema = z.object({
  valid: z.boolean(),
  countryCode: z.string(),
  vatNumber: z.string(),
  requestDate: z.string(),
  name: z.string().nullable(),
  address: z.string().nullable(),
  traderName: z.string().nullable(),
  traderCompanyType: z.string().nullable(),
  traderAddress: z.string().nullable(),
  requestIdentifier: z.string().optional(),
});

export type ViesData = z.infer<typeof viesDataSchema>;

// VAT validation result
export const vatValidationResultSchema = z.object({
  valid: z.boolean(),
  status: vatStatusSchema,
  countryCode: z.string(),
  vatNumber: z.string(),
  formattedVatNumber: z.string(),  // Full VAT with country prefix
  companyName: z.string().nullable(),
  companyAddress: z.string().nullable(),
  validatedAt: z.date(),
  cached: z.boolean(),
  viesData: viesDataSchema.nullable(),
  message: z.string(),
});

export type VatValidationResult = z.infer<typeof vatValidationResultSchema>;

// Client VAT status result
export const clientVatStatusSchema = z.object({
  clientId: z.string().uuid(),
  vatStatus: vatStatusSchema,
  vatNumber: z.string().nullable(),
  countryCode: z.string().nullable(),
  validatedAt: z.date().nullable(),
  viesData: viesDataSchema.nullable(),
  isExpired: z.boolean(),           // True if validation is older than 24h
  canValidate: z.boolean(),         // True if client has NIP to validate
  message: z.string(),
});

export type ClientVatStatus = z.infer<typeof clientVatStatusSchema>;

// Batch validation result
export const batchVatValidationResultSchema = z.object({
  success: z.boolean(),
  results: z.array(z.object({
    clientId: z.string().uuid(),
    success: z.boolean(),
    vatStatus: vatStatusSchema.optional(),
    error: z.string().optional(),
  })),
  validated: z.number(),
  failed: z.number(),
  skipped: z.number(),
  message: z.string(),
});

export type BatchVatValidationResult = z.infer<typeof batchVatValidationResultSchema>;

// VAT validation history entry
export const vatValidationHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  vatNumber: z.string(),
  countryCode: z.string(),
  status: vatStatusSchema,
  viesData: viesDataSchema.nullable(),
  validatedAt: z.date(),
  validatedBy: z.string().uuid(),
});

export type VatValidationHistoryEntry = z.infer<typeof vatValidationHistoryEntrySchema>;

// ===========================================
// HELPER FUNCTIONS (exported for service use)
// ===========================================

/**
 * Validate VAT number format for specific country
 */
export function isValidVatFormat(countryCode: string, vatNumber: string): boolean {
  const pattern = vatPatterns[countryCode];
  if (!pattern) return false;
  return pattern.test(vatNumber.toUpperCase().replace(/[^A-Z0-9]/g, ''));
}

/**
 * Format VAT number with country prefix
 */
export function formatVatNumber(countryCode: string, vatNumber: string): string {
  const cleaned = vatNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${countryCode}${cleaned}`;
}

/**
 * Extract country code and VAT number from full EU VAT
 */
export function parseFullVatNumber(fullVat: string): { countryCode: string; vatNumber: string } | null {
  const cleaned = fullVat.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const euCodes = Object.values(euCountryCodeSchema.enum);

  for (const code of euCodes) {
    if (cleaned.startsWith(code)) {
      return {
        countryCode: code,
        vatNumber: cleaned.slice(code.length),
      };
    }
  }

  return null;
}
