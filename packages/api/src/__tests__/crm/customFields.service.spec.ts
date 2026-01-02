import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CustomFieldsService } from '../../services/crm/customFields.service';
import type { PrismaClient, CustomFieldType, FieldVisibility } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';
import type {
  CreateFieldDefinitionInput,
  UpdateFieldDefinitionInput,
  GetFieldDefinitionsInput,
  SetFieldValueInput,
  BulkSetFieldValueInput,
  ReorderFieldsInput,
} from '@ksiegowacrm/shared';

// ===========================================
// CRM-006: Custom Fields System Service Tests
// ===========================================

describe('CustomFieldsService', () => {
  let customFieldsService: CustomFieldsService;
  let mockPrisma: {
    customFieldDefinition: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    customFieldValue: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let mockRedis: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
  };
  let mockAuditLogger: {
    log: ReturnType<typeof vi.fn>;
  };

  const USER_ID = 'user-123-uuid';
  const ORG_ID = 'org-456-uuid';
  const FIELD_ID = 'field-001-uuid';
  const CLIENT_ID = 'client-789-uuid';
  const VALUE_ID = 'value-001-uuid';

  const mockFieldDefinition = {
    id: FIELD_ID,
    organizationId: ORG_ID,
    name: 'custom_tax_id',
    label: 'Custom Tax ID',
    description: 'Additional tax identification number',
    fieldType: 'TEXT' as CustomFieldType,
    config: { maxLength: 50 },
    isRequired: false,
    validationRules: null,
    displayOrder: 0,
    groupName: 'Financial',
    visibility: 'ALL' as FieldVisibility,
    placeholder: 'Enter tax ID',
    helpText: 'Enter the custom tax identification number',
    entityType: 'CLIENT',
    isActive: true,
    isArchived: false,
    archivedAt: null,
    archivedBy: null,
    createdAt: new Date('2025-01-01'),
    createdBy: USER_ID,
    updatedAt: new Date('2025-01-01'),
    updatedBy: null,
  };

  const mockFieldValue = {
    id: VALUE_ID,
    fieldId: FIELD_ID,
    entityType: 'CLIENT',
    entityId: CLIENT_ID,
    organizationId: ORG_ID,
    valueText: 'TAX-12345',
    valueNumber: null,
    valueDate: null,
    valueDatetime: null,
    valueBoolean: null,
    valueJson: null,
    createdAt: new Date('2025-01-01'),
    createdBy: USER_ID,
    updatedAt: new Date('2025-01-01'),
    updatedBy: null,
    field: mockFieldDefinition,
  };

  beforeEach(() => {
    mockPrisma = {
      customFieldDefinition: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      customFieldValue: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(mockPrisma)),
    };

    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    };

    mockAuditLogger = {
      log: vi.fn(),
    };

    customFieldsService = new CustomFieldsService(
      mockPrisma as unknown as PrismaClient,
      mockRedis as unknown as Redis,
      mockAuditLogger as unknown as AuditLogger,
      USER_ID,
      ORG_ID
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================
  // FIELD DEFINITION TESTS
  // ===========================================

  describe('getFieldDefinitions', () => {
    it('should return all active field definitions for organization', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findMany).mockResolvedValue([mockFieldDefinition]);

      const result = await customFieldsService.getFieldDefinitions({
        entityType: 'CLIENT',
      });

      expect(result.fieldDefinitions).toHaveLength(1);
      expect(result.fieldDefinitions[0].name).toBe('custom_tax_id');
      expect(mockPrisma.customFieldDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: ORG_ID,
            isActive: true,
            isArchived: false,
          }),
        })
      );
    });

    it('should include archived fields when requested', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findMany).mockResolvedValue([
        mockFieldDefinition,
        { ...mockFieldDefinition, id: 'field-002', isArchived: true },
      ]);

      const result = await customFieldsService.getFieldDefinitions({
        entityType: 'CLIENT',
        includeArchived: true,
      });

      expect(result.fieldDefinitions).toHaveLength(2);
    });

    it('should filter by entity type', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findMany).mockResolvedValue([mockFieldDefinition]);

      await customFieldsService.getFieldDefinitions({ entityType: 'CONTACT' });

      expect(mockPrisma.customFieldDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: 'CONTACT',
          }),
        })
      );
    });

    it('should group fields by groupName', async () => {
      const field2 = { ...mockFieldDefinition, id: 'field-002', name: 'field_2', groupName: 'Financial' };
      const field3 = { ...mockFieldDefinition, id: 'field-003', name: 'field_3', groupName: 'Contact' };
      vi.mocked(mockPrisma.customFieldDefinition.findMany).mockResolvedValue([
        mockFieldDefinition,
        field2,
        field3,
      ]);

      const result = await customFieldsService.getFieldDefinitions({ entityType: 'CLIENT' });

      expect(result.byGroup['Financial']).toHaveLength(2);
      expect(result.byGroup['Contact']).toHaveLength(1);
    });
  });

  describe('createFieldDefinition', () => {
    const createInput: CreateFieldDefinitionInput = {
      name: 'custom_tax_id',
      label: 'Custom Tax ID',
      description: 'Additional tax identification number',
      fieldType: 'TEXT',
      config: { maxLength: 50 },
      isRequired: false,
      displayOrder: 0,
      groupName: 'Financial',
      visibility: 'ALL',
      placeholder: 'Enter tax ID',
      helpText: 'Enter the custom tax identification number',
      entityType: 'CLIENT',
    };

    it('should create a field definition successfully', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.customFieldDefinition.create).mockResolvedValue(mockFieldDefinition);

      const result = await customFieldsService.createFieldDefinition(createInput);

      expect(result.success).toBe(true);
      expect(result.fieldDefinition.name).toBe('custom_tax_id');
      expect(mockPrisma.customFieldDefinition.create).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should throw error when field name already exists for entity type', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(mockFieldDefinition);

      await expect(customFieldsService.createFieldDefinition(createInput)).rejects.toThrow(
        'Pole o tej nazwie już istnieje dla tego typu encji'
      );
    });

    it('should validate field name format', async () => {
      const invalidInput = { ...createInput, name: 'Invalid Name!' };

      await expect(customFieldsService.createFieldDefinition(invalidInput)).rejects.toThrow();
    });

    it('should create SELECT field with options config', async () => {
      const selectInput: CreateFieldDefinitionInput = {
        ...createInput,
        name: 'priority_level',
        fieldType: 'SELECT',
        config: {
          options: [
            { value: 'low', label: 'Low', color: '#00FF00' },
            { value: 'medium', label: 'Medium', color: '#FFFF00' },
            { value: 'high', label: 'High', color: '#FF0000' },
          ],
        },
      };

      const mockSelectField = {
        ...mockFieldDefinition,
        name: 'priority_level',
        fieldType: 'SELECT',
        config: selectInput.config,
      };

      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.customFieldDefinition.create).mockResolvedValue(mockSelectField);

      const result = await customFieldsService.createFieldDefinition(selectInput);

      expect(result.success).toBe(true);
      expect(result.fieldDefinition.fieldType).toBe('SELECT');
    });
  });

  describe('updateFieldDefinition', () => {
    const updateInput: UpdateFieldDefinitionInput = {
      fieldId: FIELD_ID,
      label: 'Updated Tax ID Label',
      helpText: 'Updated help text',
    };

    it('should update field definition successfully', async () => {
      const updatedField = {
        ...mockFieldDefinition,
        label: 'Updated Tax ID Label',
        helpText: 'Updated help text',
      };
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(mockFieldDefinition);
      vi.mocked(mockPrisma.customFieldDefinition.update).mockResolvedValue(updatedField);

      const result = await customFieldsService.updateFieldDefinition(updateInput);

      expect(result.success).toBe(true);
      expect(result.fieldDefinition.label).toBe('Updated Tax ID Label');
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should throw error when field not found', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(null);

      await expect(customFieldsService.updateFieldDefinition(updateInput)).rejects.toThrow(
        'Definicja pola nie znaleziona'
      );
    });

    it('should not allow changing field type', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(mockFieldDefinition);
      vi.mocked(mockPrisma.customFieldDefinition.update).mockResolvedValue(mockFieldDefinition);

      // fieldType is not in UpdateFieldDefinitionInput, so this tests that the service doesn't change it
      const result = await customFieldsService.updateFieldDefinition(updateInput);

      expect(result.fieldDefinition.fieldType).toBe('TEXT');
    });
  });

  describe('archiveFieldDefinition', () => {
    it('should archive field definition and preserve values', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(mockFieldDefinition);
      vi.mocked(mockPrisma.customFieldValue.count).mockResolvedValue(5);
      vi.mocked(mockPrisma.customFieldDefinition.update).mockResolvedValue({
        ...mockFieldDefinition,
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: USER_ID,
      });

      const result = await customFieldsService.archiveFieldDefinition({ fieldId: FIELD_ID });

      expect(result.success).toBe(true);
      expect(result.valuesPreserved).toBe(5);
      expect(result.fieldDefinition.isArchived).toBe(true);
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should throw error when field not found', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(null);

      await expect(
        customFieldsService.archiveFieldDefinition({ fieldId: FIELD_ID })
      ).rejects.toThrow('Definicja pola nie znaleziona');
    });
  });

  describe('deleteFieldDefinition', () => {
    it('should delete field definition without values', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(mockFieldDefinition);
      vi.mocked(mockPrisma.customFieldValue.count).mockResolvedValue(0);
      vi.mocked(mockPrisma.customFieldDefinition.delete).mockResolvedValue(mockFieldDefinition);

      const result = await customFieldsService.deleteFieldDefinition({
        fieldId: FIELD_ID,
        force: false,
      });

      expect(result.success).toBe(true);
      expect(result.deletedValuesCount).toBe(0);
    });

    it('should throw error when trying to delete field with values without force', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(mockFieldDefinition);
      vi.mocked(mockPrisma.customFieldValue.count).mockResolvedValue(10);

      await expect(
        customFieldsService.deleteFieldDefinition({ fieldId: FIELD_ID, force: false })
      ).rejects.toThrow('Pole ma przypisane wartości');
    });

    it('should force delete field with values', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(mockFieldDefinition);
      vi.mocked(mockPrisma.customFieldValue.count).mockResolvedValue(10);
      vi.mocked(mockPrisma.customFieldValue.deleteMany).mockResolvedValue({ count: 10 });
      vi.mocked(mockPrisma.customFieldDefinition.delete).mockResolvedValue(mockFieldDefinition);

      const result = await customFieldsService.deleteFieldDefinition({
        fieldId: FIELD_ID,
        force: true,
      });

      expect(result.success).toBe(true);
      expect(result.deletedValuesCount).toBe(10);
    });
  });

  describe('reorderFields', () => {
    const reorderInput: ReorderFieldsInput = {
      entityType: 'CLIENT',
      fieldOrders: [
        { fieldId: 'field-001', displayOrder: 0 },
        { fieldId: 'field-002', displayOrder: 1 },
        { fieldId: 'field-003', displayOrder: 2 },
      ],
    };

    it('should reorder fields successfully', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.updateMany).mockResolvedValue({ count: 1 });

      const result = await customFieldsService.reorderFields(reorderInput);

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(3);
    });
  });

  // ===========================================
  // FIELD VALUE TESTS
  // ===========================================

  describe('getEntityValues', () => {
    it('should return all values for an entity', async () => {
      vi.mocked(mockPrisma.customFieldValue.findMany).mockResolvedValue([mockFieldValue]);

      const result = await customFieldsService.getEntityValues({
        entityType: 'CLIENT',
        entityId: CLIENT_ID,
      });

      expect(result.entityId).toBe(CLIENT_ID);
      expect(result.values).toHaveLength(1);
      expect(result.values[0].value).toBe('TAX-12345');
    });

    it('should format values correctly by field type', async () => {
      const numberFieldValue = {
        ...mockFieldValue,
        field: { ...mockFieldDefinition, fieldType: 'NUMBER' as CustomFieldType },
        valueText: null,
        valueNumber: 12345,
      };
      vi.mocked(mockPrisma.customFieldValue.findMany).mockResolvedValue([numberFieldValue]);

      const result = await customFieldsService.getEntityValues({
        entityType: 'CLIENT',
        entityId: CLIENT_ID,
      });

      expect(result.values[0].value).toBe(12345);
    });

    it('should group values by field group', async () => {
      const field2 = { ...mockFieldDefinition, groupName: 'Contact' };
      const value2 = { ...mockFieldValue, id: 'value-002', field: field2 };
      vi.mocked(mockPrisma.customFieldValue.findMany).mockResolvedValue([
        mockFieldValue,
        value2,
      ]);

      const result = await customFieldsService.getEntityValues({
        entityType: 'CLIENT',
        entityId: CLIENT_ID,
      });

      expect(result.groups['Financial']).toHaveLength(1);
      expect(result.groups['Contact']).toHaveLength(1);
    });
  });

  describe('setFieldValue', () => {
    const setValueInput: SetFieldValueInput = {
      fieldId: FIELD_ID,
      entityType: 'CLIENT',
      entityId: CLIENT_ID,
      value: 'TAX-12345',
    };

    it('should set field value successfully', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(mockFieldDefinition);
      vi.mocked(mockPrisma.customFieldValue.upsert).mockResolvedValue(mockFieldValue);

      const result = await customFieldsService.setFieldValue(setValueInput);

      expect(result.success).toBe(true);
      expect(result.fieldValue.value).toBe('TAX-12345');
    });

    it('should throw error when field not found', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(null);

      await expect(customFieldsService.setFieldValue(setValueInput)).rejects.toThrow(
        'Definicja pola nie znaleziona'
      );
    });

    it('should validate required field', async () => {
      const requiredField = { ...mockFieldDefinition, isRequired: true };
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(requiredField);

      const emptyValueInput = { ...setValueInput, value: null };

      await expect(customFieldsService.setFieldValue(emptyValueInput)).rejects.toThrow(
        'Pole jest wymagane'
      );
    });

    it('should store NUMBER value correctly', async () => {
      const numberField = { ...mockFieldDefinition, fieldType: 'NUMBER' as CustomFieldType };
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(numberField);
      vi.mocked(mockPrisma.customFieldValue.upsert).mockResolvedValue({
        ...mockFieldValue,
        valueText: null,
        valueNumber: 42,
        field: numberField,
      });

      const numberInput = { ...setValueInput, value: 42 };
      const result = await customFieldsService.setFieldValue(numberInput);

      expect(result.fieldValue.value).toBe(42);
    });

    it('should store DATE value correctly', async () => {
      const dateField = { ...mockFieldDefinition, fieldType: 'DATE' as CustomFieldType };
      const testDate = new Date('2025-06-15');
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(dateField);
      vi.mocked(mockPrisma.customFieldValue.upsert).mockResolvedValue({
        ...mockFieldValue,
        valueText: null,
        valueDate: testDate,
        field: dateField,
      });

      const dateInput = { ...setValueInput, value: testDate };
      const result = await customFieldsService.setFieldValue(dateInput);

      expect(result.fieldValue.value).toEqual(testDate);
    });

    it('should store CHECKBOX value correctly', async () => {
      const checkboxField = { ...mockFieldDefinition, fieldType: 'CHECKBOX' as CustomFieldType };
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(checkboxField);
      vi.mocked(mockPrisma.customFieldValue.upsert).mockResolvedValue({
        ...mockFieldValue,
        valueText: null,
        valueBoolean: true,
        field: checkboxField,
      });

      const boolInput = { ...setValueInput, value: true };
      const result = await customFieldsService.setFieldValue(boolInput);

      expect(result.fieldValue.value).toBe(true);
    });

    it('should store MULTISELECT value correctly', async () => {
      const multiselectField = { ...mockFieldDefinition, fieldType: 'MULTISELECT' as CustomFieldType };
      const multiValue = ['option1', 'option2'];
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(multiselectField);
      vi.mocked(mockPrisma.customFieldValue.upsert).mockResolvedValue({
        ...mockFieldValue,
        valueText: null,
        valueJson: multiValue,
        field: multiselectField,
      });

      const multiInput = { ...setValueInput, value: multiValue };
      const result = await customFieldsService.setFieldValue(multiInput);

      expect(result.fieldValue.value).toEqual(multiValue);
    });

    it('should validate EMAIL format', async () => {
      const emailField = { ...mockFieldDefinition, fieldType: 'EMAIL' as CustomFieldType };
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(emailField);

      const invalidEmailInput = { ...setValueInput, value: 'not-an-email' };

      await expect(customFieldsService.setFieldValue(invalidEmailInput)).rejects.toThrow(
        'Nieprawidłowy format email'
      );
    });

    it('should validate URL format', async () => {
      const urlField = { ...mockFieldDefinition, fieldType: 'URL' as CustomFieldType };
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(urlField);

      const invalidUrlInput = { ...setValueInput, value: 'not-a-url' };

      await expect(customFieldsService.setFieldValue(invalidUrlInput)).rejects.toThrow(
        'Nieprawidłowy format URL'
      );
    });

    it('should validate PHONE format', async () => {
      const phoneField = { ...mockFieldDefinition, fieldType: 'PHONE' as CustomFieldType };
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(phoneField);

      const validPhoneInput = { ...setValueInput, value: '+48123456789' };
      vi.mocked(mockPrisma.customFieldValue.upsert).mockResolvedValue({
        ...mockFieldValue,
        valueText: '+48123456789',
        field: phoneField,
      });

      const result = await customFieldsService.setFieldValue(validPhoneInput);
      expect(result.success).toBe(true);
    });

    it('should validate SELECT option exists', async () => {
      const selectField = {
        ...mockFieldDefinition,
        fieldType: 'SELECT' as CustomFieldType,
        config: {
          options: [
            { value: 'option1', label: 'Option 1' },
            { value: 'option2', label: 'Option 2' },
          ],
        },
      };
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(selectField);

      const invalidOptionInput = { ...setValueInput, value: 'invalid_option' };

      await expect(customFieldsService.setFieldValue(invalidOptionInput)).rejects.toThrow(
        'Nieprawidłowa wartość opcji'
      );
    });

    it('should validate NUMBER min/max constraints', async () => {
      const numberField = {
        ...mockFieldDefinition,
        fieldType: 'NUMBER' as CustomFieldType,
        config: { min: 0, max: 100 },
      };
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(numberField);

      const outOfRangeInput = { ...setValueInput, value: 150 };

      await expect(customFieldsService.setFieldValue(outOfRangeInput)).rejects.toThrow(
        'Wartość poza dopuszczalnym zakresem'
      );
    });

    it('should validate TEXT maxLength constraint', async () => {
      const textField = {
        ...mockFieldDefinition,
        fieldType: 'TEXT' as CustomFieldType,
        config: { maxLength: 10 },
      };
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(textField);

      const tooLongInput = { ...setValueInput, value: 'This is way too long for the field' };

      await expect(customFieldsService.setFieldValue(tooLongInput)).rejects.toThrow(
        'Wartość przekracza maksymalną długość'
      );
    });
  });

  describe('bulkSetFieldValue', () => {
    const bulkInput: BulkSetFieldValueInput = {
      fieldId: FIELD_ID,
      entityType: 'CLIENT',
      entityIds: [CLIENT_ID, 'client-002', 'client-003'],
      value: 'BULK-VALUE',
    };

    it('should set field value for multiple entities', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(mockFieldDefinition);
      vi.mocked(mockPrisma.customFieldValue.upsert).mockResolvedValue(mockFieldValue);

      const result = await customFieldsService.bulkSetFieldValue(bulkInput);

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(3);
      expect(mockPrisma.customFieldValue.upsert).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(mockFieldDefinition);
      vi.mocked(mockPrisma.customFieldValue.upsert)
        .mockResolvedValueOnce(mockFieldValue)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce(mockFieldValue);

      const result = await customFieldsService.bulkSetFieldValue(bulkInput);

      expect(result.updatedCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('clearFieldValue', () => {
    it('should clear optional field value', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(mockFieldDefinition);
      vi.mocked(mockPrisma.customFieldValue.findFirst).mockResolvedValue(mockFieldValue);
      vi.mocked(mockPrisma.customFieldValue.delete).mockResolvedValue(mockFieldValue);

      const result = await customFieldsService.clearFieldValue({
        fieldId: FIELD_ID,
        entityId: CLIENT_ID,
      });

      expect(result.success).toBe(true);
    });

    it('should throw error when trying to clear required field', async () => {
      const requiredField = { ...mockFieldDefinition, isRequired: true };
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(requiredField);

      await expect(
        customFieldsService.clearFieldValue({
          fieldId: FIELD_ID,
          entityId: CLIENT_ID,
        })
      ).rejects.toThrow('Nie można wyczyścić wartości wymaganego pola');
    });
  });

  describe('getOptionUsage', () => {
    it('should return usage statistics for SELECT field options', async () => {
      const selectField = {
        ...mockFieldDefinition,
        fieldType: 'SELECT' as CustomFieldType,
        config: {
          options: [
            { value: 'option1', label: 'Option 1' },
            { value: 'option2', label: 'Option 2' },
          ],
        },
      };
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(selectField);
      vi.mocked(mockPrisma.customFieldValue.findMany).mockResolvedValue([
        { ...mockFieldValue, valueText: 'option1' },
        { ...mockFieldValue, id: 'value-002', valueText: 'option1' },
        { ...mockFieldValue, id: 'value-003', valueText: 'option2' },
      ]);

      const result = await customFieldsService.getOptionUsage({ fieldId: FIELD_ID });

      expect(result.totalUsage).toBe(3);
      expect(result.options).toHaveLength(2);
      expect(result.options.find(o => o.value === 'option1')?.usageCount).toBe(2);
    });

    it('should throw error for non-SELECT field', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(mockFieldDefinition);

      await expect(
        customFieldsService.getOptionUsage({ fieldId: FIELD_ID })
      ).rejects.toThrow('Pole nie jest typu SELECT lub MULTISELECT');
    });
  });

  // ===========================================
  // DISPLAY VALUE FORMATTING TESTS
  // ===========================================

  describe('formatDisplayValue', () => {
    it('should format CURRENCY value with currency symbol', async () => {
      const currencyField = {
        ...mockFieldDefinition,
        fieldType: 'CURRENCY' as CustomFieldType,
        config: { currency: 'PLN', precision: 2 },
      };
      const currencyValue = {
        ...mockFieldValue,
        valueNumber: 1234.56,
        field: currencyField,
      };
      vi.mocked(mockPrisma.customFieldValue.findMany).mockResolvedValue([currencyValue]);

      const result = await customFieldsService.getEntityValues({
        entityType: 'CLIENT',
        entityId: CLIENT_ID,
      });

      expect(result.values[0].displayValue).toContain('1234.56');
    });

    it('should format DATE value', async () => {
      const dateField = {
        ...mockFieldDefinition,
        fieldType: 'DATE' as CustomFieldType,
      };
      const dateValue = {
        ...mockFieldValue,
        valueDate: new Date('2025-06-15'),
        valueText: null,
        field: dateField,
      };
      vi.mocked(mockPrisma.customFieldValue.findMany).mockResolvedValue([dateValue]);

      const result = await customFieldsService.getEntityValues({
        entityType: 'CLIENT',
        entityId: CLIENT_ID,
      });

      expect(result.values[0].displayValue).toContain('2025');
    });

    it('should format CHECKBOX value as Tak/Nie', async () => {
      const checkboxField = {
        ...mockFieldDefinition,
        fieldType: 'CHECKBOX' as CustomFieldType,
      };
      const checkboxValue = {
        ...mockFieldValue,
        valueBoolean: true,
        valueText: null,
        field: checkboxField,
      };
      vi.mocked(mockPrisma.customFieldValue.findMany).mockResolvedValue([checkboxValue]);

      const result = await customFieldsService.getEntityValues({
        entityType: 'CLIENT',
        entityId: CLIENT_ID,
      });

      expect(result.values[0].displayValue).toBe('Tak');
    });

    it('should format SELECT value with label', async () => {
      const selectField = {
        ...mockFieldDefinition,
        fieldType: 'SELECT' as CustomFieldType,
        config: {
          options: [
            { value: 'option1', label: 'Option One' },
          ],
        },
      };
      const selectValue = {
        ...mockFieldValue,
        valueText: 'option1',
        field: selectField,
      };
      vi.mocked(mockPrisma.customFieldValue.findMany).mockResolvedValue([selectValue]);

      const result = await customFieldsService.getEntityValues({
        entityType: 'CLIENT',
        entityId: CLIENT_ID,
      });

      expect(result.values[0].displayValue).toBe('Option One');
    });
  });

  // ===========================================
  // CACHING TESTS
  // ===========================================

  describe('caching', () => {
    it('should cache field definitions', async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockPrisma.customFieldDefinition.findMany).mockResolvedValue([mockFieldDefinition]);

      await customFieldsService.getFieldDefinitions({ entityType: 'CLIENT' });

      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should return cached field definitions when available', async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify({
        fieldDefinitions: [mockFieldDefinition],
        total: 1,
        byGroup: { Financial: [mockFieldDefinition] },
      }));

      const result = await customFieldsService.getFieldDefinitions({ entityType: 'CLIENT' });

      expect(result.fieldDefinitions).toHaveLength(1);
      expect(mockPrisma.customFieldDefinition.findMany).not.toHaveBeenCalled();
    });

    it('should invalidate cache on field definition create', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.customFieldDefinition.create).mockResolvedValue(mockFieldDefinition);

      await customFieldsService.createFieldDefinition({
        name: 'new_field',
        label: 'New Field',
        fieldType: 'TEXT',
        entityType: 'CLIENT',
      });

      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should invalidate cache on field definition update', async () => {
      vi.mocked(mockPrisma.customFieldDefinition.findFirst).mockResolvedValue(mockFieldDefinition);
      vi.mocked(mockPrisma.customFieldDefinition.update).mockResolvedValue(mockFieldDefinition);

      await customFieldsService.updateFieldDefinition({
        fieldId: FIELD_ID,
        label: 'Updated Label',
      });

      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
});
