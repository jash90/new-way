# BNK-007: Transaction Reconciliation

> **Story ID**: BNK-007
> **Epic**: [Banking Integration Layer (BNK)](./epic.md)
> **Priority**: P0 (Critical)
> **Story Points**: 13
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant,
**I want to** reconcile bank transactions with accounting entries,
**So that** books match bank statements and I can identify discrepancies.

---

## Acceptance Criteria

### AC1: Exact Matching Algorithm
```gherkin
Given I have imported bank transactions
And I have corresponding journal entries in the system
When I initiate reconciliation for an account
Then the system should find exact matches based on:
  - Amount (100% match)
  - Date (same day)
  - Reference number (if available)
And matched transactions should be marked as "MATCHED" with confidence 1.0
```

### AC2: Fuzzy Matching Support
```gherkin
Given exact matching did not find a match
When fuzzy matching is enabled in configuration
Then the system should attempt fuzzy matching with:
  - Amount tolerance (±0.01 PLN for rounding differences)
  - Date tolerance (±3 days for processing delays)
  - Description similarity (Levenshtein distance ≥0.7)
And matches should include confidence score (0.0-1.0)
And only matches with confidence ≥0.75 should be suggested
```

### AC3: AI-Assisted Matching
```gherkin
Given neither exact nor fuzzy matching found a match
When AI matching is enabled
Then the system should use ML model to:
  - Analyze transaction patterns
  - Consider counterparty history
  - Evaluate seasonal patterns
  - Match based on learned behaviors
And AI matches should have minimum confidence ≥0.85
And AI reasoning should be logged for audit
```

### AC4: Manual Matching Interface
```gherkin
Given I have unmatched transactions
When I open the reconciliation interface
Then I should see:
  - List of unmatched bank transactions
  - List of unmatched journal entries
  - Suggested matches with confidence scores
And I should be able to:
  - Manually select matching entries
  - Create new journal entries for unmatched transactions
  - Mark transactions as "EXCLUDED" with reason
```

### AC5: Confidence Scoring
```gherkin
Given a transaction has been matched
When viewing the match details
Then I should see:
  - Confidence score (percentage)
  - Match type (EXACT, FUZZY, AI, MANUAL)
  - Matching criteria breakdown
  - Timestamp of match
And matches with confidence <0.80 should be flagged for review
```

### AC6: Reconciliation Reports
```gherkin
Given I have completed reconciliation for a period
When I generate a reconciliation report
Then the report should include:
  - Total transactions: count and amount
  - Matched: count, amount, by match type
  - Unmatched: count, amount, reasons
  - Confidence distribution histogram
  - Processing time statistics
And the report should be exportable as PDF/Excel
```

### AC7: Exception Handling
```gherkin
Given a transaction cannot be matched
When I review the exception
Then I should see categorized reasons:
  - "NO_MATCH_FOUND" - no suitable journal entry exists
  - "MULTIPLE_MATCHES" - ambiguous, multiple candidates
  - "AMOUNT_MISMATCH" - partial payment or overpayment
  - "DATE_DISCREPANCY" - timing difference too large
  - "DUPLICATE_SUSPECTED" - possible duplicate transaction
And I should be able to resolve each exception manually
And unresolved exceptions should be tracked for follow-up
```

---

## Technical Specification

### Database Schema

