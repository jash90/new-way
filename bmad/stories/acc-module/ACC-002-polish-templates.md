# ACC-002: Polish Chart of Accounts Templates

> **Story ID**: ACC-002
> **Title**: Polish Chart of Accounts Templates
> **Epic**: Accounting Engine (ACC)
> **Priority**: P0
> **Points**: 8
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant setting up books for a new client,
**I want to** apply standard Polish chart of accounts templates,
**So that** I can quickly create compliant account structures without manual entry.

---

## Acceptance Criteria

### AC1: Apply Template to New Organization
```gherkin
Feature: Apply Polish Account Template

Scenario: Apply full chart of accounts template
  Given I am setting up a new client organization
  And I have selected template "Standard Polish CoA"
  When I apply the template
  Then approximately 200 accounts should be created
  And accounts should follow Polish account class structure (0-9)
  And accounts should have proper Polish and English names
  And accounts should have correct normal balances
  And an audit log should record the template application

Scenario: Apply template to organization with existing accounts
  Given the organization already has 5 accounts
  When I try to apply a template
  Then I should be warned about existing accounts
  And I should choose to "Skip existing" or "Cancel"

Scenario: Preview template before applying
  Given I am viewing template "Standard Polish CoA"
  When I click "Preview"
  Then I should see the complete account list
  And I should see account codes, names, and types
```

### AC2: Template Categories
```gherkin
Feature: Template Selection

Scenario: List available templates
  Given I am on the template selection page
  When I view available templates
  Then I should see:
    | Template Name            | Accounts | Description                      |
    | Standard Polish CoA      | ~200     | Pełny plan kont wg UoR           |
    | Simplified Polish CoA    | ~80      | Uproszczony plan kont dla MŚP    |
    | Trade Company CoA        | ~150     | Plan kont dla firmy handlowej    |
    | Service Company CoA      | ~120     | Plan kont dla firmy usługowej    |
    | Manufacturing CoA        | ~180     | Plan kont dla produkcji          |

Scenario: Filter templates by business type
  Given templates exist for different business types
  When I filter by "Handel" (Trade)
  Then I should only see trade-relevant templates
```

### AC3: Template Customization
```gherkin
Feature: Customize Template Before Applying

Scenario: Exclude account groups from template
  Given I am applying "Standard Polish CoA" template
  When I exclude account group "5 - Koszty wg typów działalności"
  Then accounts 500-599 should not be created
  And remaining accounts should be created normally

Scenario: Modify account names during application
  Given I am applying a template
  And account "100" has name "Kasa"
  When I modify the name to "Kasa główna - PLN"
  Then the account should be created with the modified name
```

---

## Technical Specification

### Database Schema

