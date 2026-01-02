import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';
import {
  getCategoryFromCode,
  getTypeFromCategory,
  getNatureFromType,
  isValidAccountCode,
  getAccountLevel,
} from '@ksiegowacrm/shared';
import {
  mapPrismaToAccount,
  mapPrismaToAccounts,
} from '../../utils/account-mapper';
import type {
  Account,
  ChartAccountType,
  AccountCategory,
  AccountNature,
  AccountTreeNode,
  AccountBalance,
  CreateAccountInput,
  GetAccountInput,
  GetAccountByCodeInput,
  ListAccountsInput,
  ListAccountsResult,
  UpdateAccountInput,
  DeleteAccountInput,
  DeleteAccountResult,
  ActivateAccountInput,
  DeactivateAccountInput,
  AccountStatusResult,
  MoveAccountInput,
  MoveAccountResult,
  GetAccountTreeInput,
  GetAccountTreeResult,
  SearchAccountsInput,
  SearchAccountsResult,
  ValidateAccountCodeInput,
  ValidateAccountCodeResult,
  GetAccountBalanceInput,
  BatchCreateAccountsInput,
  BatchCreateAccountsResult,
  ImportAccountsInput,
  ImportAccountsResult,
  ExportAccountsInput,
  ExportAccountsResult,
  GetAccountStatisticsInput,
  AccountStatistics,
} from '@ksiegowacrm/shared';

// Cache TTL (5 minutes)
const CACHE_TTL = 300;