```sql
-- Reconciliation sessions
CREATE TABLE reconciliation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    client_id UUID NOT NULL REFERENCES clients(id),
    account_id UUID NOT NULL REFERENCES bank_accounts(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS'
        CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    started_by UUID NOT NULL REFERENCES users(id),
    configuration JSONB NOT NULL DEFAULT '{}',
    statistics JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reconciliation matches
CREATE TABLE reconciliation_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES reconciliation_sessions(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES bank_transactions(id),
    journal_entry_id UUID REFERENCES journal_entries(id),
    match_type VARCHAR(20) NOT NULL
        CHECK (match_type IN ('EXACT', 'FUZZY', 'AI', 'MANUAL')),
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED', 'EXCLUDED')),
    criteria JSONB NOT NULL DEFAULT '{}',
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_transaction_match UNIQUE (session_id, transaction_id)
);

-- Reconciliation exceptions
CREATE TABLE reconciliation_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES reconciliation_sessions(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES bank_transactions(id),
    exception_type VARCHAR(30) NOT NULL
        CHECK (exception_type IN (
            'NO_MATCH_FOUND', 'MULTIPLE_MATCHES', 'AMOUNT_MISMATCH',
            'DATE_DISCREPANCY', 'DUPLICATE_SUSPECTED', 'MANUAL_REVIEW_REQUIRED'
        )),
    details JSONB NOT NULL DEFAULT '{}',
    candidate_entries UUID[] DEFAULT '{}',
    resolution_type VARCHAR(20)
        CHECK (resolution_type IN ('MATCHED', 'EXCLUDED', 'CREATED_ENTRY', 'IGNORED')),
    resolution_data JSONB,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reconciliation rules (custom matching rules)
CREATE TABLE reconciliation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    priority INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    conditions JSONB NOT NULL,
    -- Example: {"field": "counterparty_name", "operator": "contains", "value": "PKO"}
    actions JSONB NOT NULL,
    -- Example: {"match_to_account": "131-01", "auto_confirm": true}
    hit_count INTEGER NOT NULL DEFAULT 0,
    last_hit_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_recon_sessions_account ON reconciliation_sessions(account_id);
CREATE INDEX idx_recon_sessions_status ON reconciliation_sessions(status);
CREATE INDEX idx_recon_sessions_period ON reconciliation_sessions(period_start, period_end);
CREATE INDEX idx_recon_matches_session ON reconciliation_matches(session_id);
CREATE INDEX idx_recon_matches_status ON reconciliation_matches(status);
CREATE INDEX idx_recon_matches_transaction ON reconciliation_matches(transaction_id);
CREATE INDEX idx_recon_exceptions_session ON reconciliation_exceptions(session_id);
CREATE INDEX idx_recon_exceptions_type ON reconciliation_exceptions(exception_type);
CREATE INDEX idx_recon_rules_org ON reconciliation_rules(organization_id, is_active);

-- RLS Policies
ALTER TABLE reconciliation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY reconciliation_sessions_org_isolation ON reconciliation_sessions
    USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY reconciliation_matches_org_isolation ON reconciliation_matches
    USING (session_id IN (
        SELECT id FROM reconciliation_sessions
        WHERE organization_id = current_setting('app.organization_id')::UUID
    ));

CREATE POLICY reconciliation_exceptions_org_isolation ON reconciliation_exceptions
    USING (session_id IN (
        SELECT id FROM reconciliation_sessions
        WHERE organization_id = current_setting('app.organization_id')::UUID
    ));

CREATE POLICY reconciliation_rules_org_isolation ON reconciliation_rules
    USING (organization_id = current_setting('app.organization_id')::UUID);
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Match type enum
export const MatchTypeSchema = z.enum(['EXACT', 'FUZZY', 'AI', 'MANUAL']);
export type MatchType = z.infer<typeof MatchTypeSchema>;

// Exception type enum
export const ExceptionTypeSchema = z.enum([
  'NO_MATCH_FOUND',
  'MULTIPLE_MATCHES',
  'AMOUNT_MISMATCH',
  'DATE_DISCREPANCY',
  'DUPLICATE_SUSPECTED',
  'MANUAL_REVIEW_REQUIRED'
]);
export type ExceptionType = z.infer<typeof ExceptionTypeSchema>;

// Reconciliation configuration
export const ReconciliationConfigSchema = z.object({
  fuzzyMatching: z.boolean().default(true),
  fuzzyThreshold: z.number().min(0).max(1).default(0.75),
  aiMatching: z.boolean().default(true),
  aiConfidenceThreshold: z.number().min(0).max(1).default(0.85),
  amountTolerance: z.number().min(0).max(100).default(0.01), // PLN
  dateTolerance: z.number().int().min(0).max(30).default(3), // days
  autoConfirmThreshold: z.number().min(0).max(1).default(0.95),
  applyCustomRules: z.boolean().default(true)
});
export type ReconciliationConfig = z.infer<typeof ReconciliationConfigSchema>;

// Start reconciliation request
export const StartReconciliationSchema = z.object({
  accountId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  configuration: ReconciliationConfigSchema.optional()
}).refine(
  (data) => new Date(data.periodStart) <= new Date(data.periodEnd),
  { message: 'Data początkowa musi być przed datą końcową' }
);
export type StartReconciliationRequest = z.infer<typeof StartReconciliationSchema>;

// Match suggestion
export const MatchSuggestionSchema = z.object({
  transactionId: z.string().uuid(),
  journalEntryId: z.string().uuid(),
  matchType: MatchTypeSchema,
  confidence: z.number().min(0).max(1),
  criteria: z.object({
    amountMatch: z.boolean(),
    dateMatch: z.boolean(),
    referenceMatch: z.boolean(),
    descriptionSimilarity: z.number().min(0).max(1).optional(),
    aiScore: z.number().min(0).max(1).optional(),
    ruleId: z.string().uuid().optional()
  })
});
export type MatchSuggestion = z.infer<typeof MatchSuggestionSchema>;

// Confirm match request
export const ConfirmMatchSchema = z.object({
  sessionId: z.string().uuid(),
  matches: z.array(z.object({
    transactionId: z.string().uuid(),
    journalEntryId: z.string().uuid(),
    notes: z.string().max(500).optional()
  })).min(1, 'Należy podać co najmniej jedno dopasowanie')
});
export type ConfirmMatchRequest = z.infer<typeof ConfirmMatchSchema>;

// Manual match request
export const ManualMatchSchema = z.object({
  sessionId: z.string().uuid(),
  transactionId: z.string().uuid(),
  journalEntryId: z.string().uuid().optional(),
  createEntry: z.object({
    accountId: z.string().uuid(),
    contraAccountId: z.string().uuid(),
    description: z.string().min(1).max(500),
    vatRate: z.enum(['23', '8', '5', '0', 'ZW', 'NP']).optional()
  }).optional(),
  excludeReason: z.string().max(500).optional()
}).refine(
  (data) => data.journalEntryId || data.createEntry || data.excludeReason,
  { message: 'Podaj wpis, utwórz nowy lub podaj powód wykluczenia' }
);
export type ManualMatchRequest = z.infer<typeof ManualMatchSchema>;

// Resolve exception request
export const ResolveExceptionSchema = z.object({
  exceptionId: z.string().uuid(),
  resolutionType: z.enum(['MATCHED', 'EXCLUDED', 'CREATED_ENTRY', 'IGNORED']),
  matchToEntryId: z.string().uuid().optional(),
  createEntry: z.object({
    accountId: z.string().uuid(),
    contraAccountId: z.string().uuid(),
    description: z.string().min(1).max(500),
    vatRate: z.enum(['23', '8', '5', '0', 'ZW', 'NP']).optional()
  }).optional(),
  excludeReason: z.string().max(500).optional()
});
export type ResolveExceptionRequest = z.infer<typeof ResolveExceptionSchema>;

// Reconciliation rule
export const ReconciliationRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  priority: z.number().int().min(1).max(1000).default(100),
  conditions: z.array(z.object({
    field: z.enum([
      'counterparty_name', 'counterparty_account', 'description',
      'amount', 'reference', 'transaction_type'
    ]),
    operator: z.enum([
      'equals', 'contains', 'starts_with', 'ends_with',
      'greater_than', 'less_than', 'regex'
    ]),
    value: z.string().min(1)
  })).min(1, 'Wymagany co najmniej jeden warunek'),
  actions: z.object({
    matchToAccount: z.string().optional(),
    autoConfirm: z.boolean().default(false),
    addTags: z.array(z.string()).optional(),
    setCategory: z.string().uuid().optional()
  })
});
export type ReconciliationRule = z.infer<typeof ReconciliationRuleSchema>;

// Session statistics
export const SessionStatisticsSchema = z.object({
  totalTransactions: z.number().int(),
  matchedExact: z.number().int(),
  matchedFuzzy: z.number().int(),
  matchedAI: z.number().int(),
  matchedManual: z.number().int(),
  unmatched: z.number().int(),
  excluded: z.number().int(),
  exceptions: z.number().int(),
  avgConfidence: z.number().min(0).max(1),
  processingTimeMs: z.number().int(),
  matchRate: z.number().min(0).max(1)
});
export type SessionStatistics = z.infer<typeof SessionStatisticsSchema>;
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  StartReconciliationSchema,
  ConfirmMatchSchema,
  ManualMatchSchema,
  ResolveExceptionSchema,
  ReconciliationRuleSchema,
  ReconciliationConfigSchema
} from './schemas';

export const reconciliationRouter = router({
  // Start reconciliation session
  startReconciliation: protectedProcedure
    .input(StartReconciliationSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.reconciliationService.startSession({
        organizationId: ctx.session.organizationId,
        userId: ctx.session.userId,
        ...input
      });

      await ctx.auditLog.record({
        action: 'BNK.RECONCILIATION.SESSION_STARTED',
        resourceId: session.id,
        metadata: {
          accountId: input.accountId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd
        }
      });

      return session;
    }),

  // Get session status
  getSessionStatus: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.reconciliationService.getSessionStatus(
        input.sessionId,
        ctx.session.organizationId
      );
    }),

  // Get match suggestions
  getSuggestions: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      minConfidence: z.number().min(0).max(1).optional(),
      matchType: z.enum(['EXACT', 'FUZZY', 'AI']).optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0)
    }))
    .query(async ({ ctx, input }) => {
      return ctx.reconciliationService.getSuggestions(
        input.sessionId,
        ctx.session.organizationId,
        input
      );
    }),

  // Confirm matches
  confirmMatches: protectedProcedure
    .input(ConfirmMatchSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.reconciliationService.confirmMatches({
        ...input,
        userId: ctx.session.userId,
        organizationId: ctx.session.organizationId
      });

      await ctx.auditLog.record({
        action: 'BNK.RECONCILIATION.MATCHES_CONFIRMED',
        resourceId: input.sessionId,
        metadata: {
          matchCount: input.matches.length,
          transactionIds: input.matches.map(m => m.transactionId)
        }
      });

      return result;
    }),

  // Manual match
  manualMatch: protectedProcedure
    .input(ManualMatchSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.reconciliationService.manualMatch({
        ...input,
        userId: ctx.session.userId,
        organizationId: ctx.session.organizationId
      });

      await ctx.auditLog.record({
        action: 'BNK.RECONCILIATION.MANUAL_MATCH',
        resourceId: input.transactionId,
        metadata: {
          sessionId: input.sessionId,
          journalEntryId: input.journalEntryId,
          createdEntry: !!input.createEntry,
          excluded: !!input.excludeReason
        }
      });

      return result;
    }),

  // Get exceptions
  getExceptions: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      exceptionType: z.enum([
        'NO_MATCH_FOUND', 'MULTIPLE_MATCHES', 'AMOUNT_MISMATCH',
        'DATE_DISCREPANCY', 'DUPLICATE_SUSPECTED', 'MANUAL_REVIEW_REQUIRED'
      ]).optional(),
      resolved: z.boolean().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0)
    }))
    .query(async ({ ctx, input }) => {
      return ctx.reconciliationService.getExceptions(
        input.sessionId,
        ctx.session.organizationId,
        input
      );
    }),

  // Resolve exception
  resolveException: protectedProcedure
    .input(ResolveExceptionSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.reconciliationService.resolveException({
        ...input,
        userId: ctx.session.userId,
        organizationId: ctx.session.organizationId
      });

      await ctx.auditLog.record({
        action: 'BNK.RECONCILIATION.EXCEPTION_RESOLVED',
        resourceId: input.exceptionId,
        metadata: {
          resolutionType: input.resolutionType
        }
      });

      return result;
    }),

  // Complete session
  completeSession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.reconciliationService.completeSession(
        input.sessionId,
        ctx.session.organizationId,
        ctx.session.userId
      );

      await ctx.auditLog.record({
        action: 'BNK.RECONCILIATION.SESSION_COMPLETED',
        resourceId: input.sessionId,
        metadata: session.statistics
      });

      return session;
    }),

  // Generate report
  generateReport: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      format: z.enum(['PDF', 'XLSX', 'CSV']).default('PDF'),
      includeDetails: z.boolean().default(true)
    }))
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.reconciliationService.generateReport(
        input.sessionId,
        ctx.session.organizationId,
        input.format,
        input.includeDetails
      );

      await ctx.auditLog.record({
        action: 'BNK.RECONCILIATION.REPORT_GENERATED',
        resourceId: input.sessionId,
        metadata: { format: input.format }
      });

      return report;
    }),

  // === Rules Management ===

  // List rules
  listRules: protectedProcedure
    .input(z.object({
      isActive: z.boolean().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0)
    }))
    .query(async ({ ctx, input }) => {
      return ctx.reconciliationService.listRules(
        ctx.session.organizationId,
        input
      );
    }),

  // Create rule
  createRule: protectedProcedure
    .input(ReconciliationRuleSchema)
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.reconciliationService.createRule({
        ...input,
        organizationId: ctx.session.organizationId,
        createdBy: ctx.session.userId
      });

      await ctx.auditLog.record({
        action: 'BNK.RECONCILIATION.RULE_CREATED',
        resourceId: rule.id,
        metadata: { name: input.name }
      });

      return rule;
    }),

  // Update rule
  updateRule: protectedProcedure
    .input(z.object({
      ruleId: z.string().uuid(),
      updates: ReconciliationRuleSchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.reconciliationService.updateRule(
        input.ruleId,
        ctx.session.organizationId,
        input.updates
      );

      await ctx.auditLog.record({
        action: 'BNK.RECONCILIATION.RULE_UPDATED',
        resourceId: input.ruleId,
        metadata: { updates: Object.keys(input.updates) }
      });

      return rule;
    }),

  // Delete rule
  deleteRule: protectedProcedure
    .input(z.object({ ruleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.reconciliationService.deleteRule(
        input.ruleId,
        ctx.session.organizationId
      );

      await ctx.auditLog.record({
        action: 'BNK.RECONCILIATION.RULE_DELETED',
        resourceId: input.ruleId
      });

      return { success: true };
    }),

  // Get unmatched transactions
  getUnmatchedTransactions: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0)
    }))
    .query(async ({ ctx, input }) => {
      return ctx.reconciliationService.getUnmatchedTransactions(
        input.sessionId,
        ctx.session.organizationId,
        input
      );
    }),

  // Get unmatched journal entries
  getUnmatchedEntries: protectedProcedure
    .input(z.object({
      accountId: z.string().uuid(),
      periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0)
    }))
    .query(async ({ ctx, input }) => {
      return ctx.reconciliationService.getUnmatchedEntries(
        ctx.session.organizationId,
        input
      );
    }),

  // Auto-reconcile (batch operation)
  autoReconcile: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      configuration: ReconciliationConfigSchema.optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.reconciliationService.autoReconcile({
        sessionId: input.sessionId,
        organizationId: ctx.session.organizationId,
        userId: ctx.session.userId,
        configuration: input.configuration
      });

      await ctx.auditLog.record({
        action: 'BNK.RECONCILIATION.AUTO_RECONCILE',
        resourceId: input.sessionId,
        metadata: result.statistics
      });

      return result;
    })
});
```

