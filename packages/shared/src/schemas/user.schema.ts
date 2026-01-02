import { z } from 'zod';

/**
 * NIP (Polish Tax ID) validation
 * 10-digit number with checksum validation
 */
export const nipSchema = z
  .string()
  .regex(/^\d{10}$/, 'NIP musi składać się z 10 cyfr')
  .refine((nip) => {
    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    const digits = nip.split('').map(Number);
    const checksum = weights.reduce((sum, weight, i) => sum + weight * digits[i]!, 0) % 11;
    return checksum === digits[9];
  }, 'Nieprawidłowy numer NIP');

/**
 * REGON (Polish Business Registry Number) validation
 * 9 or 14 digits with checksum validation
 */
export const regonSchema = z
  .string()
  .regex(/^(\d{9}|\d{14})$/, 'REGON musi mieć 9 lub 14 cyfr')
  .refine((regon) => {
    const weights9 = [8, 9, 2, 3, 4, 5, 6, 7];
    const weights14 = [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8];

    const digits = regon.split('').map(Number);

    if (regon.length === 9) {
      const checksum = weights9.reduce((sum, weight, i) => sum + weight * digits[i]!, 0) % 11;
      return (checksum % 10) === digits[8];
    } else {
      // For 14-digit REGON, first validate base 9 digits
      const checksum9 = weights9.reduce((sum, weight, i) => sum + weight * digits[i]!, 0) % 11;
      if ((checksum9 % 10) !== digits[8]) return false;

      const checksum14 = weights14.reduce((sum, weight, i) => sum + weight * digits[i]!, 0) % 11;
      return (checksum14 % 10) === digits[13];
    }
  }, 'Nieprawidłowy numer REGON');

/**
 * Polish phone number validation
 */
export const phoneSchema = z
  .string()
  .regex(/^(\+48)?[0-9]{9}$/, 'Nieprawidłowy numer telefonu')
  .transform((phone) => phone.replace(/^\+48/, ''));

/**
 * Polish postal code validation
 */
export const postalCodeSchema = z
  .string()
  .regex(/^\d{2}-\d{3}$/, 'Kod pocztowy musi być w formacie XX-XXX');

/**
 * User profile schema
 */
export const userProfileSchema = z.object({
  firstName: z.string().min(2, 'Imię jest za krótkie').max(50, 'Imię jest za długie'),
  lastName: z.string().min(2, 'Nazwisko jest za krótkie').max(50, 'Nazwisko jest za długie'),
  phone: phoneSchema.optional(),
  companyName: z.string().min(2, 'Nazwa firmy jest za krótka').max(200, 'Nazwa firmy jest za długa').optional(),
  nip: nipSchema.optional(),
  regon: regonSchema.optional(),
  street: z.string().max(200, 'Ulica jest za długa').optional(),
  city: z.string().max(100, 'Nazwa miasta jest za długa').optional(),
  postalCode: postalCodeSchema.optional(),
  country: z.string().default('PL'),
});

export type UserProfileInput = z.infer<typeof userProfileSchema>;

/**
 * User status enum
 */
export const userStatusSchema = z.enum([
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED',
]);

export type UserStatus = z.infer<typeof userStatusSchema>;
