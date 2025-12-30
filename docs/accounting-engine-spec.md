# Accounting Engine Module - Complete Technical Specification

## Module Information
- **Module Name**: Accounting Engine
- **Acronym**: ACE
- **Primary Purpose**: Provide comprehensive double-entry bookkeeping functionality with Polish tax compliance
- **Key Features**: Chart of accounts management, journal entries, general ledger, trial balance, financial periods, multi-currency support, cost center tracking

---

## A. Module Overview

### Purpose
The Accounting Engine Module serves as the financial backbone of the accounting CRM platform, implementing professional double-entry bookkeeping principles with full compliance for Polish accounting standards. It maintains financial integrity through ACID-compliant transactions, automated balance calculations, and comprehensive audit trails.

### Scope
- **Chart of Accounts Management**: Hierarchical account structure with Polish COA templates
- **Journal Entry Processing**: Double-entry bookkeeping with automatic validation
- **General Ledger Maintenance**: Real-time ledger updates with balance tracking
- **Financial Period Management**: Monthly/quarterly/annual closing procedures
- **Multi-Currency Support**: Foreign currency transactions with revaluation
- **Cost Center Tracking**: Departmental and project-based accounting
- **Bank Reconciliation**: Matching transactions with bank statements
- **Trial Balance Generation**: Real-time and historical balance reports
- **Financial Statements**: P&L, Balance Sheet, Cash Flow preparation
- **Polish Compliance**: JPK_KR, JPK_VAT, JPK_FA support
- **Audit Trail**: Immutable transaction history
- **Reversals and Corrections**: Controlled entry modifications
- **Batch Processing**: Bulk transaction imports
- **Inter-company Transactions**: Multi-entity support

### Dependencies
- **Client Module**: Client financial settings and configurations
- **Authentication Module**: User context and permissions
- **Document Module**: Attachment management for source documents
- **Tax Module**: VAT calculations and tax reporting
- **Banking Module**: Bank transaction imports and reconciliation
- **Currency Module**: Exchange rate management
- **Audit Module**: Transaction logging and compliance

### Consumers
- **Reporting Module**: Financial reports and analytics
- **Tax Module**: Tax calculations and declarations
- **Portal Module**: Client financial dashboards
- **Invoice Module**: Revenue recognition and AR
- **Expense Module**: Cost tracking and AP
- **Payroll Module**: Salary postings
- **Budget Module**: Budget vs. actual comparisons

---

## B. Technical Specification

### Technology Stack

```yaml
Core Technologies:
  Language: TypeScript 5.0+
  Runtime: Node.js 20 LTS
  Framework: NestJS for DI and structure
  
Database:
  Primary: PostgreSQL 15
  - Decimal type for precise calculations
  - JSONB for flexible metadata
  - Temporal tables for audit trail
  
Calculation Engine:
  Decimal.js: Arbitrary precision arithmetic
  Currency.js: Money calculations
  Date-fns: Period calculations
  
Caching:
  Redis:
  - Account balances (TTL: 5 minutes)
  - Trial balance cache (TTL: 1 hour)
  - Exchange rates (TTL: 1 day)
  
Message Queue:
  BullMQ: Async processing for:
  - Batch imports
  - Period closing
  - Report generation
  
Security:
  - Row-level security for multi-tenancy
  - Field encryption for sensitive data
  - Immutable audit logs
  - Transaction signing
```

### Key Interfaces