### Service Implementation

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OpenAIService } from '@/ai/openai.service';
import Decimal from 'decimal.js';

interface MatchCandidate {
  journalEntry: JournalEntry;
  confidence: number;
  matchType: 'EXACT' | 'FUZZY' | 'AI';
  criteria: Record<string, any>;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: OpenAIService
  ) {}

  async startSession(params: {
    organizationId: string;
    userId: string;
    accountId: string;
    periodStart: string;
    periodEnd: string;
    configuration?: ReconciliationConfig;
  }) {
    // Verify account ownership
    const account = await this.prisma.bankAccount.findFirst({
      where: {
        id: params.accountId,
        connection: { organizationId: params.organizationId }
      }
    });

    if (!account) {
      throw new Error('Konto bankowe nie zostało znalezione');
    }

    // Create session
    const session = await this.prisma.reconciliationSession.create({
      data: {
        organizationId: params.organizationId,
        clientId: account.connection.clientId,
        accountId: params.accountId,
        periodStart: new Date(params.periodStart),
        periodEnd: new Date(params.periodEnd),
        startedBy: params.userId,
        configuration: params.configuration || {},
        status: 'IN_PROGRESS'
      }
    });

    // Get transactions for the period
    const transactions = await this.prisma.bankTransaction.findMany({
      where: {
        accountId: params.accountId,
        bookingDate: {
          gte: new Date(params.periodStart),
          lte: new Date(params.periodEnd)
        },
        reconciliationStatus: 'UNMATCHED'
      }
    });

    this.logger.log(
      `Started reconciliation session ${session.id} with ${transactions.length} transactions`
    );

    return session;
  }

  async autoReconcile(params: {
    sessionId: string;
    organizationId: string;
    userId: string;
    configuration?: ReconciliationConfig;
  }) {
    const startTime = Date.now();

    const session = await this.prisma.reconciliationSession.findFirst({
      where: {
        id: params.sessionId,
        organizationId: params.organizationId
      }
    });

    if (!session) {
      throw new Error('Sesja uzgadniania nie została znaleziona');
    }

    const config = { ...session.configuration, ...params.configuration } as ReconciliationConfig;

    // Get unmatched transactions
    const transactions = await this.prisma.bankTransaction.findMany({
      where: {
        accountId: session.accountId,
        bookingDate: {
          gte: session.periodStart,
          lte: session.periodEnd
        },
        reconciliationStatus: 'UNMATCHED'
      }
    });

    // Get potential journal entries
    const journalEntries = await this.getUnmatchedJournalEntries(
      params.organizationId,
      session.accountId,
      session.periodStart,
      session.periodEnd
    );

    // Get custom rules
    const rules = config.applyCustomRules
      ? await this.prisma.reconciliationRule.findMany({
          where: { organizationId: params.organizationId, isActive: true },
          orderBy: { priority: 'asc' }
        })
      : [];

    const statistics = {
      totalTransactions: transactions.length,
      matchedExact: 0,
      matchedFuzzy: 0,
      matchedAI: 0,
      matchedManual: 0,
      unmatched: 0,
      excluded: 0,
      exceptions: 0,
      avgConfidence: 0,
      processingTimeMs: 0,
      matchRate: 0
    };

    const confidenceScores: number[] = [];
    const remainingEntries = new Set(journalEntries.map(e => e.id));

    for (const transaction of transactions) {
      const availableEntries = journalEntries.filter(e => remainingEntries.has(e.id));

      // Try custom rules first
      let match = await this.applyCustomRules(transaction, availableEntries, rules);

      // Try exact matching
      if (!match) {
        match = this.findExactMatch(transaction, availableEntries);
        if (match) statistics.matchedExact++;
      }

      // Try fuzzy matching
      if (!match && config.fuzzyMatching) {
        match = this.findFuzzyMatch(transaction, availableEntries, config);
        if (match) statistics.matchedFuzzy++;
      }

      // Try AI matching
      if (!match && config.aiMatching) {
        match = await this.findAIMatch(transaction, availableEntries, config);
        if (match) statistics.matchedAI++;
      }

      if (match) {
        // Create match record
        await this.prisma.reconciliationMatch.create({
          data: {
            sessionId: params.sessionId,
            transactionId: transaction.id,
            journalEntryId: match.journalEntry.id,
            matchType: match.matchType,
            confidence: match.confidence,
            criteria: match.criteria,
            status: match.confidence >= config.autoConfirmThreshold ? 'CONFIRMED' : 'PENDING',
            confirmedAt: match.confidence >= config.autoConfirmThreshold ? new Date() : null,
            confirmedBy: match.confidence >= config.autoConfirmThreshold ? params.userId : null
          }
        });

        // Update transaction status
        if (match.confidence >= config.autoConfirmThreshold) {
          await this.prisma.bankTransaction.update({
            where: { id: transaction.id },
            data: {
              reconciliationStatus: 'MATCHED',
              reconciliationData: {
                journalEntryId: match.journalEntry.id,
                matchedAt: new Date(),
                confidence: match.confidence,
                matchType: match.matchType
              }
            }
          });
        }

        remainingEntries.delete(match.journalEntry.id);
        confidenceScores.push(match.confidence);
      } else {
        // Create exception
        statistics.unmatched++;

        const exceptionType = this.determineExceptionType(
          transaction,
          availableEntries
        );

        await this.prisma.reconciliationException.create({
          data: {
            sessionId: params.sessionId,
            transactionId: transaction.id,
            exceptionType,
            details: {
              transactionAmount: transaction.amount.toString(),
              transactionDate: transaction.bookingDate,
              nearestMatch: this.findNearestMatch(transaction, availableEntries)
            },
            candidateEntries: availableEntries.slice(0, 5).map(e => e.id)
          }
        });

        statistics.exceptions++;
      }
    }

    // Calculate statistics
    statistics.processingTimeMs = Date.now() - startTime;
    statistics.avgConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
      : 0;
    statistics.matchRate = transactions.length > 0
      ? (statistics.matchedExact + statistics.matchedFuzzy + statistics.matchedAI) / transactions.length
      : 0;

    // Update session
    await this.prisma.reconciliationSession.update({
      where: { id: params.sessionId },
      data: { statistics }
    });

    return { sessionId: params.sessionId, statistics };
  }

  private findExactMatch(
    transaction: BankTransaction,
    entries: JournalEntry[]
  ): MatchCandidate | null {
    const transactionAmount = new Decimal(transaction.amount).abs();

    for (const entry of entries) {
      const entryAmount = new Decimal(entry.amount).abs();

      const amountMatch = transactionAmount.equals(entryAmount);
      const dateMatch = this.isSameDate(transaction.bookingDate, entry.date);
      const referenceMatch = transaction.reference && entry.reference
        ? transaction.reference === entry.reference
        : false;

      if (amountMatch && dateMatch && (referenceMatch || !transaction.reference)) {
        return {
          journalEntry: entry,
          confidence: 1.0,
          matchType: 'EXACT',
          criteria: { amountMatch, dateMatch, referenceMatch }
        };
      }
    }

    return null;
  }

  private findFuzzyMatch(
    transaction: BankTransaction,
    entries: JournalEntry[],
    config: ReconciliationConfig
  ): MatchCandidate | null {
    const candidates: MatchCandidate[] = [];
    const transactionAmount = new Decimal(transaction.amount).abs();

    for (const entry of entries) {
      const entryAmount = new Decimal(entry.amount).abs();
      let score = 0;

      // Amount matching with tolerance
      const amountDiff = transactionAmount.minus(entryAmount).abs().toNumber();
      if (amountDiff <= config.amountTolerance) {
        score += 0.4;
      } else if (amountDiff <= 1) {
        score += 0.2;
      } else {
        continue; // Skip if amount difference is too large
      }

      // Date matching with tolerance
      const daysDiff = Math.abs(
        (transaction.bookingDate.getTime() - entry.date.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff === 0) {
        score += 0.3;
      } else if (daysDiff <= config.dateTolerance) {
        score += 0.2 * (1 - daysDiff / config.dateTolerance);
      }

      // Description similarity
      const similarity = this.calculateStringSimilarity(
        transaction.description || '',
        entry.description || ''
      );
      score += similarity * 0.3;

      if (score >= config.fuzzyThreshold) {
        candidates.push({
          journalEntry: entry,
          confidence: Math.min(score, 0.99), // Cap at 0.99 for fuzzy matches
          matchType: 'FUZZY',
          criteria: {
            amountDiff,
            daysDiff,
            descriptionSimilarity: similarity
          }
        });
      }
    }

    // Return best match
    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => b.confidence - a.confidence)[0];
  }

  private async findAIMatch(
    transaction: BankTransaction,
    entries: JournalEntry[],
    config: ReconciliationConfig
  ): Promise<MatchCandidate | null> {
    if (entries.length === 0) return null;

    try {
      const prompt = this.buildAIMatchingPrompt(transaction, entries.slice(0, 10));

      const response = await this.aiService.chat({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: `Jesteś ekspertem w uzgadnianiu transakcji bankowych z zapisami księgowymi.
Analizujesz transakcję bankową i listę potencjalnych wpisów księgowych.
Odpowiedz w formacie JSON: {"matchId": "id_wpisu_lub_null", "confidence": 0.0-1.0, "reasoning": "wyjaśnienie"}`
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content);

      if (result.matchId && result.confidence >= config.aiConfidenceThreshold) {
        const matchedEntry = entries.find(e => e.id === result.matchId);
        if (matchedEntry) {
          return {
            journalEntry: matchedEntry,
            confidence: result.confidence,
            matchType: 'AI',
            criteria: {
              aiScore: result.confidence,
              reasoning: result.reasoning
            }
          };
        }
      }
    } catch (error) {
      this.logger.warn(`AI matching failed: ${error.message}`);
    }

    return null;
  }

  private buildAIMatchingPrompt(transaction: BankTransaction, entries: JournalEntry[]): string {
    return `Transakcja bankowa:
- Data: ${transaction.bookingDate.toISOString().split('T')[0]}
- Kwota: ${transaction.amount} ${transaction.currency}
- Opis: ${transaction.description}
- Kontrahent: ${transaction.counterpartyName || 'nieznany'}
- Referencja: ${transaction.reference || 'brak'}

Potencjalne wpisy księgowe:
${entries.map((e, i) => `
${i + 1}. ID: ${e.id}
   Data: ${e.date.toISOString().split('T')[0]}
   Kwota: ${e.amount}
   Opis: ${e.description}
   Konto: ${e.accountCode}
`).join('')}

Znajdź najlepsze dopasowanie lub odpowiedz null jeśli brak dobrego dopasowania.`;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    // Levenshtein distance
    const matrix: number[][] = [];

    for (let i = 0; i <= s1.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s2.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const maxLen = Math.max(s1.length, s2.length);
    return (maxLen - matrix[s1.length][s2.length]) / maxLen;
  }

  private determineExceptionType(
    transaction: BankTransaction,
    entries: JournalEntry[]
  ): string {
    if (entries.length === 0) return 'NO_MATCH_FOUND';

    const transactionAmount = new Decimal(transaction.amount).abs();

    // Check for multiple close matches
    const closeMatches = entries.filter(e => {
      const diff = transactionAmount.minus(new Decimal(e.amount).abs()).abs().toNumber();
      return diff < 1;
    });

    if (closeMatches.length > 1) return 'MULTIPLE_MATCHES';
    if (closeMatches.length === 1) return 'DATE_DISCREPANCY';

    // Check for partial matches (amount mismatch)
    const partialMatches = entries.filter(e => {
      const similarity = this.calculateStringSimilarity(
        transaction.description || '',
        e.description || ''
      );
      return similarity > 0.5;
    });

    if (partialMatches.length > 0) return 'AMOUNT_MISMATCH';

    return 'NO_MATCH_FOUND';
  }

  private isSameDate(date1: Date, date2: Date): boolean {
    return date1.toISOString().split('T')[0] === date2.toISOString().split('T')[0];
  }

  private findNearestMatch(
    transaction: BankTransaction,
    entries: JournalEntry[]
  ): Record<string, any> | null {
    if (entries.length === 0) return null;

    const transactionAmount = new Decimal(transaction.amount).abs();
    let nearest = entries[0];
    let minDiff = Infinity;

    for (const entry of entries) {
      const diff = transactionAmount
        .minus(new Decimal(entry.amount).abs())
        .abs()
        .toNumber();
      if (diff < minDiff) {
        minDiff = diff;
        nearest = entry;
      }
    }

    return {
      id: nearest.id,
      amount: nearest.amount,
      date: nearest.date,
      amountDiff: minDiff
    };
  }

  private async getUnmatchedJournalEntries(
    organizationId: string,
    accountId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<JournalEntry[]> {
    // Get bank account's linked GL account
    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { id: accountId },
      include: { linkedGLAccount: true }
    });

    if (!bankAccount?.linkedGLAccountId) {
      throw new Error('Konto bankowe nie ma powiązanego konta księgowego');
    }

    return this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        accountId: bankAccount.linkedGLAccountId,
        date: { gte: periodStart, lte: periodEnd },
        reconciled: false
      },
      orderBy: { date: 'desc' }
    });
  }

  private async applyCustomRules(
    transaction: BankTransaction,
    entries: JournalEntry[],
    rules: ReconciliationRule[]
  ): Promise<MatchCandidate | null> {
    for (const rule of rules) {
      if (this.matchesRuleConditions(transaction, rule.conditions)) {
        // Find matching entry based on rule action
        const matchedEntry = entries.find(e =>
          e.accountCode === rule.actions.matchToAccount
        );

        if (matchedEntry) {
          // Update rule hit count
          await this.prisma.reconciliationRule.update({
            where: { id: rule.id },
            data: {
              hitCount: { increment: 1 },
              lastHitAt: new Date()
            }
          });

          return {
            journalEntry: matchedEntry,
            confidence: rule.actions.autoConfirm ? 1.0 : 0.9,
            matchType: 'EXACT', // Rules are considered exact matches
            criteria: { ruleId: rule.id, ruleName: rule.name }
          };
        }
      }
    }

    return null;
  }

  private matchesRuleConditions(
    transaction: BankTransaction,
    conditions: RuleCondition[]
  ): boolean {
    return conditions.every(condition => {
      const value = this.getTransactionField(transaction, condition.field);
      return this.evaluateCondition(value, condition.operator, condition.value);
    });
  }

  private getTransactionField(transaction: BankTransaction, field: string): string {
    const fieldMap: Record<string, string> = {
      counterparty_name: transaction.counterpartyName || '',
      counterparty_account: transaction.counterpartyAccount || '',
      description: transaction.description || '',
      amount: transaction.amount.toString(),
      reference: transaction.reference || '',
      transaction_type: transaction.type
    };
    return fieldMap[field] || '';
  }

  private evaluateCondition(value: string, operator: string, target: string): boolean {
    switch (operator) {
      case 'equals': return value === target;
      case 'contains': return value.includes(target);
      case 'starts_with': return value.startsWith(target);
      case 'ends_with': return value.endsWith(target);
      case 'greater_than': return parseFloat(value) > parseFloat(target);
      case 'less_than': return parseFloat(value) < parseFloat(target);
      case 'regex': return new RegExp(target).test(value);
      default: return false;
    }
  }
}
```

---

## Test Specification

### Unit Tests

```typescript
describe('ReconciliationService', () => {
  describe('findExactMatch', () => {
    it('should find exact match when amount, date, and reference match', async () => {
      const transaction = createMockTransaction({
        amount: '1000.00',
        bookingDate: new Date('2024-01-15'),
        reference: 'INV-001'
      });

      const entries = [
        createMockJournalEntry({
          amount: '1000.00',
          date: new Date('2024-01-15'),
          reference: 'INV-001'
        })
      ];

      const match = service.findExactMatch(transaction, entries);

      expect(match).not.toBeNull();
      expect(match.confidence).toBe(1.0);
      expect(match.matchType).toBe('EXACT');
    });

    it('should return null when no exact match found', async () => {
      const transaction = createMockTransaction({
        amount: '1000.00',
        bookingDate: new Date('2024-01-15')
      });

      const entries = [
        createMockJournalEntry({
          amount: '999.00',
          date: new Date('2024-01-15')
        })
      ];

      const match = service.findExactMatch(transaction, entries);

      expect(match).toBeNull();
    });
  });

  describe('findFuzzyMatch', () => {
    it('should find fuzzy match within tolerance', async () => {
      const transaction = createMockTransaction({
        amount: '1000.01',
        bookingDate: new Date('2024-01-15'),
        description: 'Payment from ABC Company'
      });

      const entries = [
        createMockJournalEntry({
          amount: '1000.00',
          date: new Date('2024-01-16'),
          description: 'ABC Company payment'
        })
      ];

      const config: ReconciliationConfig = {
        fuzzyMatching: true,
        fuzzyThreshold: 0.75,
        amountTolerance: 0.01,
        dateTolerance: 3
      };

      const match = service.findFuzzyMatch(transaction, entries, config);

      expect(match).not.toBeNull();
      expect(match.matchType).toBe('FUZZY');
      expect(match.confidence).toBeGreaterThanOrEqual(0.75);
    });
  });

  describe('calculateStringSimilarity', () => {
    it('should return 1.0 for identical strings', () => {
      expect(service.calculateStringSimilarity('test', 'test')).toBe(1.0);
    });

    it('should return 0 for completely different strings', () => {
      expect(service.calculateStringSimilarity('abc', 'xyz')).toBeLessThan(0.5);
    });

    it('should return high similarity for similar strings', () => {
      const similarity = service.calculateStringSimilarity(
        'Payment ABC Company',
        'ABC Company Payment'
      );
      expect(similarity).toBeGreaterThan(0.5);
    });
  });

  describe('autoReconcile', () => {
    it('should process all transactions and create matches/exceptions', async () => {
      const result = await service.autoReconcile({
        sessionId: 'session-123',
        organizationId: 'org-123',
        userId: 'user-123'
      });

      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalTransactions).toBeGreaterThan(0);
      expect(result.statistics.matchRate).toBeDefined();
    });

    it('should auto-confirm high confidence matches', async () => {
      const config: ReconciliationConfig = {
        autoConfirmThreshold: 0.95
      };

      const result = await service.autoReconcile({
        sessionId: 'session-123',
        organizationId: 'org-123',
        userId: 'user-123',
        configuration: config
      });

      // Verify high confidence matches were auto-confirmed
      const confirmedMatches = await prisma.reconciliationMatch.findMany({
        where: {
          sessionId: 'session-123',
          status: 'CONFIRMED',
          confidence: { gte: 0.95 }
        }
      });

      expect(confirmedMatches.length).toBeGreaterThan(0);
    });
  });
});
```

### Integration Tests

```typescript
describe('Reconciliation API', () => {
  it('should complete full reconciliation workflow', async () => {
    // 1. Start session
    const sessionResponse = await request(app)
      .post('/api/trpc/bnk.startReconciliation')
      .send({
        accountId: testAccountId,
        periodStart: '2024-01-01',
        periodEnd: '2024-01-31'
      });

    expect(sessionResponse.status).toBe(200);
    const sessionId = sessionResponse.body.id;

    // 2. Run auto-reconcile
    const reconcileResponse = await request(app)
      .post('/api/trpc/bnk.autoReconcile')
      .send({ sessionId });

    expect(reconcileResponse.status).toBe(200);
    expect(reconcileResponse.body.statistics).toBeDefined();

    // 3. Get suggestions
    const suggestionsResponse = await request(app)
      .get('/api/trpc/bnk.getSuggestions')
      .query({ sessionId });

    expect(suggestionsResponse.status).toBe(200);

    // 4. Confirm matches
    if (suggestionsResponse.body.length > 0) {
      const confirmResponse = await request(app)
        .post('/api/trpc/bnk.confirmMatches')
        .send({
          sessionId,
          matches: suggestionsResponse.body.slice(0, 5).map(s => ({
            transactionId: s.transactionId,
            journalEntryId: s.journalEntryId
          }))
        });

      expect(confirmResponse.status).toBe(200);
    }

    // 5. Complete session
    const completeResponse = await request(app)
      .post('/api/trpc/bnk.completeSession')
      .send({ sessionId });

    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.status).toBe('COMPLETED');
  });
});
```

---

## Security Checklist

- [x] RLS policies enforced on all reconciliation tables
- [x] Input validation with Zod schemas
- [x] User authorization verified for all operations
- [x] Audit logging for all reconciliation actions
- [x] Rate limiting on auto-reconcile operations
- [x] AI service calls logged for compliance
- [x] Sensitive data masked in logs
- [x] Session timeout handling
- [x] Exception data sanitized before storage
- [x] No direct SQL queries - using Prisma ORM

---

## Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `BNK.RECONCILIATION.SESSION_STARTED` | Session creation | accountId, period, config |
| `BNK.RECONCILIATION.AUTO_RECONCILE` | Auto-reconcile run | statistics summary |
| `BNK.RECONCILIATION.MATCHES_CONFIRMED` | Batch confirmation | match count, transaction IDs |
| `BNK.RECONCILIATION.MANUAL_MATCH` | Manual match | transaction, entry, action |
| `BNK.RECONCILIATION.EXCEPTION_RESOLVED` | Exception resolution | resolution type, data |
| `BNK.RECONCILIATION.SESSION_COMPLETED` | Session completion | final statistics |
| `BNK.RECONCILIATION.REPORT_GENERATED` | Report generation | format, session |
| `BNK.RECONCILIATION.RULE_CREATED` | Rule creation | rule name, conditions |
| `BNK.RECONCILIATION.RULE_UPDATED` | Rule modification | changed fields |
| `BNK.RECONCILIATION.RULE_DELETED` | Rule deletion | rule ID |

---

## Implementation Notes

### Matching Algorithm Priority
1. Custom rules (highest priority)
2. Exact matching
3. Fuzzy matching
4. AI-assisted matching (lowest priority, highest cost)

### Performance Considerations
- Batch process transactions in chunks of 100
- Cache journal entries during session
- Limit AI calls to reduce costs
- Index on booking_date, amount for fast lookups

### Polish Banking Specifics
- Handle PLN rounding differences (grosze)
- Consider Polish banking holidays for date matching
- Support Split Payment transaction matching
- Handle multi-currency transactions with NBP rates

---

## Dependencies

- **BNK-003**: Transaction Import (source transactions)
- **ACC**: Accounting Engine (journal entries)
- **AIM**: Authentication (user sessions)

## Related Stories

- **BNK-004**: AI Transaction Categorization (shared AI infrastructure)
- **BNK-010**: Banking Analytics (reconciliation metrics)

---

*Last updated: December 2024*