```sql
-- Template definitions
CREATE TABLE account_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template metadata
  template_code VARCHAR(50) NOT NULL UNIQUE,
  template_name VARCHAR(255) NOT NULL,
  template_name_en VARCHAR(255),
  description TEXT,

  -- Categorization
  business_type VARCHAR(100), -- trade, service, manufacturing, general
  company_size VARCHAR(50),   -- small, medium, large

  -- Version control
  version VARCHAR(20) NOT NULL DEFAULT '1.0',
  is_active BOOLEAN DEFAULT TRUE,
  is_system_template BOOLEAN DEFAULT TRUE,

  -- Metadata
  account_count INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template account definitions
CREATE TABLE template_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES account_templates(id) ON DELETE CASCADE,

  -- Account definition
  account_code VARCHAR(20) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_name_en VARCHAR(255),

  -- Classification
  account_type VARCHAR(50) NOT NULL,
  account_class INTEGER NOT NULL,
  account_group VARCHAR(100),
  parent_account_code VARCHAR(20),

  -- Behavior
  normal_balance VARCHAR(10) NOT NULL,
  allows_posting BOOLEAN DEFAULT TRUE,

  -- For JPK
  tax_category VARCHAR(50),
  jpk_symbol VARCHAR(50),

  -- Ordering
  sort_order INTEGER NOT NULL,

  UNIQUE(template_id, account_code)
);

-- Track template applications
CREATE TABLE template_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  template_id UUID NOT NULL REFERENCES account_templates(id),
  applied_by UUID NOT NULL REFERENCES users(id),
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accounts_created INTEGER NOT NULL,
  customizations JSONB -- Any modifications made during application
);

-- Indexes
CREATE INDEX idx_template_accounts_template ON template_accounts(template_id);
CREATE INDEX idx_template_apps_org ON template_applications(organization_id);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Template metadata
export const AccountTemplateSchema = z.object({
  id: z.string().uuid(),
  templateCode: z.string(),
  templateName: z.string(),
  templateNameEn: z.string().nullable(),
  description: z.string().nullable(),
  businessType: z.string().nullable(),
  companySize: z.string().nullable(),
  version: z.string(),
  isActive: z.boolean(),
  isSystemTemplate: z.boolean(),
  accountCount: z.number(),
});

// Template account
export const TemplateAccountSchema = z.object({
  accountCode: z.string(),
  accountName: z.string(),
  accountNameEn: z.string().nullable(),
  accountType: z.string(),
  accountClass: z.number(),
  accountGroup: z.string().nullable(),
  parentAccountCode: z.string().nullable(),
  normalBalance: z.enum(['DEBIT', 'CREDIT']),
  allowsPosting: z.boolean(),
  taxCategory: z.string().nullable(),
  jpkSymbol: z.string().nullable(),
});

// Apply template input
export const ApplyTemplateInput = z.object({
  templateId: z.string().uuid(),
  excludeAccountClasses: z.array(z.number().min(0).max(9)).optional(),
  excludeAccountCodes: z.array(z.string()).optional(),
  accountModifications: z
    .array(
      z.object({
        accountCode: z.string(),
        newName: z.string().optional(),
        newNameEn: z.string().optional(),
      })
    )
    .optional(),
  skipExisting: z.boolean().default(true),
});

// Preview output
export const TemplatePreviewOutput = z.object({
  template: AccountTemplateSchema,
  accounts: z.array(TemplateAccountSchema),
  conflictingAccounts: z.array(z.string()).optional(),
});
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { ApplyTemplateInput } from './schemas';

export const templateRouter = router({
  // List available templates
  listTemplates: protectedProcedure
    .input(
      z.object({
        businessType: z.string().optional(),
        companySize: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: any = { isActive: true };

      if (input?.businessType) {
        where.businessType = input.businessType;
      }
      if (input?.companySize) {
        where.companySize = input.companySize;
      }

      return ctx.db.accountTemplates.findMany({
        where,
        orderBy: { templateName: 'asc' },
      });
    }),

  // Preview template
  previewTemplate: protectedProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.accountTemplates.findUnique({
        where: { id: input.templateId },
        include: {
          accounts: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found',
        });
      }

      // Check for existing accounts that would conflict
      const existingAccounts = await ctx.db.chartOfAccounts.findMany({
        where: { organizationId: ctx.session.organizationId },
        select: { accountCode: true },
      });

      const existingCodes = new Set(existingAccounts.map((a) => a.accountCode));
      const conflictingAccounts = template.accounts
        .filter((a) => existingCodes.has(a.accountCode))
        .map((a) => a.accountCode);

      return {
        template,
        accounts: template.accounts,
        conflictingAccounts,
      };
    }),

  // Apply template to organization
  applyTemplate: protectedProcedure
    .input(ApplyTemplateInput)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.session;

      // Get template with accounts
      const template = await ctx.db.accountTemplates.findUnique({
        where: { id: input.templateId },
        include: {
          accounts: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found',
        });
      }

      // Get existing accounts
      const existingAccounts = await ctx.db.chartOfAccounts.findMany({
        where: { organizationId },
        select: { accountCode: true },
      });
      const existingCodes = new Set(existingAccounts.map((a) => a.accountCode));

      // Filter accounts based on exclusions
      let accountsToCreate = template.accounts.filter((account) => {
        // Skip excluded classes
        if (input.excludeAccountClasses?.includes(account.accountClass)) {
          return false;
        }
        // Skip excluded codes
        if (input.excludeAccountCodes?.includes(account.accountCode)) {
          return false;
        }
        // Skip existing if requested
        if (input.skipExisting && existingCodes.has(account.accountCode)) {
          return false;
        }
        return true;
      });

      // Apply modifications
      const modificationsMap = new Map(
        input.accountModifications?.map((m) => [m.accountCode, m]) || []
      );

      // Build parent account ID mapping
      const parentCodeToId = new Map<string, string>();

      // Create accounts in order (parents first)
      const createdAccounts: any[] = [];

      await ctx.db.$transaction(async (tx) => {
        for (const templateAccount of accountsToCreate) {
          const modification = modificationsMap.get(templateAccount.accountCode);

          // Find parent ID if parent was just created
          let parentAccountId: string | null = null;
          if (templateAccount.parentAccountCode) {
            parentAccountId = parentCodeToId.get(templateAccount.parentAccountCode) || null;
          }

          const account = await tx.chartOfAccounts.create({
            data: {
              organizationId,
              accountCode: templateAccount.accountCode,
              accountName: modification?.newName || templateAccount.accountName,
              accountNameEn: modification?.newNameEn || templateAccount.accountNameEn,
              accountType: templateAccount.accountType,
              accountClass: templateAccount.accountClass,
              accountGroup: templateAccount.accountGroup,
              parentAccountId,
              normalBalance: templateAccount.normalBalance,
              allowsPosting: templateAccount.allowsPosting,
              taxCategory: templateAccount.taxCategory,
              jpkSymbol: templateAccount.jpkSymbol,
              isSystemAccount: false,
              createdBy: userId,
            },
          });

          parentCodeToId.set(account.accountCode, account.id);
          createdAccounts.push(account);
        }

        // Record application
        await tx.templateApplications.create({
          data: {
            organizationId,
            templateId: template.id,
            appliedBy: userId,
            accountsCreated: createdAccounts.length,
            customizations: {
              excludedClasses: input.excludeAccountClasses,
              excludedCodes: input.excludeAccountCodes,
              modifications: input.accountModifications,
            },
          },
        });
      });

      // Audit log
      await ctx.audit.log({
        action: 'TEMPLATE_APPLIED',
        entityType: 'ACCOUNT_TEMPLATE',
        entityId: template.id,
        details: {
          templateName: template.templateName,
          accountsCreated: createdAccounts.length,
        },
      });

      return {
        success: true,
        accountsCreated: createdAccounts.length,
        templateName: template.templateName,
      };
    }),
});
```

