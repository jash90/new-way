import { z } from 'zod';
import { phoneSchema } from './user.schema';

// ===========================================
// CRM-004: Contact Management
// ===========================================

// Enums
export const contactTypeSchema = z.enum(['primary', 'billing', 'technical', 'legal', 'other']);
export const contactStatusSchema = z.enum(['active', 'inactive', 'archived']);

export type ContactType = z.infer<typeof contactTypeSchema>;
export type ContactStatus = z.infer<typeof contactStatusSchema>;

// ===========================================
// INPUT SCHEMAS
// ===========================================

// Create Contact
export const createContactSchema = z.object({
  clientId: z.string().uuid(),
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
  email: z.string().email().max(255).optional(),
  phone: phoneSchema.optional(),
  mobilePhone: phoneSchema.optional(),
  position: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  contactType: contactTypeSchema.default('other'),
  isPrimary: z.boolean().default(false),
  notes: z.string().max(2000).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;

// Update Contact
export const updateContactSchema = z.object({
  firstName: z.string().min(2).max(100).optional(),
  lastName: z.string().min(2).max(100).optional(),
  email: z.string().email().max(255).optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  mobilePhone: phoneSchema.optional().nullable(),
  position: z.string().max(100).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  contactType: contactTypeSchema.optional(),
  isPrimary: z.boolean().optional(),
  status: contactStatusSchema.optional(),
  notes: z.string().max(2000).optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateContactInput = z.infer<typeof updateContactSchema>;

// Get Contact
export const getContactSchema = z.object({
  contactId: z.string().uuid(),
});

export type GetContactInput = z.infer<typeof getContactSchema>;

// List Contacts for Client
export const listContactsSchema = z.object({
  clientId: z.string().uuid(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  contactType: contactTypeSchema.optional(),
  status: contactStatusSchema.optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['fullName', 'createdAt', 'updatedAt', 'contactType']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListContactsInput = z.infer<typeof listContactsSchema>;

// Delete Contact
export const deleteContactSchema = z.object({
  contactId: z.string().uuid(),
  permanent: z.boolean().default(false),
});

export type DeleteContactInput = z.infer<typeof deleteContactSchema>;

// Restore Contact
export const restoreContactSchema = z.object({
  contactId: z.string().uuid(),
});

export type RestoreContactInput = z.infer<typeof restoreContactSchema>;

// Set Primary Contact
export const setPrimaryContactSchema = z.object({
  contactId: z.string().uuid(),
  contactType: contactTypeSchema.optional(),
});

export type SetPrimaryContactInput = z.infer<typeof setPrimaryContactSchema>;

// Bulk Create Contacts
export const bulkCreateContactsSchema = z.object({
  clientId: z.string().uuid(),
  contacts: z.array(createContactSchema.omit({ clientId: true })).min(1).max(50),
});

export type BulkCreateContactsInput = z.infer<typeof bulkCreateContactsSchema>;

// Search Contacts
export const searchContactsSchema = z.object({
  query: z.string().min(2).max(100),
  clientId: z.string().uuid().optional(),
  contactType: contactTypeSchema.optional(),
  limit: z.number().int().positive().max(50).default(10),
});

export type SearchContactsInput = z.infer<typeof searchContactsSchema>;

// ===========================================
// OUTPUT SCHEMAS
// ===========================================

export const contactOutputSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  mobilePhone: z.string().nullable(),
  position: z.string().nullable(),
  department: z.string().nullable(),
  contactType: contactTypeSchema,
  isPrimary: z.boolean(),
  status: contactStatusSchema,
  notes: z.string().nullable(),
  customFields: z.record(z.string(), z.unknown()),
  createdAt: z.date(),
  updatedAt: z.date(),
  archivedAt: z.date().nullable(),
});

export type ContactOutput = z.infer<typeof contactOutputSchema>;

export const paginatedContactsSchema = z.object({
  contacts: z.array(contactOutputSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
  hasMore: z.boolean(),
});

export type PaginatedContacts = z.infer<typeof paginatedContactsSchema>;

export const contactCreateResultSchema = z.object({
  success: z.boolean(),
  contact: contactOutputSchema,
  message: z.string().optional(),
});

export type ContactCreateResult = z.infer<typeof contactCreateResultSchema>;

export const contactUpdateResultSchema = z.object({
  success: z.boolean(),
  contact: contactOutputSchema,
  message: z.string().optional(),
});

export type ContactUpdateResult = z.infer<typeof contactUpdateResultSchema>;

export const contactDeleteResultSchema = z.object({
  success: z.boolean(),
  archived: z.boolean(),
  message: z.string(),
});

export type ContactDeleteResult = z.infer<typeof contactDeleteResultSchema>;

export const contactRestoreResultSchema = z.object({
  success: z.boolean(),
  contact: contactOutputSchema,
  message: z.string(),
});

export type ContactRestoreResult = z.infer<typeof contactRestoreResultSchema>;

export const bulkCreateContactsResultSchema = z.object({
  success: z.boolean(),
  created: z.number(),
  failed: z.number(),
  contacts: z.array(contactOutputSchema),
  errors: z.array(z.object({
    index: z.number(),
    error: z.string(),
  })).optional(),
  message: z.string(),
});

export type BulkCreateContactsResult = z.infer<typeof bulkCreateContactsResultSchema>;

export const contactSearchResultSchema = z.object({
  contacts: z.array(contactOutputSchema),
  total: z.number(),
});

export type ContactSearchResult = z.infer<typeof contactSearchResultSchema>;

export const setPrimaryContactResultSchema = z.object({
  success: z.boolean(),
  contact: contactOutputSchema,
  previousPrimary: contactOutputSchema.nullable(),
  message: z.string(),
});

export type SetPrimaryContactResult = z.infer<typeof setPrimaryContactResultSchema>;