```typescript
// =====================================
// Core Accounting Types
// =====================================

import { Decimal } from 'decimal.js';
import { z } from 'zod';

// Account Types following Polish standards
export enum AccountType {
  // Assets (Aktywa)
  FIXED_ASSETS = 'FIXED_ASSETS',           // Środki trwałe
  CURRENT_ASSETS = 'CURRENT_ASSETS',       // Aktywa obrotowe
  INVENTORY = 'INVENTORY',                 // Zapasy
  RECEIVABLES = 'RECEIVABLES',             // Należności
  CASH = 'CASH',                          // Środki pieniężne
  
  // Liabilities (Pasywa)
  EQUITY = 'EQUITY',                       // Kapitał własny
  LONG_TERM_LIABILITIES = 'LONG_TERM_LIABILITIES',
  SHORT_TERM_LIABILITIES = 'SHORT_TERM_LIABILITIES',
  PAYABLES = 'PAYABLES',                   // Zobowiązania
  
  // Income Statement
  REVENUE = 'REVENUE',                     // Przychody
  COST_OF_GOODS_SOLD = 'COST_OF_GOODS_SOLD', // Koszty własne sprzedaży
  OPERATING_EXPENSES = 'OPERATING_EXPENSES',  // Koszty operacyjne
  OTHER_INCOME = 'OTHER_INCOME',
  OTHER_EXPENSES = 'OTHER_EXPENSES',
  TAX_EXPENSE = 'TAX_EXPENSE'
}

export enum EntryStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
  VOID = 'VOID'
}

export enum PeriodStatus {
  OPEN = 'OPEN',
  SOFT_CLOSED = 'SOFT_CLOSED',
  HARD_CLOSED = 'HARD_CLOSED',
  ARCHIVED = 'ARCHIVED'
}

// =====================================
// Domain Models
// =====================================

export interface ChartOfAccount {
  id: string;
  organizationId: string;
  accountCode: string;          // e.g., "200-01-001"
  accountName: string;
  accountNamePL: string;        // Polish name
  accountType: AccountType;
  parentAccountId?: string;
  level: number;                // Hierarchy level (1-5)
  
  // Account properties
  normalBalance: 'DEBIT' | 'CREDIT';
  currency: string;              // Default currency
  allowMultiCurrency: boolean;
  requireCostCenter: boolean;
  requireProject: boolean;
  
  // Polish specific
  pkdCode?: string;             // Polish classification
  jpkCode?: string;             // JPK mapping
  taxCategory?: string;
  
  // Control fields
  isActive: boolean;
  isSystemAccount: boolean;     // Cannot be deleted
  isHeaderAccount: boolean;     // Only for grouping
  allowManualEntry: boolean;
  
  // Balances
  currentBalance: Decimal;
  ytdBalance: Decimal;          // Year-to-date
  budgetAmount?: Decimal;
  
  // Metadata
  description?: string;
  tags: string[];
  customFields: Record<string, any>;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface JournalEntry {
  id: string;
  organizationId: string;
  entryNumber: string;          // e.g., "JE-2024-01-0001"
  
  // Entry details
  entryDate: Date;
  postingDate: Date;
  accountingPeriodId: string;
  
  // Description
  description: string;
  descriptionPL?: string;
  reference?: string;           // External reference
  
  // Classification
  entryType: EntryType;
  source: EntrySource;          // Manual, Import, System
  
  // Lines
  lines: JournalLine[];
  
  // Amounts
  totalDebit: Decimal;
  totalCredit: Decimal;
  
  // Multi-currency
  currency: string;
  exchangeRate?: Decimal;
  baseCurrencyAmount?: Decimal;
  
  // Status
  status: EntryStatus;
  approvedBy?: string;
  approvedAt?: Date;
  postedBy?: string;
  postedAt?: Date;
  
  // Reversal
  isReversal: boolean;
  reversalOfId?: string;
  reversedById?: string;
  reversalReason?: string;
  
  // Attachments
  attachments: Attachment[];
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  version: number;
}

export interface JournalLine {
  id: string;
  lineNumber: number;
  
  // Account
  accountId: string;
  accountCode: string;
  accountName: string;
  
  // Amounts
  debit: Decimal;
  credit: Decimal;
  
  // Multi-currency
  foreignDebit?: Decimal;
  foreignCredit?: Decimal;
  exchangeRate?: Decimal;
  
  // Dimensions
  costCenterId?: string;
  projectId?: string;
  departmentId?: string;
  
  // Description
  description?: string;
  
  // Tax
  vatRate?: number;
  vatAmount?: Decimal;
  taxCode?: string;
  
  // References
  invoiceId?: string;
  customerId?: string;
  vendorId?: string;
  employeeId?: string;
  
  // Analytics
  analysisCode1?: string;
  analysisCode2?: string;
  analysisCode3?: string;
}

export interface GeneralLedger {
  id: string;
  accountId: string;
  periodId: string;
  
  // Balances
  openingBalance: Decimal;
  periodDebit: Decimal;
  periodCredit: Decimal;
  closingBalance: Decimal;
  
  // Multi-currency
  currency: string;
  foreignOpeningBalance?: Decimal;
  foreignPeriodDebit?: Decimal;
  foreignPeriodCredit?: Decimal;
  foreignClosingBalance?: Decimal;
  
  // Transaction count
  transactionCount: number;
  
  // Status
  isReconciled: boolean;
  reconciledAt?: Date;
  reconciledBy?: string;
}

export interface AccountingPeriod {
  id: string;
  organizationId: string;
  
  // Period definition
  year: number;
  month: number;
  quarter?: number;
  periodName: string;           // e.g., "January 2024"
  
  // Dates
  startDate: Date;
  endDate: Date;
  
  // Status
  status: PeriodStatus;
  
  // Closing information
  softClosedAt?: Date;
  softClosedBy?: string;
  hardClosedAt?: Date;
  hardClosedBy?: string;
  
  // Statistics
  journalEntryCount: number;
  totalDebit: Decimal;
  totalCredit: Decimal;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}

// =====================================
// Service Interfaces
// =====================================

export interface AccountingService {
  // Chart of Accounts
  createAccount(data: CreateAccountDto): Promise<ChartOfAccount>;
  updateAccount(id: string, data: UpdateAccountDto): Promise<ChartOfAccount>;
  deactivateAccount(id: string): Promise<void>;
  getAccountBalance(accountId: string, date?: Date): Promise<AccountBalance>;
  getAccountHistory(accountId: string, dateRange: DateRange): Promise<AccountHistory>;
  importChartOfAccounts(template: COATemplate): Promise<ImportResult>;
  
  // Journal Entries
  createJournalEntry(data: CreateJournalEntryDto): Promise<JournalEntry>;
  postJournalEntry(id: string): Promise<JournalEntry>;
  reverseJournalEntry(id: string, reason: string): Promise<JournalEntry>;
  voidJournalEntry(id: string, reason: string): Promise<void>;
  approveJournalEntry(id: string): Promise<JournalEntry>;
  
  // Period Management
  openPeriod(year: number, month: number): Promise<AccountingPeriod>;
  softClosePeriod(periodId: string): Promise<ClosingResult>;
  hardClosePeriod(periodId: string): Promise<ClosingResult>;
  reopenPeriod(periodId: string, reason: string): Promise<AccountingPeriod>;
  
  // Reports
  generateTrialBalance(date: Date, options?: TrialBalanceOptions): Promise<TrialBalance>;
  generateIncomeStatement(dateRange: DateRange): Promise<IncomeStatement>;
  generateBalanceSheet(date: Date): Promise<BalanceSheet>;
  generateCashFlow(dateRange: DateRange): Promise<CashFlowStatement>;
  generateGeneralLedger(filters: GLFilters): Promise<GeneralLedgerReport>;
  
  // Bank Reconciliation
  importBankStatement(data: BankStatementData): Promise<ImportResult>;
  matchTransactions(bankTxId: string, journalEntryId: string): Promise<ReconciliationMatch>;
  reconcileAccount(accountId: string, date: Date): Promise<ReconciliationResult>;
  
  // Multi-currency
  revaluateForeignCurrency(date: Date): Promise<RevaluationResult>;
  recordExchangeDifference(data: ExchangeDifferenceDto): Promise<JournalEntry>;
  
  // Polish Compliance
  generateJPK_KR(period: AccountingPeriod): Promise<JPK_KR>;
  generateJPK_VAT(period: AccountingPeriod): Promise<JPK_VAT>;
  validateJPK(jpkData: any): Promise<ValidationResult>;
}

// =====================================
// Data Transfer Objects
// =====================================

export const CreateAccountDto = z.object({
  accountCode: z.string().regex(/^\d{3}(-\d{2}(-\d{3})?)?$/),
  accountName: z.string().min(1).max(255),
  accountNamePL: z.string().min(1).max(255).optional(),
  accountType: z.nativeEnum(AccountType),
  parentAccountId: z.string().uuid().optional(),
  normalBalance: z.enum(['DEBIT', 'CREDIT']),
  currency: z.string().length(3).default('PLN'),
  allowMultiCurrency: z.boolean().default(false),
  requireCostCenter: z.boolean().default(false),
  requireProject: z.boolean().default(false),
  isActive: z.boolean().default(true),
  allowManualEntry: z.boolean().default(true),
  description: z.string().optional(),
  tags: z.array(z.string()).default([])
});

export const CreateJournalEntryDto = z.object({
  entryDate: z.date(),
  description: z.string().min(1).max(500),
  reference: z.string().optional(),
  entryType: z.string(),
  lines: z.array(z.object({
    accountId: z.string().uuid(),
    debit: z.number().min(0),
    credit: z.number().min(0),
    description: z.string().optional(),
    costCenterId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    vatRate: z.number().optional(),
    customerId: z.string().uuid().optional(),
    vendorId: z.string().uuid().optional()
  })).min(2).refine(
    lines => {
      const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
      return Math.abs(totalDebit - totalCredit) < 0.01;
    },
    { message: 'Journal entry must balance (debits must equal credits)' }
  ),
  attachmentIds: z.array(z.string().uuid()).optional()
});

export type CreateAccountDto = z.infer<typeof CreateAccountDto>;
export type CreateJournalEntryDto = z.infer<typeof CreateJournalEntryDto>;
```

