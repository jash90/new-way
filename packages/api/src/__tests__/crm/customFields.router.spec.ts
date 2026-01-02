import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createContext } from '../../context';
import { appRouter } from '../../index';

// ==========================================================================
// MOCKS - Use vi.hoisted() to ensure mocks are available when vi.mock runs
// ==========================================================================

const mockCustomFieldsServiceMethods = vi.hoisted(() => ({
  getFieldDefinitions: vi.fn(),
  createFieldDefinition: vi.fn(),
  updateFieldDefinition: vi.fn(),
  archiveFieldDefinition: vi.fn(),
  deleteFieldDefinition: vi.fn(),
  reorderFields: vi.fn(),
  getEntityValues: vi.fn(),
  setFieldValue: vi.fn(),
  bulkSetFieldValue: vi.fn(),
  clearFieldValue: vi.fn(),
  getOptionUsage: vi.fn(),
}));

// Mock CustomFieldsService module
vi.mock('../../services/crm/customFields.service', () => ({
  CustomFieldsService: vi.fn(() => mockCustomFieldsServiceMethods),
}));

// Mock @ksiegowacrm/auth
vi.mock('@ksiegowacrm/auth', () => ({
  Argon2Service: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockResolvedValue(true),
  })),
  argon2Service: {
    verify: vi.fn().mockResolvedValue(true),
  },
  TotpService: vi.fn().mockImplementation(() => ({
    verifyToken: vi.fn(),
    verifyBackupCode: vi.fn(),
    generateBackupCodes: vi.fn(),
    hashBackupCode: vi.fn(),
  })),
  totpService: {
    verifyToken: vi.fn(),
    verifyBackupCode: vi.fn(),
    generateBackupCodes: vi.fn(),
    hashBackupCode: vi.fn(),
  },
}));

