import { z } from 'zod';
import { nipSchema, regonSchema, phoneSchema, postalCodeSchema } from './user.schema';

// ===========================================
// CRM-001: Client Profile Management
// ===========================================

// Enums
export const clientTypeSchema = z.enum(['company', 'individual']);
export const clientStatusSchema = z.enum(['active', 'inactive', 'suspended', 'archived']);

export type ClientType = z.infer<typeof clientTypeSchema>;
export type ClientStatus = z.infer<typeof clientStatusSchema>;

// ===========================================
// INPUT SCHEMAS
// ===========================================

// Create Client
export const createCompanyClientSchema = z.object({
  type: z.literal('company'),
  companyName: z.string().min(2).max(300),
  nip: nipSchema.optional(),
  regon: regonSchema.optional(),
  krs: z.string().length(10).regex(/^\d{10}$/).optional(),
  legalForm: z.string().max(100).optional(),
  pkdCodes: z.array(z.string().max(10)).optional(),
  email: z.string().email().max(255).optional(),
  phone: phoneSchema.optional(),
  website: z.string().url().max(500).optional(),
  street: z.string().max(200).optional(),
  buildingNumber: z.string().max(20).optional(),
  apartmentNumber: z.string().max(20).optional(),
  postalCode: postalCodeSchema.optional(),
  city: z.string().max(100).optional(),
  voivodeship: z.string().max(50).optional(),
  country: z.string().length(2).default('PL'),
  tags: z.array(z.string().max(50)).max(20).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(5000).optional(),
});

export const createIndividualClientSchema = z.object({
  type: z.literal('individual'),
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
  pesel: z.string().length(11).regex(/^\d{11}$/).optional(),
  email: z.string().email().max(255).optional(),
  phone: phoneSchema.optional(),
  street: z.string().max(200).optional(),
  buildingNumber: z.string().max(20).optional(),
  apartmentNumber: z.string().max(20).optional(),
  postalCode: postalCodeSchema.optional(),
  city: z.string().max(100).optional(),
  voivodeship: z.string().max(50).optional(),
  country: z.string().length(2).default('PL'),
  tags: z.array(z.string().max(50)).max(20).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(5000).optional(),
});

export const createClientSchema = z.discriminatedUnion('type', [
  createCompanyClientSchema,
  createIndividualClientSchema,
]);

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type CreateCompanyClientInput = z.infer<typeof createCompanyClientSchema>;
export type CreateIndividualClientInput = z.infer<typeof createIndividualClientSchema>;

// Update Client
export const updateClientSchema = z.object({
  companyName: z.string().min(2).max(300).optional(),
  firstName: z.string().min(2).max(100).optional(),
  lastName: z.string().min(2).max(100).optional(),
  nip: nipSchema.optional(),
  regon: regonSchema.optional(),
  krs: z.string().length(10).regex(/^\d{10}$/).optional(),
  pesel: z.string().length(11).regex(/^\d{11}$/).optional(),
  legalForm: z.string().max(100).optional(),
  pkdCodes: z.array(z.string().max(10)).optional(),
  email: z.string().email().max(255).optional(),
  phone: phoneSchema.optional(),
  website: z.string().url().max(500).optional(),
  street: z.string().max(200).optional(),
  buildingNumber: z.string().max(20).optional(),
  apartmentNumber: z.string().max(20).optional(),
  postalCode: postalCodeSchema.optional(),
  city: z.string().max(100).optional(),
  voivodeship: z.string().max(50).optional(),
  country: z.string().length(2).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(5000).optional(),
  status: clientStatusSchema.optional(),
});

export type UpdateClientInput = z.infer<typeof updateClientSchema>;

// Get Client
export const getClientSchema = z.object({
  clientId: z.string().uuid(),
});

export type GetClientInput = z.infer<typeof getClientSchema>;

