import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';
import type {
  CreateTaxConfigurationInput,
  CreateTaxConfigurationResult,
  GetTaxConfigurationInput,
  GetTaxConfigurationByClientInput,
  ListTaxConfigurationsInput,
  ListTaxConfigurationsResult,
  UpdateTaxConfigurationInput,
  UpdateTaxConfigurationResult,
  DeleteTaxConfigurationInput,
  DeleteTaxConfigurationResult,
  AddTaxRepresentativeInput,
  AddTaxRepresentativeResult,
  UpdateTaxRepresentativeInput,
  UpdateTaxRepresentativeResult,
  RemoveTaxRepresentativeInput,
  RemoveTaxRepresentativeResult,
  ListTaxRepresentativesInput,
  ListTaxRepresentativesResult,
  GetConfigurationHistoryInput,
  GetConfigurationHistoryResult,
  RestoreConfigurationInput,
  RestoreConfigurationResult,
  ValidateConfigurationInput,
  ValidateConfigurationResult,
  ValidationIssue,
  CheckSmallTaxpayerStatusInput,
  CheckSmallTaxpayerStatusResult,
  CheckEstonianCitEligibilityInput,
  CheckEstonianCitEligibilityResult,
  TaxConfiguration,
  TaxRepresentative,
  ConfigurationHistoryEntry,
} from '@ksiegowacrm/shared';

// Cache TTL (5 minutes)
const _CACHE_TTL = 300;

// Small taxpayer threshold in PLN (approximately 2M EUR)
const SMALL_TAXPAYER_THRESHOLD_PLN = 9_218_000; // 2M EUR * 4.609 PLN/EUR (approx.)

// Polish company legal forms eligible for Estonian CIT
const ESTONIAN_CIT_LEGAL_FORMS = ['sp_zoo', 'sa', 'sk', 'psa', 'sp_z_oo', 'spolka_z_oo'];

export class TaxConfigurationService {
  private prisma: PrismaClient;
  private redis: Redis;
  private auditLogger: AuditLogger;
  private userId: string;
  private organizationId: string;

