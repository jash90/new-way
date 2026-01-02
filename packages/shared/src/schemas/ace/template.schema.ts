/**
 * ACC-002: Polish Chart of Accounts Templates
 *
 * Zod schemas for account templates supporting Polish CoA standards
 */

import { z } from 'zod';

// ===========================================================================
// ENUMS
// ===========================================================================

export const businessTypeSchema = z.enum([
  'general',
  'trade',
  'service',
  'manufacturing',
  'construction',
  'healthcare',
  'education',
  'ngo',
]);

export type BusinessType = z.infer<typeof businessTypeSchema>;

export const companySizeSchema = z.enum([
  'micro',      // Mikroprzedsiębiorstwo
  'small',      // Małe przedsiębiorstwo
  'medium',     // Średnie przedsiębiorstwo
  'large',      // Duże przedsiębiorstwo
]);

export type CompanySize = z.infer<typeof companySizeSchema>;

// ===========================================================================
// ENTITIES
// ===========================================================================

/**
 * Account Template - Template metadata
 */
export interface AccountTemplate {
  id: string;
  templateCode: string;
  templateName: string;
  templateNameEn: string | null;
  description: string | null;
  businessType: BusinessType | null;
  companySize: CompanySize | null;
  version: string;
  isActive: boolean;
  isSystemTemplate: boolean;
  accountCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Template Account - Account definition within a template
 */
export interface TemplateAccount {
  id: string;
  templateId: string;
  accountCode: string;
  accountName: string;
  accountNameEn: string | null;
  accountType: string;
  accountClass: number;
  accountGroup: string | null;
  parentAccountCode: string | null;
  normalBalance: 'debit' | 'credit';
  allowsPosting: boolean;
  taxCategory: string | null;
  jpkSymbol: string | null;
  sortOrder: number;
}

/**
 * Template Application - Record of template being applied to an organization
 */
export interface TemplateApplication {
  id: string;
  organizationId: string;
  templateId: string;
  appliedBy: string;
  appliedAt: Date;
  accountsCreated: number;
  customizations: TemplateCustomizations | null;
}

/**
 * Customizations applied when applying a template
 */
export interface TemplateCustomizations {
  excludedClasses?: number[];
  excludedCodes?: string[];
  modifications?: AccountModification[];
}

/**
 * Modification to an account during template application
 */
export interface AccountModification {
  accountCode: string;
  newName?: string;
  newNameEn?: string;
}

// ===========================================================================
// INPUT SCHEMAS
// ===========================================================================

/**
 * List templates input
 */
export const listTemplatesSchema = z.object({
  businessType: businessTypeSchema.optional(),
  companySize: companySizeSchema.optional(),
  isActive: z.boolean().optional().default(true),
  search: z.string().optional(),
});

export type ListTemplatesInput = z.infer<typeof listTemplatesSchema>;

/**
 * Get template by ID
 */
export const getTemplateSchema = z.object({
  templateId: z.string().uuid(),
});

export type GetTemplateInput = z.infer<typeof getTemplateSchema>;

/**
 * Preview template - shows all accounts and detects conflicts
 */
export const previewTemplateSchema = z.object({
  templateId: z.string().uuid(),
});

export type PreviewTemplateInput = z.infer<typeof previewTemplateSchema>;

/**
 * Account modification during template application
 */
export const accountModificationSchema = z.object({
  accountCode: z.string().min(3).max(20),
  newName: z.string().min(1).max(255).optional(),
  newNameEn: z.string().min(1).max(255).optional(),
});

export type AccountModificationInput = z.infer<typeof accountModificationSchema>;

/**
 * Apply template to organization
 */
export const applyTemplateSchema = z.object({
  templateId: z.string().uuid(),
  excludeAccountClasses: z.array(z.number().min(0).max(9)).optional(),
  excludeAccountCodes: z.array(z.string()).optional(),
  accountModifications: z.array(accountModificationSchema).optional(),
  skipExisting: z.boolean().default(true),
});

export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;

/**
 * Get template application history for an organization
 */
export const getTemplateApplicationsSchema = z.object({
  organizationId: z.string().uuid().optional(), // Uses session org if not provided
  templateId: z.string().uuid().optional(),
});

export type GetTemplateApplicationsInput = z.infer<typeof getTemplateApplicationsSchema>;

// ===========================================================================
// RESULT TYPES
// ===========================================================================

/**
 * List templates result
 */
export interface ListTemplatesResult {
  templates: AccountTemplate[];
  total: number;
}

/**
 * Preview template result
 */
export interface PreviewTemplateResult {
  template: AccountTemplate;
  accounts: TemplateAccount[];
  conflictingAccounts: string[];
  summary: {
    totalAccounts: number;
    byClass: Record<number, number>;
    byType: Record<string, number>;
  };
}

/**
 * Apply template result
 */
export interface ApplyTemplateResult {
  success: boolean;
  templateId: string;
  templateName: string;
  accountsCreated: number;
  accountsSkipped: number;
  applicationId: string;
}

/**
 * Template applications history result
 */
export interface TemplateApplicationsResult {
  applications: Array<TemplateApplication & {
    template: Pick<AccountTemplate, 'templateCode' | 'templateName'>;
  }>;
  total: number;
}

// ===========================================================================
// POLISH STANDARD CHART OF ACCOUNTS TEMPLATE DATA
// ===========================================================================

/**
 * Complete Polish Standard Chart of Accounts (Pełny Plan Kont wg UoR)
 * Based on Ustawa o rachunkowości (Polish Accounting Act)
 */
export const POLISH_STANDARD_COA_FULL = [
  // ===========================================
  // Class 0 - Fixed Assets (Aktywa trwałe)
  // ===========================================
  { code: '010', name: 'Środki trwałe', nameEn: 'Fixed Assets', type: 'asset', class: 0, balance: 'debit', posting: false },
  { code: '011', name: 'Grunty', nameEn: 'Land', type: 'asset', class: 0, parent: '010', balance: 'debit', posting: true },
  { code: '012', name: 'Budynki i lokale', nameEn: 'Buildings and Premises', type: 'asset', class: 0, parent: '010', balance: 'debit', posting: true },
  { code: '013', name: 'Urządzenia techniczne i maszyny', nameEn: 'Technical Equipment and Machinery', type: 'asset', class: 0, parent: '010', balance: 'debit', posting: true },
  { code: '014', name: 'Środki transportu', nameEn: 'Vehicles', type: 'asset', class: 0, parent: '010', balance: 'debit', posting: true },
  { code: '015', name: 'Inne środki trwałe', nameEn: 'Other Fixed Assets', type: 'asset', class: 0, parent: '010', balance: 'debit', posting: true },
  { code: '016', name: 'Inwestycje w obcych środkach trwałych', nameEn: 'Investments in Third-Party Assets', type: 'asset', class: 0, parent: '010', balance: 'debit', posting: true },

  { code: '020', name: 'Wartości niematerialne i prawne', nameEn: 'Intangible Assets', type: 'asset', class: 0, balance: 'debit', posting: false },
  { code: '021', name: 'Licencje i oprogramowanie', nameEn: 'Licenses and Software', type: 'asset', class: 0, parent: '020', balance: 'debit', posting: true },
  { code: '022', name: 'Patenty i znaki towarowe', nameEn: 'Patents and Trademarks', type: 'asset', class: 0, parent: '020', balance: 'debit', posting: true },
  { code: '023', name: 'Wartość firmy', nameEn: 'Goodwill', type: 'asset', class: 0, parent: '020', balance: 'debit', posting: true },
  { code: '024', name: 'Inne wartości niematerialne i prawne', nameEn: 'Other Intangible Assets', type: 'asset', class: 0, parent: '020', balance: 'debit', posting: true },

  { code: '030', name: 'Długoterminowe aktywa finansowe', nameEn: 'Long-term Financial Assets', type: 'asset', class: 0, balance: 'debit', posting: false },
  { code: '031', name: 'Udziały i akcje', nameEn: 'Shares and Stocks', type: 'asset', class: 0, parent: '030', balance: 'debit', posting: true },
  { code: '032', name: 'Udzielone pożyczki długoterminowe', nameEn: 'Long-term Loans Granted', type: 'asset', class: 0, parent: '030', balance: 'debit', posting: true },
  { code: '033', name: 'Inne długoterminowe aktywa finansowe', nameEn: 'Other Long-term Financial Assets', type: 'asset', class: 0, parent: '030', balance: 'debit', posting: true },

  { code: '070', name: 'Umorzenie środków trwałych', nameEn: 'Accumulated Depreciation - Fixed Assets', type: 'contra_asset', class: 0, balance: 'credit', posting: false },
  { code: '071', name: 'Umorzenie budynków i lokali', nameEn: 'Accum. Depreciation - Buildings', type: 'contra_asset', class: 0, parent: '070', balance: 'credit', posting: true },
  { code: '072', name: 'Umorzenie urządzeń i maszyn', nameEn: 'Accum. Depreciation - Equipment', type: 'contra_asset', class: 0, parent: '070', balance: 'credit', posting: true },
  { code: '073', name: 'Umorzenie środków transportu', nameEn: 'Accum. Depreciation - Vehicles', type: 'contra_asset', class: 0, parent: '070', balance: 'credit', posting: true },
  { code: '074', name: 'Umorzenie innych środków trwałych', nameEn: 'Accum. Depreciation - Other', type: 'contra_asset', class: 0, parent: '070', balance: 'credit', posting: true },

  { code: '075', name: 'Umorzenie wartości niematerialnych i prawnych', nameEn: 'Accumulated Amortization - Intangibles', type: 'contra_asset', class: 0, balance: 'credit', posting: true },

  { code: '080', name: 'Środki trwałe w budowie', nameEn: 'Construction in Progress', type: 'asset', class: 0, balance: 'debit', posting: true },

  // ===========================================
  // Class 1 - Cash and Bank (Środki pieniężne)
  // ===========================================
  { code: '100', name: 'Kasa', nameEn: 'Cash', type: 'asset', class: 1, balance: 'debit', posting: false },
  { code: '101', name: 'Kasa - PLN', nameEn: 'Cash - PLN', type: 'asset', class: 1, parent: '100', balance: 'debit', posting: true },
  { code: '102', name: 'Kasa - EUR', nameEn: 'Cash - EUR', type: 'asset', class: 1, parent: '100', balance: 'debit', posting: true },
  { code: '103', name: 'Kasa - USD', nameEn: 'Cash - USD', type: 'asset', class: 1, parent: '100', balance: 'debit', posting: true },

  { code: '130', name: 'Rachunki bankowe', nameEn: 'Bank Accounts', type: 'asset', class: 1, balance: 'debit', posting: false },
  { code: '131', name: 'Rachunek bieżący - PLN', nameEn: 'Current Account - PLN', type: 'asset', class: 1, parent: '130', balance: 'debit', posting: true },
  { code: '132', name: 'Rachunek bieżący - EUR', nameEn: 'Current Account - EUR', type: 'asset', class: 1, parent: '130', balance: 'debit', posting: true },
  { code: '133', name: 'Rachunek bieżący - USD', nameEn: 'Current Account - USD', type: 'asset', class: 1, parent: '130', balance: 'debit', posting: true },
  { code: '134', name: 'Rachunki pomocnicze', nameEn: 'Auxiliary Accounts', type: 'asset', class: 1, parent: '130', balance: 'debit', posting: true },
  { code: '135', name: 'Rachunek VAT (split payment)', nameEn: 'VAT Account (Split Payment)', type: 'asset', class: 1, parent: '130', balance: 'debit', posting: true },

  { code: '140', name: 'Krótkoterminowe aktywa finansowe', nameEn: 'Short-term Financial Assets', type: 'asset', class: 1, balance: 'debit', posting: false },
  { code: '141', name: 'Lokaty terminowe', nameEn: 'Term Deposits', type: 'asset', class: 1, parent: '140', balance: 'debit', posting: true },
  { code: '142', name: 'Udzielone pożyczki krótkoterminowe', nameEn: 'Short-term Loans Granted', type: 'asset', class: 1, parent: '140', balance: 'debit', posting: true },

  { code: '149', name: 'Środki pieniężne w drodze', nameEn: 'Cash in Transit', type: 'asset', class: 1, balance: 'debit', posting: true },

  // ===========================================
  // Class 2 - Settlements (Rozrachunki)
  // ===========================================
  { code: '200', name: 'Rozrachunki z odbiorcami', nameEn: 'Trade Receivables', type: 'asset', class: 2, balance: 'debit', posting: false },
  { code: '201', name: 'Rozrachunki z odbiorcami krajowymi', nameEn: 'Domestic Trade Receivables', type: 'asset', class: 2, parent: '200', balance: 'debit', posting: true },
  { code: '202', name: 'Rozrachunki z odbiorcami zagranicznymi', nameEn: 'Foreign Trade Receivables', type: 'asset', class: 2, parent: '200', balance: 'debit', posting: true },

  { code: '210', name: 'Rozrachunki z dostawcami', nameEn: 'Trade Payables', type: 'liability', class: 2, balance: 'credit', posting: false },
  { code: '211', name: 'Rozrachunki z dostawcami krajowymi', nameEn: 'Domestic Trade Payables', type: 'liability', class: 2, parent: '210', balance: 'credit', posting: true },
  { code: '212', name: 'Rozrachunki z dostawcami zagranicznymi', nameEn: 'Foreign Trade Payables', type: 'liability', class: 2, parent: '210', balance: 'credit', posting: true },

  { code: '220', name: 'Rozrachunki publicznoprawne', nameEn: 'Public-Law Settlements', type: 'liability', class: 2, balance: 'credit', posting: false },
  { code: '221', name: 'Rozrachunki z tytułu VAT', nameEn: 'VAT Settlements', type: 'liability', class: 2, parent: '220', balance: 'credit', posting: false },
  { code: '221-1', name: 'VAT naliczony', nameEn: 'Input VAT', type: 'asset', class: 2, parent: '221', balance: 'debit', posting: true, taxCategory: 'VAT_INPUT', jpkSymbol: 'VAT_NAL' },
  { code: '221-2', name: 'VAT należny', nameEn: 'Output VAT', type: 'liability', class: 2, parent: '221', balance: 'credit', posting: true, taxCategory: 'VAT_OUTPUT', jpkSymbol: 'VAT_NAL' },
  { code: '222', name: 'Rozrachunki z tytułu podatku dochodowego', nameEn: 'Income Tax Settlements', type: 'liability', class: 2, parent: '220', balance: 'credit', posting: false },
  { code: '222-1', name: 'Rozrachunki z tytułu CIT', nameEn: 'Corporate Income Tax', type: 'liability', class: 2, parent: '222', balance: 'credit', posting: true, taxCategory: 'CIT' },
  { code: '222-2', name: 'Rozrachunki z tytułu PIT (płatnik)', nameEn: 'Personal Income Tax (Withholding)', type: 'liability', class: 2, parent: '222', balance: 'credit', posting: true, taxCategory: 'PIT' },
  { code: '223', name: 'Rozrachunki z ZUS', nameEn: 'Social Security Settlements', type: 'liability', class: 2, parent: '220', balance: 'credit', posting: false },
  { code: '223-1', name: 'Składki na ubezpieczenie społeczne', nameEn: 'Social Insurance Contributions', type: 'liability', class: 2, parent: '223', balance: 'credit', posting: true },
  { code: '223-2', name: 'Składki na ubezpieczenie zdrowotne', nameEn: 'Health Insurance Contributions', type: 'liability', class: 2, parent: '223', balance: 'credit', posting: true },
  { code: '223-3', name: 'Składki na FP i FGŚP', nameEn: 'Labor Fund Contributions', type: 'liability', class: 2, parent: '223', balance: 'credit', posting: true },
  { code: '224', name: 'Pozostałe rozrachunki publicznoprawne', nameEn: 'Other Public-Law Settlements', type: 'liability', class: 2, parent: '220', balance: 'credit', posting: true },

  { code: '230', name: 'Rozrachunki z pracownikami', nameEn: 'Employee Settlements', type: 'liability', class: 2, balance: 'credit', posting: false },
  { code: '231', name: 'Rozrachunki z tytułu wynagrodzeń', nameEn: 'Salary Settlements', type: 'liability', class: 2, parent: '230', balance: 'credit', posting: true },
  { code: '232', name: 'Rozrachunki z tytułu zaliczek', nameEn: 'Advance Settlements', type: 'asset', class: 2, parent: '230', balance: 'debit', posting: true },
  { code: '233', name: 'Rozrachunki z tytułu podróży służbowych', nameEn: 'Business Travel Settlements', type: 'liability', class: 2, parent: '230', balance: 'credit', posting: true },

  { code: '240', name: 'Pozostałe rozrachunki', nameEn: 'Other Settlements', type: 'liability', class: 2, balance: 'credit', posting: false },
  { code: '241', name: 'Rozrachunki z właścicielami', nameEn: 'Settlements with Owners', type: 'liability', class: 2, parent: '240', balance: 'credit', posting: true },
  { code: '242', name: 'Rozrachunki z jednostkami powiązanymi', nameEn: 'Settlements with Related Parties', type: 'liability', class: 2, parent: '240', balance: 'credit', posting: true },
  { code: '249', name: 'Inne rozrachunki', nameEn: 'Other Miscellaneous Settlements', type: 'liability', class: 2, parent: '240', balance: 'credit', posting: true },

  { code: '280', name: 'Odpisy aktualizujące należności', nameEn: 'Allowance for Doubtful Receivables', type: 'contra_asset', class: 2, balance: 'credit', posting: true },

  // ===========================================
  // Class 3 - Inventory (Zapasy)
  // ===========================================
  { code: '300', name: 'Materiały', nameEn: 'Raw Materials', type: 'asset', class: 3, balance: 'debit', posting: false },
  { code: '301', name: 'Materiały podstawowe', nameEn: 'Basic Materials', type: 'asset', class: 3, parent: '300', balance: 'debit', posting: true },
  { code: '302', name: 'Materiały pomocnicze', nameEn: 'Auxiliary Materials', type: 'asset', class: 3, parent: '300', balance: 'debit', posting: true },
  { code: '303', name: 'Paliwa', nameEn: 'Fuels', type: 'asset', class: 3, parent: '300', balance: 'debit', posting: true },
  { code: '304', name: 'Części zamienne', nameEn: 'Spare Parts', type: 'asset', class: 3, parent: '300', balance: 'debit', posting: true },
  { code: '305', name: 'Opakowania', nameEn: 'Packaging', type: 'asset', class: 3, parent: '300', balance: 'debit', posting: true },

  { code: '310', name: 'Odchylenia od cen ewidencyjnych materiałów', nameEn: 'Material Price Variances', type: 'asset', class: 3, balance: 'debit', posting: true },

  { code: '330', name: 'Towary', nameEn: 'Merchandise', type: 'asset', class: 3, balance: 'debit', posting: true },
  { code: '340', name: 'Odchylenia od cen ewidencyjnych towarów', nameEn: 'Merchandise Price Variances', type: 'asset', class: 3, balance: 'debit', posting: true },

  { code: '350', name: 'Zaliczki na dostawy', nameEn: 'Advances for Deliveries', type: 'asset', class: 3, balance: 'debit', posting: true },

  // ===========================================
  // Class 4 - Costs by Type (Koszty wg rodzajów)
  // ===========================================
  { code: '400', name: 'Amortyzacja', nameEn: 'Depreciation and Amortization', type: 'expense', class: 4, balance: 'debit', posting: true },
  { code: '401', name: 'Zużycie materiałów i energii', nameEn: 'Materials and Energy Consumption', type: 'expense', class: 4, balance: 'debit', posting: true },
  { code: '402', name: 'Usługi obce', nameEn: 'External Services', type: 'expense', class: 4, balance: 'debit', posting: true },
  { code: '403', name: 'Podatki i opłaty', nameEn: 'Taxes and Fees', type: 'expense', class: 4, balance: 'debit', posting: true },
  { code: '404', name: 'Wynagrodzenia', nameEn: 'Salaries and Wages', type: 'expense', class: 4, balance: 'debit', posting: true },
  { code: '405', name: 'Ubezpieczenia społeczne i inne świadczenia', nameEn: 'Social Insurance and Benefits', type: 'expense', class: 4, balance: 'debit', posting: true },
  { code: '409', name: 'Pozostałe koszty rodzajowe', nameEn: 'Other Operating Costs by Type', type: 'expense', class: 4, balance: 'debit', posting: true },

  // ===========================================
  // Class 5 - Costs by Function (Koszty wg działalności)
  // ===========================================
  { code: '500', name: 'Koszty działalności podstawowej', nameEn: 'Core Operating Costs', type: 'expense', class: 5, balance: 'debit', posting: false },
  { code: '501', name: 'Koszty produkcji podstawowej', nameEn: 'Primary Production Costs', type: 'expense', class: 5, parent: '500', balance: 'debit', posting: true },
  { code: '502', name: 'Koszty wydziałowe', nameEn: 'Departmental Overhead', type: 'expense', class: 5, parent: '500', balance: 'debit', posting: true },

  { code: '520', name: 'Koszty sprzedaży', nameEn: 'Selling Costs', type: 'expense', class: 5, balance: 'debit', posting: true },
  { code: '530', name: 'Koszty ogólnego zarządu', nameEn: 'General and Administrative Costs', type: 'expense', class: 5, balance: 'debit', posting: true },

  { code: '550', name: 'Rozliczenie kosztów działalności', nameEn: 'Cost Allocation', type: 'expense', class: 5, balance: 'debit', posting: true },

  // ===========================================
  // Class 6 - Products (Produkty)
  // ===========================================
  { code: '600', name: 'Produkty gotowe', nameEn: 'Finished Goods', type: 'asset', class: 6, balance: 'debit', posting: true },
  { code: '610', name: 'Odchylenia od cen ewidencyjnych produktów', nameEn: 'Product Price Variances', type: 'asset', class: 6, balance: 'debit', posting: true },
  { code: '620', name: 'Produkcja w toku', nameEn: 'Work in Progress', type: 'asset', class: 6, balance: 'debit', posting: true },

  // ===========================================
  // Class 7 - Revenue and Other Income (Przychody)
  // ===========================================
  { code: '700', name: 'Sprzedaż produktów', nameEn: 'Product Sales', type: 'revenue', class: 7, balance: 'credit', posting: true },
  { code: '730', name: 'Sprzedaż towarów', nameEn: 'Merchandise Sales', type: 'revenue', class: 7, balance: 'credit', posting: true },
  { code: '740', name: 'Sprzedaż materiałów', nameEn: 'Material Sales', type: 'revenue', class: 7, balance: 'credit', posting: true },
  { code: '750', name: 'Przychody finansowe', nameEn: 'Financial Income', type: 'revenue', class: 7, balance: 'credit', posting: false },
  { code: '751', name: 'Odsetki', nameEn: 'Interest Income', type: 'revenue', class: 7, parent: '750', balance: 'credit', posting: true },
  { code: '752', name: 'Zyski ze zbycia inwestycji', nameEn: 'Gains on Investment Disposal', type: 'revenue', class: 7, parent: '750', balance: 'credit', posting: true },
  { code: '753', name: 'Różnice kursowe dodatnie', nameEn: 'Positive Exchange Rate Differences', type: 'revenue', class: 7, parent: '750', balance: 'credit', posting: true },
  { code: '759', name: 'Pozostałe przychody finansowe', nameEn: 'Other Financial Income', type: 'revenue', class: 7, parent: '750', balance: 'credit', posting: true },

  { code: '760', name: 'Pozostałe przychody operacyjne', nameEn: 'Other Operating Income', type: 'revenue', class: 7, balance: 'credit', posting: false },
  { code: '761', name: 'Zysk ze zbycia niefinansowych aktywów trwałych', nameEn: 'Gains on Non-Financial Asset Disposal', type: 'revenue', class: 7, parent: '760', balance: 'credit', posting: true },
  { code: '762', name: 'Dotacje', nameEn: 'Grants and Subsidies', type: 'revenue', class: 7, parent: '760', balance: 'credit', posting: true },
  { code: '763', name: 'Rozwiązanie odpisów aktualizujących', nameEn: 'Reversal of Impairment', type: 'revenue', class: 7, parent: '760', balance: 'credit', posting: true },
  { code: '769', name: 'Inne przychody operacyjne', nameEn: 'Other Miscellaneous Operating Income', type: 'revenue', class: 7, parent: '760', balance: 'credit', posting: true },

  { code: '770', name: 'Koszty finansowe', nameEn: 'Financial Costs', type: 'expense', class: 7, balance: 'debit', posting: false },
  { code: '771', name: 'Odsetki', nameEn: 'Interest Expense', type: 'expense', class: 7, parent: '770', balance: 'debit', posting: true },
  { code: '772', name: 'Straty ze zbycia inwestycji', nameEn: 'Losses on Investment Disposal', type: 'expense', class: 7, parent: '770', balance: 'debit', posting: true },
  { code: '773', name: 'Różnice kursowe ujemne', nameEn: 'Negative Exchange Rate Differences', type: 'expense', class: 7, parent: '770', balance: 'debit', posting: true },
  { code: '779', name: 'Pozostałe koszty finansowe', nameEn: 'Other Financial Costs', type: 'expense', class: 7, parent: '770', balance: 'debit', posting: true },

  { code: '780', name: 'Pozostałe koszty operacyjne', nameEn: 'Other Operating Costs', type: 'expense', class: 7, balance: 'debit', posting: false },
  { code: '781', name: 'Strata ze zbycia niefinansowych aktywów trwałych', nameEn: 'Losses on Non-Financial Asset Disposal', type: 'expense', class: 7, parent: '780', balance: 'debit', posting: true },
  { code: '782', name: 'Odpisy aktualizujące aktywa', nameEn: 'Asset Impairment Charges', type: 'expense', class: 7, parent: '780', balance: 'debit', posting: true },
  { code: '789', name: 'Inne koszty operacyjne', nameEn: 'Other Miscellaneous Operating Costs', type: 'expense', class: 7, parent: '780', balance: 'debit', posting: true },

  { code: '790', name: 'Obroty wewnętrzne', nameEn: 'Internal Turnover', type: 'revenue', class: 7, balance: 'credit', posting: true },
  { code: '791', name: 'Koszt własny obrotów wewnętrznych', nameEn: 'Internal Turnover Cost', type: 'expense', class: 7, balance: 'debit', posting: true },

  // ===========================================
  // Class 8 - Equity and Results (Kapitały i wynik)
  // ===========================================
  { code: '800', name: 'Kapitał zakładowy', nameEn: 'Share Capital', type: 'equity', class: 8, balance: 'credit', posting: true },
  { code: '801', name: 'Kapitał zapasowy', nameEn: 'Reserve Capital', type: 'equity', class: 8, balance: 'credit', posting: true },
  { code: '802', name: 'Kapitał rezerwowy', nameEn: 'Reserve Fund', type: 'equity', class: 8, balance: 'credit', posting: true },
  { code: '803', name: 'Kapitał z aktualizacji wyceny', nameEn: 'Revaluation Reserve', type: 'equity', class: 8, balance: 'credit', posting: true },

  { code: '820', name: 'Rozliczenie wyniku finansowego', nameEn: 'Profit/Loss Distribution', type: 'equity', class: 8, balance: 'credit', posting: true },
  { code: '840', name: 'Rezerwy', nameEn: 'Provisions', type: 'liability', class: 8, balance: 'credit', posting: false },
  { code: '841', name: 'Rezerwy na świadczenia emerytalne', nameEn: 'Pension Provisions', type: 'liability', class: 8, parent: '840', balance: 'credit', posting: true },
  { code: '842', name: 'Rezerwa na odroczony podatek dochodowy', nameEn: 'Deferred Tax Provision', type: 'liability', class: 8, parent: '840', balance: 'credit', posting: true },
  { code: '849', name: 'Pozostałe rezerwy', nameEn: 'Other Provisions', type: 'liability', class: 8, parent: '840', balance: 'credit', posting: true },

  { code: '850', name: 'Fundusze specjalne', nameEn: 'Special Funds', type: 'equity', class: 8, balance: 'credit', posting: false },
  { code: '851', name: 'Zakładowy fundusz świadczeń socjalnych', nameEn: 'Social Benefits Fund', type: 'equity', class: 8, parent: '850', balance: 'credit', posting: true },

  { code: '860', name: 'Wynik finansowy', nameEn: 'Financial Result', type: 'equity', class: 8, balance: 'credit', posting: true },
  { code: '870', name: 'Podatek dochodowy bieżący', nameEn: 'Current Income Tax', type: 'expense', class: 8, balance: 'debit', posting: true },
  { code: '871', name: 'Podatek dochodowy odroczony', nameEn: 'Deferred Income Tax', type: 'expense', class: 8, balance: 'debit', posting: true },

  // ===========================================
  // Class 9 - Off-Balance Sheet (Konta pozabilansowe)
  // ===========================================
  { code: '900', name: 'Zobowiązania warunkowe', nameEn: 'Contingent Liabilities', type: 'asset', class: 9, balance: 'debit', posting: true },
  { code: '910', name: 'Środki trwałe w leasingu operacyjnym', nameEn: 'Operating Lease Assets', type: 'asset', class: 9, balance: 'debit', posting: true },
  { code: '920', name: 'Gwarancje i poręczenia udzielone', nameEn: 'Guarantees Granted', type: 'asset', class: 9, balance: 'debit', posting: true },
  { code: '930', name: 'Gwarancje i poręczenia otrzymane', nameEn: 'Guarantees Received', type: 'asset', class: 9, balance: 'debit', posting: true },
  { code: '990', name: 'Przeciwstawne konto pozabilansowe', nameEn: 'Off-Balance Sheet Contra', type: 'liability', class: 9, balance: 'credit', posting: true },
] as const;

/**
 * Simplified Polish Chart of Accounts (Uproszczony Plan Kont dla MŚP)
 * For small and medium enterprises
 */
export const POLISH_STANDARD_COA_SIMPLIFIED = [
  // Class 0 - Fixed Assets
  { code: '010', name: 'Środki trwałe', nameEn: 'Fixed Assets', type: 'asset', class: 0, balance: 'debit', posting: true },
  { code: '020', name: 'Wartości niematerialne i prawne', nameEn: 'Intangible Assets', type: 'asset', class: 0, balance: 'debit', posting: true },
  { code: '070', name: 'Umorzenie środków trwałych i WNiP', nameEn: 'Accumulated Depreciation', type: 'contra_asset', class: 0, balance: 'credit', posting: true },
  { code: '080', name: 'Środki trwałe w budowie', nameEn: 'Construction in Progress', type: 'asset', class: 0, balance: 'debit', posting: true },

  // Class 1 - Cash
  { code: '100', name: 'Kasa', nameEn: 'Cash', type: 'asset', class: 1, balance: 'debit', posting: true },
  { code: '130', name: 'Rachunki bankowe', nameEn: 'Bank Accounts', type: 'asset', class: 1, balance: 'debit', posting: true },

  // Class 2 - Settlements
  { code: '200', name: 'Rozrachunki z odbiorcami', nameEn: 'Trade Receivables', type: 'asset', class: 2, balance: 'debit', posting: true },
  { code: '210', name: 'Rozrachunki z dostawcami', nameEn: 'Trade Payables', type: 'liability', class: 2, balance: 'credit', posting: true },
  { code: '220', name: 'Rozrachunki z urzędem skarbowym', nameEn: 'Tax Settlements', type: 'liability', class: 2, balance: 'credit', posting: true },
  { code: '221', name: 'VAT naliczony', nameEn: 'Input VAT', type: 'asset', class: 2, balance: 'debit', posting: true, taxCategory: 'VAT_INPUT' },
  { code: '222', name: 'VAT należny', nameEn: 'Output VAT', type: 'liability', class: 2, balance: 'credit', posting: true, taxCategory: 'VAT_OUTPUT' },
  { code: '223', name: 'Rozrachunki z ZUS', nameEn: 'Social Security', type: 'liability', class: 2, balance: 'credit', posting: true },
  { code: '230', name: 'Rozrachunki z pracownikami', nameEn: 'Employee Settlements', type: 'liability', class: 2, balance: 'credit', posting: true },
  { code: '240', name: 'Pozostałe rozrachunki', nameEn: 'Other Settlements', type: 'liability', class: 2, balance: 'credit', posting: true },

  // Class 3 - Inventory
  { code: '300', name: 'Materiały', nameEn: 'Materials', type: 'asset', class: 3, balance: 'debit', posting: true },
  { code: '330', name: 'Towary', nameEn: 'Merchandise', type: 'asset', class: 3, balance: 'debit', posting: true },

  // Class 4 - Costs
  { code: '400', name: 'Amortyzacja', nameEn: 'Depreciation', type: 'expense', class: 4, balance: 'debit', posting: true },
  { code: '401', name: 'Zużycie materiałów i energii', nameEn: 'Materials and Energy', type: 'expense', class: 4, balance: 'debit', posting: true },
  { code: '402', name: 'Usługi obce', nameEn: 'External Services', type: 'expense', class: 4, balance: 'debit', posting: true },
  { code: '403', name: 'Podatki i opłaty', nameEn: 'Taxes and Fees', type: 'expense', class: 4, balance: 'debit', posting: true },
  { code: '404', name: 'Wynagrodzenia', nameEn: 'Salaries', type: 'expense', class: 4, balance: 'debit', posting: true },
  { code: '405', name: 'Ubezpieczenia społeczne', nameEn: 'Social Insurance', type: 'expense', class: 4, balance: 'debit', posting: true },
  { code: '409', name: 'Pozostałe koszty', nameEn: 'Other Costs', type: 'expense', class: 4, balance: 'debit', posting: true },

  // Class 7 - Revenue
  { code: '700', name: 'Sprzedaż produktów i usług', nameEn: 'Sales of Products and Services', type: 'revenue', class: 7, balance: 'credit', posting: true },
  { code: '730', name: 'Sprzedaż towarów', nameEn: 'Merchandise Sales', type: 'revenue', class: 7, balance: 'credit', posting: true },
  { code: '750', name: 'Przychody finansowe', nameEn: 'Financial Income', type: 'revenue', class: 7, balance: 'credit', posting: true },
  { code: '760', name: 'Pozostałe przychody operacyjne', nameEn: 'Other Operating Income', type: 'revenue', class: 7, balance: 'credit', posting: true },
  { code: '770', name: 'Koszty finansowe', nameEn: 'Financial Costs', type: 'expense', class: 7, balance: 'debit', posting: true },
  { code: '780', name: 'Pozostałe koszty operacyjne', nameEn: 'Other Operating Costs', type: 'expense', class: 7, balance: 'debit', posting: true },

  // Class 8 - Equity
  { code: '800', name: 'Kapitał podstawowy', nameEn: 'Share Capital', type: 'equity', class: 8, balance: 'credit', posting: true },
  { code: '820', name: 'Rozliczenie wyniku finansowego', nameEn: 'Profit Distribution', type: 'equity', class: 8, balance: 'credit', posting: true },
  { code: '860', name: 'Wynik finansowy', nameEn: 'Financial Result', type: 'equity', class: 8, balance: 'credit', posting: true },
  { code: '870', name: 'Podatek dochodowy', nameEn: 'Income Tax', type: 'expense', class: 8, balance: 'debit', posting: true },
] as const;

/**
 * Micro-entity Chart of Accounts (Plan Kont dla Mikroprzedsiębiorstw)
 * Minimal accounts per UoR Art. 49-50
 */
export const POLISH_STANDARD_COA_MICRO = [
  // Class 0 - Fixed Assets
  { code: '010', name: 'Środki trwałe i WNiP', nameEn: 'Fixed and Intangible Assets', type: 'asset', class: 0, balance: 'debit', posting: true },
  { code: '070', name: 'Umorzenie', nameEn: 'Accumulated Depreciation', type: 'contra_asset', class: 0, balance: 'credit', posting: true },

  // Class 1 - Cash
  { code: '100', name: 'Środki pieniężne', nameEn: 'Cash and Cash Equivalents', type: 'asset', class: 1, balance: 'debit', posting: true },

  // Class 2 - Settlements
  { code: '200', name: 'Należności', nameEn: 'Receivables', type: 'asset', class: 2, balance: 'debit', posting: true },
  { code: '210', name: 'Zobowiązania', nameEn: 'Payables', type: 'liability', class: 2, balance: 'credit', posting: true },
  { code: '220', name: 'Rozrachunki z VAT', nameEn: 'VAT Settlements', type: 'liability', class: 2, balance: 'credit', posting: true },

  // Class 3 - Inventory
  { code: '300', name: 'Zapasy', nameEn: 'Inventories', type: 'asset', class: 3, balance: 'debit', posting: true },

  // Class 4 - Costs
  { code: '400', name: 'Koszty działalności', nameEn: 'Operating Costs', type: 'expense', class: 4, balance: 'debit', posting: true },

  // Class 7 - Revenue
  { code: '700', name: 'Przychody', nameEn: 'Revenue', type: 'revenue', class: 7, balance: 'credit', posting: true },
  { code: '770', name: 'Koszty finansowe', nameEn: 'Financial Costs', type: 'expense', class: 7, balance: 'debit', posting: true },

  // Class 8 - Equity
  { code: '800', name: 'Kapitał', nameEn: 'Equity', type: 'equity', class: 8, balance: 'credit', posting: true },
  { code: '860', name: 'Wynik finansowy', nameEn: 'Financial Result', type: 'equity', class: 8, balance: 'credit', posting: true },
] as const;

/**
 * Available template definitions for seeding
 */
export const TEMPLATE_DEFINITIONS = [
  {
    templateCode: 'PL_FULL',
    templateName: 'Pełny Plan Kont (wg UoR)',
    templateNameEn: 'Full Polish Chart of Accounts',
    description: 'Kompletny plan kont zgodny z Ustawą o rachunkowości dla średnich i dużych przedsiębiorstw',
    businessType: 'general' as BusinessType,
    companySize: 'large' as CompanySize,
    accounts: POLISH_STANDARD_COA_FULL,
  },
  {
    templateCode: 'PL_SIMPLIFIED',
    templateName: 'Uproszczony Plan Kont (MŚP)',
    templateNameEn: 'Simplified Polish Chart of Accounts',
    description: 'Uproszczony plan kont dla małych i średnich przedsiębiorstw',
    businessType: 'general' as BusinessType,
    companySize: 'small' as CompanySize,
    accounts: POLISH_STANDARD_COA_SIMPLIFIED,
  },
  {
    templateCode: 'PL_MICRO',
    templateName: 'Plan Kont dla Mikroprzedsiębiorstw',
    templateNameEn: 'Micro-entity Chart of Accounts',
    description: 'Minimalny plan kont dla mikroprzedsiębiorstw zgodny z Art. 49-50 UoR',
    businessType: 'general' as BusinessType,
    companySize: 'micro' as CompanySize,
    accounts: POLISH_STANDARD_COA_MICRO,
  },
] as const;
