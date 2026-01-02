import { z } from 'zod';

// ===========================================================================
// ACCOUNT TYPE - Typ konta (bilansowy)
// ===========================================================================

export const chartAccountTypeSchema = z.enum([
  'asset',       // Aktywa (konta 0-3)
  'liability',   // Pasywa/Zobowiązania
  'equity',      // Kapitał (konto 8)
  'revenue',     // Przychody (konto 7)
  'expense',     // Koszty (konta 4-5)
]);

export type ChartAccountType = z.infer<typeof chartAccountTypeSchema>;

// Alias for backwards compatibility and convenience
export type AccountType = ChartAccountType;

// ===========================================================================
// ACCOUNT CATEGORY - Grupa kont wg polskiego planu kont
// ===========================================================================

export const accountCategorySchema = z.enum([
  '0',  // Aktywa trwałe (Fixed Assets)
  '1',  // Środki pieniężne, rachunki bankowe (Cash & Bank)
  '2',  // Rozrachunki i roszczenia (Settlements)
  '3',  // Materiały i towary (Materials & Goods)
  '4',  // Koszty według rodzajów (Costs by Type)
  '5',  // Koszty według funkcji/miejsc (Costs by Function)
  '6',  // Produkty (Products)
  '7',  // Przychody i koszty (Revenues & Costs)
  '8',  // Kapitały (Equity)
  '9',  // Konta pozabilansowe (Off-Balance)
]);

export type AccountCategory = z.infer<typeof accountCategorySchema>;

// ===========================================================================
// ACCOUNT NATURE - Natura konta (strona zwiększająca saldo)
// ===========================================================================

export const accountNatureSchema = z.enum([
  'debit',     // Zwiększa się po stronie Winien (Dt)
  'credit',    // Zwiększa się po stronie Ma (Ct)
]);

export type AccountNature = z.infer<typeof accountNatureSchema>;

// ===========================================================================
// ACCOUNT STATUS
// ===========================================================================

export const accountStatusSchema = z.enum([
  'active',     // Konto aktywne, można księgować
  'inactive',   // Konto nieaktywne, nie można księgować
  'blocked',    // Konto zablokowane (tymczasowo)
]);

export type AccountStatus = z.infer<typeof accountStatusSchema>;

// ===========================================================================
// VAT SETTINGS - Ustawienia VAT dla konta
// ===========================================================================

export const vatTypeSchema = z.enum([
  'none',           // Bez VAT
  'standard',       // Stawka podstawowa (23%)
  'reduced_8',      // Stawka obniżona (8%)
  'reduced_5',      // Stawka obniżona (5%)
  'zero',           // Stawka 0%
  'exempt',         // Zwolniony z VAT
  'reverse_charge', // Odwrotne obciążenie
]);

export type VatType = z.infer<typeof vatTypeSchema>;

// ===========================================================================
// ACCOUNT - Konto księgowe
// ===========================================================================

export interface Account {
  id: string;
  organizationId: string;
  code: string;               // Numer konta np. "010", "010-01", "221-01-001"
  name: string;               // Nazwa konta np. "Środki trwałe"
  namePl: string;             // Polska nazwa konta
  description: string | null; // Opis konta
  type: ChartAccountType;     // Typ konta (bilansowy)
  category: AccountCategory;  // Kategoria wg planu kont
  nature: AccountNature;      // Natura konta (Dt/Ct)
  status: AccountStatus;      // Status konta

  // Hierarchia
  parentId: string | null;    // ID konta nadrzędnego
  level: number;              // Poziom w hierarchii (1 = syntetyczne)
  isSynthetic: boolean;       // Czy konto syntetyczne (grupujące)
  isAnalytic: boolean;        // Czy konto analityczne (szczegółowe)
  isOffBalance: boolean;      // Czy pozabilansowe

  // Ustawienia
  allowManualEntry?: boolean;  // Czy dozwolone ręczne księgowanie
  requireCostCenter?: boolean; // Czy wymagane MPK
  requireProject?: boolean;    // Czy wymagany projekt
  requireDimension?: boolean;  // Czy wymagany wymiar analityczny

