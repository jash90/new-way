/**
 * Account Mapper Utilities
 *
 * Converts between Prisma ChartOfAccount records and domain Account interfaces.
 * This bridges the database model (Prisma) with the application model (shared schemas).
 */

import type {
  ChartOfAccount as PrismaChartOfAccount,
  ChartAccountType,
  AccountNature,
  AccountStatus,
} from '@prisma/client';
import type {
  Account,
  AccountCategory,
  AccountTreeNode,
} from '@ksiegowacrm/shared';

// ===========================================================================
// TYPE MAPPINGS
// ===========================================================================

/**
 * Map accountClass (0-9) to AccountCategory
 */
function mapAccountClassToCategory(accountClass: number): AccountCategory {
  const classStr = String(accountClass) as AccountCategory;
  // Validate it's a valid category (0-9)
  if (accountClass >= 0 && accountClass <= 9) {
    return classStr;
  }
  // Default to '0' for invalid values
  return '0';
}

/**
 * Map Prisma ChartAccountType to domain type (they should match)
 */
function mapAccountType(prismaType: ChartAccountType): Account['type'] {
  return prismaType as Account['type'];
}

/**
 * Map Prisma AccountNature to domain nature
 */
function mapAccountNature(prismaBalance: AccountNature): Account['nature'] {
  return prismaBalance as Account['nature'];
}

/**
 * Map Prisma AccountStatus to domain status
 */
function mapAccountStatus(prismaStatus: AccountStatus): Account['status'] {
  return prismaStatus as Account['status'];
}

// ===========================================================================
// PRISMA TO DOMAIN MAPPERS
// ===========================================================================

/**
 * Convert a Prisma ChartOfAccount record to domain Account interface
 */
export function mapPrismaToAccount(prismaAccount: PrismaChartOfAccount): Account {
  return {
    id: prismaAccount.id,
    organizationId: prismaAccount.organizationId,
    code: prismaAccount.accountCode,
    name: prismaAccount.accountName,
    namePl: prismaAccount.accountName, // Use Polish name as primary
    description: prismaAccount.description,
    type: mapAccountType(prismaAccount.accountType),
    category: mapAccountClassToCategory(prismaAccount.accountClass),
    nature: mapAccountNature(prismaAccount.normalBalance),
    status: mapAccountStatus(prismaAccount.status),

    // Hierarchy
    parentId: prismaAccount.parentAccountId,
    level: prismaAccount.level,
    isSynthetic: prismaAccount.isSynthetic,
    isAnalytic: prismaAccount.allowsPosting && !prismaAccount.isSynthetic,
    isOffBalance: prismaAccount.accountClass === 9,

    // Settings
    allowManualEntry: prismaAccount.allowsPosting,
    requireProject: false, // Not in current schema
    requireCostCenter: false, // Not in current schema
    requireDimension: false, // Not in current schema

    // VAT settings
    vatType: null, // Not stored in current schema, default to null

    // Currency
    currency: prismaAccount.currency,
    isMultiCurrency: prismaAccount.isMultiCurrency,

    // Metadata
    tags: prismaAccount.tags,

    // Audit
    createdAt: prismaAccount.createdAt,
    createdBy: prismaAccount.createdBy,
    updatedAt: prismaAccount.updatedAt,
    updatedBy: prismaAccount.updatedBy,
  };
}

/**
 * Convert array of Prisma ChartOfAccount records to domain Account array
 */
export function mapPrismaToAccounts(prismaAccounts: PrismaChartOfAccount[]): Account[] {
  return prismaAccounts.map(mapPrismaToAccount);
}

/**
 * Convert Prisma ChartOfAccount with children to AccountTreeNode
 */
export function mapPrismaToAccountTreeNode(
  prismaAccount: PrismaChartOfAccount & { childAccounts?: PrismaChartOfAccount[] },
): AccountTreeNode {
  const baseAccount = mapPrismaToAccount(prismaAccount);

  return {
    ...baseAccount,
    children: prismaAccount.childAccounts
      ? prismaAccount.childAccounts.map(mapPrismaToAccountTreeNode)
      : [],
    childrenCount: prismaAccount.childAccounts?.length ?? 0,
  };
}

// ===========================================================================
// DOMAIN TO PRISMA MAPPERS (for create/update operations)
// ===========================================================================

/**
 * Convert domain Account category to Prisma accountClass
 */
function mapCategoryToAccountClass(category: AccountCategory): number {
  return parseInt(category, 10);
}

/**
 * Prepare create data for Prisma from domain Account input
 */
export function mapAccountToCreateInput(
  account: Partial<Account> & { code: string; name: string; type: Account['type']; nature: Account['nature'] },
) {
  return {
    accountCode: account.code,
    accountName: account.name,
    accountNameEn: account.name, // English name same as primary for now
    description: account.description ?? null,
    accountType: account.type,
    accountClass: account.category ? mapCategoryToAccountClass(account.category) : 0,
    normalBalance: account.nature,
    parentAccountId: account.parentId ?? null,
    level: account.level ?? 1,
    isSynthetic: account.isSynthetic ?? false,
    status: account.status ?? 'active',
    currency: account.currency ?? 'PLN',
    isMultiCurrency: account.isMultiCurrency ?? false,
    tags: account.tags ?? [],
  };
}

/**
 * Prepare update data for Prisma from domain Account input
 */
export function mapAccountToUpdateInput(account: Partial<Account>) {
  const updateData: Record<string, unknown> = {};

  if (account.code !== undefined) updateData.accountCode = account.code;
  if (account.name !== undefined) {
    updateData.accountName = account.name;
    updateData.accountNameEn = account.name;
  }
  if (account.description !== undefined) updateData.description = account.description;
  if (account.type !== undefined) updateData.accountType = account.type;
  if (account.category !== undefined) updateData.accountClass = mapCategoryToAccountClass(account.category);
  if (account.nature !== undefined) updateData.normalBalance = account.nature;
  if (account.status !== undefined) updateData.status = account.status;
  if (account.parentId !== undefined) updateData.parentAccountId = account.parentId;
  if (account.level !== undefined) updateData.level = account.level;
  if (account.isSynthetic !== undefined) updateData.isSynthetic = account.isSynthetic;
  if (account.currency !== undefined) updateData.currency = account.currency;
  if (account.isMultiCurrency !== undefined) updateData.isMultiCurrency = account.isMultiCurrency;
  if (account.tags !== undefined) updateData.tags = account.tags;

  return updateData;
}

// ===========================================================================
// QUERY HELPERS
// ===========================================================================

/**
 * Map domain field names to Prisma field names for queries
 */
export const accountFieldMapping = {
  code: 'accountCode',
  name: 'accountName',
  namePl: 'accountName',
  type: 'accountType',
  category: 'accountClass',
  nature: 'normalBalance',
  parentId: 'parentAccountId',
  children: 'childAccounts',
} as const;

/**
 * Convert domain orderBy to Prisma orderBy
 */
export function mapAccountOrderBy(
  orderBy: { field: keyof typeof accountFieldMapping; direction: 'asc' | 'desc' },
) {
  const prismaField = accountFieldMapping[orderBy.field] ?? orderBy.field;
  return { [prismaField]: orderBy.direction };
}

/**
 * Convert domain where clause to Prisma where clause
 */
export function mapAccountWhere(where: Partial<Record<keyof Account, unknown>>) {
  const prismaWhere: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;

    const mappedKey = accountFieldMapping[key as keyof typeof accountFieldMapping] ?? key;
    prismaWhere[mappedKey] = value;
  }

  return prismaWhere;
}