// List Clients
export const listClientsQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  type: clientTypeSchema.optional(),
  status: clientStatusSchema.optional(),
  search: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(['displayName', 'createdAt', 'updatedAt', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListClientsQueryInput = z.infer<typeof listClientsQuerySchema>;

// Delete/Archive Client
export const deleteClientSchema = z.object({
  clientId: z.string().uuid(),
  permanent: z.boolean().default(false),
});

export type DeleteClientInput = z.infer<typeof deleteClientSchema>;

// Restore Client
export const restoreClientSchema = z.object({
  clientId: z.string().uuid(),
});

export type RestoreClientInput = z.infer<typeof restoreClientSchema>;

// Search by NIP/REGON
export const searchByNipSchema = z.object({
  nip: nipSchema,
});

export const searchByRegonSchema = z.object({
  regon: regonSchema,
});

export type SearchByNipInput = z.infer<typeof searchByNipSchema>;
export type SearchByRegonInput = z.infer<typeof searchByRegonSchema>;

// Enrich from GUS
export const enrichFromGusSchema = z.object({
  clientId: z.string().uuid(),
  nip: nipSchema.optional(),
  regon: regonSchema.optional(),
}).refine(
  (data) => data.nip || data.regon,
  { message: 'Wymagany NIP lub REGON' }
);

export type EnrichFromGusInput = z.infer<typeof enrichFromGusSchema>;

// ===========================================
// OUTPUT SCHEMAS
// ===========================================

export const clientOutputSchema = z.object({
  id: z.string().uuid(),
  type: clientTypeSchema,
  status: clientStatusSchema,
  displayName: z.string(),
  companyName: z.string().nullable(),
  nip: z.string().nullable(),
  regon: z.string().nullable(),
  krs: z.string().nullable(),
  legalForm: z.string().nullable(),
  pkdCodes: z.array(z.string()),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  pesel: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  street: z.string().nullable(),
  buildingNumber: z.string().nullable(),
  apartmentNumber: z.string().nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  voivodeship: z.string().nullable(),
  country: z.string(),
  gusEnrichedAt: z.date().nullable(),
  gusData: z.unknown().nullable(),
  ownerId: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  tags: z.array(z.string()),
  customFields: z.record(z.string(), z.unknown()),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  archivedAt: z.date().nullable(),
});

export type ClientOutput = z.infer<typeof clientOutputSchema>;

export const paginatedClientsSchema = z.object({
  clients: z.array(clientOutputSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
  hasMore: z.boolean(),
});

export type PaginatedClients = z.infer<typeof paginatedClientsSchema>;

export const clientCreateResultSchema = z.object({
  success: z.boolean(),
  client: clientOutputSchema,
  message: z.string().optional(),
});

export type ClientCreateResult = z.infer<typeof clientCreateResultSchema>;

export const clientUpdateResultSchema = z.object({
  success: z.boolean(),
  client: clientOutputSchema,
  message: z.string().optional(),
});

export type ClientUpdateResult = z.infer<typeof clientUpdateResultSchema>;

export const clientDeleteResultSchema = z.object({
  success: z.boolean(),
  archived: z.boolean(),
  message: z.string(),
});

export type ClientDeleteResult = z.infer<typeof clientDeleteResultSchema>;

export const clientRestoreResultSchema = z.object({
  success: z.boolean(),
  client: clientOutputSchema,
  message: z.string(),
});

export type ClientRestoreResult = z.infer<typeof clientRestoreResultSchema>;

export const gusEnrichResultSchema = z.object({
  success: z.boolean(),
  client: clientOutputSchema,
  enrichedFields: z.array(z.string()),
  message: z.string(),
});

export type GusEnrichResult = z.infer<typeof gusEnrichResultSchema>;

export const clientSearchResultSchema = z.object({
  found: z.boolean(),
  client: clientOutputSchema.nullable(),
  message: z.string().optional(),
});

export type ClientSearchResult = z.infer<typeof clientSearchResultSchema>;