### Standard Polish Template Data

```typescript
// Standard Polish Chart of Accounts (abbreviated sample)
export const STANDARD_POLISH_COA = [
  // Class 0 - Fixed Assets
  { code: '010', name: 'Środki trwałe', nameEn: 'Fixed Assets', type: 'FIXED_ASSETS', class: 0, balance: 'DEBIT' },
  { code: '011', name: 'Grunty', nameEn: 'Land', type: 'FIXED_ASSETS', class: 0, parent: '010', balance: 'DEBIT' },
  { code: '012', name: 'Budynki i lokale', nameEn: 'Buildings', type: 'FIXED_ASSETS', class: 0, parent: '010', balance: 'DEBIT' },
  { code: '013', name: 'Urządzenia techniczne i maszyny', nameEn: 'Machinery', type: 'FIXED_ASSETS', class: 0, parent: '010', balance: 'DEBIT' },
  { code: '014', name: 'Środki transportu', nameEn: 'Vehicles', type: 'FIXED_ASSETS', class: 0, parent: '010', balance: 'DEBIT' },
  { code: '020', name: 'Wartości niematerialne i prawne', nameEn: 'Intangible Assets', type: 'FIXED_ASSETS', class: 0, balance: 'DEBIT' },
  { code: '070', name: 'Umorzenie środków trwałych', nameEn: 'Accumulated Depreciation', type: 'FIXED_ASSETS', class: 0, balance: 'CREDIT' },

  // Class 1 - Cash and Bank
  { code: '100', name: 'Kasa', nameEn: 'Cash', type: 'CASH', class: 1, balance: 'DEBIT' },
  { code: '101', name: 'Kasa - PLN', nameEn: 'Cash - PLN', type: 'CASH', class: 1, parent: '100', balance: 'DEBIT' },
  { code: '102', name: 'Kasa - EUR', nameEn: 'Cash - EUR', type: 'CASH', class: 1, parent: '100', balance: 'DEBIT' },
  { code: '130', name: 'Rachunki bankowe', nameEn: 'Bank Accounts', type: 'CASH', class: 1, balance: 'DEBIT' },
  { code: '131', name: 'Rachunek bieżący - PLN', nameEn: 'Current Account - PLN', type: 'CASH', class: 1, parent: '130', balance: 'DEBIT' },
  { code: '132', name: 'Rachunek bieżący - EUR', nameEn: 'Current Account - EUR', type: 'CASH', class: 1, parent: '130', balance: 'DEBIT' },

  // Class 2 - Settlements
  { code: '200', name: 'Rozrachunki z odbiorcami', nameEn: 'Accounts Receivable', type: 'RECEIVABLES', class: 2, balance: 'DEBIT' },
  { code: '210', name: 'Rozrachunki z dostawcami', nameEn: 'Accounts Payable', type: 'LIABILITIES', class: 2, balance: 'CREDIT' },
  { code: '220', name: 'Rozrachunki publicznoprawne', nameEn: 'Tax Settlements', type: 'TAXES_SETTLEMENTS', class: 2, balance: 'CREDIT' },
  { code: '221', name: 'Rozrachunki z tytułu VAT', nameEn: 'VAT Settlements', type: 'TAXES_SETTLEMENTS', class: 2, parent: '220', balance: 'CREDIT' },
  { code: '222', name: 'Rozrachunki z tytułu CIT/PIT', nameEn: 'Income Tax', type: 'TAXES_SETTLEMENTS', class: 2, parent: '220', balance: 'CREDIT' },
  { code: '223', name: 'Rozrachunki z ZUS', nameEn: 'Social Security', type: 'TAXES_SETTLEMENTS', class: 2, parent: '220', balance: 'CREDIT' },
  { code: '230', name: 'Rozrachunki z pracownikami', nameEn: 'Employee Settlements', type: 'LIABILITIES', class: 2, balance: 'CREDIT' },

  // Class 3 - Inventory
  { code: '300', name: 'Materiały', nameEn: 'Raw Materials', type: 'INVENTORY', class: 3, balance: 'DEBIT' },
  { code: '330', name: 'Towary', nameEn: 'Merchandise', type: 'INVENTORY', class: 3, balance: 'DEBIT' },

  // Class 4 - Costs by Type
  { code: '400', name: 'Amortyzacja', nameEn: 'Depreciation', type: 'COST_BY_TYPE', class: 4, balance: 'DEBIT' },
  { code: '401', name: 'Zużycie materiałów i energii', nameEn: 'Materials & Energy', type: 'COST_BY_TYPE', class: 4, balance: 'DEBIT' },
  { code: '402', name: 'Usługi obce', nameEn: 'External Services', type: 'COST_BY_TYPE', class: 4, balance: 'DEBIT' },
  { code: '403', name: 'Podatki i opłaty', nameEn: 'Taxes & Fees', type: 'COST_BY_TYPE', class: 4, balance: 'DEBIT' },
  { code: '404', name: 'Wynagrodzenia', nameEn: 'Salaries', type: 'COST_BY_TYPE', class: 4, balance: 'DEBIT' },
  { code: '405', name: 'Ubezpieczenia społeczne', nameEn: 'Social Insurance', type: 'COST_BY_TYPE', class: 4, balance: 'DEBIT' },
  { code: '409', name: 'Pozostałe koszty rodzajowe', nameEn: 'Other Costs', type: 'COST_BY_TYPE', class: 4, balance: 'DEBIT' },

  // Class 7 - Revenue
  { code: '700', name: 'Sprzedaż produktów', nameEn: 'Product Sales', type: 'REVENUE', class: 7, balance: 'CREDIT' },
  { code: '730', name: 'Sprzedaż towarów', nameEn: 'Merchandise Sales', type: 'REVENUE', class: 7, balance: 'CREDIT' },
  { code: '750', name: 'Przychody finansowe', nameEn: 'Financial Income', type: 'REVENUE', class: 7, balance: 'CREDIT' },
  { code: '760', name: 'Pozostałe przychody operacyjne', nameEn: 'Other Operating Income', type: 'REVENUE', class: 7, balance: 'CREDIT' },

  // Class 8 - Equity and Results
  { code: '800', name: 'Kapitał podstawowy', nameEn: 'Share Capital', type: 'EQUITY', class: 8, balance: 'CREDIT' },
  { code: '820', name: 'Wynik finansowy', nameEn: 'Net Income', type: 'EQUITY', class: 8, balance: 'CREDIT' },
  { code: '860', name: 'Rozliczenie wyniku finansowego', nameEn: 'Profit Distribution', type: 'EQUITY', class: 8, balance: 'CREDIT' },
];
```

