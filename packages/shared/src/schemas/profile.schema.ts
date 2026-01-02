import { z } from 'zod';
import { nipSchema, regonSchema, phoneSchema, postalCodeSchema } from './user.schema';

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

/**
 * Onboarding steps for profile completion
 */
export const onboardingStepSchema = z.enum([
  'PERSONAL_INFO',
  'COMPANY_INFO',
  'ADDRESS_INFO',
  'PREFERENCES',
]);

export type OnboardingStep = z.infer<typeof onboardingStepSchema>;

/**
 * Profile completion status
 */
export const profileCompletionStatusSchema = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
]);

export type ProfileCompletionStatus = z.infer<typeof profileCompletionStatusSchema>;

/**
 * Account type
 */
export const accountTypeSchema = z.enum([
  'INDIVIDUAL',
  'COMPANY',
]);

export type AccountType = z.infer<typeof accountTypeSchema>;

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

/**
 * Get profile schema
 */
export const getProfileSchema = z.object({
  userId: z.string().uuid().optional(),
});

export type GetProfileInput = z.infer<typeof getProfileSchema>;

/**
 * Personal info step schema (Step 1)
 */
export const personalInfoSchema = z.object({
  firstName: z.string().min(2, 'Imię jest za krótkie').max(50, 'Imię jest za długie'),
  lastName: z.string().min(2, 'Nazwisko jest za krótkie').max(50, 'Nazwisko jest za długie'),
  phone: phoneSchema.optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data urodzenia musi być w formacie YYYY-MM-DD').optional(),
});

export type PersonalInfoInput = z.infer<typeof personalInfoSchema>;

/**
 * Company info step schema (Step 2)
 */
export const companyInfoSchema = z.object({
  accountType: accountTypeSchema,
  companyName: z.string().min(2, 'Nazwa firmy jest za krótka').max(200, 'Nazwa firmy jest za długa').optional(),
  nip: nipSchema.optional(),
  regon: regonSchema.optional(),
  krs: z.string().regex(/^\d{10}$/, 'KRS musi mieć 10 cyfr').optional(),
  taxOffice: z.string().max(200, 'Nazwa urzędu skarbowego jest za długa').optional(),
});

export type CompanyInfoInput = z.infer<typeof companyInfoSchema>;

/**
 * Address info step schema (Step 3)
 */
export const addressInfoSchema = z.object({
  street: z.string().max(200, 'Ulica jest za długa').optional(),
  buildingNumber: z.string().max(20, 'Numer budynku jest za długi').optional(),
  apartmentNumber: z.string().max(20, 'Numer lokalu jest za długi').optional(),
  city: z.string().min(2, 'Nazwa miasta jest za krótka').max(100, 'Nazwa miasta jest za długa'),
  postalCode: postalCodeSchema,
  voivodeship: z.string().max(50, 'Nazwa województwa jest za długa').optional(),
  country: z.string().default('PL'),
});

export type AddressInfoInput = z.infer<typeof addressInfoSchema>;

/**
 * Preferences step schema (Step 4)
 */