### API Endpoints

```typescript
// RESTful API endpoints
export const accountingEndpoints = {
  // Chart of Accounts
  'POST   /api/v1/accounts': 'Create account',
  'GET    /api/v1/accounts': 'List accounts',
  'GET    /api/v1/accounts/tree': 'Get hierarchical COA',
  'GET    /api/v1/accounts/:id': 'Get account details',
  'PUT    /api/v1/accounts/:id': 'Update account',
  'DELETE /api/v1/accounts/:id': 'Deactivate account',
  'GET    /api/v1/accounts/:id/balance': 'Get account balance',
  'GET    /api/v1/accounts/:id/history': 'Get transaction history',
  'POST   /api/v1/accounts/import': 'Import COA template',
  
  // Journal Entries
  'POST   /api/v1/journal-entries': 'Create journal entry',
  'GET    /api/v1/journal-entries': 'List journal entries',
  'GET    /api/v1/journal-entries/:id': 'Get entry details',
  'PUT    /api/v1/journal-entries/:id': 'Update draft entry',
  'POST   /api/v1/journal-entries/:id/post': 'Post entry',
  'POST   /api/v1/journal-entries/:id/approve': 'Approve entry',
  'POST   /api/v1/journal-entries/:id/reverse': 'Reverse entry',
  'POST   /api/v1/journal-entries/:id/void': 'Void entry',
  'POST   /api/v1/journal-entries/import': 'Bulk import entries',
  
  // Periods
  'GET    /api/v1/periods': 'List accounting periods',
  'POST   /api/v1/periods': 'Create new period',
  'GET    /api/v1/periods/:id': 'Get period details',
  'POST   /api/v1/periods/:id/soft-close': 'Soft close period',
  'POST   /api/v1/periods/:id/hard-close': 'Hard close period',
  'POST   /api/v1/periods/:id/reopen': 'Reopen period',
  
  // Reports
  'GET    /api/v1/reports/trial-balance': 'Generate trial balance',
  'GET    /api/v1/reports/income-statement': 'Generate P&L',
  'GET    /api/v1/reports/balance-sheet': 'Generate balance sheet',
  'GET    /api/v1/reports/cash-flow': 'Generate cash flow',
  'GET    /api/v1/reports/general-ledger': 'Generate GL report',
  'GET    /api/v1/reports/account-statement': 'Account statement',
  
  // Bank Reconciliation
  'POST   /api/v1/bank/import': 'Import bank statement',
  'GET    /api/v1/bank/unmatched': 'Get unmatched transactions',
  'POST   /api/v1/bank/match': 'Match transactions',
  'POST   /api/v1/bank/reconcile': 'Reconcile account',
  
  // Polish Compliance
  'GET    /api/v1/jpk/kr': 'Generate JPK_KR',
  'GET    /api/v1/jpk/vat': 'Generate JPK_VAT',
  'POST   /api/v1/jpk/validate': 'Validate JPK file'
};
```

---

## C. Implementation Details