// Polish Standard Chart of Accounts template
const POLISH_STANDARD_ACCOUNTS = [
  // Group 0 - Fixed Assets (Aktywa trwałe)
  { code: '010', name: 'Fixed Assets', namePl: 'Środki trwałe', type: 'asset' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '020', name: 'Intangible Assets', namePl: 'Wartości niematerialne i prawne', type: 'asset' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '030', name: 'Long-term Investments', namePl: 'Długoterminowe aktywa finansowe', type: 'asset' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '070', name: 'Depreciation of Fixed Assets', namePl: 'Umorzenie środków trwałych', type: 'asset' as ChartAccountType, nature: 'credit' as AccountNature, isSynthetic: true },
  { code: '080', name: 'Construction in Progress', namePl: 'Środki trwałe w budowie', type: 'asset' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },

  // Group 1 - Cash and Bank (Środki pieniężne)
  { code: '100', name: 'Cash', namePl: 'Kasa', type: 'asset' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '130', name: 'Bank Accounts', namePl: 'Rachunki bankowe', type: 'asset' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '140', name: 'Other Cash', namePl: 'Krótkoterminowe aktywa finansowe', type: 'asset' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },

  // Group 2 - Settlements (Rozrachunki)
  { code: '200', name: 'Trade Receivables', namePl: 'Rozrachunki z odbiorcami', type: 'asset' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '210', name: 'Trade Payables', namePl: 'Rozrachunki z dostawcami', type: 'liability' as ChartAccountType, nature: 'credit' as AccountNature, isSynthetic: true },
  { code: '220', name: 'Tax Settlements', namePl: 'Rozrachunki publicznoprawne', type: 'liability' as ChartAccountType, nature: 'credit' as AccountNature, isSynthetic: true },
  { code: '221', name: 'VAT Settlements', namePl: 'Rozrachunki z tytułu VAT', type: 'liability' as ChartAccountType, nature: 'credit' as AccountNature, isSynthetic: true },
  { code: '230', name: 'Payroll Settlements', namePl: 'Rozrachunki z tytułu wynagrodzeń', type: 'liability' as ChartAccountType, nature: 'credit' as AccountNature, isSynthetic: true },
  { code: '240', name: 'Other Settlements', namePl: 'Pozostałe rozrachunki', type: 'liability' as ChartAccountType, nature: 'credit' as AccountNature, isSynthetic: true },

  // Group 3 - Materials and Goods (Materiały i towary)
  { code: '300', name: 'Raw Materials', namePl: 'Rozliczenie zakupu', type: 'asset' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '310', name: 'Materials', namePl: 'Materiały', type: 'asset' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '330', name: 'Goods', namePl: 'Towary', type: 'asset' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },

  // Group 4 - Costs by Type (Koszty wg rodzajów)
  { code: '400', name: 'Depreciation', namePl: 'Amortyzacja', type: 'expense' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '401', name: 'Material Costs', namePl: 'Zużycie materiałów i energii', type: 'expense' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '402', name: 'External Services', namePl: 'Usługi obce', type: 'expense' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '403', name: 'Taxes and Fees', namePl: 'Podatki i opłaty', type: 'expense' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '404', name: 'Salaries', namePl: 'Wynagrodzenia', type: 'expense' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '405', name: 'Social Security', namePl: 'Ubezpieczenia społeczne i inne świadczenia', type: 'expense' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '409', name: 'Other Costs', namePl: 'Pozostałe koszty rodzajowe', type: 'expense' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },

  // Group 5 - Costs by Function (Koszty wg funkcji)
  { code: '500', name: 'Production Costs', namePl: 'Koszty działalności podstawowej - produkcyjnej', type: 'expense' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '520', name: 'Overhead Costs', namePl: 'Koszty wydziałowe', type: 'expense' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '530', name: 'Selling Costs', namePl: 'Koszty sprzedaży', type: 'expense' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '550', name: 'Administrative Costs', namePl: 'Koszty ogólnego zarządu', type: 'expense' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },

  // Group 6 - Products (Produkty)
  { code: '600', name: 'Finished Products', namePl: 'Produkty gotowe', type: 'asset' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '620', name: 'Work in Progress', namePl: 'Produkcja niezakończona', type: 'asset' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },

  // Group 7 - Revenues and Costs (Przychody i koszty)
  { code: '700', name: 'Sales Revenue', namePl: 'Przychody ze sprzedaży produktów', type: 'revenue' as ChartAccountType, nature: 'credit' as AccountNature, isSynthetic: true },
  { code: '730', name: 'Goods Sales Revenue', namePl: 'Przychody ze sprzedaży towarów', type: 'revenue' as ChartAccountType, nature: 'credit' as AccountNature, isSynthetic: true },
  { code: '750', name: 'Other Operating Revenue', namePl: 'Przychody finansowe', type: 'revenue' as ChartAccountType, nature: 'credit' as AccountNature, isSynthetic: true },
  { code: '751', name: 'Financial Revenue', namePl: 'Koszty finansowe', type: 'expense' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },
  { code: '760', name: 'Other Operating Costs', namePl: 'Pozostałe przychody operacyjne', type: 'revenue' as ChartAccountType, nature: 'credit' as AccountNature, isSynthetic: true },
  { code: '761', name: 'Other Operating Expenses', namePl: 'Pozostałe koszty operacyjne', type: 'expense' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },

  // Group 8 - Equity (Kapitały)
  { code: '800', name: 'Opening/Closing', namePl: 'Rozliczenie wyniku finansowego', type: 'equity' as ChartAccountType, nature: 'credit' as AccountNature, isSynthetic: true },
  { code: '801', name: 'Share Capital', namePl: 'Kapitał podstawowy', type: 'equity' as ChartAccountType, nature: 'credit' as AccountNature, isSynthetic: true },
  { code: '802', name: 'Reserve Capital', namePl: 'Kapitał zapasowy', type: 'equity' as ChartAccountType, nature: 'credit' as AccountNature, isSynthetic: true },
  { code: '803', name: 'Supplementary Capital', namePl: 'Kapitał rezerwowy', type: 'equity' as ChartAccountType, nature: 'credit' as AccountNature, isSynthetic: true },
  { code: '860', name: 'Profit/Loss', namePl: 'Wynik finansowy', type: 'equity' as ChartAccountType, nature: 'credit' as AccountNature, isSynthetic: true },
  { code: '870', name: 'Corporate Tax', namePl: 'Podatek dochodowy', type: 'expense' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true },

  // Group 9 - Off-Balance (Pozabilansowe)
  { code: '900', name: 'Off-Balance Assets', namePl: 'Aktywa warunkowe', type: 'asset' as ChartAccountType, nature: 'debit' as AccountNature, isSynthetic: true, isOffBalance: true },
  { code: '990', name: 'Off-Balance Liabilities', namePl: 'Zobowiązania warunkowe', type: 'liability' as ChartAccountType, nature: 'credit' as AccountNature, isSynthetic: true, isOffBalance: true },
];

export class AccountService {
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

  private getCacheKey(suffix: string): string {
    return `account:${this.organizationId}:${suffix}`;
  }

