import { router, protectedProcedure, adminProcedure } from '../../trpc';
import {
  createFieldDefinitionSchema,
  updateFieldDefinitionSchema,
  getFieldDefinitionsSchema,
  archiveFieldDefinitionSchema,
  deleteFieldDefinitionSchema,
  reorderFieldsSchema,
  getEntityValuesSchema,
  setFieldValueSchema,
  bulkSetFieldValueSchema,
  clearFieldValueSchema,
  getOptionUsageSchema,
} from '@ksiegowacrm/shared';
import { CustomFieldsService } from '../../services/crm/customFields.service';
import { AuditLogger } from '../../utils/audit-logger';

/**
 * Custom Fields Router (CRM-006)
 * Handles custom field definitions and values for entities
 */
export const customFieldsRouter = router({
  // =========================================================================
  // GET FIELD DEFINITIONS
  // =========================================================================

  /**
   * Get all field definitions for the organization
   * Supports filtering by entity type, group, and archived status
   */
  getFieldDefinitions: protectedProcedure
    .input(getFieldDefinitionsSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const customFieldsService = new CustomFieldsService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return customFieldsService.getFieldDefinitions(input);
    }),

  // =========================================================================
  // CREATE FIELD DEFINITION (Admin only)
  // =========================================================================

  /**
   * Create a new custom field definition
   * Only administrators can create field definitions
   */
  createFieldDefinition: adminProcedure
    .input(createFieldDefinitionSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const customFieldsService = new CustomFieldsService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return customFieldsService.createFieldDefinition(input);
    }),

  // =========================================================================
  // UPDATE FIELD DEFINITION (Admin only)
  // =========================================================================

  /**
   * Update an existing field definition
   * Only administrators can update field definitions
   * Note: field name and type cannot be changed after creation
   */
  updateFieldDefinition: adminProcedure
    .input(updateFieldDefinitionSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const customFieldsService = new CustomFieldsService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return customFieldsService.updateFieldDefinition(input);
    }),

  // =========================================================================
  // ARCHIVE FIELD DEFINITION (Admin only)
  // =========================================================================

  /**
   * Archive a field definition (soft delete)
   * Preserves existing values but hides field from UI
   */
  archiveFieldDefinition: adminProcedure
    .input(archiveFieldDefinitionSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const customFieldsService = new CustomFieldsService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return customFieldsService.archiveFieldDefinition(input);
    }),

  // =========================================================================
  // DELETE FIELD DEFINITION (Admin only)
  // =========================================================================

  /**
   * Permanently delete a field definition
   * Use force=true to delete even if values exist
   */
  deleteFieldDefinition: adminProcedure
    .input(deleteFieldDefinitionSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const customFieldsService = new CustomFieldsService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return customFieldsService.deleteFieldDefinition(input);
    }),

  // =========================================================================
  // REORDER FIELDS (Admin only)
  // =========================================================================

  /**
   * Update display order for multiple fields
   * Allows administrators to reorder fields in the UI
   */
  reorderFields: adminProcedure
    .input(reorderFieldsSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const customFieldsService = new CustomFieldsService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return customFieldsService.reorderFields(input);
    }),

  // =========================================================================
  // GET ENTITY VALUES
  // =========================================================================

  /**
   * Get all custom field values for a specific entity
   * Returns values grouped by field group
   */
  getEntityValues: protectedProcedure
    .input(getEntityValuesSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const customFieldsService = new CustomFieldsService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return customFieldsService.getEntityValues(input);
    }),

  // =========================================================================
  // SET FIELD VALUE
  // =========================================================================

  /**
   * Set a value for a custom field on an entity
   * Creates or updates the value
   */
  setFieldValue: protectedProcedure
    .input(setFieldValueSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const customFieldsService = new CustomFieldsService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return customFieldsService.setFieldValue(input);
    }),

  // =========================================================================
  // BULK SET FIELD VALUE
  // =========================================================================

  /**
   * Set the same value for a field across multiple entities
   * Maximum 100 entities per request
   */
  bulkSetFieldValue: protectedProcedure
    .input(bulkSetFieldValueSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const customFieldsService = new CustomFieldsService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return customFieldsService.bulkSetFieldValue(input);
    }),

  // =========================================================================
  // CLEAR FIELD VALUE
  // =========================================================================

  /**
   * Clear (remove) a field value from an entity
   * Cannot clear required fields
   */
  clearFieldValue: protectedProcedure
    .input(clearFieldValueSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const customFieldsService = new CustomFieldsService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return customFieldsService.clearFieldValue(input);
    }),

  // =========================================================================
  // GET OPTION USAGE
  // =========================================================================

  /**
   * Get usage statistics for SELECT/MULTISELECT field options
   * Shows how many entities are using each option
   */
  getOptionUsage: protectedProcedure
    .input(getOptionUsageSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const customFieldsService = new CustomFieldsService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return customFieldsService.getOptionUsage(input);
    }),
});

export type CustomFieldsRouter = typeof customFieldsRouter;