### Main Service Implementation

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { Decimal } from 'decimal.js';
import { Redis } from 'ioredis';
import { Logger } from 'winston';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AccountingServiceImpl implements AccountingService {
  private readonly BALANCE_CACHE_TTL = 300; // 5 minutes
  private readonly TRIAL_BALANCE_CACHE_TTL = 3600; // 1 hour
  
  constructor(
    @InjectRepository(ChartOfAccount) private accountRepo: Repository<ChartOfAccount>,
    @InjectRepository(JournalEntry) private entryRepo: Repository<JournalEntry>,
    @InjectRepository(GeneralLedger) private ledgerRepo: Repository<GeneralLedger>,
    @InjectRepository(AccountingPeriod) private periodRepo: Repository<AccountingPeriod>,
    @Inject('DataSource') private dataSource: DataSource,
    @Inject('Redis') private cache: Redis,
    @Inject('Logger') private logger: Logger,
    @Inject('EventEmitter') private eventEmitter: EventEmitter2,
    @Inject('AuditService') private auditService: AuditService,
    @Inject('AuthContext') private authContext: AuthContext
  ) {}

  // =====================================
  // Journal Entry Processing
  // =====================================

  async createJournalEntry(data: CreateJournalEntryDto): Promise<JournalEntry> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      // Validate DTO
      const validated = CreateJournalEntryDto.parse(data);
      
      // Check if period is open
      const period = await this.getPeriodForDate(validated.entryDate);
      if (!period || period.status !== PeriodStatus.OPEN) {
        throw new ClosedPeriodException(`Period for ${validated.entryDate} is not open`);
      }

      // Validate all accounts exist and are active
      const accountIds = validated.lines.map(line => line.accountId);
      const accounts = await queryRunner.manager
        .createQueryBuilder(ChartOfAccount, 'account')
        .where('account.id IN (:...ids)', { ids: accountIds })
        .andWhere('account.isActive = :active', { active: true })
        .andWhere('account.organizationId = :orgId', { 
          orgId: this.authContext.organizationId 
        })
        .getMany();

      if (accounts.length !== accountIds.length) {
        throw new InvalidAccountException('One or more accounts are invalid or inactive');
      }

      // Create account map for validation
      const accountMap = new Map(accounts.map(a => [a.id, a]));

      // Validate account requirements
      for (const line of validated.lines) {
        const account = accountMap.get(line.accountId);
        if (!account) continue;

        // Check if manual entry is allowed
        if (!account.allowManualEntry) {
          throw new AccountRestrictionException(
            `Manual entries not allowed for account ${account.accountCode}`
          );
        }

        // Check required dimensions
        if (account.requireCostCenter && !line.costCenterId) {
          throw new ValidationException(
            `Cost center required for account ${account.accountCode}`
          );
        }
        if (account.requireProject && !line.projectId) {
          throw new ValidationException(
            `Project required for account ${account.accountCode}`
          );
        }
      }

      // Calculate totals
      const totalDebit = validated.lines.reduce(
        (sum, line) => sum.add(new Decimal(line.debit)), 
        new Decimal(0)
      );
      const totalCredit = validated.lines.reduce(
        (sum, line) => sum.add(new Decimal(line.credit)), 
        new Decimal(0)
      );

      // Verify balance
      if (!totalDebit.equals(totalCredit)) {
        throw new UnbalancedEntryException(
          `Entry unbalanced: Debit ${totalDebit} != Credit ${totalCredit}`
        );
      }

      // Generate entry number
      const entryNumber = await this.generateEntryNumber(period, queryRunner);

      // Create journal entry
      const journalEntry = queryRunner.manager.create(JournalEntry, {
        organizationId: this.authContext.organizationId,
        entryNumber,
        entryDate: validated.entryDate,
        postingDate: new Date(),
        accountingPeriodId: period.id,
        description: validated.description,
        reference: validated.reference,
        entryType: validated.entryType || 'MANUAL',
        source: 'MANUAL',
        status: EntryStatus.DRAFT,
        totalDebit,
        totalCredit,
        currency: 'PLN',
        isReversal: false,
        createdBy: this.authContext.userId,
        updatedBy: this.authContext.userId,
        version: 1,
        lines: []
      });

      // Save entry first to get ID
      const savedEntry = await queryRunner.manager.save(journalEntry);

      // Create journal lines
      const journalLines = [];
      for (let i = 0; i < validated.lines.length; i++) {
        const lineData = validated.lines[i];
        const account = accountMap.get(lineData.accountId)!;

        const line = queryRunner.manager.create(JournalLine, {
          journalEntryId: savedEntry.id,
          lineNumber: i + 1,
          accountId: lineData.accountId,
          accountCode: account.accountCode,
          accountName: account.accountName,
          debit: new Decimal(lineData.debit),
          credit: new Decimal(lineData.credit),
          description: lineData.description,
          costCenterId: lineData.costCenterId,
          projectId: lineData.projectId,
          vatRate: lineData.vatRate,
          vatAmount: lineData.vatRate ? 
            new Decimal(lineData.debit || lineData.credit).mul(lineData.vatRate).div(100) : 
            undefined,
          customerId: lineData.customerId,
          vendorId: lineData.vendorId
        });

        journalLines.push(line);
      }

      // Save all lines
      savedEntry.lines = await queryRunner.manager.save(journalLines);

      // Create audit log
      await this.auditService.logCreate({
        entityType: 'JournalEntry',
        entityId: savedEntry.id,
        data: savedEntry,
        userId: this.authContext.userId,
        organizationId: this.authContext.organizationId
      });

      // Emit event
      await this.eventEmitter.emit('journal.entry.created', {
        entryId: savedEntry.id,
        entryNumber: savedEntry.entryNumber,
        totalAmount: totalDebit.toString(),
        userId: this.authContext.userId
      });

      await queryRunner.commitTransaction();

      this.logger.info(`Journal entry ${savedEntry.entryNumber} created`, {
        entryId: savedEntry.id,
        userId: this.authContext.userId
      });

      return savedEntry;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to create journal entry', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async postJournalEntry(id: string): Promise<JournalEntry> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('REPEATABLE READ');

    try {
      // Get entry with lock
      const entry = await queryRunner.manager
        .createQueryBuilder(JournalEntry, 'entry')
        .leftJoinAndSelect('entry.lines', 'lines')
        .where('entry.id = :id', { id })
        .andWhere('entry.organizationId = :orgId', { 
          orgId: this.authContext.organizationId 
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!entry) {
        throw new EntryNotFoundException(`Journal entry ${id} not found`);
      }

      // Validate status
      if (entry.status !== EntryStatus.DRAFT && entry.status !== EntryStatus.APPROVED) {
        throw new InvalidStatusException(
          `Cannot post entry with status ${entry.status}`
        );
      }

      // Check period is open
      const period = await queryRunner.manager.findOne(AccountingPeriod, {
        where: { id: entry.accountingPeriodId }
      });

      if (!period || period.status !== PeriodStatus.OPEN) {
        throw new ClosedPeriodException('Cannot post to closed period');
      }

      // Update general ledger for each line
      for (const line of entry.lines) {
        await this.updateGeneralLedger(
          queryRunner,
          line,
          entry.accountingPeriodId,
          entry.entryDate
        );

        // Update account balance
        await this.updateAccountBalance(
          queryRunner,
          line.accountId,
          line.debit,
          line.credit
        );
      }

      // Update entry status
      entry.status = EntryStatus.POSTED;
      entry.postedAt = new Date();
      entry.postedBy = this.authContext.userId;
      
      const postedEntry = await queryRunner.manager.save(entry);

      // Clear caches
      await this.clearAccountBalanceCache();
      await this.clearTrialBalanceCache();

      // Create audit log
      await this.auditService.logUpdate({
        entityType: 'JournalEntry',
        entityId: entry.id,
        changes: [
          { field: 'status', oldValue: 'DRAFT', newValue: 'POSTED' }
        ],
        userId: this.authContext.userId
      });

      // Emit event
      await this.eventEmitter.emit('journal.entry.posted', {
        entryId: entry.id,
        entryNumber: entry.entryNumber,
        postedBy: this.authContext.userId,
        postedAt: new Date()
      });

      await queryRunner.commitTransaction();

      this.logger.info(`Journal entry ${entry.entryNumber} posted`, {
        entryId: entry.id,
        userId: this.authContext.userId
      });

      return postedEntry;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to post journal entry ${id}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async reverseJournalEntry(id: string, reason: string): Promise<JournalEntry> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get original entry
      const originalEntry = await queryRunner.manager
        .createQueryBuilder(JournalEntry, 'entry')
        .leftJoinAndSelect('entry.lines', 'lines')
        .where('entry.id = :id', { id })
        .andWhere('entry.organizationId = :orgId', {
          orgId: this.authContext.organizationId
        })
        .getOne();

      if (!originalEntry) {
        throw new EntryNotFoundException(`Journal entry ${id} not found`);
      }

      // Validate can be reversed
      if (originalEntry.status !== EntryStatus.POSTED) {
        throw new InvalidStatusException('Only posted entries can be reversed');
      }

      if (originalEntry.reversedById) {
        throw new AlreadyReversedException('Entry has already been reversed');
      }

      // Check period
      const currentPeriod = await this.getCurrentPeriod();
      if (!currentPeriod || currentPeriod.status !== PeriodStatus.OPEN) {
        throw new ClosedPeriodException('Current period is not open');
      }

      // Create reversal entry
      const reversalEntry = queryRunner.manager.create(JournalEntry, {
        organizationId: originalEntry.organizationId,
        entryNumber: await this.generateEntryNumber(currentPeriod, queryRunner),
        entryDate: new Date(),
        postingDate: new Date(),
        accountingPeriodId: currentPeriod.id,
        description: `Reversal of ${originalEntry.entryNumber}: ${reason}`,
        reference: originalEntry.entryNumber,
        entryType: 'REVERSAL',
        source: 'SYSTEM',
        status: EntryStatus.POSTED,
        totalDebit: originalEntry.totalCredit, // Swap debits and credits
        totalCredit: originalEntry.totalDebit,
        currency: originalEntry.currency,
        isReversal: true,
        reversalOfId: originalEntry.id,
        reversalReason: reason,
        postedAt: new Date(),
        postedBy: this.authContext.userId,
        createdBy: this.authContext.userId,
        updatedBy: this.authContext.userId,
        version: 1
      });

      const savedReversal = await queryRunner.manager.save(reversalEntry);

      // Create reversal lines (swap debits and credits)
      const reversalLines = [];
      for (const originalLine of originalEntry.lines) {
        const reversalLine = queryRunner.manager.create(JournalLine, {
          journalEntryId: savedReversal.id,
          lineNumber: originalLine.lineNumber,
          accountId: originalLine.accountId,
          accountCode: originalLine.accountCode,
          accountName: originalLine.accountName,
          debit: originalLine.credit, // Swap
          credit: originalLine.debit, // Swap
          description: `Reversal: ${originalLine.description || ''}`,
          costCenterId: originalLine.costCenterId,
          projectId: originalLine.projectId
        });

        reversalLines.push(reversalLine);

        // Update general ledger
        await this.updateGeneralLedger(
          queryRunner,
          reversalLine,
          currentPeriod.id,
          new Date()
        );

        // Update account balance
        await this.updateAccountBalance(
          queryRunner,
          reversalLine.accountId,
          reversalLine.debit,
          reversalLine.credit
        );
      }

      savedReversal.lines = await queryRunner.manager.save(reversalLines);

      // Mark original as reversed
      originalEntry.status = EntryStatus.REVERSED;
      originalEntry.reversedById = savedReversal.id;
      await queryRunner.manager.save(originalEntry);

      // Clear caches
      await this.clearAccountBalanceCache();
      await this.clearTrialBalanceCache();

      // Audit logs
      await this.auditService.logUpdate({
        entityType: 'JournalEntry',
        entityId: originalEntry.id,
        changes: [
          { field: 'status', oldValue: 'POSTED', newValue: 'REVERSED' },
          { field: 'reversedById', oldValue: null, newValue: savedReversal.id }
        ],
        userId: this.authContext.userId
      });

      // Emit event
      await this.eventEmitter.emit('journal.entry.reversed', {
        originalEntryId: originalEntry.id,
        reversalEntryId: savedReversal.id,
        reason,
        reversedBy: this.authContext.userId
      });

      await queryRunner.commitTransaction();

      this.logger.info(`Journal entry ${originalEntry.entryNumber} reversed`, {
        originalId: originalEntry.id,
        reversalId: savedReversal.id,
        userId: this.authContext.userId
      });

      return savedReversal;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to reverse journal entry ${id}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // =====================================
  // Trial Balance Generation
  // =====================================

  async generateTrialBalance(
    date: Date, 
    options?: TrialBalanceOptions
  ): Promise<TrialBalance> {
    try {
      // Check cache first
      const cacheKey = `trial_balance:${this.authContext.organizationId}:${date.toISOString()}`;
      const cached = await this.cache.get(cacheKey);
      if (cached && !options?.skipCache) {
        return JSON.parse(cached);
      }

      // Get all active accounts
      const accounts = await this.accountRepo.find({
        where: {
          organizationId: this.authContext.organizationId,
          isActive: true
        },
        order: {
          accountCode: 'ASC'
        }
      });

      // Get period for date
      const period = await this.getPeriodForDate(date);
      if (!period) {
        throw new PeriodNotFoundException(`No period found for date ${date}`);
      }

      // Build trial balance
      const balanceRows: TrialBalanceRow[] = [];
      let totalDebit = new Decimal(0);
      let totalCredit = new Decimal(0);

      for (const account of accounts) {
        // Skip header accounts
        if (account.isHeaderAccount) continue;

        // Get account balance at date
        const balance = await this.getAccountBalanceAtDate(
          account.id, 
          date,
          options?.includeDrafts || false
        );

        if (balance.isZero() && options?.excludeZeroBalances) {
          continue;
        }

        const row: TrialBalanceRow = {
          accountCode: account.accountCode,
          accountName: account.accountName,
          accountType: account.accountType,
          debit: balance.isPositive() && account.normalBalance === 'DEBIT' 
            ? balance 
            : new Decimal(0),
          credit: balance.isNegative() || (balance.isPositive() && account.normalBalance === 'CREDIT')
            ? balance.abs()
            : new Decimal(0),
          balance: balance,
          ytdBalance: await this.getYTDBalance(account.id, date)
        };

        balanceRows.push(row);
        totalDebit = totalDebit.add(row.debit);
        totalCredit = totalCredit.add(row.credit);
      }

      const trialBalance: TrialBalance = {
        organizationId: this.authContext.organizationId,
        date,
        periodId: period.id,
        periodName: period.periodName,
        rows: balanceRows,
        totalDebit,
        totalCredit,
        difference: totalDebit.sub(totalCredit),
        isBalanced: totalDebit.equals(totalCredit),
        generatedAt: new Date(),
        generatedBy: this.authContext.userId
      };

      // Cache result
      await this.cache.setex(
        cacheKey,
        this.TRIAL_BALANCE_CACHE_TTL,
        JSON.stringify(trialBalance)
      );

      this.logger.info('Trial balance generated', {
        date,
        rowCount: balanceRows.length,
        isBalanced: trialBalance.isBalanced
      });

      return trialBalance;

    } catch (error) {
      this.logger.error('Failed to generate trial balance', error);
      throw error;
    }
  }

  // =====================================
  // Helper Methods
  // =====================================

  private async updateGeneralLedger(
    queryRunner: QueryRunner,
    line: JournalLine,
    periodId: string,
    entryDate: Date
  ): Promise<void> {
    // Find or create GL entry for account and period
    let glEntry = await queryRunner.manager.findOne(GeneralLedger, {
      where: {
        accountId: line.accountId,
        periodId: periodId
      },
      lock: { mode: 'pessimistic_write' }
    });

    if (!glEntry) {
      // Get opening balance from previous period
      const openingBalance = await this.getOpeningBalance(
        line.accountId,
        periodId,
        queryRunner
      );

      glEntry = queryRunner.manager.create(GeneralLedger, {
        accountId: line.accountId,
        periodId: periodId,
        openingBalance: openingBalance,
        periodDebit: new Decimal(0),
        periodCredit: new Decimal(0),
        closingBalance: openingBalance,
        currency: 'PLN',
        transactionCount: 0
      });
    }

    // Update GL entry
    glEntry.periodDebit = glEntry.periodDebit.add(line.debit);
    glEntry.periodCredit = glEntry.periodCredit.add(line.credit);
    glEntry.closingBalance = glEntry.openingBalance
      .add(glEntry.periodDebit)
      .sub(glEntry.periodCredit);
    glEntry.transactionCount++;

    await queryRunner.manager.save(glEntry);
  }

  private async updateAccountBalance(
    queryRunner: QueryRunner,
    accountId: string,
    debit: Decimal,
    credit: Decimal
  ): Promise<void> {
    const account = await queryRunner.manager.findOne(ChartOfAccount, {
      where: { id: accountId },
      lock: { mode: 'pessimistic_write' }
    });

    if (!account) {
      throw new AccountNotFoundException(`Account ${accountId} not found`);
    }

    if (account.normalBalance === 'DEBIT') {
      account.currentBalance = account.currentBalance.add(debit).sub(credit);
    } else {
      account.currentBalance = account.currentBalance.add(credit).sub(debit);
    }

    await queryRunner.manager.save(account);
  }

  private async generateEntryNumber(
    period: AccountingPeriod,
    queryRunner: QueryRunner
  ): Promise<string> {
    const prefix = `JE-${period.year}-${String(period.month).padStart(2, '0')}`;
    
    const lastEntry = await queryRunner.manager
      .createQueryBuilder(JournalEntry, 'entry')
      .where('entry.entryNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('entry.entryNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastEntry) {
      const lastSequence = parseInt(lastEntry.entryNumber.split('-').pop() || '0');
      sequence = lastSequence + 1;
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }

  private async getAccountBalanceAtDate(
    accountId: string,
    date: Date,
    includeDrafts: boolean = false
  ): Promise<Decimal> {
    const query = this.dataSource
      .createQueryBuilder()
      .select('SUM(line.debit)', 'totalDebit')
      .addSelect('SUM(line.credit)', 'totalCredit')
      .from(JournalLine, 'line')
      .innerJoin('line.journalEntry', 'entry')
      .where('line.accountId = :accountId', { accountId })
      .andWhere('entry.entryDate <= :date', { date })
      .andWhere('entry.organizationId = :orgId', {
        orgId: this.authContext.organizationId
      });

    if (!includeDrafts) {
      query.andWhere('entry.status = :status', { status: EntryStatus.POSTED });
    }

    const result = await query.getRawOne();
    
    const totalDebit = new Decimal(result.totalDebit || 0);
    const totalCredit = new Decimal(result.totalCredit || 0);
    
    const account = await this.accountRepo.findOne({ where: { id: accountId } });
    
    if (account?.normalBalance === 'DEBIT') {
      return totalDebit.sub(totalCredit);
    } else {
      return totalCredit.sub(totalDebit);
    }
  }

  private async clearAccountBalanceCache(): Promise<void> {
    const pattern = `balance:${this.authContext.organizationId}:*`;
    const keys = await this.cache.keys(pattern);
    if (keys.length > 0) {
      await this.cache.del(...keys);
    }
  }

  private async clearTrialBalanceCache(): Promise<void> {
    const pattern = `trial_balance:${this.authContext.organizationId}:*`;
    const keys = await this.cache.keys(pattern);
    if (keys.length > 0) {
      await this.cache.del(...keys);
    }
  }

  // Additional helper methods continue...
}

// =====================================
// Custom Exceptions
// =====================================

export class AccountingException extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AccountingException';
  }
}

export class UnbalancedEntryException extends AccountingException {
  constructor(message: string) {
    super(message, 'UNBALANCED_ENTRY');
  }
}

export class ClosedPeriodException extends AccountingException {
  constructor(message: string) {
    super(message, 'CLOSED_PERIOD');
  }
}

export class InvalidAccountException extends AccountingException {
  constructor(message: string) {
    super(message, 'INVALID_ACCOUNT');
  }
}

export class DuplicateEntryException extends AccountingException {
  constructor(message: string) {
    super(message, 'DUPLICATE_ENTRY');
  }
}

export class InsufficientPermissionsException extends AccountingException {
  constructor(message: string) {
    super(message, 'INSUFFICIENT_PERMISSIONS');
  }
}
```

---

## D. Database Schema

```sql
-- =====================================
-- Chart of Accounts
-- =====================================
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Account identification
  account_code VARCHAR(20) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_name_pl VARCHAR(255),
  
  -- Account properties
  account_type VARCHAR(50) NOT NULL,
  parent_account_id UUID REFERENCES chart_of_accounts(id),
  level INTEGER NOT NULL DEFAULT 1,
  normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
  
  -- Currency settings
  currency CHAR(3) NOT NULL DEFAULT 'PLN',
  allow_multi_currency BOOLEAN DEFAULT FALSE,
  
  -- Requirements
  require_cost_center BOOLEAN DEFAULT FALSE,
  require_project BOOLEAN DEFAULT FALSE,
  
  -- Polish specific
  pkd_code VARCHAR(10),
  jpk_code VARCHAR(50),
  tax_category VARCHAR(50),
  
  -- Control flags
  is_active BOOLEAN DEFAULT TRUE,
  is_system_account BOOLEAN DEFAULT FALSE,
  is_header_account BOOLEAN DEFAULT FALSE,
  allow_manual_entry BOOLEAN DEFAULT TRUE,
  
  -- Current balances (denormalized for performance)
  current_balance DECIMAL(15,2) DEFAULT 0,
  ytd_balance DECIMAL(15,2) DEFAULT 0,
  budget_amount DECIMAL(15,2),
  
  -- Metadata
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  
  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  updated_by UUID NOT NULL,
  
  -- Constraints
  UNIQUE(organization_id, account_code),
  CHECK (level BETWEEN 1 AND 5)
);