export const preferencesSchema = z.object({
  language: z.enum(['pl', 'en']).default('pl'),
  timezone: z.string().default('Europe/Warsaw'),
  currency: z.enum(['PLN', 'EUR', 'USD']).default('PLN'),
  dateFormat: z.enum(['DD.MM.YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY']).default('DD.MM.YYYY'),
  emailNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(false),
  marketingConsent: z.boolean().default(false),
  termsAccepted: z.boolean().refine((val) => val === true, 'Musisz zaakceptować regulamin'),
  privacyPolicyAccepted: z.boolean().refine((val) => val === true, 'Musisz zaakceptować politykę prywatności'),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;

/**
 * Complete profile update schema
 */
export const updateProfileSchema = z.object({
  personalInfo: personalInfoSchema.optional(),
  companyInfo: companyInfoSchema.optional(),
  addressInfo: addressInfoSchema.optional(),
  preferences: preferencesSchema.partial().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Complete onboarding step schema
 */
export const completeOnboardingStepSchema = z.object({
  step: onboardingStepSchema,
  data: z.union([personalInfoSchema, companyInfoSchema, addressInfoSchema, preferencesSchema]),
});

export type CompleteOnboardingStepInput = z.infer<typeof completeOnboardingStepSchema>;

/**
 * GUS lookup by NIP schema
 */
export const gusLookupByNipSchema = z.object({
  nip: nipSchema,
});

export type GusLookupByNipInput = z.infer<typeof gusLookupByNipSchema>;

/**
 * GUS lookup by REGON schema
 */
export const gusLookupByRegonSchema = z.object({
  regon: regonSchema,
});

export type GusLookupByRegonInput = z.infer<typeof gusLookupByRegonSchema>;

/**
 * Get onboarding status schema
 */
export const getOnboardingStatusSchema = z.object({
  userId: z.string().uuid().optional(),
});

export type GetOnboardingStatusInput = z.infer<typeof getOnboardingStatusSchema>;

/**
 * Skip onboarding step schema
 */
export const skipOnboardingStepSchema = z.object({
  step: onboardingStepSchema,
});

export type SkipOnboardingStepInput = z.infer<typeof skipOnboardingStepSchema>;

/**
 * Reset onboarding schema
 */
export const resetOnboardingSchema = z.object({
  userId: z.string().uuid().optional(),
});

export type ResetOnboardingInput = z.infer<typeof resetOnboardingSchema>;

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

/**
 * Profile output schema
 */
export const profileOutputSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  phone: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  accountType: accountTypeSchema.nullable(),
  companyName: z.string().nullable(),
  nip: z.string().nullable(),
  regon: z.string().nullable(),
  krs: z.string().nullable(),
  taxOffice: z.string().nullable(),
  street: z.string().nullable(),
  buildingNumber: z.string().nullable(),
  apartmentNumber: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  voivodeship: z.string().nullable(),
  country: z.string(),
  language: z.string(),
  timezone: z.string(),
  currency: z.string(),
  dateFormat: z.string(),
  emailNotifications: z.boolean(),
  smsNotifications: z.boolean(),
  marketingConsent: z.boolean(),
  termsAccepted: z.boolean(),
  privacyPolicyAccepted: z.boolean(),
  completionPercentage: z.number().min(0).max(100),
  completionStatus: profileCompletionStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ProfileOutput = z.infer<typeof profileOutputSchema>;

/**
 * Onboarding status output schema
 */
export const onboardingStatusOutputSchema = z.object({
  currentStep: onboardingStepSchema.nullable(),
  completedSteps: z.array(onboardingStepSchema),
  skippedSteps: z.array(onboardingStepSchema),
  completionPercentage: z.number().min(0).max(100),
  status: profileCompletionStatusSchema,
  nextStep: onboardingStepSchema.nullable(),
  isComplete: z.boolean(),
});

export type OnboardingStatusOutput = z.infer<typeof onboardingStatusOutputSchema>;

/**
 * GUS company data output schema
 */
export const gusCompanyDataOutputSchema = z.object({
  found: z.boolean(),
  companyName: z.string().nullable(),
  nip: z.string().nullable(),
  regon: z.string().nullable(),
  krs: z.string().nullable(),
  street: z.string().nullable(),
  buildingNumber: z.string().nullable(),
  apartmentNumber: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  voivodeship: z.string().nullable(),
  country: z.string().nullable(),
  legalForm: z.string().nullable(),
  pkdMain: z.string().nullable(),
  pkdMainDescription: z.string().nullable(),
  registrationDate: z.string().nullable(),
  isActive: z.boolean().nullable(),
});

export type GusCompanyDataOutput = z.infer<typeof gusCompanyDataOutputSchema>;

/**
 * Profile update result schema
 */
export const profileUpdateResultSchema = z.object({
  success: z.boolean(),
  profile: profileOutputSchema,
  message: z.string().optional(),
});

export type ProfileUpdateResult = z.infer<typeof profileUpdateResultSchema>;

/**
 * Onboarding step completion result schema
 */
export const onboardingStepResultSchema = z.object({
  success: z.boolean(),
  step: onboardingStepSchema,
  completedSteps: z.array(onboardingStepSchema),
  nextStep: onboardingStepSchema.nullable(),
  completionPercentage: z.number().min(0).max(100),
  isComplete: z.boolean(),
});

export type OnboardingStepResult = z.infer<typeof onboardingStepResultSchema>;
