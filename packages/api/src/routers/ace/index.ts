import { router } from '../../trpc';
import { fiscalYearRouter } from './fiscal-year.router';
import { accountRouter } from './account.router';
import { templateRouter } from './template.router';
import { hierarchyRouter } from './hierarchy.router';
import { openingBalanceRouter } from './opening-balance.router';
import { journalEntryRouter } from './journal-entry.router';
import { validationRouter } from './validation.router';
import { generalLedgerRouter } from './general-ledger.router';
import { entryTemplateRouter } from './entry-template.router';
import { recurringEntryRouter } from './recurring-entry.router';
import { entryReversalRouter } from './entry-reversal.router';
import { trialBalanceRouter } from './trial-balance.router';
import { balanceSheetRouter } from './balance-sheet.router';
import { incomeStatementRouter } from './income-statement.router';
import { jpkKrRouter } from './jpk-kr.router';

/**
 * ACE (Accounting Engine) Router
 * Combines all ACE-related routes for accounting operations
 * Complete implementation of all 15 ACC stories
 */
export const aceRouter = router({
  fiscalYear: fiscalYearRouter, // ACC-004: Fiscal Year Management
  account: accountRouter, // ACC-001: Chart of Accounts
  template: templateRouter, // ACC-002: Polish CoA Templates
  hierarchy: hierarchyRouter, // ACC-003: Account Hierarchy and Grouping
  openingBalance: openingBalanceRouter, // ACC-005: Opening Balances
  journalEntry: journalEntryRouter, // ACC-006: Journal Entry Creation
  validation: validationRouter, // ACC-007: Entry Validation and Balancing
  generalLedger: generalLedgerRouter, // ACC-008: General Ledger
  entryTemplate: entryTemplateRouter, // ACC-009: Journal Entry Templates
  recurringEntry: recurringEntryRouter, // ACC-010: Recurring Entries
  entryReversal: entryReversalRouter, // ACC-011: Entry Reversal
  trialBalance: trialBalanceRouter, // ACC-012: Trial Balance
  balanceSheet: balanceSheetRouter, // ACC-013: Balance Sheet (Bilans)
  incomeStatement: incomeStatementRouter, // ACC-014: Income Statement (RZiS)
  jpkKr: jpkKrRouter, // ACC-015: JPK-KR Export (Jednolity Plik Kontrolny)
});

export type AceRouter = typeof aceRouter;