-- =====================================
-- Journal Entries
-- =====================================
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Entry identification
  entry_number VARCHAR(30) NOT NULL,
  
  -- Dates
  entry_date DATE NOT NULL,
  posting_date DATE,
  accounting_period_id UUID NOT NULL REFERENCES accounting_periods(id),
  
  -- Description
  description VARCHAR(500) NOT NULL,
  description_pl VARCHAR(500),
  reference VARCHAR(100),
  
  -- Classification
  entry_type VARCHAR(50) NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  posted_by UUID REFERENCES users(id),
  posted_at TIMESTAMP,
  
  -- Amounts (denormalized for performance)
  total_debit DECIMAL(15,2) NOT NULL,
  total_credit DECIMAL(15,2) NOT NULL,
  
  -- Multi-currency
  currency CHAR(3) NOT NULL DEFAULT 'PLN',
  exchange_rate DECIMAL(10,6),
  base_currency_amount DECIMAL(15,2),
  
  -- Reversal information
  is_reversal BOOLEAN DEFAULT FALSE,
  reversal_of_id UUID REFERENCES journal_entries(id),
  reversed_by_id UUID REFERENCES journal_entries(id),
  reversal_reason TEXT,
  
  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  updated_by UUID NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Constraints
  UNIQUE(organization_id, entry_number),
  CHECK (total_debit = total_credit),
  CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'REVERSED', 'VOID'))
);

