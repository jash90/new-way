import type { PrismaClient, CustomFieldType, FieldVisibility } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';
import type {
  CreateFieldDefinitionInput,
  UpdateFieldDefinitionInput,
  GetFieldDefinitionsInput,
  ArchiveFieldDefinitionInput,
  DeleteFieldDefinitionInput,
  ReorderFieldsInput,
  SetFieldValueInput,
  BulkSetFieldValueInput,
  // BulkSetEntityValuesInput, // Reserved for future bulk entity operations
  GetEntityValuesInput,
  ClearFieldValueInput,
  GetOptionUsageInput,
  FieldDefinitionOutput,
  FieldValueOutput,
  EntityCustomFieldsOutput,
  FieldDefinitionCreateResult,
  FieldDefinitionUpdateResult,
  FieldDefinitionArchiveResult,
  FieldDefinitionDeleteResult,
  FieldValueSetResult,
  BulkSetResult,
  ReorderFieldsResult,
  FieldDefinitionListResult,
  OptionUsageOutput,
  FieldValue,
} from '@ksiegowacrm/shared';
import { TRPCError } from '@trpc/server';

/**
 * CustomFieldsService (CRM-006)
 * Handles custom fields management for flexible entity metadata
 */
export class CustomFieldsService {
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CACHE_PREFIX = 'custom_fields:';

  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private auditLogger: AuditLogger,
    private userId: string,
    private organizationId: string | null
  ) {}

  // ===========================================
  // PRIVATE HELPERS
  // ===========================================

  private getCacheKey(suffix: string): string {
    return `${this.CACHE_PREFIX}${this.organizationId}:${suffix}`;
  }

  private async invalidateCache(entityType: string): Promise<void> {
    const keys = [
      this.getCacheKey(`definitions:${entityType}`),
      this.getCacheKey(`definitions:all`),
    ];
    await Promise.all(keys.map(key => this.redis.del(key)));
  }

  private formatFieldDefinitionOutput(field: any): FieldDefinitionOutput {
    return {
      id: field.id,
      organizationId: field.organizationId,
      name: field.name,
      label: field.label,
      description: field.description,
      fieldType: field.fieldType,
      config: field.config || {},
      isRequired: field.isRequired,
      validationRules: field.validationRules,
      displayOrder: field.displayOrder,
      groupName: field.groupName,
      visibility: field.visibility,
      placeholder: field.placeholder,
      helpText: field.helpText,
      entityType: field.entityType,
      isActive: field.isActive,
      isArchived: field.isArchived,
      archivedAt: field.archivedAt,
      archivedBy: field.archivedBy,
      createdAt: field.createdAt,
      createdBy: field.createdBy,
      updatedAt: field.updatedAt,
      updatedBy: field.updatedBy,
    };
  }

  private extractValue(value: any, fieldType: CustomFieldType): FieldValue {
    switch (fieldType) {
      case 'NUMBER':
      case 'CURRENCY':
        return value.valueNumber !== null ? Number(value.valueNumber) : null;
      case 'DATE':
        return value.valueDate;
      case 'DATETIME':
        return value.valueDatetime;
      case 'CHECKBOX':
        return value.valueBoolean;
      case 'MULTISELECT':
        return value.valueJson as string[];
      case 'TEXT':
      case 'TEXTAREA':
      case 'SELECT':
      case 'EMAIL':
      case 'PHONE':
      case 'URL':
      default:
        return value.valueText;
    }
  }

  private formatDisplayValue(value: any, fieldType: CustomFieldType, config: any): string {
    const rawValue = this.extractValue(value, fieldType);

    if (rawValue === null || rawValue === undefined) {
      return '';
    }

    switch (fieldType) {
      case 'CURRENCY':
        const currency = config?.currency || 'PLN';
        const precision = config?.precision ?? 2;
        return `${Number(rawValue).toFixed(precision)} ${currency}`;

      case 'DATE':
        return rawValue instanceof Date ? (rawValue.toISOString().split('T')[0] ?? '') : String(rawValue);

      case 'DATETIME':
        return rawValue instanceof Date ? rawValue.toISOString() : String(rawValue);

      case 'CHECKBOX':
        return rawValue ? 'Tak' : 'Nie';

      case 'MULTISELECT':
        if (Array.isArray(rawValue) && config?.options) {
          return rawValue
            .map(v => config.options.find((o: any) => o.value === v)?.label || v)
            .join(', ');
        }
        return Array.isArray(rawValue) ? rawValue.join(', ') : String(rawValue);

      case 'SELECT':
        if (config?.options) {
          const option = config.options.find((o: any) => o.value === rawValue);
          return option?.label || String(rawValue);
        }
        return String(rawValue);

      default:
        return String(rawValue);
    }
  }

  private formatFieldValueOutput(value: any): FieldValueOutput {
    const field = value.field;
    return {
      id: value.id,
      fieldId: value.fieldId,
      fieldName: field.name,
      fieldLabel: field.label,
      fieldType: field.fieldType,
      entityType: value.entityType,
      entityId: value.entityId,
      value: this.extractValue(value, field.fieldType),
      displayValue: this.formatDisplayValue(value, field.fieldType, field.config),
      createdAt: value.createdAt,
      createdBy: value.createdBy,
      updatedAt: value.updatedAt,
      updatedBy: value.updatedBy,
    };
  }

  private prepareValueData(value: FieldValue, fieldType: CustomFieldType): any {
    const data: any = {
      valueText: null,
      valueNumber: null,
      valueDate: null,
      valueDatetime: null,
      valueBoolean: null,
      valueJson: null,
    };

    if (value === null || value === undefined) {
      return data;
    }

    switch (fieldType) {
      case 'NUMBER':
      case 'CURRENCY':
        data.valueNumber = typeof value === 'number' ? value : null;
        break;
      case 'DATE':
        data.valueDate = value instanceof Date ? value : (typeof value === 'string' ? new Date(value) : null);
        break;
      case 'DATETIME':
        data.valueDatetime = value instanceof Date ? value : (typeof value === 'string' ? new Date(value) : null);
        break;
      case 'CHECKBOX':
        data.valueBoolean = typeof value === 'boolean' ? value : null;
        break;
      case 'MULTISELECT':
        data.valueJson = Array.isArray(value) ? value : null;
        break;
      case 'TEXT':
      case 'TEXTAREA':
      case 'SELECT':
      case 'EMAIL':
      case 'PHONE':
      case 'URL':
      default:
        data.valueText = typeof value === 'string' ? value : String(value);
        break;
    }

    return data;
  }

  private async validateFieldValue(
    value: FieldValue,
    fieldType: CustomFieldType,
    config: any,
    isRequired: boolean
  ): Promise<void> {
    // Check required
    if (isRequired && (value === null || value === undefined || value === '')) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Pole jest wymagane',
      });
    }

    if (value === null || value === undefined) {
      return;
    }

    // Type-specific validation
    switch (fieldType) {
      case 'EMAIL':
        if (typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Nieprawidłowy format email',
          });
        }
        break;

      case 'URL':
        if (typeof value === 'string') {
          try {
            new URL(value);
          } catch {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Nieprawidłowy format URL',
            });
          }
        }
        break;

      case 'PHONE':
        if (typeof value === 'string' && !/^\+?[0-9\s-]{6,20}$/.test(value)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Nieprawidłowy format numeru telefonu',
          });
        }
        break;

      case 'NUMBER':
      case 'CURRENCY':
        if (typeof value === 'number') {
          if (config?.min !== undefined && value < config.min) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Wartość poza dopuszczalnym zakresem',
            });
          }
          if (config?.max !== undefined && value > config.max) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Wartość poza dopuszczalnym zakresem',
            });
          }
        }
        break;

      case 'TEXT':
      case 'TEXTAREA':
        if (typeof value === 'string' && config?.maxLength && value.length > config.maxLength) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Wartość przekracza maksymalną długość',
          });
        }
        break;

      case 'SELECT':
        if (config?.options && typeof value === 'string') {
          const validValues = config.options.map((o: any) => o.value);
          if (!validValues.includes(value) && !config.allowOther) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Nieprawidłowa wartość opcji',
            });
          }
        }
        break;

      case 'MULTISELECT':
        if (config?.options && Array.isArray(value)) {
          const validValues = config.options.map((o: any) => o.value);
          const invalidValues = value.filter(v => !validValues.includes(v));
          if (invalidValues.length > 0 && !config.allowOther) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Nieprawidłowa wartość opcji',
            });
          }
          if (config.minSelected && value.length < config.minSelected) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Wybierz co najmniej ${config.minSelected} opcji`,
            });
          }
          if (config.maxSelected && value.length > config.maxSelected) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Wybierz maksymalnie ${config.maxSelected} opcji`,
            });
          }
        }
        break;
    }
  }

  // ===========================================
  // FIELD DEFINITION OPERATIONS
  // ===========================================

  async getFieldDefinitions(input: GetFieldDefinitionsInput): Promise<FieldDefinitionListResult> {
    const { entityType, groupName, includeArchived, includeInactive } = input;

    // Try cache first
    const cacheKey = this.getCacheKey(`definitions:${entityType || 'all'}:${includeArchived}:${includeInactive}`);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const where: any = {
      organizationId: this.organizationId ?? undefined,
    };

    if (entityType) {
      where.entityType = entityType;
    }

    if (groupName) {
      where.groupName = groupName;
    }

    if (!includeArchived) {
      where.isArchived = false;
    }

    if (!includeInactive) {
      where.isActive = true;
    }

    const fields = await this.prisma.customFieldDefinition.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const fieldDefinitions = fields.map(f => this.formatFieldDefinitionOutput(f));

    // Group by groupName
    const byGroup: Record<string, FieldDefinitionOutput[]> = {};
    for (const field of fieldDefinitions) {
      const group = field.groupName || 'Uncategorized';
      if (!byGroup[group]) {
        byGroup[group] = [];
      }
      byGroup[group].push(field);
    }

    const result: FieldDefinitionListResult = {
      fieldDefinitions,
      total: fieldDefinitions.length,
      byGroup,
    };

    // Cache result
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', this.CACHE_TTL);

    return result;
  }

  async createFieldDefinition(input: CreateFieldDefinitionInput): Promise<FieldDefinitionCreateResult> {
    // Validate name format
    if (!/^[a-z][a-z0-9_]*$/.test(input.name)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nazwa pola musi zaczynać się od małej litery i zawierać tylko małe litery, cyfry i podkreślenia',
      });
    }

    // Check if name already exists for entity type
    const existing = await this.prisma.customFieldDefinition.findFirst({
      where: {
        organizationId: this.organizationId ?? undefined,
        name: input.name,
        entityType: input.entityType,
      },
    });

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Pole o tej nazwie już istnieje dla tego typu encji',
      });
    }

    const field = await this.prisma.customFieldDefinition.create({
      data: {
        organizationId: this.organizationId!,
        name: input.name,
        label: input.label,
        description: input.description,
        fieldType: input.fieldType as CustomFieldType,
        config: input.config || {},
        isRequired: input.isRequired ?? false,
        validationRules: input.validationRules ? JSON.parse(JSON.stringify(input.validationRules)) : undefined,
        displayOrder: input.displayOrder ?? 0,
        groupName: input.groupName,
        visibility: (input.visibility || 'ALL') as FieldVisibility,
        placeholder: input.placeholder,
        helpText: input.helpText,
        entityType: input.entityType,
        createdBy: this.userId,
      },
    });

    await this.invalidateCache(input.entityType);

    await this.auditLogger.log({
      eventType: 'CUSTOM_FIELD_CREATED' as any,
      actorId: this.userId,
      targetType: 'CustomFieldDefinition',
      targetId: field.id,
      metadata: {
        fieldName: input.name,
        fieldType: input.fieldType,
        entityType: input.entityType,
      },
    });

    return {
      success: true,
      fieldDefinition: this.formatFieldDefinitionOutput(field),
      message: 'Pole niestandardowe utworzone pomyślnie',
    };
  }

  async updateFieldDefinition(input: UpdateFieldDefinitionInput): Promise<FieldDefinitionUpdateResult> {
    const field = await this.prisma.customFieldDefinition.findFirst({
      where: {
        id: input.fieldId,
        organizationId: this.organizationId ?? undefined,
      },
    });

    if (!field) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Definicja pola nie znaleziona',
      });
    }

    const updateData: any = {};
    if (input.label !== undefined) updateData.label = input.label;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.config !== undefined) updateData.config = input.config;
    if (input.isRequired !== undefined) updateData.isRequired = input.isRequired;
    if (input.validationRules !== undefined) updateData.validationRules = input.validationRules;
    if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder;
    if (input.groupName !== undefined) updateData.groupName = input.groupName;
    if (input.visibility !== undefined) updateData.visibility = input.visibility;
    if (input.placeholder !== undefined) updateData.placeholder = input.placeholder;
    if (input.helpText !== undefined) updateData.helpText = input.helpText;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    updateData.updatedBy = this.userId;

    const updatedField = await this.prisma.customFieldDefinition.update({
      where: { id: input.fieldId },
      data: updateData,
    });

    await this.invalidateCache(field.entityType);

    await this.auditLogger.log({
      eventType: 'CUSTOM_FIELD_UPDATED' as any,
      actorId: this.userId,
      targetType: 'CustomFieldDefinition',
      targetId: field.id,
      metadata: {
        fieldName: field.name,
        changes: Object.keys(updateData),
      },
    });

    return {
      success: true,
      fieldDefinition: this.formatFieldDefinitionOutput(updatedField),
      message: 'Pole niestandardowe zaktualizowane pomyślnie',
    };
  }

  async archiveFieldDefinition(input: ArchiveFieldDefinitionInput): Promise<FieldDefinitionArchiveResult> {
    const field = await this.prisma.customFieldDefinition.findFirst({
      where: {
        id: input.fieldId,
        organizationId: this.organizationId ?? undefined,
      },
    });

    if (!field) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Definicja pola nie znaleziona',
      });
    }

    const valuesCount = await this.prisma.customFieldValue.count({
      where: { fieldId: input.fieldId },
    });

    const archivedField = await this.prisma.customFieldDefinition.update({
      where: { id: input.fieldId },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: this.userId,
        updatedBy: this.userId,
      },
    });

    await this.invalidateCache(field.entityType);

    await this.auditLogger.log({
      eventType: 'CUSTOM_FIELD_ARCHIVED' as any,
      actorId: this.userId,
      targetType: 'CustomFieldDefinition',
      targetId: field.id,
      metadata: {
        fieldName: field.name,
        valuesPreserved: valuesCount,
      },
    });

    return {
      success: true,
      fieldDefinition: this.formatFieldDefinitionOutput(archivedField),
      valuesPreserved: valuesCount,
      message: `Pole zarchiwizowane. ${valuesCount} wartości zachowanych.`,
    };
  }

  async deleteFieldDefinition(input: DeleteFieldDefinitionInput): Promise<FieldDefinitionDeleteResult> {
    const field = await this.prisma.customFieldDefinition.findFirst({
      where: {
        id: input.fieldId,
        organizationId: this.organizationId ?? undefined,
      },
    });

    if (!field) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Definicja pola nie znaleziona',
      });
    }

    const valuesCount = await this.prisma.customFieldValue.count({
      where: { fieldId: input.fieldId },
    });

    if (valuesCount > 0 && !input.force) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Pole ma przypisane wartości. Użyj force=true aby usunąć pole wraz z wartościami.',
      });
    }

    let deletedValuesCount = 0;
    if (valuesCount > 0) {
      const deleteResult = await this.prisma.customFieldValue.deleteMany({
        where: { fieldId: input.fieldId },
      });
      deletedValuesCount = deleteResult.count;
    }

    await this.prisma.customFieldDefinition.delete({
      where: { id: input.fieldId },
    });

    await this.invalidateCache(field.entityType);

    await this.auditLogger.log({
      eventType: 'CUSTOM_FIELD_DELETED' as any,
      actorId: this.userId,
      targetType: 'CustomFieldDefinition',
      targetId: field.id,
      metadata: {
        fieldName: field.name,
        deletedValuesCount,
        forced: input.force,
      },
    });

    return {
      success: true,
      deletedValuesCount,
      message: deletedValuesCount > 0
        ? `Pole usunięte wraz z ${deletedValuesCount} wartościami.`
        : 'Pole usunięte pomyślnie.',
    };
  }

  async reorderFields(input: ReorderFieldsInput): Promise<ReorderFieldsResult> {
    const updates = input.fieldOrders.map(order =>
      this.prisma.customFieldDefinition.updateMany({
        where: {
          id: order.fieldId,
          organizationId: this.organizationId ?? undefined,
          entityType: input.entityType,
        },
        data: {
          displayOrder: order.displayOrder,
          updatedBy: this.userId,
        },
      })
    );

    await Promise.all(updates);
    await this.invalidateCache(input.entityType);

    return {
      success: true,
      updatedCount: input.fieldOrders.length,
      message: 'Kolejność pól zaktualizowana.',
    };
  }

  // ===========================================
  // FIELD VALUE OPERATIONS
  // ===========================================

  async getEntityValues(input: GetEntityValuesInput): Promise<EntityCustomFieldsOutput> {
    const values = await this.prisma.customFieldValue.findMany({
      where: {
        entityType: input.entityType,
        entityId: input.entityId,
        organizationId: this.organizationId ?? undefined,
        field: {
          isActive: true,
          isArchived: false,
        },
      },
      include: {
        field: true,
      },
      orderBy: {
        field: {
          displayOrder: 'asc',
        },
      },
    });

    const formattedValues = values.map(v => this.formatFieldValueOutput(v));

    // Group by field group
    const groups: Record<string, FieldValueOutput[]> = {};
    for (let i = 0; i < formattedValues.length; i++) {
      const value = formattedValues[i];
      if (!value) continue; // Skip undefined values
      const originalValue = values[i] as { field?: { groupName?: string | null } };
      const group = originalValue?.field?.groupName || 'Uncategorized';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(value);
    }

    return {
      entityType: input.entityType,
      entityId: input.entityId,
      values: formattedValues,
      groups,
    };
  }

  async setFieldValue(input: SetFieldValueInput): Promise<FieldValueSetResult> {
    const field = await this.prisma.customFieldDefinition.findFirst({
      where: {
        id: input.fieldId,
        organizationId: this.organizationId ?? undefined,
        isActive: true,
        isArchived: false,
      },
    });

    if (!field) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Definicja pola nie znaleziona',
      });
    }

    await this.validateFieldValue(
      input.value,
      field.fieldType,
      field.config,
      field.isRequired
    );

    const valueData = this.prepareValueData(input.value, field.fieldType);

    const value = await this.prisma.customFieldValue.upsert({
      where: {
        fieldId_entityId: {
          fieldId: input.fieldId,
          entityId: input.entityId,
        },
      },
      create: {
        fieldId: input.fieldId,
        entityType: input.entityType,
        entityId: input.entityId,
        organizationId: this.organizationId!,
        ...valueData,
        createdBy: this.userId,
      },
      update: {
        ...valueData,
        updatedBy: this.userId,
      },
      include: {
        field: true,
      },
    });

    return {
      success: true,
      fieldValue: this.formatFieldValueOutput(value),
      message: 'Wartość pola zapisana pomyślnie',
    };
  }

  async bulkSetFieldValue(input: BulkSetFieldValueInput): Promise<BulkSetResult> {
    const field = await this.prisma.customFieldDefinition.findFirst({
      where: {
        id: input.fieldId,
        organizationId: this.organizationId ?? undefined,
        isActive: true,
        isArchived: false,
      },
    });

    if (!field) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Definicja pola nie znaleziona',
      });
    }

    await this.validateFieldValue(
      input.value,
      field.fieldType,
      field.config,
      field.isRequired
    );

    const valueData = this.prepareValueData(input.value, field.fieldType);
    const errors: { entityId: string; error: string }[] = [];
    let updatedCount = 0;

    for (const entityId of input.entityIds) {
      try {
        await this.prisma.customFieldValue.upsert({
          where: {
            fieldId_entityId: {
              fieldId: input.fieldId,
              entityId,
            },
          },
          create: {
            fieldId: input.fieldId,
            entityType: input.entityType,
            entityId,
            organizationId: this.organizationId!,
            ...valueData,
            createdBy: this.userId,
          },
          update: {
            ...valueData,
            updatedBy: this.userId,
          },
        });
        updatedCount++;
      } catch (error: any) {
        errors.push({
          entityId,
          error: error.message || 'Unknown error',
        });
      }
    }

    return {
      success: errors.length === 0,
      updatedCount,
      failedCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      message: errors.length === 0
        ? `Zaktualizowano ${updatedCount} wartości`
        : `Zaktualizowano ${updatedCount} wartości, ${errors.length} błędów`,
    };
  }

  async clearFieldValue(input: ClearFieldValueInput): Promise<{ success: boolean; message: string }> {
    const field = await this.prisma.customFieldDefinition.findFirst({
      where: {
        id: input.fieldId,
        organizationId: this.organizationId ?? undefined,
      },
    });

    if (!field) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Definicja pola nie znaleziona',
      });
    }

    if (field.isRequired) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nie można wyczyścić wartości wymaganego pola',
      });
    }

    const existing = await this.prisma.customFieldValue.findFirst({
      where: {
        fieldId: input.fieldId,
        entityId: input.entityId,
        organizationId: this.organizationId ?? undefined,
      },
    });

    if (existing) {
      await this.prisma.customFieldValue.delete({
        where: { id: existing.id },
      });
    }

    return {
      success: true,
      message: 'Wartość pola wyczyszczona',
    };
  }

  async getOptionUsage(input: GetOptionUsageInput): Promise<OptionUsageOutput> {
    const field = await this.prisma.customFieldDefinition.findFirst({
      where: {
        id: input.fieldId,
        organizationId: this.organizationId ?? undefined,
      },
    });

    if (!field) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Definicja pola nie znaleziona',
      });
    }

    if (field.fieldType !== 'SELECT' && field.fieldType !== 'MULTISELECT') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Pole nie jest typu SELECT lub MULTISELECT',
      });
    }

    const values = await this.prisma.customFieldValue.findMany({
      where: { fieldId: input.fieldId },
    });

    const config = field.config as any;
    const options = config?.options || [];
    const usageCounts: Record<string, number> = {};

    // Initialize counts
    for (const option of options) {
      usageCounts[option.value] = 0;
    }

    // Count usage
    for (const value of values) {
      if (field.fieldType === 'SELECT' && value.valueText) {
        usageCounts[value.valueText] = (usageCounts[value.valueText] || 0) + 1;
      } else if (field.fieldType === 'MULTISELECT' && value.valueJson) {
        const selected = value.valueJson as string[];
        for (const v of selected) {
          usageCounts[v] = (usageCounts[v] || 0) + 1;
        }
      }
    }

    const totalUsage = values.length;
    const optionStats = options.map((option: any) => ({
      value: option.value,
      label: option.label,
      usageCount: usageCounts[option.value] || 0,
      percentage: totalUsage > 0 ? (usageCounts[option.value] || 0) / totalUsage * 100 : 0,
    }));

    return {
      fieldId: input.fieldId,
      fieldName: field.name,
      options: optionStats,
      totalUsage,
    };
  }
}