---

## Test Specifications

### Unit Tests

```typescript
describe('Template Service', () => {
  describe('applyTemplate', () => {
    it('should create all accounts from template', async () => {
      const result = await service.applyTemplate({
        templateId: 'standard-polish-coa',
      });

      expect(result.accountsCreated).toBeGreaterThan(100);
    });

    it('should skip excluded account classes', async () => {
      const result = await service.applyTemplate({
        templateId: 'standard-polish-coa',
        excludeAccountClasses: [5], // Exclude class 5
      });

      const accounts = await service.getAccounts({});
      const class5Accounts = accounts.filter((a) => a.accountClass === 5);

      expect(class5Accounts).toHaveLength(0);
    });

    it('should skip existing accounts when skipExisting is true', async () => {
      // Pre-create account
      await service.createAccount({
        accountCode: '100',
        accountName: 'Existing Kasa',
        accountType: 'CASH',
        normalBalance: 'DEBIT',
      });

      const result = await service.applyTemplate({
        templateId: 'standard-polish-coa',
        skipExisting: true,
      });

      const kasa = await service.getAccountByCode('100');
      expect(kasa.accountName).toBe('Existing Kasa'); // Not overwritten
    });

    it('should apply account name modifications', async () => {
      const result = await service.applyTemplate({
        templateId: 'standard-polish-coa',
        accountModifications: [
          { accountCode: '100', newName: 'Kasa główna firmy' },
        ],
      });

      const kasa = await service.getAccountByCode('100');
      expect(kasa.accountName).toBe('Kasa główna firmy');
    });
  });
});
```

---

## Security Checklist

- [x] Only authenticated users can apply templates
- [x] Templates are read-only (system templates)
- [x] Audit log records template applications
- [x] Organization isolation enforced
- [x] No sensitive data in templates

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| TEMPLATE_APPLIED | Template applied to organization | templateId, templateName, accountsCreated, customizations |

---

## Tasks

- [ ] Create database migrations for templates
- [ ] Seed standard Polish templates
- [ ] Implement template preview API
- [ ] Implement template application logic
- [ ] Create UI for template selection
- [ ] Write unit tests
- [ ] Write integration tests

---

*Last updated: December 2024*