-- =====================================
-- Journal Lines
-- =====================================
CREATE TABLE journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  
  -- Account
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  account_code VARCHAR(20) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  
  -- Amounts
  debit DECIMAL(15,2) NOT NULL DEFAULT 0,
  credit DECIMAL(15,2) NOT NULL DEFAULT 0,
  
  -- Multi-currency
  foreign_debit DECIMAL(15,2),
  foreign_credit DECIMAL(15,2),
  exchange_rate DECIMAL(10,6),
  
  -- Dimensions
  cost_center_id UUID,
  project_id UUID,
  department_id UUID,
  
  -- Description
  description VARCHAR(500),
  
  -- Tax
  vat_rate DECIMAL(5,2),
  vat_amount DECIMAL(15,2),
  tax_code VARCHAR(20),
  
  -- References
  invoice_id UUID,
  customer_id UUID,
  vendor_id UUID,
  employee_id UUID,
  
  -- Analytics codes
  analysis_code1 VARCHAR(50),
  analysis_code2 VARCHAR(50),
  analysis_code3 VARCHAR(50),
  
  -- Constraints
  CHECK ((debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)),
  UNIQUE(journal_entry_id, line_number)
);

-- =====================================
-- General Ledger
-- =====================================
CREATE TABLE general_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  period_id UUID NOT NULL REFERENCES accounting_periods(id),
  
  -- Balances
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  period_debit DECIMAL(15,2) NOT NULL DEFAULT 0,
  period_credit DECIMAL(15,2) NOT NULL DEFAULT 0,
  closing_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  
  -- Multi-currency
  currency CHAR(3) NOT NULL DEFAULT 'PLN',
  foreign_opening_balance DECIMAL(15,2),
  foreign_period_debit DECIMAL(15,2),
  foreign_period_credit DECIMAL(15,2),
  foreign_closing_balance DECIMAL(15,2),
  
  -- Statistics
  transaction_count INTEGER NOT NULL DEFAULT 0,
  
  -- Reconciliation
  is_reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMP,
  reconciled_by UUID REFERENCES users(id),
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(account_id, period_id)
);