  private async invalidateCache(): Promise<void> {
    const pattern = `account:${this.organizationId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // ===========================================================================
  // CREATE ACCOUNT
  // ===========================================================================

  async createAccount(input: CreateAccountInput): Promise<Account> {
    const {
      code,
      name,
      namePl,
      description,
      type,
      nature,
      parentId,
      isSynthetic,
      isOffBalance: _isOffBalance,
      allowManualEntry: _allowManualEntry,
      requireCostCenter: _requireCostCenter,
      requireProject: _requireProject,
      vatType: _vatType,
      tags,
    } = input;

    // Validate account code format
    if (!isValidAccountCode(code)) {
      throw new Error('Nieprawidłowy format numeru konta');
    }

    // Check if account with same code exists
    const existing = await this.prisma.chartOfAccount.findFirst({
      where: {
        organizationId: this.organizationId,
        accountCode: code,
      },
    });

    if (existing) {
      throw new Error(`Konto o numerze ${code} już istnieje`);
    }

    // Validate parent exists if provided
    let parentAccount: Account | null = null;
    if (parentId) {
      const parentPrisma = await this.prisma.chartOfAccount.findFirst({
        where: {
          id: parentId,
          organizationId: this.organizationId,
        },
      });

      if (!parentPrisma) {
        throw new Error('Konto nadrzędne nie istnieje');
      }
      parentAccount = mapPrismaToAccount(parentPrisma);
    }

    // Auto-detect category from code
    const category = getCategoryFromCode(code) || '0';

    // Calculate level
    const level = parentAccount ? parentAccount.level + 1 : getAccountLevel(code);

    // Note: isAnalytic = !isSynthetic (computed when needed in mapper)

    // Create account using Prisma field names
    const accountPrisma = await this.prisma.chartOfAccount.create({
      data: {
        organizationId: this.organizationId,
        accountCode: code,
        accountName: name,
        accountNameEn: namePl, // Store Polish name in English field for now
        description: description ?? null,
        accountType: type,
        accountClass: parseInt(category, 10),
        normalBalance: nature,
        status: 'active',
        parentAccountId: parentId ?? null,
        level,
        isSynthetic: isSynthetic ?? false,
        allowsPosting: !isSynthetic,
        tags: tags ?? [],
        createdBy: this.userId,
        currency: 'PLN',
        isMultiCurrency: false,
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Map to domain Account
    const account = mapPrismaToAccount(accountPrisma);

    // Log audit event
    await this.auditLogger.log({
      action: 'account.create',
      entityType: 'Account',
      entityId: account.id,
      userId: this.userId,
      organizationId: this.organizationId,
      changes: { code, name, namePl, type, category },
    });

    return account;
  }

  // ===========================================================================
  // GET ACCOUNT
  // ===========================================================================

  async getAccount(input: GetAccountInput): Promise<Account> {
    const { id, includeChildren, includeParent } = input;

    // Check cache first
    const cacheKey = this.getCacheKey(id);
    const cached = await this.redis.get(cacheKey);
    if (cached && !includeChildren && !includeParent) {
      return JSON.parse(cached) as Account;
    }

    const accountPrisma = await this.prisma.chartOfAccount.findFirst({
      where: {
        id,
        organizationId: this.organizationId,
      },
      include: {
        childAccounts: includeChildren ?? false,
        parentAccount: includeParent ?? false,
      },
    });

    if (!accountPrisma) {
      throw new Error('Konto nie zostało znalezione');
    }

    // Map to domain Account
    const account = mapPrismaToAccount(accountPrisma);

    // Cache result (without includes)
    if (!includeChildren && !includeParent) {
      await this.redis.set(cacheKey, JSON.stringify(account), 'EX', CACHE_TTL);
    }

    return account;
  }

  // ===========================================================================
  // GET ACCOUNT BY CODE
  // ===========================================================================

  async getAccountByCode(input: GetAccountByCodeInput): Promise<Account> {
    const { code, includeChildren, includeParent } = input;

    const accountPrisma = await this.prisma.chartOfAccount.findFirst({
      where: {
        accountCode: code,
        organizationId: this.organizationId,
      },
      include: {
        childAccounts: includeChildren ?? false,
        parentAccount: includeParent ?? false,
      },
    });

    if (!accountPrisma) {
      throw new Error(`Konto o numerze ${code} nie istnieje`);
    }

    return mapPrismaToAccount(accountPrisma);
  }

  // ===========================================================================
  // LIST ACCOUNTS
  // ===========================================================================

  async listAccounts(input: ListAccountsInput): Promise<ListAccountsResult> {
    const {
      type,
      category,
      status,
      parentId,
      isSynthetic,
      isAnalytic: _isAnalytic,
      isOffBalance: _isOffBalance,
      search,
      tags,
      limit,
      offset,
      includeChildren,
      sortBy,
      sortOrder,
    } = input;

    // Build where clause using Prisma field names
    const where: any = {
      organizationId: this.organizationId,
    };

    if (type) where.accountType = type;
    if (category) where.accountClass = parseInt(category, 10);
    if (status) where.status = status;
    if (parentId !== undefined) where.parentAccountId = parentId;
    if (isSynthetic !== undefined) where.isSynthetic = isSynthetic;
    // isAnalytic and isOffBalance are calculated, not stored directly
    if (tags && tags.length > 0) where.tags = { hasSome: tags };

    // Search across multiple fields using Prisma field names
    if (search) {
      where.OR = [
        { accountCode: { contains: search, mode: 'insensitive' } },
        { accountName: { contains: search, mode: 'insensitive' } },
        { accountNameEn: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Map sortBy to Prisma field name
    const sortField = sortBy === 'code' ? 'accountCode' : sortBy === 'name' ? 'accountName' : sortBy ?? 'accountCode';

    // Query
    const [items, total] = await Promise.all([
      this.prisma.chartOfAccount.findMany({
        where,
        orderBy: { [sortField]: sortOrder ?? 'asc' },
        take: limit,
        skip: offset,
        include: {
          childAccounts: includeChildren ?? false,
        },
      }),
      this.prisma.chartOfAccount.count({ where }),
    ]);

    return {
      items: mapPrismaToAccounts(items),
      total,
      limit,
      offset,
    };
  }

  // ===========================================================================
  // UPDATE ACCOUNT
  // ===========================================================================

  async updateAccount(input: UpdateAccountInput): Promise<Account> {
    const {
      id,
      name,
      namePl,
      description,
      status,
      allowManualEntry,
      requireCostCenter: _requireCostCenter,
      requireProject: _requireProject,
      vatType: _vatType,
      tags,
    } = input;

    // Verify account exists
    const existing = await this.prisma.chartOfAccount.findFirst({
      where: {
        id,
        organizationId: this.organizationId,
      },
    });

    if (!existing) {
      throw new Error('Konto nie zostało znalezione');
    }

    // Map status to Prisma-compatible values (Prisma only has 'active' | 'inactive')
    const prismaStatus = status === 'blocked' ? 'inactive' : status;

    // Update account using Prisma field names
    const accountPrisma = await this.prisma.chartOfAccount.update({
      where: { id },
      data: {
        ...(name !== undefined && { accountName: name, accountNameEn: name }),
        ...(namePl !== undefined && { accountName: namePl }),
        ...(description !== undefined && { description }),
        ...(prismaStatus !== undefined && { status: prismaStatus as 'active' | 'inactive' }),
        ...(allowManualEntry !== undefined && { allowsPosting: allowManualEntry }),
        // requireCostCenter, requireProject, vatType are not in Prisma schema
        ...(tags !== undefined && { tags }),
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'account.update',
      entityType: 'Account',
      entityId: id,
      userId: this.userId,
      organizationId: this.organizationId,
      changes: input,
    });

    return mapPrismaToAccount(accountPrisma);
  }

  // ===========================================================================
  // DELETE ACCOUNT
  // ===========================================================================

  async deleteAccount(input: DeleteAccountInput): Promise<DeleteAccountResult> {
    const { id, force } = input;

    // Verify account exists
    const existing = await this.prisma.chartOfAccount.findFirst({
      where: {
        id,
        organizationId: this.organizationId,
      },
    });

    if (!existing) {
      throw new Error('Konto nie zostało znalezione');
    }

    // Check for children
    const childrenCount = await this.prisma.chartOfAccount.count({
      where: { parentAccountId: id },
    });

    if (childrenCount > 0 && !force) {
      throw new Error('Nie można usunąć konta posiadającego konta podrzędne');
    }

    // Check for journal entries
    const entriesCount = await this.prisma.journalLine.count({
      where: { accountId: id },
    });

    if (entriesCount > 0) {
      throw new Error('Nie można usunąć konta z zapisami księgowymi');
    }

    // Delete children if force
    let deletedChildrenCount = 0;
    if (force && childrenCount > 0) {
      const result = await this.prisma.chartOfAccount.deleteMany({
        where: { parentAccountId: id },
      });
      deletedChildrenCount = result.count;
    }

    // Delete account
    await this.prisma.chartOfAccount.delete({
      where: { id },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'account.delete',
      entityType: 'Account',
      entityId: id,
      userId: this.userId,
      organizationId: this.organizationId,
      changes: { code: existing.accountCode, deletedChildrenCount },
    });

    return {
      success: true,
      message: 'Konto zostało usunięte',
      deletedChildrenCount: deletedChildrenCount > 0 ? deletedChildrenCount : undefined,
    };
  }

  // ===========================================================================
  // ACTIVATE ACCOUNT
  // ===========================================================================

  async activateAccount(input: ActivateAccountInput): Promise<AccountStatusResult> {
    const { id } = input;

    const existing = await this.prisma.chartOfAccount.findFirst({
      where: {
        id,
        organizationId: this.organizationId,
      },
    });

    if (!existing) {
      throw new Error('Konto nie zostało znalezione');
    }

    if (existing.status === 'active') {
      throw new Error('Konto jest już aktywne');
    }

    const accountPrisma = await this.prisma.chartOfAccount.update({
      where: { id },
      data: {
        status: 'active',
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'account.activate',
      entityType: 'Account',
      entityId: id,
      userId: this.userId,
      organizationId: this.organizationId,
    });

    return {
      success: true,
      account: mapPrismaToAccount(accountPrisma),
      message: 'Konto zostało aktywowane',
    };
  }

  // ===========================================================================
  // DEACTIVATE ACCOUNT
  // ===========================================================================

  async deactivateAccount(input: DeactivateAccountInput): Promise<AccountStatusResult> {
    const { id, reason } = input;

    const existing = await this.prisma.chartOfAccount.findFirst({
      where: {
        id,
        organizationId: this.organizationId,
      },
    });

    if (!existing) {
      throw new Error('Konto nie zostało znalezione');
    }

    if (existing.status === 'inactive') {
      throw new Error('Konto jest już nieaktywne');
    }

    const accountPrisma = await this.prisma.chartOfAccount.update({
      where: { id },
      data: {
        status: 'inactive',
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'account.deactivate',
      entityType: 'Account',
      entityId: id,
      userId: this.userId,
      organizationId: this.organizationId,
      changes: { reason },
    });

    return {
      success: true,
      account: mapPrismaToAccount(accountPrisma),
      message: 'Konto zostało dezaktywowane',
    };
  }

  // ===========================================================================
  // MOVE ACCOUNT
  // ===========================================================================

  async moveAccount(input: MoveAccountInput): Promise<MoveAccountResult> {
    const { id, newParentId } = input;

    // Cannot move to self
    if (id === newParentId) {
      throw new Error('Konto nie może być swoim własnym rodzicem');
    }

    // Get account
    const accountPrisma = await this.prisma.chartOfAccount.findFirst({
      where: {
        id,
        organizationId: this.organizationId,
      },
    });

    if (!accountPrisma) {
      throw new Error('Konto nie zostało znalezione');
    }

    // Validate new parent if provided
    let newParentPrisma = null;
    if (newParentId) {
      newParentPrisma = await this.prisma.chartOfAccount.findFirst({
        where: {
          id: newParentId,
          organizationId: this.organizationId,
        },
      });

      if (!newParentPrisma) {
        throw new Error('Nowe konto nadrzędne nie istnieje');
      }
    }

    const previousParentId = accountPrisma.parentAccountId;
    const newLevel = newParentPrisma ? newParentPrisma.level + 1 : 1;

    // Update account
    const updated = await this.prisma.chartOfAccount.update({
      where: { id },
      data: {
        parentAccountId: newParentId,
        level: newLevel,
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'account.move',
      entityType: 'Account',
      entityId: id,
      userId: this.userId,
      organizationId: this.organizationId,
      changes: { previousParentId, newParentId },
    });

    return {
      success: true,
      account: mapPrismaToAccount(updated),
      previousParentId,
      message: 'Konto zostało przeniesione',
    };
  }

  // ===========================================================================
  // GET ACCOUNT TREE
  // ===========================================================================

  async getAccountTree(input: GetAccountTreeInput): Promise<GetAccountTreeResult> {
    const { category, type, includeInactive, maxDepth } = input;

    // Build where clause using Prisma field names
    const where: any = {
      organizationId: this.organizationId,
    };

    if (category) where.accountClass = parseInt(category, 10);
    if (type) where.accountType = type;
    if (!includeInactive) where.status = 'active';

    // Get all accounts
    const accounts = await this.prisma.chartOfAccount.findMany({
      where,
      orderBy: { accountCode: 'asc' },
    });

    // Build tree structure using mapper
    const accountMap = new Map<string, AccountTreeNode>();
    const rootNodes: AccountTreeNode[] = [];

    // First pass: create all nodes with mapped accounts
    for (const prismaAccount of accounts) {
      const mappedAccount = mapPrismaToAccount(prismaAccount);
      accountMap.set(prismaAccount.id, {
        ...mappedAccount,
        children: [],
        childrenCount: 0,
      });
    }

    // Second pass: build hierarchy
    for (const prismaAccount of accounts) {
      const node = accountMap.get(prismaAccount.id)!;
      if (prismaAccount.parentAccountId && accountMap.has(prismaAccount.parentAccountId)) {
        const parent = accountMap.get(prismaAccount.parentAccountId)!;
        if (node.level <= (maxDepth ?? 5)) {
          parent.children.push(node);
          parent.childrenCount = parent.children.length;
        }
      } else {
        rootNodes.push(node);
      }
    }

    return {
      nodes: rootNodes,
      totalAccounts: accounts.length,
      maxDepth: maxDepth ?? 5,
    };
  }

  // ===========================================================================
  // SEARCH ACCOUNTS
  // ===========================================================================

  async searchAccounts(input: SearchAccountsInput): Promise<SearchAccountsResult> {
    const { query, searchIn, type, category, status, limit } = input;

    // Map domain field names to Prisma field names
    const fieldMapping: Record<string, string> = {
      code: 'accountCode',
      name: 'accountName',
      namePl: 'accountName',
      description: 'description',
    };

    // Build OR conditions based on searchIn using Prisma field names
    const searchFields = searchIn ?? ['code', 'name', 'namePl'];
    const orConditions = searchFields.map((field) => ({
      [fieldMapping[field] ?? field]: { contains: query, mode: 'insensitive' as const },
    }));

    // Build where clause using Prisma field names
    const where: any = {
      organizationId: this.organizationId,
      OR: orConditions,
    };

    if (type) where.accountType = type;
    if (category) where.accountClass = parseInt(category, 10);
    if (status) where.status = status;

    // Query
    const [items, total] = await Promise.all([
      this.prisma.chartOfAccount.findMany({
        where,
        orderBy: { accountCode: 'asc' },
        take: limit ?? 20,
      }),
      this.prisma.chartOfAccount.count({ where }),
    ]);

    return {
      items: mapPrismaToAccounts(items),
      total,
      query,
    };
  }

  // ===========================================================================
  // VALIDATE ACCOUNT CODE
  // ===========================================================================

  async validateAccountCode(input: ValidateAccountCodeInput): Promise<ValidateAccountCodeResult> {
    const { code, excludeId } = input;
    const errors: string[] = [];

    // Check format
    const isValid = isValidAccountCode(code);
    if (!isValid) {
      errors.push('Numer konta musi zaczynać się od cyfry');
    }

    // Check uniqueness using Prisma field name
    const where: any = {
      organizationId: this.organizationId,
      accountCode: code,
    };
    if (excludeId) {
      where.id = { not: excludeId };
    }

    const existing = await this.prisma.chartOfAccount.findFirst({ where });
    const isUnique = !existing;
    if (!isUnique) {
      errors.push('Konto o tym numerze już istnieje');
    }

    // Suggest category, type, and nature
    const suggestedCategory = getCategoryFromCode(code);
    const suggestedType = suggestedCategory ? getTypeFromCategory(suggestedCategory) : null;
    const suggestedNature = suggestedType ? getNatureFromType(suggestedType) : null;

    return {
      isValid,
      isUnique,
      suggestedCategory,
      suggestedType,
      suggestedNature,
      errors,
    };
  }

  // ===========================================================================
  // GET ACCOUNT BALANCE
  // ===========================================================================

  async getAccountBalance(input: GetAccountBalanceInput): Promise<AccountBalance> {
    const { accountId, fiscalYearId, asOfDate, includePendingEntries } = input;

    // Get account
    const account = await this.prisma.chartOfAccount.findFirst({
      where: {
        id: accountId,
        organizationId: this.organizationId,
      },
    });

    if (!account) {
      throw new Error('Konto nie zostało znalezione');
    }

    // Build where clause for journal lines
    const where: any = {
      accountId,
      journalEntry: {
        organizationId: this.organizationId,
      },
    };

    if (fiscalYearId) {
      where.journalEntry.fiscalYearId = fiscalYearId;
    }

    if (asOfDate) {
      where.journalEntry.entryDate = { lte: asOfDate };
    }

    if (!includePendingEntries) {
      where.journalEntry.status = 'posted';
    }

    // Aggregate journal lines
    const aggregates = await this.prisma.journalLine.aggregate({
      where,
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
      _count: true,
    });

    const periodDebit = Number(aggregates._sum?.debitAmount ?? 0);
    const periodCredit = Number(aggregates._sum?.creditAmount ?? 0);

    // Calculate closing balance based on account nature (using Prisma field name)
    let closingBalance: number;
    if (account.normalBalance === 'debit') {
      closingBalance = periodDebit - periodCredit;
    } else {
      closingBalance = periodCredit - periodDebit;
    }

    return {
      accountId,
      accountCode: account.accountCode,
      accountName: account.accountName,
      openingDebit: 0,
      openingCredit: 0,
      openingBalance: 0,
      periodDebit,
      periodCredit,
      closingDebit: periodDebit,
      closingCredit: periodCredit,
      closingBalance,
      entriesCount: aggregates._count,
      asOfDate: asOfDate ?? new Date(),
    };
  }

  // ===========================================================================
  // BATCH CREATE ACCOUNTS
  // ===========================================================================

  async batchCreateAccounts(input: BatchCreateAccountsInput): Promise<BatchCreateAccountsResult> {
    const { accounts, skipErrors } = input;

    const created: Account[] = [];
    const failed: Array<{ index: number; code: string; error: string }> = [];

    for (let i = 0; i < accounts.length; i++) {
      const accountInput = accounts[i];
      if (!accountInput) continue;
      try {
        const account = await this.createAccount(accountInput);
        created.push(account);
      } catch (error) {
        if (skipErrors) {
          failed.push({
            index: i,
            code: accountInput.code,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        } else {
          throw error;
        }
      }
    }

    return {
      success: failed.length === 0 || skipErrors,
      created,
      failed,
      message: `Utworzono ${created.length} kont${failed.length > 0 ? `, ${failed.length} błędów` : ''}`,
    };
  }

  // ===========================================================================
  // IMPORT ACCOUNTS
  // ===========================================================================

  async importAccounts(input: ImportAccountsInput): Promise<ImportAccountsResult> {
    const { templateId, accounts: customAccounts, overwriteExisting } = input;

    let accountsToImport: CreateAccountInput[];

    if (templateId === 'polish_standard' || (!templateId && !customAccounts)) {
      // Add missing required properties with defaults
      accountsToImport = POLISH_STANDARD_ACCOUNTS.map(acc => ({
        ...acc,
        tags: [],
        isOffBalance: acc.isOffBalance ?? false,
        allowManualEntry: true,
        requireCostCenter: false,
        requireProject: false,
      }));
    } else if (customAccounts) {
      accountsToImport = customAccounts;
    } else {
      throw new Error('Brak kont do importu');
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const accountInput of accountsToImport) {
      try {
        // Check if exists using Prisma field name
        const existing = await this.prisma.chartOfAccount.findFirst({
          where: {
            organizationId: this.organizationId,
            accountCode: accountInput.code,
          },
        });

        if (existing) {
          if (overwriteExisting) {
            await this.prisma.chartOfAccount.update({
              where: { id: existing.id },
              data: {
                accountName: accountInput.name,
                accountNameEn: accountInput.namePl,
                accountType: accountInput.type,
                normalBalance: accountInput.nature,
                updatedAt: new Date(),
              },
            });
            updated++;
          } else {
            skipped++;
          }
        } else {
          await this.createAccount(accountInput);
          imported++;
        }
      } catch (error) {
        errors.push(`${accountInput.code}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: errors.length === 0,
      imported,
      updated,
      skipped,
      errors,
      message: `Import zakończony: ${imported} utworzonych, ${updated} zaktualizowanych, ${skipped} pominiętych`,
    };
  }

  // ===========================================================================
  // EXPORT ACCOUNTS
  // ===========================================================================

  async exportAccounts(input: ExportAccountsInput): Promise<ExportAccountsResult> {
    const { format, category, includeInactive, includeBalances: _includeBalances, fiscalYearId: _fiscalYearId } = input;

    // Build where clause using Prisma field names
    const where: any = {
      organizationId: this.organizationId,
    };

    if (category) where.accountClass = parseInt(category, 10);
    if (!includeInactive) where.status = 'active';

    // Get accounts
    const accountsPrisma = await this.prisma.chartOfAccount.findMany({
      where,
      orderBy: { accountCode: 'asc' },
    });

    // Map to domain accounts for export
    const accounts = mapPrismaToAccounts(accountsPrisma);

    // Format data
    let data: string;
    let filename: string;

    if (format === 'json') {
      data = JSON.stringify(accounts, null, 2);
      filename = `accounts_${this.organizationId}_${Date.now()}.json`;
    } else if (format === 'csv') {
      const headers = ['code', 'name', 'namePl', 'type', 'category', 'nature', 'status'];
      const rows = accounts.map((acc) =>
        [acc.code, acc.name, acc.namePl, acc.type, acc.category, acc.nature, acc.status].join(',')
      );
      data = [headers.join(','), ...rows].join('\n');
      filename = `accounts_${this.organizationId}_${Date.now()}.csv`;
    } else {
      // xlsx - return CSV for now (xlsx would require additional library)
      const headers = ['code', 'name', 'namePl', 'type', 'category', 'nature', 'status'];
      const rows = accounts.map((acc) =>
        [acc.code, acc.name, acc.namePl, acc.type, acc.category, acc.nature, acc.status].join(',')
      );
      data = [headers.join(','), ...rows].join('\n');
      filename = `accounts_${this.organizationId}_${Date.now()}.csv`;
    }

    return {
      data,
      format: format ?? 'json',
      filename,
      accountsCount: accounts.length,
    };
  }

  // ===========================================================================
  // GET ACCOUNT STATISTICS
  // ===========================================================================

  async getAccountStatistics(input: GetAccountStatisticsInput): Promise<AccountStatistics> {
    const { fiscalYearId } = input;

    // Get counts using Prisma field names
    const [
      totalAccounts,
      activeAccounts,
      inactiveAccounts,
      syntheticAccounts,
      analyticAccounts,
    ] = await Promise.all([
      this.prisma.chartOfAccount.count({
        where: { organizationId: this.organizationId },
      }),
      this.prisma.chartOfAccount.count({
        where: { organizationId: this.organizationId, status: 'active' },
      }),
      this.prisma.chartOfAccount.count({
        where: { organizationId: this.organizationId, status: 'inactive' },
      }),
      this.prisma.chartOfAccount.count({
        where: { organizationId: this.organizationId, isSynthetic: true },
      }),
      // isAnalytic is calculated as !isSynthetic && allowsPosting
      this.prisma.chartOfAccount.count({
        where: { organizationId: this.organizationId, isSynthetic: false, allowsPosting: true },
      }),
    ]);

    // Get counts by type using Prisma field name
    const byTypeResults = await this.prisma.chartOfAccount.groupBy({
      by: ['accountType'],
      where: { organizationId: this.organizationId },
      _count: { id: true },
    });

    const byType: Record<ChartAccountType, number> = {
      asset: 0,
      liability: 0,
      equity: 0,
      revenue: 0,
      expense: 0,
    };
    for (const result of byTypeResults) {
      byType[result.accountType as ChartAccountType] = result._count.id;
    }

    // Get counts by category using Prisma field name
    const byCategoryResults = await this.prisma.chartOfAccount.groupBy({
      by: ['accountClass'],
      where: { organizationId: this.organizationId },
      _count: { id: true },
    });

    const byCategory: Record<AccountCategory, number> = {
      '0': 0, '1': 0, '2': 0, '3': 0, '4': 0,
      '5': 0, '6': 0, '7': 0, '8': 0, '9': 0,
    };
    for (const result of byCategoryResults) {
      byCategory[String(result.accountClass) as AccountCategory] = result._count.id;
    }

    // Get accounts with entries
    const entriesWhere: any = {
      journalEntry: { organizationId: this.organizationId },
    };
    if (fiscalYearId) {
      entriesWhere.journalEntry.fiscalYearId = fiscalYearId;
    }

    const accountsWithEntries = await this.prisma.journalLine.findMany({
      where: entriesWhere,
      select: { accountId: true },
      distinct: ['accountId'],
    });

    const accountsWithEntriesCount = accountsWithEntries.length;
    const accountsWithoutEntriesCount = totalAccounts - accountsWithEntriesCount;

    return {
      totalAccounts,
      activeAccounts,
      inactiveAccounts,
      syntheticAccounts,
      analyticAccounts,
      byType,
      byCategory,
      accountsWithEntries: accountsWithEntriesCount,
      accountsWithoutEntries: accountsWithoutEntriesCount,
    };
  }
}
