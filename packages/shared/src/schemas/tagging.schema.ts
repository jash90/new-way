import { z } from 'zod';

// ===========================================
// TAGGING SYSTEM ENUMS
// ===========================================

export const selectionModeSchema = z.enum(['SINGLE', 'MULTIPLE']);
export type SelectionMode = z.infer<typeof selectionModeSchema>;

export const tagOperationSchema = z.enum(['ADD', 'REMOVE', 'REPLACE']);
export type TagOperation = z.infer<typeof tagOperationSchema>;

export const tagLogicSchema = z.enum(['AND', 'OR']);
export type TagLogic = z.infer<typeof tagLogicSchema>;

// ===========================================
// VALIDATION HELPERS
// ===========================================

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Nieprawidłowy format koloru (wymagany: #RRGGBB)');

// ===========================================
// TAG CATEGORY INPUT SCHEMAS
// ===========================================

export const createTagCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  selectionMode: selectionModeSchema.default('MULTIPLE'),
  displayOrder: z.number().int().min(0).default(0),
});

export type CreateTagCategoryInput = z.infer<typeof createTagCategorySchema>;

export const updateTagCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  selectionMode: selectionModeSchema.optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateTagCategoryInput = z.infer<typeof updateTagCategorySchema>;

export const getTagCategoriesSchema = z.object({
  includeInactive: z.boolean().default(false),
  includeTags: z.boolean().default(true),
});

export type GetTagCategoriesInput = z.infer<typeof getTagCategoriesSchema>;

export const deleteTagCategorySchema = z.object({
  id: z.string().uuid(),
  reassignToCategory: z.string().uuid().optional(), // Move orphaned tags to another category
});

export type DeleteTagCategoryInput = z.infer<typeof deleteTagCategorySchema>;

// ===========================================
// TAG INPUT SCHEMAS
// ===========================================

export const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  categoryId: z.string().uuid().optional(),
  color: hexColorSchema.default('#3B82F6'),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  displayOrder: z.number().int().min(0).default(0),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  color: hexColorSchema.optional(),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export type UpdateTagInput = z.infer<typeof updateTagSchema>;

export const getTagsSchema = z.object({
  categoryId: z.string().uuid().optional(),
  includeInactive: z.boolean().default(false),
  includeArchived: z.boolean().default(false),
  search: z.string().max(100).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

export type GetTagsInput = z.infer<typeof getTagsSchema>;

export const getTagByIdSchema = z.object({
  id: z.string().uuid(),
  includeClientCount: z.boolean().default(false),
});

export type GetTagByIdInput = z.infer<typeof getTagByIdSchema>;

export const deleteTagSchema = z.object({
  id: z.string().uuid(),
  hardDelete: z.boolean().default(false), // If true, permanently delete; otherwise archive
});

export type DeleteTagInput = z.infer<typeof deleteTagSchema>;

export const archiveTagSchema = z.object({
  id: z.string().uuid(),
});

export type ArchiveTagInput = z.infer<typeof archiveTagSchema>;

export const restoreTagSchema = z.object({
  id: z.string().uuid(),
});

export type RestoreTagInput = z.infer<typeof restoreTagSchema>;

// ===========================================
// CLIENT TAG ASSIGNMENT SCHEMAS
// ===========================================

export const assignTagsSchema = z.object({
  clientId: z.string().uuid(),
  tagIds: z.array(z.string().uuid()).min(1).max(50),
});

export type AssignTagsInput = z.infer<typeof assignTagsSchema>;

export const removeTagsSchema = z.object({
  clientId: z.string().uuid(),
  tagIds: z.array(z.string().uuid()).min(1).max(50),
});

export type RemoveTagsInput = z.infer<typeof removeTagsSchema>;

export const getClientTagsSchema = z.object({
  clientId: z.string().uuid(),
});

export type GetClientTagsInput = z.infer<typeof getClientTagsSchema>;

export const replaceClientTagsSchema = z.object({
  clientId: z.string().uuid(),
  tagIds: z.array(z.string().uuid()).max(100),
});

export type ReplaceClientTagsInput = z.infer<typeof replaceClientTagsSchema>;

// ===========================================
// BULK TAG OPERATIONS SCHEMAS
// ===========================================

export const bulkTagOperationSchema = z.object({
  clientIds: z.array(z.string().uuid()).min(1).max(1000),
  operation: tagOperationSchema,
  tagIds: z.array(z.string().uuid()).min(1).max(50),
  replaceTagId: z.string().uuid().optional(), // Only for REPLACE operation
});

export type BulkTagOperationInput = z.infer<typeof bulkTagOperationSchema>;

// ===========================================
// TAG FILTER SCHEMAS
// ===========================================

export const tagFilterSchema = z.object({
  includeTags: z.array(z.string().uuid()).optional(),
  excludeTags: z.array(z.string().uuid()).optional(),
  tagLogic: tagLogicSchema.default('AND'),
});

export type TagFilterInput = z.infer<typeof tagFilterSchema>;

// ===========================================
// TAG STATISTICS SCHEMAS
// ===========================================

export const getTagStatisticsSchema = z.object({
  tagId: z.string().uuid().optional(), // Specific tag or all tags
  categoryId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export type GetTagStatisticsInput = z.infer<typeof getTagStatisticsSchema>;

// ===========================================
// OUTPUT INTERFACES
// ===========================================

export interface Tag {
  id: string;
  name: string;
  slug: string;
  color: string;
  description: string | null;
  icon: string | null;
  categoryId: string | null;
  categoryName: string | null;
  displayOrder: number;
  isSystem: boolean;
  isActive: boolean;
  isArchived: boolean;
  clientCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TagCategory {
  id: string;
  name: string;
  description: string | null;
  selectionMode: SelectionMode;
  displayOrder: number;
  isActive: boolean;
  tags?: Tag[];
  tagCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientTag {
  tagId: string;
  tagName: string;
  tagColor: string;
  tagSlug: string;
  categoryId: string | null;
  categoryName: string | null;
  assignedAt: Date;
  assignedBy: {
    id: string;
    name: string;
  } | null;
}

export interface TagAssignmentResult {
  success: boolean;
  clientId: string;
  assignedTags: string[];
  skippedTags: string[];
  errors?: { tagId: string; error: string }[];
  message: string;
}

export interface BulkTagResult {
  success: boolean;
  operation: TagOperation;
  processed: number;
  failed: number;
  results: {
    clientId: string;
    success: boolean;
    error?: string;
  }[];
  message: string;
}

export interface TagStatistics {
  tagId: string;
  tagName: string;
  tagColor: string;
  categoryId: string | null;
  categoryName: string | null;
  clientCount: number;
  assignmentsToday: number;
  assignmentsThisWeek: number;
  assignmentsThisMonth: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  topClients?: { clientId: string; clientName: string }[];
}

export interface TagCategoryStatistics {
  categoryId: string;
  categoryName: string;
  tagCount: number;
  totalClientAssignments: number;
  tags: TagStatistics[];
}

export interface TagsOverviewStatistics {
  totalTags: number;
  activeTags: number;
  archivedTags: number;
  totalCategories: number;
  totalAssignments: number;
  topTags: { tagId: string; tagName: string; clientCount: number }[];
  recentActivity: {
    date: string;
    assignments: number;
    removals: number;
  }[];
}