-- =====================================
-- Accounting Periods
-- =====================================
CREATE TABLE accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Period definition
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  quarter INTEGER,
  period_name VARCHAR(50) NOT NULL,
  
  -- Dates
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  
  -- Closing information
  soft_closed_at TIMESTAMP,
  soft_closed_by UUID REFERENCES users(id),
  hard_closed_at TIMESTAMP,
  hard_closed_by UUID REFERENCES users(id),
  
  -- Statistics
  journal_entry_count INTEGER DEFAULT 0,
  total_debit DECIMAL(15,2) DEFAULT 0,
  total_credit DECIMAL(15,2) DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(organization_id, year, month),
  CHECK (month BETWEEN 1 AND 12),
  CHECK (status IN ('OPEN', 'SOFT_CLOSED', 'HARD_CLOSED', 'ARCHIVED'))
);

-- =====================================
-- Indexes for Performance
-- =====================================

-- Chart of Accounts
CREATE INDEX idx_coa_org_code ON chart_of_accounts(organization_id, account_code);
CREATE INDEX idx_coa_parent ON chart_of_accounts(parent_account_id);
CREATE INDEX idx_coa_type ON chart_of_accounts(account_type);
CREATE INDEX idx_coa_active ON chart_of_accounts(is_active) WHERE is_active = true;

-- Journal Entries
CREATE INDEX idx_je_org_number ON journal_entries(organization_id, entry_number);
CREATE INDEX idx_je_period ON journal_entries(accounting_period_id);
CREATE INDEX idx_je_date ON journal_entries(entry_date);
CREATE INDEX idx_je_status ON journal_entries(status);
CREATE INDEX idx_je_posted ON journal_entries(posted_at) WHERE status = 'POSTED';