  constructor(
    prisma: PrismaClient,
    redis: Redis,
    auditLogger: AuditLogger,
    userId: string,
    organizationId: string
  ) {
    this.prisma = prisma;
    this.redis = redis;
    this.auditLogger = auditLogger;
    this.userId = userId;
    this.organizationId = organizationId;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private _getCacheKey(suffix: string): string {
    return `tax_config:${this.organizationId}:${suffix}`;
  }

  private async invalidateCache(): Promise<void> {
    const pattern = `tax_config:${this.organizationId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private async verifyClientBelongsToOrganization(clientId: string): Promise<boolean> {
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: this.organizationId,
      },
    });
    return !!client;
  }

  // ===========================================================================
  // CREATE TAX CONFIGURATION
  // ===========================================================================

  async createConfiguration(input: CreateTaxConfigurationInput): Promise<CreateTaxConfigurationResult> {
    // Verify client belongs to organization
    const clientExists = await this.verifyClientBelongsToOrganization(input.clientId);
    if (!clientExists) {
      throw new Error('Klient nie został znaleziony');
    }

    // Check for existing active configuration
    const existingConfig = await this.prisma.taxConfiguration.findFirst({
      where: {
        clientId: input.clientId,
        isActive: true,
      },
    });

    if (existingConfig) {
      throw new Error('Aktywna konfiguracja podatkowa już istnieje dla tego klienta');
    }

    // Additional validation for quarterly VAT
    if (input.vatPeriod === 'quarterly' && !input.isSmallTaxpayer) {
      const smallTaxpayerCheck = await this.checkSmallTaxpayerStatus({ clientId: input.clientId });
      if (!smallTaxpayerCheck.isEligible) {
        throw new Error('Klient nie kwalifikuje się do kwartalnego rozliczenia VAT (wymagany status małego podatnika)');
      }
    }

    // Additional validation for Estonian CIT
    if (input.estonianCitEnabled) {
      const estonianCitCheck = await this.checkEstonianCitEligibility({ clientId: input.clientId });
      if (!estonianCitCheck.isEligible) {
        throw new Error('Klient nie spełnia wymogów estońskiego CIT');
      }
    }

    // Create configuration
    const configuration = await this.prisma.taxConfiguration.create({
      data: {
        clientId: input.clientId,
        organizationId: this.organizationId,
        vatStatus: input.vatStatus,
        vatPeriod: input.vatPeriod ?? null,
        vatExemptionReason: input.vatExemptionReason ?? null,
        vatRegistrationDate: input.vatRegistrationDate ?? null,
        incomeTaxForm: input.incomeTaxForm,
        incomeTaxRate: input.incomeTaxRate ?? null,
        isSmallTaxpayer: input.isSmallTaxpayer ?? false,
        estonianCitEnabled: input.estonianCitEnabled ?? false,
        estonianCitStartDate: input.estonianCitStartDate ?? null,
        pitTaxOption: input.pitTaxOption ?? null,
        accountingYearStart: input.accountingYearStart ?? '01-01',
        zusType: input.zusType ?? null,
        zusContributionBase: input.zusContributionBase ?? null,
        zusAccidentRate: input.zusAccidentRate ?? 1.67,
        zusFpEnabled: input.zusFpEnabled ?? true,
        zusFgspEnabled: input.zusFgspEnabled ?? true,
        zusUlgaExpiryDate: input.zusUlgaExpiryDate ?? null,
        submissionMethod: input.submissionMethod ?? 'manual',
        autoUpoDownload: input.autoUpoDownload ?? true,
        notificationEmail: input.notificationEmail ?? null,
        notificationInApp: input.notificationInApp ?? true,
        approvalRequired: input.approvalRequired ?? false,
        approvalDaysBefore: input.approvalDaysBefore ?? 5,
        effectiveFrom: input.effectiveFrom ?? new Date(),
        effectiveTo: input.effectiveTo ?? null,
        isActive: true,
        createdBy: this.userId,
        updatedBy: this.userId,
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Create audit log entry
    await this.createAuditEntry(
      configuration.id,
      input.clientId,
      'CREATE',
      null,
      null,
      input,
      null
    );

    // Log audit event
    await this.auditLogger.log({
      action: 'tax_configuration_created',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'tax_configuration',
      resourceId: configuration.id,
      metadata: {
        clientId: input.clientId,
        vatStatus: input.vatStatus,
        incomeTaxForm: input.incomeTaxForm,
      },
    });

    return {
      success: true,
      configuration: configuration as TaxConfiguration,
      message: 'Konfiguracja podatkowa została utworzona',
    };
  }

  // ===========================================================================
  // GET TAX CONFIGURATION
  // ===========================================================================

  async getConfiguration(input: GetTaxConfigurationInput): Promise<TaxConfiguration | null> {
    const { id, includeRepresentatives } = input;

    const configuration = await this.prisma.taxConfiguration.findUnique({
      where: {
        id,
        organizationId: this.organizationId,
      },
      include: {
        representatives: includeRepresentatives ? {
          where: { isActive: true },
        } : false,
      },
    });

    return configuration as TaxConfiguration | null;
  }

  // ===========================================================================
  // GET TAX CONFIGURATION BY CLIENT
  // ===========================================================================

  async getConfigurationByClient(input: GetTaxConfigurationByClientInput): Promise<TaxConfiguration | null> {
    const { clientId, includeRepresentatives, includeInactive } = input;

    const configuration = await this.prisma.taxConfiguration.findFirst({
      where: {
        clientId,
        organizationId: this.organizationId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        representatives: includeRepresentatives ? {
          where: includeInactive ? {} : { isActive: true },
        } : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    return configuration as TaxConfiguration | null;
  }

  // ===========================================================================
  // LIST TAX CONFIGURATIONS
  // ===========================================================================

  async listConfigurations(input: ListTaxConfigurationsInput): Promise<ListTaxConfigurationsResult> {
    const {
      vatStatus,
      incomeTaxForm,
      zusType,
      isActive,
      search,
      limit,
      offset,
      includeRepresentatives,
    } = input;

    const where: Record<string, unknown> = {
      organizationId: this.organizationId,
    };

    if (vatStatus) where.vatStatus = vatStatus;
    if (incomeTaxForm) where.incomeTaxForm = incomeTaxForm;
    if (zusType) where.zusType = zusType;
    if (typeof isActive === 'boolean') where.isActive = isActive;

    if (search) {
      where.client = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { nip: { contains: search } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.taxConfiguration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          client: {
            select: { id: true, name: true, nip: true },
          },
          representatives: includeRepresentatives ? {
            where: { isActive: true },
          } : false,
        },
      }),
      this.prisma.taxConfiguration.count({ where }),
    ]);

    return {
      items: items as TaxConfiguration[],
      total,
      limit,
      offset,
    };
  }

  // ===========================================================================
  // UPDATE TAX CONFIGURATION
  // ===========================================================================

  async updateConfiguration(input: UpdateTaxConfigurationInput): Promise<UpdateTaxConfigurationResult> {
    const { id, data, changeReason } = input;

    // Verify configuration exists and belongs to organization
    const existing = await this.prisma.taxConfiguration.findUnique({
      where: { id, organizationId: this.organizationId },
    });

    if (!existing) {
      throw new Error('Konfiguracja podatkowa nie została znaleziona');
    }

    // Store old values for audit
    const oldValues = { ...existing };
    const changedFields: string[] = [];

    // Update configuration
    const updated = await this.prisma.taxConfiguration.update({
      where: { id },
      data: {
        ...data,
        updatedBy: this.userId,
        updatedAt: new Date(),
      },
    });

    // Create audit entries for each changed field
    for (const [key, newValue] of Object.entries(data)) {
      const oldValue = oldValues[key as keyof typeof oldValues];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changedFields.push(key);
        await this.createAuditEntry(
          id,
          existing.clientId,
          'UPDATE',
          key,
          oldValue,
          newValue,
          changeReason ?? null
        );
      }
    }

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'tax_configuration_updated',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'tax_configuration',
      resourceId: id,
      metadata: { changedFields, changeReason },
    });

    return {
      success: true,
      configuration: updated as TaxConfiguration,
      changedFields,
      message: 'Konfiguracja podatkowa została zaktualizowana',
    };
  }

  // ===========================================================================
  // DELETE TAX CONFIGURATION
  // ===========================================================================

  async deleteConfiguration(input: DeleteTaxConfigurationInput): Promise<DeleteTaxConfigurationResult> {
    const { id, reason, hardDelete } = input;

    // Verify configuration exists
    const existing = await this.prisma.taxConfiguration.findUnique({
      where: { id, organizationId: this.organizationId },
    });

    if (!existing) {
      throw new Error('Konfiguracja podatkowa nie została znaleziona');
    }

    if (hardDelete) {
      // Hard delete - remove from database
      await this.prisma.taxConfiguration.delete({ where: { id } });
    } else {
      // Soft delete - mark as inactive
      await this.prisma.taxConfiguration.update({
        where: { id },
        data: {
          isActive: false,
          effectiveTo: new Date(),
          updatedBy: this.userId,
          updatedAt: new Date(),
        },
      });
    }

    // Create audit entry
    await this.createAuditEntry(
      id,
      existing.clientId,
      'DELETE',
      null,
      existing,
      null,
      reason
    );

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'tax_configuration_deleted',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'tax_configuration',
      resourceId: id,
      metadata: { reason, hardDelete },
    });

    return {
      success: true,
      message: hardDelete
        ? 'Konfiguracja podatkowa została usunięta'
        : 'Konfiguracja podatkowa została dezaktywowana',
    };
  }

  // ===========================================================================
  // TAX REPRESENTATIVE METHODS
  // ===========================================================================

  async addRepresentative(input: AddTaxRepresentativeInput): Promise<AddTaxRepresentativeResult> {
    const { clientId, representativeNip, representativeName, authorizationScope, upl1Reference, validFrom, validTo } = input;

    // Verify client belongs to organization
    const clientExists = await this.verifyClientBelongsToOrganization(clientId);
    if (!clientExists) {
      throw new Error('Klient nie został znaleziony');
    }

    // Check if representative with same NIP already exists for this client
    const existingRep = await this.prisma.taxRepresentative.findFirst({
      where: {
        clientId,
        representativeNip,
        isActive: true,
      },
    });

    if (existingRep) {
      throw new Error('Pełnomocnik o tym NIP już istnieje dla tego klienta');
    }

    const representative = await this.prisma.taxRepresentative.create({
      data: {
        clientId,
        representativeNip,
        representativeName,
        authorizationScope,
        upl1Reference: upl1Reference ?? null,
        validFrom,
        validTo: validTo ?? null,
        isActive: true,
        createdBy: this.userId,
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'tax_representative_added',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'tax_representative',
      resourceId: representative.id,
      metadata: { clientId, representativeNip, representativeName, authorizationScope },
    });

    return {
      success: true,
      representative: representative as TaxRepresentative,
      message: 'Pełnomocnik został dodany',
    };
  }

  async updateRepresentative(input: UpdateTaxRepresentativeInput): Promise<UpdateTaxRepresentativeResult> {
    const { id, data } = input;

    // Verify representative exists
    const existing = await this.prisma.taxRepresentative.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!existing || existing.client.organizationId !== this.organizationId) {
      throw new Error('Pełnomocnik nie został znaleziony');
    }

    const updated = await this.prisma.taxRepresentative.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'tax_representative_updated',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'tax_representative',
      resourceId: id,
      metadata: { data },
    });

    return {
      success: true,
      representative: updated as TaxRepresentative,
      message: 'Pełnomocnik został zaktualizowany',
    };
  }

  async removeRepresentative(input: RemoveTaxRepresentativeInput): Promise<RemoveTaxRepresentativeResult> {
    const { id, reason } = input;

    // Verify representative exists
    const existing = await this.prisma.taxRepresentative.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!existing || existing.client.organizationId !== this.organizationId) {
      throw new Error('Pełnomocnik nie został znaleziony');
    }

    // Soft delete - mark as inactive
    await this.prisma.taxRepresentative.update({
      where: { id },
      data: {
        isActive: false,
        validTo: new Date(),
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'tax_representative_removed',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'tax_representative',
      resourceId: id,
      metadata: { reason },
    });

    return {
      success: true,
      message: 'Pełnomocnik został usunięty',
    };
  }

  async listRepresentatives(input: ListTaxRepresentativesInput): Promise<ListTaxRepresentativesResult> {
    const { clientId, includeInactive, scope } = input;

    // Verify client belongs to organization
    const clientExists = await this.verifyClientBelongsToOrganization(clientId);
    if (!clientExists) {
      throw new Error('Klient nie został znaleziony');
    }

    const where: Record<string, unknown> = {
      clientId,
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    if (scope) {
      where.authorizationScope = { has: scope };
    }

    const items = await this.prisma.taxRepresentative.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: items as TaxRepresentative[],
      total: items.length,
    };
  }

  // ===========================================================================
  // CONFIGURATION HISTORY
  // ===========================================================================

  async getConfigurationHistory(input: GetConfigurationHistoryInput): Promise<GetConfigurationHistoryResult> {
    const { configurationId, startDate, endDate, fieldName, action, limit, cursor } = input;

    // Verify configuration exists and belongs to organization
    const config = await this.prisma.taxConfiguration.findUnique({
      where: { id: configurationId, organizationId: this.organizationId },
    });

    if (!config) {
      throw new Error('Konfiguracja podatkowa nie została znaleziona');
    }

    const where: Record<string, unknown> = {
      configurationId,
    };

    if (startDate) {
      where.createdAt = { ...(where.createdAt as object), gte: startDate };
    }

    if (endDate) {
      where.createdAt = { ...(where.createdAt as object), lte: endDate };
    }

    if (fieldName) {
      where.fieldChanged = fieldName;
    }

    if (action) {
      where.action = action;
    }

    if (cursor) {
      where.id = { lt: cursor };
    }

    const [history, total] = await Promise.all([
      this.prisma.taxConfigurationAudit.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      }),
      this.prisma.taxConfigurationAudit.count({ where }),
    ]);

    let nextCursor: string | null = null;
    if (history.length > limit) {
      const nextItem = history.pop();
      nextCursor = nextItem?.id ?? null;
    }

    const items: ConfigurationHistoryEntry[] = history.map((entry) => ({
      id: entry.id,
      action: entry.action as ConfigurationHistoryEntry['action'],
      fieldChanged: entry.fieldChanged,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      changeReason: entry.changeReason,
      userName: entry.user?.name ?? 'Nieznany',
      userEmail: entry.user?.email ?? '',
      createdAt: entry.createdAt,
    }));

    return {
      items,
      nextCursor,
      total,
    };
  }

  // ===========================================================================
  // RESTORE CONFIGURATION
  // ===========================================================================

  async restoreConfiguration(input: RestoreConfigurationInput): Promise<RestoreConfigurationResult> {
    const { configurationId, auditEntryId, restoreReason } = input;

    // Verify configuration exists
    const config = await this.prisma.taxConfiguration.findUnique({
      where: { id: configurationId, organizationId: this.organizationId },
    });

    if (!config) {
      throw new Error('Konfiguracja podatkowa nie została znaleziona');
    }

    // Get the audit entry to restore from
    const auditEntry = await this.prisma.taxConfigurationAudit.findUnique({
      where: { id: auditEntryId },
    });

    if (!auditEntry || auditEntry.configurationId !== configurationId) {
      throw new Error('Wpis audytu nie został znaleziony');
    }

    if (!auditEntry.fieldChanged) {
      throw new Error('Nie można przywrócić wpisu bez określonego pola');
    }

    const currentValue = config[auditEntry.fieldChanged as keyof typeof config];

    // Restore the old value
    const updated = await this.prisma.taxConfiguration.update({
      where: { id: configurationId },
      data: {
        [auditEntry.fieldChanged]: auditEntry.oldValue,
        updatedBy: this.userId,
        updatedAt: new Date(),
      },
    });

    // Create restoration audit entry
    await this.createAuditEntry(
      configurationId,
      config.clientId,
      'RESTORE',
      auditEntry.fieldChanged,
      currentValue,
      auditEntry.oldValue,
      restoreReason
    );

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'tax_configuration_restored',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'tax_configuration',
      resourceId: configurationId,
      metadata: {
        restoredField: auditEntry.fieldChanged,
        restoreReason,
        fromAuditEntryId: auditEntryId,
      },
    });

    return {
      success: true,
      configuration: updated as TaxConfiguration,
      restoredField: auditEntry.fieldChanged,
      message: `Pole ${auditEntry.fieldChanged} zostało przywrócone`,
    };
  }

  // ===========================================================================
  // VALIDATE CONFIGURATION
  // ===========================================================================

  async validateConfiguration(input: ValidateConfigurationInput): Promise<ValidateConfigurationResult> {
    const { clientId, data } = input;
    const issues: ValidationIssue[] = [];

    // Verify client exists
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: this.organizationId,
      },
    });

    if (!client) {
      issues.push({
        field: 'clientId',
        message: 'Klient nie został znaleziony',
        severity: 'error',
      });
      return { isValid: false, issues };
    }

    // VAT validation
    if (data.vatStatus === 'active' && !data.vatPeriod) {
      issues.push({
        field: 'vatPeriod',
        message: 'Okres rozliczeniowy VAT jest wymagany dla czynnych podatników VAT',
        severity: 'error',
      });
    }

    if (data.vatStatus === 'exempt' && !data.vatExemptionReason) {
      issues.push({
        field: 'vatExemptionReason',
        message: 'Podstawa zwolnienia z VAT jest wymagana',
        severity: 'error',
      });
    }

    if (data.vatPeriod === 'quarterly' && !data.isSmallTaxpayer) {
      const smallTaxpayerCheck = await this.checkSmallTaxpayerStatus({ clientId });
      if (!smallTaxpayerCheck.isEligible) {
        issues.push({
          field: 'vatPeriod',
          message: 'Rozliczenie kwartalne VAT dostępne tylko dla małych podatników',
          severity: 'error',
        });
      }
    }

    // Income tax validation
    if (data.incomeTaxForm === 'PIT' && !data.pitTaxOption) {
      issues.push({
        field: 'pitTaxOption',
        message: 'Forma opodatkowania PIT jest wymagana',
        severity: 'error',
      });
    }

    if (data.estonianCitEnabled && data.incomeTaxForm !== 'CIT') {
      issues.push({
        field: 'estonianCitEnabled',
        message: 'Estoński CIT dostępny tylko dla podatników CIT',
        severity: 'error',
      });
    }

    if (data.estonianCitEnabled) {
      const estonianCitCheck = await this.checkEstonianCitEligibility({ clientId });
      if (!estonianCitCheck.isEligible) {
        issues.push({
          field: 'estonianCitEnabled',
          message: 'Klient nie spełnia wymogów estońskiego CIT',
          severity: 'error',
        });
      }
    }

    // ZUS validation
    if (data.zusType === 'ulga_na_start' && !data.zusUlgaExpiryDate) {
      issues.push({
        field: 'zusUlgaExpiryDate',
        message: 'Data wygaśnięcia ulgi na start jest wymagana',
        severity: 'warning',
      });
    }

    // Warnings
    if (data.submissionMethod === 'automatic' && data.approvalRequired) {
      issues.push({
        field: 'submissionMethod',
        message: 'Automatyczne wysyłanie z wymaganą akceptacją może powodować opóźnienia',
        severity: 'warning',
      });
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }

  // ===========================================================================
  // CHECK SMALL TAXPAYER STATUS
  // ===========================================================================

  async checkSmallTaxpayerStatus(input: CheckSmallTaxpayerStatusInput): Promise<CheckSmallTaxpayerStatusResult> {
    const { clientId, year } = input;
    const checkYear = year ?? new Date().getFullYear() - 1;

    // Verify client belongs to organization
    const clientExists = await this.verifyClientBelongsToOrganization(clientId);
    if (!clientExists) {
      throw new Error('Klient nie został znaleziony');
    }

    // Get client revenue from previous year
    // Revenue accounts typically start with '7' in Polish chart of accounts
    const lastYearRevenue = await this.prisma.journalEntry.aggregate({
      where: {
        account: {
          code: { startsWith: '7' },
          organizationId: this.organizationId,
        },
        fiscalYear: {
          startDate: { gte: new Date(checkYear, 0, 1) },
          endDate: { lt: new Date(checkYear + 1, 0, 1) },
        },
        status: 'posted',
      },
      _sum: { credit: true },
    });

    const revenue = Number(lastYearRevenue._sum.credit ?? 0);
    const isEligible = revenue < SMALL_TAXPAYER_THRESHOLD_PLN;

    return {
      isEligible,
      revenue,
      threshold: SMALL_TAXPAYER_THRESHOLD_PLN,
      currency: 'PLN',
      year: checkYear,
      message: isEligible
        ? `Klient kwalifikuje się jako mały podatnik (przychód ${revenue.toLocaleString('pl-PL')} PLN < ${SMALL_TAXPAYER_THRESHOLD_PLN.toLocaleString('pl-PL')} PLN)`
        : `Klient nie kwalifikuje się jako mały podatnik (przychód ${revenue.toLocaleString('pl-PL')} PLN >= ${SMALL_TAXPAYER_THRESHOLD_PLN.toLocaleString('pl-PL')} PLN)`,
    };
  }

  // ===========================================================================
  // CHECK ESTONIAN CIT ELIGIBILITY
  // ===========================================================================

  async checkEstonianCitEligibility(input: CheckEstonianCitEligibilityInput): Promise<CheckEstonianCitEligibilityResult> {
    const { clientId } = input;

    // Get client details
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: this.organizationId,
      },
    });

    if (!client) {
      throw new Error('Klient nie został znaleziony');
    }

    // Check requirements
    const requirements = {
      // Must be Polish company (sp. z o.o., S.A., S.K., P.S.A.)
      isPolishCompany: ESTONIAN_CIT_LEGAL_FORMS.includes(client.legalForm?.toLowerCase() ?? ''),

      // No income from partnerships (would need to check actual data)
      // For now, assume true - in production, check journal entries for partnership income
      noPartnershipIncome: true,

      // Employment level requirements (at least 3 employees or monthly payroll > 3x minimum wage)
      // Would need to check ZUS data - for now, assume false until verified
      employmentLevel: false,

      // Has qualified revenue (not from passive sources)
      // Would need complex calculation - for now, assume true
      hasQualifiedRevenue: true,
    };

    const isEligible = Object.values(requirements).every((v) => v);

    return {
      isEligible,
      requirements,
      legalForm: client.legalForm ?? 'unknown',
      message: isEligible
        ? 'Klient spełnia wymogi estońskiego CIT'
        : 'Klient nie spełnia wszystkich wymogów estońskiego CIT',
    };
  }

  // ===========================================================================
  // PRIVATE HELPER: CREATE AUDIT ENTRY
  // ===========================================================================

  private async createAuditEntry(
    configurationId: string,
    clientId: string,
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE',
    fieldChanged: string | null,
    oldValue: unknown,
    newValue: unknown,
    changeReason: string | null
  ): Promise<void> {
    await this.prisma.taxConfigurationAudit.create({
      data: {
        configurationId,
        clientId,
        userId: this.userId,
        action,
        fieldChanged,
        oldValue: oldValue as Record<string, unknown> | null,
        newValue: newValue as Record<string, unknown> | null,
        changeReason,
        // Note: ipAddress, userAgent, sessionId would come from context in real implementation
      },
    });
  }
}