  // VAT
  vatType?: VatType | null;    // Typ VAT (jeśli dotyczy)

  // Currency
  currency?: string;           // Waluta konta (default: PLN)
  isMultiCurrency?: boolean;   // Czy wielowalutowe

  // Metadane
  sortOrder?: number;          // Kolejność sortowania
  tags: string[];             // Tagi pomocnicze

  // Audit
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string | null;

  // Relacje (opcjonalne)
  parent?: Account;
  children?: Account[];
}

// ===========================================================================
// CREATE ACCOUNT - Tworzenie konta
// ===========================================================================

export const createAccountSchema = z.object({
  code: z.string()
    .min(1, 'Numer konta jest wymagany')
    .max(20, 'Numer konta może mieć maksymalnie 20 znaków')
    .regex(/^[0-9\-]+$/, 'Numer konta może zawierać tylko cyfry i myślniki'),
  name: z.string()
    .min(1, 'Nazwa konta jest wymagana')
    .max(200, 'Nazwa konta może mieć maksymalnie 200 znaków'),
  namePl: z.string()
    .min(1, 'Polska nazwa konta jest wymagana')
    .max(200, 'Polska nazwa może mieć maksymalnie 200 znaków'),
  description: z.string().max(1000).nullable().optional(),
  type: chartAccountTypeSchema,
  nature: accountNatureSchema,
  parentId: z.string().uuid().nullable().optional(),
  isSynthetic: z.boolean().default(false),
  isOffBalance: z.boolean().default(false),
  allowManualEntry: z.boolean().default(true),
  requireCostCenter: z.boolean().default(false),
  requireProject: z.boolean().default(false),
  vatType: vatTypeSchema.nullable().optional(),
  tags: z.array(z.string()).default([]),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

// ===========================================================================
// GET ACCOUNT
// ===========================================================================

export const getAccountSchema = z.object({
  id: z.string().uuid(),
  includeChildren: z.boolean().default(false),
  includeParent: z.boolean().default(false),
});

export type GetAccountInput = z.infer<typeof getAccountSchema>;

// ===========================================================================
// GET ACCOUNT BY CODE
// ===========================================================================

export const getAccountByCodeSchema = z.object({
  code: z.string().min(1),
  includeChildren: z.boolean().default(false),
  includeParent: z.boolean().default(false),
});

export type GetAccountByCodeInput = z.infer<typeof getAccountByCodeSchema>;

// ===========================================================================
// LIST ACCOUNTS - Lista kont
// ===========================================================================

export const listAccountsSchema = z.object({
  type: chartAccountTypeSchema.optional(),
  category: accountCategorySchema.optional(),
  status: accountStatusSchema.optional(),
  parentId: z.string().uuid().nullable().optional(),
  isSynthetic: z.boolean().optional(),
  isAnalytic: z.boolean().optional(),
  isOffBalance: z.boolean().optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(500).default(100),
  offset: z.number().int().min(0).default(0),
  includeChildren: z.boolean().default(false),
  sortBy: z.enum(['code', 'name', 'createdAt']).default('code'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type ListAccountsInput = z.infer<typeof listAccountsSchema>;

export interface ListAccountsResult {
  items: Account[];
  total: number;
  limit: number;
  offset: number;
}

// ===========================================================================
// UPDATE ACCOUNT
// ===========================================================================

export const updateAccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  namePl: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: accountStatusSchema.optional(),
  allowManualEntry: z.boolean().optional(),
  requireCostCenter: z.boolean().optional(),
  requireProject: z.boolean().optional(),
  vatType: vatTypeSchema.nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

// ===========================================================================
// DELETE ACCOUNT
// ===========================================================================

export const deleteAccountSchema = z.object({
  id: z.string().uuid(),
  force: z.boolean().default(false), // Usuń nawet jeśli ma dzieci
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export interface DeleteAccountResult {
  success: boolean;
  message: string;
  deletedChildrenCount?: number;
}

// ===========================================================================
// ACTIVATE/DEACTIVATE ACCOUNT
// ===========================================================================

export const activateAccountSchema = z.object({
  id: z.string().uuid(),
});

export type ActivateAccountInput = z.infer<typeof activateAccountSchema>;

export const deactivateAccountSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export type DeactivateAccountInput = z.infer<typeof deactivateAccountSchema>;

export interface AccountStatusResult {
  success: boolean;
  account: Account;
  message: string;
}

// ===========================================================================
// MOVE ACCOUNT - Przeniesienie konta w hierarchii
// ===========================================================================

export const moveAccountSchema = z.object({
  id: z.string().uuid(),
  newParentId: z.string().uuid().nullable(),
});

export type MoveAccountInput = z.infer<typeof moveAccountSchema>;

export interface MoveAccountResult {
  success: boolean;
  account: Account;
  previousParentId: string | null;
  message: string;
}

// ===========================================================================
// GET ACCOUNT TREE - Drzewo kont
// ===========================================================================

export const getAccountTreeSchema = z.object({
  category: accountCategorySchema.optional(),
  type: chartAccountTypeSchema.optional(),
  includeInactive: z.boolean().default(false),
  maxDepth: z.number().int().min(1).max(10).default(5),
});

export type GetAccountTreeInput = z.infer<typeof getAccountTreeSchema>;

export interface AccountTreeNode extends Account {
  children: AccountTreeNode[];
  childrenCount: number;
}

export interface GetAccountTreeResult {
  nodes: AccountTreeNode[];
  totalAccounts: number;
  maxDepth: number;
}

// ===========================================================================
// SEARCH ACCOUNTS - Wyszukiwanie kont
// ===========================================================================

export const searchAccountsSchema = z.object({
  query: z.string().min(1).max(100),
  searchIn: z.array(z.enum(['code', 'name', 'namePl', 'description', 'tags'])).default(['code', 'name', 'namePl']),
  type: chartAccountTypeSchema.optional(),
  category: accountCategorySchema.optional(),
  status: accountStatusSchema.optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export type SearchAccountsInput = z.infer<typeof searchAccountsSchema>;

export interface SearchAccountsResult {
  items: Account[];
  total: number;
  query: string;
}

// ===========================================================================
// VALIDATE ACCOUNT CODE - Walidacja numeru konta
// ===========================================================================

export const validateAccountCodeSchema = z.object({
  code: z.string().min(1).max(20),
  excludeId: z.string().uuid().optional(), // Wyklucz przy edycji
});

export type ValidateAccountCodeInput = z.infer<typeof validateAccountCodeSchema>;

export interface ValidateAccountCodeResult {
  isValid: boolean;
  isUnique: boolean;
  suggestedCategory: AccountCategory | null;
  suggestedType: AccountType | null;
  suggestedNature: AccountNature | null;
  errors: string[];
}

// ===========================================================================
// ACCOUNT BALANCE - Saldo konta
// ===========================================================================

export const getAccountBalanceSchema = z.object({
  accountId: z.string().uuid(),
  fiscalYearId: z.string().uuid().optional(),
  asOfDate: z.coerce.date().optional(),
  includePendingEntries: z.boolean().default(false),
});

export type GetAccountBalanceInput = z.infer<typeof getAccountBalanceSchema>;

export interface AccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  openingDebit: number;
  openingCredit: number;
  openingBalance: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
  closingBalance: number;
  entriesCount: number;
  asOfDate: Date;
}

// ===========================================================================
// BATCH CREATE ACCOUNTS - Masowe tworzenie kont
// ===========================================================================

export const batchCreateAccountsSchema = z.object({
  accounts: z.array(createAccountSchema).min(1).max(100),
  skipErrors: z.boolean().default(false), // Kontynuuj mimo błędów
});

export type BatchCreateAccountsInput = z.infer<typeof batchCreateAccountsSchema>;

export interface BatchCreateAccountsResult {
  success: boolean;
  created: Account[];
  failed: Array<{
    index: number;
    code: string;
    error: string;
  }>;
  message: string;
}

// ===========================================================================
// IMPORT ACCOUNTS - Import planu kont
// ===========================================================================

export const importAccountsSchema = z.object({
  templateId: z.string().optional(), // ID szablonu planu kont
  accounts: z.array(createAccountSchema).optional(),
  overwriteExisting: z.boolean().default(false),
});

export type ImportAccountsInput = z.infer<typeof importAccountsSchema>;

export interface ImportAccountsResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
  message: string;
}

// ===========================================================================
// EXPORT ACCOUNTS - Eksport planu kont
// ===========================================================================

export const exportAccountsSchema = z.object({
  format: z.enum(['json', 'csv', 'xlsx']).default('json'),
  category: accountCategorySchema.optional(),
  includeInactive: z.boolean().default(false),
  includeBalances: z.boolean().default(false),
  fiscalYearId: z.string().uuid().optional(),
});

export type ExportAccountsInput = z.infer<typeof exportAccountsSchema>;

export interface ExportAccountsResult {
  data: string; // Base64 encoded dla xlsx, string dla json/csv
  format: string;
  filename: string;
  accountsCount: number;
}

// ===========================================================================
// ACCOUNT STATISTICS
// ===========================================================================

export const getAccountStatisticsSchema = z.object({
  fiscalYearId: z.string().uuid().optional(),
});

export type GetAccountStatisticsInput = z.infer<typeof getAccountStatisticsSchema>;

export interface AccountStatistics {
  totalAccounts: number;
  activeAccounts: number;
  inactiveAccounts: number;
  syntheticAccounts: number;
  analyticAccounts: number;
  byType: Record<AccountType, number>;
  byCategory: Record<AccountCategory, number>;
  accountsWithEntries: number;
  accountsWithoutEntries: number;
}

// ===========================================================================
// STANDARD CHART OF ACCOUNTS TEMPLATES
// ===========================================================================

export const chartOfAccountsTemplateSchema = z.enum([
  'polish_standard',     // Standardowy polski plan kont
  'polish_simplified',   // Uproszczony plan kont
  'polish_full',         // Pełny plan kont wg UoR
  'custom',              // Własny plan kont
]);

export type ChartOfAccountsTemplate = z.infer<typeof chartOfAccountsTemplateSchema>;

// ===========================================================================
// HELPER FUNCTIONS FOR ACCOUNT CODE PARSING
// ===========================================================================

/**
 * Określa kategorię konta na podstawie numeru
 * @param code Numer konta np. "010", "221"
 * @returns Kategoria konta
 */
export function getCategoryFromCode(code: string): AccountCategory | null {
  const firstChar = code.charAt(0);
  if (/^[0-9]$/.test(firstChar)) {
    return firstChar as AccountCategory;
  }
  return null;
}

/**
 * Określa typ konta na podstawie kategorii
 * @param category Kategoria konta
 * @returns Typ konta
 */
export function getTypeFromCategory(category: AccountCategory): AccountType {
  switch (category) {
    case '0':
    case '1':
    case '2':
    case '3':
    case '6':
      return 'asset';
    case '4':
    case '5':
      return 'expense';
    case '7':
      return 'revenue';
    case '8':
      return 'equity';
    case '9':
      return 'asset'; // Off-balance typically treated as assets
    default:
      return 'asset';
  }
}

/**
 * Określa naturę konta (Dt/Ct) na podstawie typu
 * @param type Typ konta
 * @returns Natura konta
 */
export function getNatureFromType(type: AccountType): AccountNature {
  switch (type) {
    case 'asset':
    case 'expense':
      return 'debit';
    case 'liability':
    case 'equity':
    case 'revenue':
      return 'credit';
    default:
      return 'debit';
  }
}

/**
 * Waliduje numer konta zgodnie z polskimi standardami
 * @param code Numer konta
 * @returns Czy numer jest poprawny
 */
export function isValidAccountCode(code: string): boolean {
  // Musi zaczynać się od cyfry 0-9
  // Może zawierać cyfry i myślniki
  // Maksymalnie 20 znaków
  return /^[0-9][0-9\-]{0,19}$/.test(code);
}

/**
 * Zwraca poziom konta w hierarchii na podstawie numeru
 * @param code Numer konta
 * @returns Poziom (1 = syntetyczne, 2+ = analityczne)
 */
export function getAccountLevel(code: string): number {
  const parts = code.split('-');
  return parts.length;
}