-- Journal Lines
CREATE INDEX idx_jl_entry ON journal_lines(journal_entry_id);
CREATE INDEX idx_jl_account ON journal_lines(account_id);
CREATE INDEX idx_jl_cost_center ON journal_lines(cost_center_id) WHERE cost_center_id IS NOT NULL;
CREATE INDEX idx_jl_project ON journal_lines(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_jl_customer ON journal_lines(customer_id) WHERE customer_id IS NOT NULL;

-- General Ledger
CREATE INDEX idx_gl_account_period ON general_ledger(account_id, period_id);
CREATE INDEX idx_gl_period ON general_ledger(period_id);

-- Accounting Periods
CREATE INDEX idx_ap_org_year_month ON accounting_periods(organization_id, year, month);
CREATE INDEX idx_ap_status ON accounting_periods(status);
CREATE INDEX idx_ap_dates ON accounting_periods(start_date, end_date);
```

---

## E. Testing Strategy

### Unit Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AccountingServiceImpl } from './accounting.service';
import { Repository, DataSource } from 'typeorm';
import { Decimal } from 'decimal.js';

describe('AccountingService', () => {
  let service: AccountingServiceImpl;
  let dataSource: jest.Mocked<DataSource>;
  let accountRepo: jest.Mocked<Repository<ChartOfAccount>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingServiceImpl,
        {
          provide: DataSource,
          useValue: createMockDataSource()
        },
        {
          provide: 'ChartOfAccountRepository',
          useValue: createMockRepository()
        }
      ]
    }).compile();

    service = module.get<AccountingServiceImpl>(AccountingServiceImpl);
    dataSource = module.get(DataSource);
    accountRepo = module.get('ChartOfAccountRepository');
  });

  describe('createJournalEntry', () => {
    it('should create a balanced journal entry', async () => {
      // Arrange
      const dto: CreateJournalEntryDto = {
        entryDate: new Date('2024-01-15'),
        description: 'Test journal entry',
        lines: [
          {
            accountId: 'cash-account-id',
            debit: 1000,
            credit: 0,
            description: 'Cash payment received'
          },
          {
            accountId: 'revenue-account-id',
            debit: 0,
            credit: 1000,
            description: 'Service revenue'
          }
        ]
      };

      const mockQueryRunner = createMockQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      // Act
      const result = await service.createJournalEntry(dto);

      // Assert
      expect(result).toBeDefined();
      expect(result.totalDebit.equals(new Decimal(1000))).toBe(true);
      expect(result.totalCredit.equals(new Decimal(1000))).toBe(true);
      expect(result.status).toBe(EntryStatus.DRAFT);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should reject unbalanced entries', async () => {
      // Arrange
      const dto: CreateJournalEntryDto = {
        entryDate: new Date('2024-01-15'),
        description: 'Unbalanced entry',
        lines: [
          {
            accountId: 'cash-account-id',
            debit: 1000,
            credit: 0
          },
          {
            accountId: 'revenue-account-id',
            debit: 0,
            credit: 900 // Unbalanced!
          }
        ]
      };

      // Act & Assert
      await expect(service.createJournalEntry(dto)).rejects.toThrow(
        UnbalancedEntryException
      );
    });

    it('should validate required dimensions', async () => {
      // Arrange
      const dto: CreateJournalEntryDto = {
        entryDate: new Date('2024-01-15'),
        description: 'Entry missing cost center',
        lines: [
          {
            accountId: 'expense-account-id', // Requires cost center
            debit: 500,
            credit: 0
            // costCenterId missing!
          },
          {
            accountId: 'cash-account-id',
            debit: 0,
            credit: 500
          }
        ]
      };

      const mockAccount = {
        id: 'expense-account-id',
        requireCostCenter: true,
        isActive: true,
        allowManualEntry: true
      };

      // Setup mocks
      const mockQueryRunner = createMockQueryRunner();
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAccount])
      });

      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      // Act & Assert
      await expect(service.createJournalEntry(dto)).rejects.toThrow(
        'Cost center required for account'
      );
    });
  });

  describe('postJournalEntry', () => {
    it('should post draft entry and update balances', async () => {
      // Arrange
      const entryId = 'test-entry-id';
      const mockEntry = {
        id: entryId,
        status: EntryStatus.DRAFT,
        accountingPeriodId: 'period-id',
        lines: [
          {
            accountId: 'cash-account-id',
            debit: new Decimal(1000),
            credit: new Decimal(0)
          },
          {
            accountId: 'revenue-account-id',
            debit: new Decimal(0),
            credit: new Decimal(1000)
          }
        ]
      };

      const mockQueryRunner = createMockQueryRunner();
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockEntry)
      });

      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      // Act
      const result = await service.postJournalEntry(entryId);

      // Assert
      expect(result.status).toBe(EntryStatus.POSTED);
      expect(result.postedAt).toBeDefined();
      expect(result.postedBy).toBeDefined();
    });
  });

  describe('generateTrialBalance', () => {
    it('should generate balanced trial balance', async () => {
      // Arrange
      const date = new Date('2024-01-31');
      const mockAccounts = [
        {
          id: 'cash-id',
          accountCode: '100',
          accountName: 'Cash',
          accountType: AccountType.CASH,
          normalBalance: 'DEBIT',
          isHeaderAccount: false
        },
        {
          id: 'revenue-id',
          accountCode: '400',
          accountName: 'Revenue',
          accountType: AccountType.REVENUE,
          normalBalance: 'CREDIT',
          isHeaderAccount: false
        }
      ];

      accountRepo.find.mockResolvedValue(mockAccounts);

      // Mock balance calculations
      jest.spyOn(service as any, 'getAccountBalanceAtDate')
        .mockResolvedValueOnce(new Decimal(5000))  // Cash balance
        .mockResolvedValueOnce(new Decimal(-5000)); // Revenue balance

      // Act
      const result = await service.generateTrialBalance(date);

      // Assert
      expect(result.isBalanced).toBe(true);
      expect(result.totalDebit.equals(result.totalCredit)).toBe(true);
      expect(result.rows).toHaveLength(2);
    });
  });
});
```

### Integration Tests

```typescript
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

describe('Accounting API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('/api/v1/journal-entries', () => {
    it('should create and post journal entry', async () => {
      // Create entry
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/journal-entries')
        .send({
          entryDate: '2024-01-15',
          description: 'Test entry',
          lines: [
            {
              accountId: 'cash-account',
              debit: 1000,
              credit: 0
            },
            {
              accountId: 'revenue-account',
              debit: 0,
              credit: 1000
            }
          ]
        })
        .expect(201);

      const entryId = createResponse.body.id;

      // Post entry
      const postResponse = await request(app.getHttpServer())
        .post(`/api/v1/journal-entries/${entryId}/post`)
        .expect(200);

      expect(postResponse.body.status).toBe('POSTED');
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

---

## F. Deployment Considerations

### Resource Requirements

```yaml
Development:
  CPU: 2 cores
  Memory: 4GB
  Database: PostgreSQL 15 (2 cores, 4GB)
  Redis: 1GB
  
Production:
  CPU: 4-8 cores
  Memory: 8-16GB
  Database: PostgreSQL 15 (8 cores, 16GB, with read replicas)
  Redis: 4GB cluster
  Storage: 100GB+ for documents and backups
```

### Performance Optimization

- **Database**: Partition large tables by period, use materialized views for reports
- **Caching**: Redis for account balances, trial balances, report data
- **Async Processing**: Queue for batch imports, report generation, period closing
- **Indexing**: Comprehensive indexes on frequently queried columns
- **Connection Pooling**: Optimize database connection pool size

### Security Considerations

- **Data Encryption**: Encrypt sensitive financial data at rest
- **Audit Trail**: Immutable audit log for all transactions
- **Access Control**: Role-based permissions for financial operations
- **Data Validation**: Strict input validation to prevent injection
- **Compliance**: GDPR compliance for data retention and deletion

---

This comprehensive Accounting Engine module specification provides a production-ready, Polish-compliant double-entry bookkeeping system with all necessary components for professional accounting operations. The module is designed for scalability, accuracy, and regulatory compliance.