// Alias for cleaner access in tests
const mocks = {
  getFieldDefinitions: mockCustomFieldsServiceMethods.getFieldDefinitions,
  createFieldDefinition: mockCustomFieldsServiceMethods.createFieldDefinition,
  updateFieldDefinition: mockCustomFieldsServiceMethods.updateFieldDefinition,
  archiveFieldDefinition: mockCustomFieldsServiceMethods.archiveFieldDefinition,
  deleteFieldDefinition: mockCustomFieldsServiceMethods.deleteFieldDefinition,
  reorderFields: mockCustomFieldsServiceMethods.reorderFields,
  getEntityValues: mockCustomFieldsServiceMethods.getEntityValues,
  setFieldValue: mockCustomFieldsServiceMethods.setFieldValue,
  bulkSetFieldValue: mockCustomFieldsServiceMethods.bulkSetFieldValue,
  clearFieldValue: mockCustomFieldsServiceMethods.clearFieldValue,
  getOptionUsage: mockCustomFieldsServiceMethods.getOptionUsage,
};

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  customFieldDefinition: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  customFieldValue: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  authAuditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  keys: vi.fn(),
  pipeline: vi.fn(() => ({
    del: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
};

// ==========================================================================
// TEST SUITE
// ==========================================================================

describe('Custom Fields Router (CRM-006)', () => {
  // UUIDs
  const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const ADMIN_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440002';
  const ORG_ID = '550e8400-e29b-41d4-a716-446655440030';
  const FIELD_ID = '550e8400-e29b-41d4-a716-446655440100';
  const FIELD_ID_2 = '550e8400-e29b-41d4-a716-446655440101';
  const CLIENT_ID = '550e8400-e29b-41d4-a716-446655440200';
  const VALUE_ID = '550e8400-e29b-41d4-a716-446655440300';

  // Mock field definition data
  const mockFieldDefinition = {
    id: FIELD_ID,
    organizationId: ORG_ID,
    name: 'industry_type',
    label: 'Branża',
    description: 'Branża działalności klienta',
    fieldType: 'SELECT',
    config: {
      options: [
        { value: 'it', label: 'IT' },
        { value: 'finance', label: 'Finanse' },
        { value: 'retail', label: 'Handel detaliczny' },
      ],
    },
    isRequired: false,
    validationRules: null,
    displayOrder: 0,
    groupName: 'basic',
    visibility: 'ALL',
    placeholder: 'Wybierz branżę',
    helpText: 'Wybierz główną branżę klienta',
    entityType: 'CLIENT',
    isActive: true,
    isArchived: false,
    archivedAt: null,
    archivedBy: null,
    createdAt: new Date('2025-01-01'),
    createdBy: ADMIN_USER_ID,
    updatedAt: new Date('2025-01-01'),
    updatedBy: null,
  };

  const mockFieldDefinition2 = {
    ...mockFieldDefinition,
    id: FIELD_ID_2,
    name: 'annual_revenue',
    label: 'Roczny przychód',
    fieldType: 'CURRENCY',
    config: {
      currency: 'PLN',
      precision: 2,
    },
    displayOrder: 1,
  };

  const mockFieldValue = {
    id: VALUE_ID,
    fieldId: FIELD_ID,
    fieldName: 'industry_type',
    fieldLabel: 'Branża',
    fieldType: 'SELECT',
    entityType: 'CLIENT',
    entityId: CLIENT_ID,
    value: 'it',
    displayValue: 'IT',
    createdAt: new Date('2025-01-01'),
    createdBy: TEST_USER_ID,
    updatedAt: new Date('2025-01-01'),
    updatedBy: null,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    vi.clearAllMocks();

    // Default mocks for Redis
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.keys.mockResolvedValue([]);

    // Default mocks for Prisma
    mockPrisma.authAuditLog.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({
      id: TEST_USER_ID,
      email: 'test@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$hashedpassword',
      status: 'ACTIVE',
      isEmailVerified: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // CONTEXT HELPERS
  // ===========================================================================

  function createUserContext() {
    const ctx = createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
          authorization: 'Bearer user-token',
        },
        url: '/api/trpc/crm.customFields',
        method: 'POST',
      } as any,
      res: {} as any,
    });

    return {
      ...ctx,
      session: {
        sessionId: SESSION_ID,
        userId: TEST_USER_ID,
        email: 'test@example.com',
        roles: ['USER'],
        organizationId: ORG_ID,
      },
    };
  }

  function createAdminContext() {
    const ctx = createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
          authorization: 'Bearer admin-token',
        },
        url: '/api/trpc/crm.customFields',
        method: 'POST',
      } as any,
      res: {} as any,
    });

    return {
      ...ctx,
      session: {
        sessionId: SESSION_ID,
        userId: ADMIN_USER_ID,
        email: 'admin@example.com',
        roles: ['ADMIN'],
        organizationId: ORG_ID,
      },
    };
  }

  function createUnauthenticatedContext() {
    return createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
        },
        url: '/api/trpc/crm.customFields',
        method: 'POST',
      } as any,
      res: {} as any,
    });
  }

  // ===========================================================================
  // AUTHENTICATION TESTS
  // ===========================================================================

  describe('Authentication', () => {
    it('should require authentication for getFieldDefinitions', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.crm.customFields.getFieldDefinitions({})
      ).rejects.toThrow(TRPCError);
    });

    it('should require authentication for getEntityValues', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.crm.customFields.getEntityValues({
          entityType: 'CLIENT',
          entityId: CLIENT_ID,
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should require authentication for setFieldValue', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.crm.customFields.setFieldValue({
          fieldId: FIELD_ID,
          entityType: 'CLIENT',
          entityId: CLIENT_ID,
          value: 'it',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  // ===========================================================================
  // AUTHORIZATION TESTS (Admin-only endpoints)
  // ===========================================================================

  describe('Authorization', () => {
    it('should require admin role for createFieldDefinition', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.customFields.createFieldDefinition({
          name: 'test_field',
          label: 'Test Field',
          fieldType: 'TEXT',
        })
      ).rejects.toThrow('Brak uprawnień administratora');
    });

    it('should require admin role for updateFieldDefinition', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.customFields.updateFieldDefinition({
          fieldId: FIELD_ID,
          label: 'Updated Label',
        })
      ).rejects.toThrow('Brak uprawnień administratora');
    });

    it('should require admin role for archiveFieldDefinition', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.customFields.archiveFieldDefinition({
          fieldId: FIELD_ID,
        })
      ).rejects.toThrow('Brak uprawnień administratora');
    });

    it('should require admin role for deleteFieldDefinition', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.customFields.deleteFieldDefinition({
          fieldId: FIELD_ID,
        })
      ).rejects.toThrow('Brak uprawnień administratora');
    });

    it('should require admin role for reorderFields', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.customFields.reorderFields({
          entityType: 'CLIENT',
          fieldOrders: [
            { fieldId: FIELD_ID, displayOrder: 0 },
            { fieldId: FIELD_ID_2, displayOrder: 1 },
          ],
        })
      ).rejects.toThrow('Brak uprawnień administratora');
    });

    it('should allow admin to create field definition', async () => {
      mocks.createFieldDefinition.mockResolvedValue({
        success: true,
        fieldDefinition: mockFieldDefinition,
        message: 'Pole utworzone pomyślnie',
      });
      const caller = appRouter.createCaller(createAdminContext());

      const result = await caller.crm.customFields.createFieldDefinition({
        name: 'industry_type',
        label: 'Branża',
        fieldType: 'SELECT',
        config: {
          options: [
            { value: 'it', label: 'IT' },
            { value: 'finance', label: 'Finanse' },
          ],
        },
      });

      expect(result.success).toBe(true);
      expect(result.fieldDefinition.name).toBe('industry_type');
    });
  });

  // ===========================================================================
  // GET FIELD DEFINITIONS
  // ===========================================================================

  describe('getFieldDefinitions', () => {
    it('should get field definitions successfully', async () => {
      mocks.getFieldDefinitions.mockResolvedValue({
        fieldDefinitions: [mockFieldDefinition, mockFieldDefinition2],
        total: 2,
        byGroup: {
          basic: [mockFieldDefinition, mockFieldDefinition2],
        },
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.customFields.getFieldDefinitions({});

      expect(result.fieldDefinitions).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mocks.getFieldDefinitions).toHaveBeenCalled();
    });

    it('should filter by entity type', async () => {
      mocks.getFieldDefinitions.mockResolvedValue({
        fieldDefinitions: [mockFieldDefinition],
        total: 1,
        byGroup: { basic: [mockFieldDefinition] },
      });
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.customFields.getFieldDefinitions({
        entityType: 'CLIENT',
      });

      expect(mocks.getFieldDefinitions).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'CLIENT' })
      );
    });

    it('should filter by group name', async () => {
      mocks.getFieldDefinitions.mockResolvedValue({
        fieldDefinitions: [mockFieldDefinition],
        total: 1,
        byGroup: { basic: [mockFieldDefinition] },
      });
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.customFields.getFieldDefinitions({
        groupName: 'basic',
      });

      expect(mocks.getFieldDefinitions).toHaveBeenCalledWith(
        expect.objectContaining({ groupName: 'basic' })
      );
    });

    it('should include archived when requested', async () => {
      mocks.getFieldDefinitions.mockResolvedValue({
        fieldDefinitions: [],
        total: 0,
        byGroup: {},
      });
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.customFields.getFieldDefinitions({
        includeArchived: true,
      });

      expect(mocks.getFieldDefinitions).toHaveBeenCalledWith(
        expect.objectContaining({ includeArchived: true })
      );
    });
  });

  // ===========================================================================
  // CREATE FIELD DEFINITION
  // ===========================================================================

  describe('createFieldDefinition', () => {
    it('should create a TEXT field definition', async () => {
      const textField = {
        ...mockFieldDefinition,
        fieldType: 'TEXT',
        config: { maxLength: 100 },
      };
      mocks.createFieldDefinition.mockResolvedValue({
        success: true,
        fieldDefinition: textField,
        message: 'Pole utworzone pomyślnie',
      });
      const caller = appRouter.createCaller(createAdminContext());

      const result = await caller.crm.customFields.createFieldDefinition({
        name: 'company_code',
        label: 'Kod firmy',
        fieldType: 'TEXT',
        config: { maxLength: 100 },
      });

      expect(result.success).toBe(true);
      expect(result.fieldDefinition.fieldType).toBe('TEXT');
    });

    it('should create a SELECT field with options', async () => {
      mocks.createFieldDefinition.mockResolvedValue({
        success: true,
        fieldDefinition: mockFieldDefinition,
        message: 'Pole utworzone pomyślnie',
      });
      const caller = appRouter.createCaller(createAdminContext());

      const result = await caller.crm.customFields.createFieldDefinition({
        name: 'industry_type',
        label: 'Branża',
        fieldType: 'SELECT',
        config: {
          options: [
            { value: 'it', label: 'IT' },
            { value: 'finance', label: 'Finanse' },
          ],
        },
      });

      expect(result.success).toBe(true);
      expect(result.fieldDefinition.fieldType).toBe('SELECT');
    });

    it('should validate name format (lowercase with underscores)', async () => {
      const caller = appRouter.createCaller(createAdminContext());

      await expect(
        caller.crm.customFields.createFieldDefinition({
          name: 'InvalidName',
          label: 'Invalid Field',
          fieldType: 'TEXT',
        })
      ).rejects.toThrow();
    });

    it('should validate name cannot start with number', async () => {
      const caller = appRouter.createCaller(createAdminContext());

      await expect(
        caller.crm.customFields.createFieldDefinition({
          name: '1invalid',
          label: 'Invalid Field',
          fieldType: 'TEXT',
        })
      ).rejects.toThrow();
    });

    it('should validate fieldType enum', async () => {
      const caller = appRouter.createCaller(createAdminContext());

      await expect(
        caller.crm.customFields.createFieldDefinition({
          name: 'test_field',
          label: 'Test Field',
          fieldType: 'INVALID' as any,
        })
      ).rejects.toThrow();
    });

    it('should create field with all optional parameters', async () => {
      mocks.createFieldDefinition.mockResolvedValue({
        success: true,
        fieldDefinition: mockFieldDefinition,
        message: 'Pole utworzone pomyślnie',
      });
      const caller = appRouter.createCaller(createAdminContext());

      const result = await caller.crm.customFields.createFieldDefinition({
        name: 'industry_type',
        label: 'Branża',
        description: 'Branża działalności',
        fieldType: 'SELECT',
        config: {
          options: [{ value: 'it', label: 'IT' }],
        },
        isRequired: true,
        displayOrder: 5,
        groupName: 'business',
        visibility: 'INTERNAL',
        placeholder: 'Wybierz...',
        helpText: 'Pomoc',
        entityType: 'CLIENT',
      });

      expect(result.success).toBe(true);
      expect(mocks.createFieldDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          isRequired: true,
          displayOrder: 5,
          groupName: 'business',
          visibility: 'INTERNAL',
        })
      );
    });
  });

  // ===========================================================================
  // UPDATE FIELD DEFINITION
  // ===========================================================================

  describe('updateFieldDefinition', () => {
    it('should update field label', async () => {
      const updatedField = { ...mockFieldDefinition, label: 'Nowa nazwa' };
      mocks.updateFieldDefinition.mockResolvedValue({
        success: true,
        fieldDefinition: updatedField,
        message: 'Pole zaktualizowane pomyślnie',
      });
      const caller = appRouter.createCaller(createAdminContext());

      const result = await caller.crm.customFields.updateFieldDefinition({
        fieldId: FIELD_ID,
        label: 'Nowa nazwa',
      });

      expect(result.success).toBe(true);
      expect(result.fieldDefinition.label).toBe('Nowa nazwa');
    });

    it('should update field visibility', async () => {
      const updatedField = { ...mockFieldDefinition, visibility: 'ADMIN_ONLY' };
      mocks.updateFieldDefinition.mockResolvedValue({
        success: true,
        fieldDefinition: updatedField,
        message: 'Pole zaktualizowane pomyślnie',
      });
      const caller = appRouter.createCaller(createAdminContext());

      const result = await caller.crm.customFields.updateFieldDefinition({
        fieldId: FIELD_ID,
        visibility: 'ADMIN_ONLY',
      });

      expect(result.success).toBe(true);
      expect(result.fieldDefinition.visibility).toBe('ADMIN_ONLY');
    });

    it('should validate fieldId is UUID', async () => {
      const caller = appRouter.createCaller(createAdminContext());

      await expect(
        caller.crm.customFields.updateFieldDefinition({
          fieldId: 'not-a-uuid',
          label: 'New Label',
        })
      ).rejects.toThrow();
    });

    it('should propagate NOT_FOUND error', async () => {
      mocks.updateFieldDefinition.mockRejectedValue(
        new TRPCError({ code: 'NOT_FOUND', message: 'Pole nie znalezione' })
      );
      const caller = appRouter.createCaller(createAdminContext());

      await expect(
        caller.crm.customFields.updateFieldDefinition({
          fieldId: FIELD_ID,
          label: 'New Label',
        })
      ).rejects.toThrow('Pole nie znalezione');
    });
  });

  // ===========================================================================
  // ARCHIVE FIELD DEFINITION
  // ===========================================================================

  describe('archiveFieldDefinition', () => {
    it('should archive field successfully', async () => {
      const archivedField = {
        ...mockFieldDefinition,
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: ADMIN_USER_ID,
      };
      mocks.archiveFieldDefinition.mockResolvedValue({
        success: true,
        fieldDefinition: archivedField,
        valuesPreserved: 15,
        message: 'Pole zarchiwizowane. Zachowano 15 wartości.',
      });
      const caller = appRouter.createCaller(createAdminContext());

      const result = await caller.crm.customFields.archiveFieldDefinition({
        fieldId: FIELD_ID,
      });

      expect(result.success).toBe(true);
      expect(result.valuesPreserved).toBe(15);
      expect(result.fieldDefinition.isArchived).toBe(true);
    });

    it('should validate fieldId is UUID', async () => {
      const caller = appRouter.createCaller(createAdminContext());

      await expect(
        caller.crm.customFields.archiveFieldDefinition({
          fieldId: 'invalid',
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // DELETE FIELD DEFINITION
  // ===========================================================================

  describe('deleteFieldDefinition', () => {
    it('should delete field with no values', async () => {
      mocks.deleteFieldDefinition.mockResolvedValue({
        success: true,
        deletedValuesCount: 0,
        message: 'Pole usunięte pomyślnie',
      });
      const caller = appRouter.createCaller(createAdminContext());

      const result = await caller.crm.customFields.deleteFieldDefinition({
        fieldId: FIELD_ID,
      });

      expect(result.success).toBe(true);
      expect(result.deletedValuesCount).toBe(0);
    });

    it('should fail to delete field with values without force flag', async () => {
      mocks.deleteFieldDefinition.mockRejectedValue(
        new TRPCError({
          code: 'CONFLICT',
          message: 'Pole ma 15 wartości. Użyj force=true aby usunąć.',
        })
      );
      const caller = appRouter.createCaller(createAdminContext());

      await expect(
        caller.crm.customFields.deleteFieldDefinition({
          fieldId: FIELD_ID,
        })
      ).rejects.toThrow('Pole ma 15 wartości');
    });

    it('should force delete field with values', async () => {
      mocks.deleteFieldDefinition.mockResolvedValue({
        success: true,
        deletedValuesCount: 15,
        message: 'Pole usunięte wraz z 15 wartościami',
      });
      const caller = appRouter.createCaller(createAdminContext());

      const result = await caller.crm.customFields.deleteFieldDefinition({
        fieldId: FIELD_ID,
        force: true,
      });

      expect(result.success).toBe(true);
      expect(result.deletedValuesCount).toBe(15);
    });
  });

  // ===========================================================================
  // REORDER FIELDS
  // ===========================================================================

  describe('reorderFields', () => {
    it('should reorder fields successfully', async () => {
      mocks.reorderFields.mockResolvedValue({
        success: true,
        updatedCount: 2,
        message: 'Zaktualizowano kolejność 2 pól',
      });
      const caller = appRouter.createCaller(createAdminContext());

      const result = await caller.crm.customFields.reorderFields({
        entityType: 'CLIENT',
        fieldOrders: [
          { fieldId: FIELD_ID, displayOrder: 1 },
          { fieldId: FIELD_ID_2, displayOrder: 0 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(2);
    });

    it('should validate minimum 1 field order', async () => {
      const caller = appRouter.createCaller(createAdminContext());

      await expect(
        caller.crm.customFields.reorderFields({
          entityType: 'CLIENT',
          fieldOrders: [],
        })
      ).rejects.toThrow();
    });

    it('should validate entity type enum', async () => {
      const caller = appRouter.createCaller(createAdminContext());

      await expect(
        caller.crm.customFields.reorderFields({
          entityType: 'INVALID' as any,
          fieldOrders: [{ fieldId: FIELD_ID, displayOrder: 0 }],
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // GET ENTITY VALUES
  // ===========================================================================

  describe('getEntityValues', () => {
    it('should get entity values successfully', async () => {
      mocks.getEntityValues.mockResolvedValue({
        entityType: 'CLIENT',
        entityId: CLIENT_ID,
        values: [mockFieldValue],
        groups: { basic: [mockFieldValue] },
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.customFields.getEntityValues({
        entityType: 'CLIENT',
        entityId: CLIENT_ID,
      });

      expect(result.entityId).toBe(CLIENT_ID);
      expect(result.values).toHaveLength(1);
      expect(result.values[0].displayValue).toBe('IT');
    });

    it('should validate entityId is UUID', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.customFields.getEntityValues({
          entityType: 'CLIENT',
          entityId: 'not-a-uuid',
        })
      ).rejects.toThrow();
    });

    it('should validate entityType enum', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.customFields.getEntityValues({
          entityType: 'INVALID' as any,
          entityId: CLIENT_ID,
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // SET FIELD VALUE
  // ===========================================================================

  describe('setFieldValue', () => {
    it('should set text value', async () => {
      const textValue = { ...mockFieldValue, fieldType: 'TEXT', value: 'Test' };
      mocks.setFieldValue.mockResolvedValue({
        success: true,
        fieldValue: textValue,
        message: 'Wartość zapisana pomyślnie',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.customFields.setFieldValue({
        fieldId: FIELD_ID,
        entityType: 'CLIENT',
        entityId: CLIENT_ID,
        value: 'Test',
      });

      expect(result.success).toBe(true);
      expect(result.fieldValue.value).toBe('Test');
    });

    it('should set number value', async () => {
      const numValue = { ...mockFieldValue, fieldType: 'NUMBER', value: 12345 };
      mocks.setFieldValue.mockResolvedValue({
        success: true,
        fieldValue: numValue,
        message: 'Wartość zapisana pomyślnie',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.customFields.setFieldValue({
        fieldId: FIELD_ID,
        entityType: 'CLIENT',
        entityId: CLIENT_ID,
        value: 12345,
      });

      expect(result.success).toBe(true);
      expect(result.fieldValue.value).toBe(12345);
    });

    it('should set boolean value', async () => {
      const boolValue = { ...mockFieldValue, fieldType: 'CHECKBOX', value: true };
      mocks.setFieldValue.mockResolvedValue({
        success: true,
        fieldValue: boolValue,
        message: 'Wartość zapisana pomyślnie',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.customFields.setFieldValue({
        fieldId: FIELD_ID,
        entityType: 'CLIENT',
        entityId: CLIENT_ID,
        value: true,
      });

      expect(result.success).toBe(true);
      expect(result.fieldValue.value).toBe(true);
    });

    it('should set multiselect value (array)', async () => {
      const multiValue = {
        ...mockFieldValue,
        fieldType: 'MULTISELECT',
        value: ['it', 'finance'],
      };
      mocks.setFieldValue.mockResolvedValue({
        success: true,
        fieldValue: multiValue,
        message: 'Wartość zapisana pomyślnie',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.customFields.setFieldValue({
        fieldId: FIELD_ID,
        entityType: 'CLIENT',
        entityId: CLIENT_ID,
        value: ['it', 'finance'],
      });

      expect(result.success).toBe(true);
      expect(result.fieldValue.value).toEqual(['it', 'finance']);
    });

    it('should validate fieldId is UUID', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.customFields.setFieldValue({
          fieldId: 'invalid',
          entityType: 'CLIENT',
          entityId: CLIENT_ID,
          value: 'test',
        })
      ).rejects.toThrow();
    });

    it('should propagate validation error for invalid value', async () => {
      mocks.setFieldValue.mockRejectedValue(
        new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Wartość "xyz" nie jest prawidłową opcją dla pola SELECT',
        })
      );
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.customFields.setFieldValue({
          fieldId: FIELD_ID,
          entityType: 'CLIENT',
          entityId: CLIENT_ID,
          value: 'xyz',
        })
      ).rejects.toThrow('nie jest prawidłową opcją');
    });
  });

  // ===========================================================================
  // BULK SET FIELD VALUE
  // ===========================================================================

  describe('bulkSetFieldValue', () => {
    it('should bulk set values successfully', async () => {
      mocks.bulkSetFieldValue.mockResolvedValue({
        success: true,
        updatedCount: 5,
        failedCount: 0,
        message: 'Zaktualizowano 5 z 5 wartości',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.customFields.bulkSetFieldValue({
        fieldId: FIELD_ID,
        entityType: 'CLIENT',
        entityIds: [
          CLIENT_ID,
          '550e8400-e29b-41d4-a716-446655440201',
          '550e8400-e29b-41d4-a716-446655440202',
          '550e8400-e29b-41d4-a716-446655440203',
          '550e8400-e29b-41d4-a716-446655440204',
        ],
        value: 'it',
      });

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(5);
      expect(result.failedCount).toBe(0);
    });

    it('should handle partial failures', async () => {
      mocks.bulkSetFieldValue.mockResolvedValue({
        success: false,
        updatedCount: 3,
        failedCount: 2,
        errors: [
          { entityId: CLIENT_ID, error: 'Entity not found' },
        ],
        message: 'Zaktualizowano 3 z 5 wartości',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.customFields.bulkSetFieldValue({
        fieldId: FIELD_ID,
        entityType: 'CLIENT',
        entityIds: [
          CLIENT_ID,
          '550e8400-e29b-41d4-a716-446655440201',
          '550e8400-e29b-41d4-a716-446655440202',
          '550e8400-e29b-41d4-a716-446655440203',
          '550e8400-e29b-41d4-a716-446655440204',
        ],
        value: 'it',
      });

      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(2);
      expect(result.errors).toBeDefined();
    });

    it('should validate minimum 1 entity ID', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.customFields.bulkSetFieldValue({
          fieldId: FIELD_ID,
          entityType: 'CLIENT',
          entityIds: [],
          value: 'test',
        })
      ).rejects.toThrow();
    });

    it('should validate maximum 100 entity IDs', async () => {
      const caller = appRouter.createCaller(createUserContext());
      const tooManyIds = Array(101).fill(CLIENT_ID);

      await expect(
        caller.crm.customFields.bulkSetFieldValue({
          fieldId: FIELD_ID,
          entityType: 'CLIENT',
          entityIds: tooManyIds,
          value: 'test',
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // CLEAR FIELD VALUE
  // ===========================================================================

  describe('clearFieldValue', () => {
    it('should clear value successfully', async () => {
      mocks.clearFieldValue.mockResolvedValue({
        success: true,
        message: 'Wartość usunięta',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.customFields.clearFieldValue({
        fieldId: FIELD_ID,
        entityId: CLIENT_ID,
      });

      expect(result.success).toBe(true);
    });

    it('should fail for required field', async () => {
      mocks.clearFieldValue.mockRejectedValue(
        new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nie można usunąć wartości wymaganego pola',
        })
      );
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.customFields.clearFieldValue({
          fieldId: FIELD_ID,
          entityId: CLIENT_ID,
        })
      ).rejects.toThrow('wymaganego pola');
    });

    it('should validate fieldId is UUID', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.customFields.clearFieldValue({
          fieldId: 'invalid',
          entityId: CLIENT_ID,
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // GET OPTION USAGE
  // ===========================================================================

  describe('getOptionUsage', () => {
    it('should get option usage statistics', async () => {
      mocks.getOptionUsage.mockResolvedValue({
        fieldId: FIELD_ID,
        fieldName: 'industry_type',
        options: [
          { value: 'it', label: 'IT', usageCount: 45, percentage: 45 },
          { value: 'finance', label: 'Finanse', usageCount: 30, percentage: 30 },
          { value: 'retail', label: 'Handel', usageCount: 25, percentage: 25 },
        ],
        totalUsage: 100,
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.customFields.getOptionUsage({
        fieldId: FIELD_ID,
      });

      expect(result.totalUsage).toBe(100);
      expect(result.options).toHaveLength(3);
      expect(result.options[0].usageCount).toBe(45);
    });

    it('should return empty usage for field with no values', async () => {
      mocks.getOptionUsage.mockResolvedValue({
        fieldId: FIELD_ID,
        fieldName: 'industry_type',
        options: [
          { value: 'it', label: 'IT', usageCount: 0, percentage: 0 },
          { value: 'finance', label: 'Finanse', usageCount: 0, percentage: 0 },
        ],
        totalUsage: 0,
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.customFields.getOptionUsage({
        fieldId: FIELD_ID,
      });

      expect(result.totalUsage).toBe(0);
      expect(result.options.every((o: any) => o.usageCount === 0)).toBe(true);
    });

    it('should validate fieldId is UUID', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.customFields.getOptionUsage({
          fieldId: 'invalid',
        })
      ).rejects.toThrow();
    });

    it('should fail for non-SELECT field', async () => {
      mocks.getOptionUsage.mockRejectedValue(
        new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Statystyki opcji dostępne tylko dla pól SELECT/MULTISELECT',
        })
      );
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.customFields.getOptionUsage({
          fieldId: FIELD_ID,
        })
      ).rejects.toThrow('SELECT/MULTISELECT');
    });
  });

  // ===========================================================================
  // INPUT VALIDATION
  // ===========================================================================

  describe('Input Validation', () => {
    it('should validate visibility enum', async () => {
      const caller = appRouter.createCaller(createAdminContext());

      await expect(
        caller.crm.customFields.createFieldDefinition({
          name: 'test_field',
          label: 'Test',
          fieldType: 'TEXT',
          visibility: 'INVALID' as any,
        })
      ).rejects.toThrow();
    });

    it('should validate label max length', async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const longLabel = 'a'.repeat(201);

      await expect(
        caller.crm.customFields.createFieldDefinition({
          name: 'test_field',
          label: longLabel,
          fieldType: 'TEXT',
        })
      ).rejects.toThrow();
    });

    it('should validate description max length', async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const longDesc = 'a'.repeat(1001);

      await expect(
        caller.crm.customFields.createFieldDefinition({
          name: 'test_field',
          label: 'Test',
          fieldType: 'TEXT',
          description: longDesc,
        })
      ).rejects.toThrow();
    });

    it('should validate displayOrder is non-negative', async () => {
      const caller = appRouter.createCaller(createAdminContext());

      await expect(
        caller.crm.customFields.createFieldDefinition({
          name: 'test_field',
          label: 'Test',
          fieldType: 'TEXT',
          displayOrder: -1,
        })
      ).rejects.toThrow();
    });
  });
});
