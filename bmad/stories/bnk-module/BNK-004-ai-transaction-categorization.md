# BNK-004: AI Transaction Categorization

> **Story ID**: BNK-004
> **Epic**: Banking Integration Layer (BNK)
> **Priority**: P1 (Important)
> **Story Points**: 8
> **Phase**: Week 22
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant,
**I want to** have transactions automatically categorized using AI,
**So that** I can quickly assign them to proper accounting categories without manual review.

---

## Acceptance Criteria

### AC1: ML-Based Categorization
```gherkin
Feature: ML-Based Transaction Categorization
  Scenario: Categorize new transaction automatically
    Given a new transaction is imported
      | description | "Faktura VAT 123/2024 za usługi IT" |
      | counterparty | "ABC Software Sp. z o.o." |
      | amount | 12300.00 |
    When AI categorization is triggered
    Then transaction is assigned category "Usługi obce"
    And subcategory is "Usługi informatyczne"
    And VAT rate suggestion is 23%
    And confidence score is >= 0.8

  Scenario: Low confidence categorization requires review
    Given transaction with ambiguous description "Płatność"
    When AI categorization is triggered
    And confidence score is < 0.7
    Then transaction is flagged for manual review
    And suggested categories are provided with scores
```

### AC2: Polish Accounting Categories
```gherkin
Feature: Polish Chart of Accounts Mapping
  Scenario: Map to Polish accounting categories
    Given transaction categorized as "Zakup materiałów biurowych"
    When category mapping is applied
    Then account suggestion is "401-01" (Zużycie materiałów)
    And debit account is "401-01"
    And credit account is "130" (Rachunek bankowy)

  Scenario: Handle split payment transactions
    Given transaction with split payment marker
    When category mapping is applied
    Then VAT account suggestion includes "221-01" (VAT naliczony)
    And split payment indicator is set
```

### AC3: VAT Rate Suggestions
```gherkin
Feature: VAT Rate Suggestions
  Scenario: Suggest standard VAT rate
    Given transaction for standard goods/services
    When VAT suggestion is calculated
    Then suggested rate is 23%
    And confidence is provided

  Scenario: Suggest reduced VAT rate
    Given transaction description contains "książki" or "żywność"
    When VAT suggestion is calculated
    Then suggested rate is 8% or 5%
    And reasoning is provided

  Scenario: Suggest VAT exempt
    Given transaction for financial services
    When VAT suggestion is calculated
    Then suggested rate is "ZW" (zwolniony)
    And exempt reason is provided
```

### AC4: Counterparty Recognition
```gherkin
Feature: Counterparty Recognition
  Scenario: Recognize known counterparty
    Given transaction from "ABC Software Sp. z o.o."
    And previous transactions from same counterparty exist
    When counterparty recognition runs
    Then counterparty is matched to existing record
    And historical category is suggested
    And NIP is retrieved if available

  Scenario: Create new counterparty
    Given transaction from unknown counterparty
    When counterparty recognition runs
    Then new counterparty record is suggested
    And NIP lookup is attempted from GUS
```

### AC5: Custom Rule Support
```gherkin
Feature: Custom Categorization Rules
  Scenario: Apply user-defined rule
    Given user created rule
      | condition | "description CONTAINS 'OLX'" |
      | category | "Reklama i promocja" |
      | priority | 100 |
    When transaction matches rule
    Then rule-based category is applied
    And AI suggestion is overridden
    And rule ID is recorded

  Scenario: Rule priority handling
    Given multiple rules match transaction
    When categorization runs
    Then highest priority rule is applied
    And other matching rules are logged
```

### AC6: Learning from Corrections
```gherkin
Feature: Learning from User Corrections
  Scenario: Learn from category correction
    Given transaction was auto-categorized as "Usługi obce"
    When user changes category to "Koszty reprezentacji"
    Then correction is recorded as training data
    And future similar transactions weighted towards new category
    And model is scheduled for retraining

  Scenario: Bulk correction learning
    Given user bulk-corrects 10 similar transactions
    When corrections are saved
    Then pattern is identified
    And rule suggestion is generated for user
```

### AC7: Confidence Scoring
```gherkin
Feature: Confidence Scoring
  Scenario: High confidence categorization
    Given transaction with clear business context
    When AI categorization completes
    Then confidence score is calculated (0.0-1.0)
    And score >= 0.85 marked as "auto-approved"
    And transaction proceeds to accounting

  Scenario: Medium confidence categorization
    Given transaction with some ambiguity
    When AI categorization completes
    And score is 0.7-0.85
    Then transaction marked for "quick review"
    And top 3 suggestions provided

  Scenario: Low confidence categorization
    Given transaction with high ambiguity
    When AI categorization completes
    And score < 0.7
    Then transaction marked for "manual review"
    And all possible categories listed
```

---

## Technical Specification

### Database Schema

```sql
-- Transaction categories table
CREATE TABLE transaction_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id),

    -- Category hierarchy
    parent_id UUID REFERENCES transaction_categories(id),
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),

    -- Accounting mapping
    default_debit_account VARCHAR(20),
    default_credit_account VARCHAR(20),
    default_vat_rate VARCHAR(10),

    -- Classification
    category_type VARCHAR(50), -- 'INCOME', 'EXPENSE', 'TRANSFER', 'TAX'
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    -- AI training
    keywords TEXT[],
    negative_keywords TEXT[],

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(client_id, code)
);

-- Categorization rules table
CREATE TABLE categorization_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),

    -- Rule definition
    name VARCHAR(255) NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 50,
    is_enabled BOOLEAN DEFAULT TRUE,

    -- Conditions (JSONB for flexibility)
    conditions JSONB NOT NULL,
    -- Example: {"operator": "AND", "rules": [
    --   {"field": "description", "op": "contains", "value": "OLX"},
    --   {"field": "amount", "op": "gte", "value": 100}
    -- ]}

    -- Actions
    category_id UUID REFERENCES transaction_categories(id),
    vat_rate VARCHAR(10),
    tags TEXT[],

    -- Tracking
    times_applied INTEGER DEFAULT 0,
    last_applied_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI predictions table
CREATE TABLE categorization_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES bank_transactions(id),

    -- Prediction
    predicted_category_id UUID REFERENCES transaction_categories(id),
    confidence DECIMAL(5, 4) NOT NULL,

    -- Alternative predictions
    alternatives JSONB,
    -- Example: [{"categoryId": "...", "confidence": 0.75}, ...]

    -- VAT suggestion
    suggested_vat_rate VARCHAR(10),
    vat_confidence DECIMAL(5, 4),

    -- Model info
    model_version VARCHAR(50),
    features_used JSONB,

    -- Status
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'MANUAL'
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User corrections for learning
CREATE TABLE categorization_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    transaction_id UUID NOT NULL REFERENCES bank_transactions(id),

    -- Original prediction
    original_category_id UUID REFERENCES transaction_categories(id),
    original_confidence DECIMAL(5, 4),

    -- Correction
    corrected_category_id UUID NOT NULL REFERENCES transaction_categories(id),
    correction_reason TEXT,

    -- Learning metadata
    is_used_for_training BOOLEAN DEFAULT FALSE,
    training_batch_id VARCHAR(100),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Counterparty recognition cache
CREATE TABLE counterparty_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),

    -- Counterparty identification
    counterparty_name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    counterparty_account VARCHAR(34),

    -- Matched entity
    crm_contact_id UUID,
    nip VARCHAR(10),

    -- Default categorization
    default_category_id UUID REFERENCES transaction_categories(id),
    default_vat_rate VARCHAR(10),

    -- Statistics
    transaction_count INTEGER DEFAULT 0,
    last_transaction_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(client_id, normalized_name)
);

-- Indexes
CREATE INDEX idx_categories_client ON transaction_categories(client_id);
CREATE INDEX idx_categories_parent ON transaction_categories(parent_id);
CREATE INDEX idx_rules_client_priority ON categorization_rules(client_id, priority DESC);
CREATE INDEX idx_predictions_transaction ON categorization_predictions(transaction_id);
CREATE INDEX idx_predictions_status ON categorization_predictions(status);
CREATE INDEX idx_corrections_client ON categorization_corrections(client_id);
CREATE INDEX idx_counterparty_client_name ON counterparty_mappings(client_id, normalized_name);

-- RLS
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorization_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorization_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE counterparty_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_client_isolation ON transaction_categories
    USING (client_id IS NULL OR client_id = current_setting('app.current_client_id')::UUID);
CREATE POLICY rules_client_isolation ON categorization_rules
    USING (client_id = current_setting('app.current_client_id')::UUID);
```

### Zod Schemas

```typescript
// src/modules/bnk/schemas/categorization.schema.ts
import { z } from 'zod';

// Category schema
export const TransactionCategorySchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid().nullable(),
  parentId: z.string().uuid().nullable(),
  code: z.string(),
  name: z.string(),
  nameEn: z.string().nullable(),
  defaultDebitAccount: z.string().nullable(),
  defaultCreditAccount: z.string().nullable(),
  defaultVatRate: z.string().nullable(),
  categoryType: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'TAX']).nullable(),
  isSystem: z.boolean(),
  isActive: z.boolean(),
  keywords: z.array(z.string()),
  negativeKeywords: z.array(z.string())
});

// Rule condition schema
export const RuleConditionSchema = z.object({
  field: z.enum(['description', 'counterpartyName', 'counterpartyAccount', 'amount', 'transactionType']),
  operator: z.enum(['equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith', 'gt', 'gte', 'lt', 'lte', 'regex']),
  value: z.union([z.string(), z.number()]),
  caseSensitive: z.boolean().optional()
});

export const RuleConditionsSchema = z.object({
  operator: z.enum(['AND', 'OR']),
  rules: z.array(RuleConditionSchema)
});

// Categorization rule schema
export const CategorizationRuleSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  priority: z.number().min(1).max(100),
  isEnabled: z.boolean(),
  conditions: RuleConditionsSchema,
  categoryId: z.string().uuid().nullable(),
  vatRate: z.string().nullable(),
  tags: z.array(z.string()),
  timesApplied: z.number(),
  lastAppliedAt: z.string().datetime().nullable()
});

// Create rule request
export const CreateRuleRequestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  priority: z.number().min(1).max(100).default(50),
  conditions: RuleConditionsSchema,
  categoryId: z.string().uuid(),
  vatRate: z.string().optional(),
  tags: z.array(z.string()).optional()
});

// Prediction schema
export const CategorizationPredictionSchema = z.object({
  id: z.string().uuid(),
  transactionId: z.string().uuid(),
  predictedCategoryId: z.string().uuid().nullable(),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(z.object({
    categoryId: z.string().uuid(),
    categoryName: z.string(),
    confidence: z.number()
  })),
  suggestedVatRate: z.string().nullable(),
  vatConfidence: z.number().nullable(),
  modelVersion: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'MANUAL']),
  reviewedAt: z.string().datetime().nullable()
});

// Categorize request
export const CategorizeTransactionRequestSchema = z.object({
  transactionId: z.string().uuid(),
  forceRecategorize: z.boolean().default(false)
});

// Bulk categorize request
export const BulkCategorizeRequestSchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1).max(100),
  forceRecategorize: z.boolean().default(false)
});

// Approve categorization request
export const ApproveCategorrizationRequestSchema = z.object({
  predictionId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  vatRate: z.string().optional()
});

// Correction request
export const SubmitCorrectionRequestSchema = z.object({
  transactionId: z.string().uuid(),
  categoryId: z.string().uuid(),
  reason: z.string().optional()
});

// Category suggestion response
export const CategorySuggestionSchema = z.object({
  categoryId: z.string().uuid(),
  categoryName: z.string(),
  categoryCode: z.string(),
  confidence: z.number(),
  reasoning: z.string(),
  accountMapping: z.object({
    debitAccount: z.string().nullable(),
    creditAccount: z.string().nullable()
  }),
  vatSuggestion: z.object({
    rate: z.string(),
    confidence: z.number(),
    reasoning: z.string()
  }).nullable()
});

// Type exports
export type TransactionCategory = z.infer<typeof TransactionCategorySchema>;
export type CategorizationRule = z.infer<typeof CategorizationRuleSchema>;
export type CreateRuleRequest = z.infer<typeof CreateRuleRequestSchema>;
export type CategorizationPrediction = z.infer<typeof CategorizationPredictionSchema>;
export type CategorySuggestion = z.infer<typeof CategorySuggestionSchema>;
```

### tRPC Router

```typescript
// src/modules/bnk/routers/categorization.router.ts
import { router, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  CategorizeTransactionRequestSchema,
  BulkCategorizeRequestSchema,
  ApproveCategorrizationRequestSchema,
  SubmitCorrectionRequestSchema,
  CreateRuleRequestSchema,
  TransactionCategorySchema,
  CategorizationRuleSchema,
  CategorizationPredictionSchema,
  CategorySuggestionSchema
} from '../schemas/categorization.schema';
import { AICategorizationService } from '../services/ai-categorization.service';
import { RuleEngineService } from '../services/rule-engine.service';

export const categorizationRouter = router({
  // Get categories
  getCategories: protectedProcedure
    .input(z.object({
      parentId: z.string().uuid().optional(),
      includeSystem: z.boolean().default(true),
      activeOnly: z.boolean().default(true)
    }))
    .output(z.array(TransactionCategorySchema))
    .query(async ({ ctx, input }) => {
      const where: any = {
        OR: [
          { clientId: null }, // System categories
          { clientId: ctx.session.clientId }
        ]
      };

      if (input.parentId) {
        where.parentId = input.parentId;
      } else {
        where.parentId = null; // Top-level only
      }

      if (!input.includeSystem) {
        where.isSystem = false;
      }

      if (input.activeOnly) {
        where.isActive = true;
      }

      return ctx.db.transactionCategory.findMany({
        where,
        orderBy: { code: 'asc' }
      });
    }),

  // Categorize single transaction
  categorizeTransaction: protectedProcedure
    .input(CategorizeTransactionRequestSchema)
    .output(CategorizationPredictionSchema)
    .mutation(async ({ ctx, input }) => {
      const transaction = await ctx.db.bankTransaction.findFirst({
        where: {
          id: input.transactionId,
          clientId: ctx.session.clientId
        }
      });

      if (!transaction) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono transakcji'
        });
      }

      // Check for existing prediction
      if (!input.forceRecategorize) {
        const existing = await ctx.db.categorizationPrediction.findFirst({
          where: { transactionId: input.transactionId }
        });
        if (existing) return existing;
      }

      // Try rule-based categorization first
      const ruleEngine = new RuleEngineService(ctx.db);
      const ruleResult = await ruleEngine.evaluate(ctx.session.clientId, transaction);

      if (ruleResult) {
        return ctx.db.categorizationPrediction.create({
          data: {
            transactionId: input.transactionId,
            predictedCategoryId: ruleResult.categoryId,
            confidence: 1.0, // Rules are deterministic
            alternatives: [],
            suggestedVatRate: ruleResult.vatRate,
            vatConfidence: 1.0,
            modelVersion: 'rule-engine-v1',
            status: 'APPROVED'
          }
        });
      }

      // Fall back to AI categorization
      const aiService = new AICategorizationService(ctx.db);
      const prediction = await aiService.categorize(ctx.session.clientId, transaction);

      const created = await ctx.db.categorizationPrediction.create({
        data: {
          transactionId: input.transactionId,
          predictedCategoryId: prediction.categoryId,
          confidence: prediction.confidence,
          alternatives: prediction.alternatives,
          suggestedVatRate: prediction.vatRate,
          vatConfidence: prediction.vatConfidence,
          modelVersion: prediction.modelVersion,
          status: prediction.confidence >= 0.85 ? 'APPROVED' : 'PENDING'
        }
      });

      // Auto-apply if high confidence
      if (prediction.confidence >= 0.85) {
        await ctx.db.bankTransaction.update({
          where: { id: input.transactionId },
          data: {
            categoryId: prediction.categoryId,
            categoryConfidence: prediction.confidence,
            isCategoryConfirmed: false
          }
        });
      }

      return created;
    }),

  // Bulk categorize
  bulkCategorize: protectedProcedure
    .input(BulkCategorizeRequestSchema)
    .output(z.object({
      processed: z.number(),
      autoApproved: z.number(),
      pendingReview: z.number(),
      errors: z.array(z.object({
        transactionId: z.string(),
        error: z.string()
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      const aiService = new AICategorizationService(ctx.db);
      const ruleEngine = new RuleEngineService(ctx.db);

      const results = {
        processed: 0,
        autoApproved: 0,
        pendingReview: 0,
        errors: [] as { transactionId: string; error: string }[]
      };

      for (const transactionId of input.transactionIds) {
        try {
          const transaction = await ctx.db.bankTransaction.findFirst({
            where: {
              id: transactionId,
              clientId: ctx.session.clientId
            }
          });

          if (!transaction) {
            results.errors.push({
              transactionId,
              error: 'Nie znaleziono transakcji'
            });
            continue;
          }

          // Try rules first, then AI
          let prediction;
          const ruleResult = await ruleEngine.evaluate(ctx.session.clientId, transaction);

          if (ruleResult) {
            prediction = {
              categoryId: ruleResult.categoryId,
              confidence: 1.0,
              alternatives: [],
              vatRate: ruleResult.vatRate,
              vatConfidence: 1.0,
              modelVersion: 'rule-engine-v1'
            };
          } else {
            prediction = await aiService.categorize(ctx.session.clientId, transaction);
          }

          await ctx.db.categorizationPrediction.create({
            data: {
              transactionId,
              predictedCategoryId: prediction.categoryId,
              confidence: prediction.confidence,
              alternatives: prediction.alternatives,
              suggestedVatRate: prediction.vatRate,
              vatConfidence: prediction.vatConfidence,
              modelVersion: prediction.modelVersion,
              status: prediction.confidence >= 0.85 ? 'APPROVED' : 'PENDING'
            }
          });

          results.processed++;
          if (prediction.confidence >= 0.85) {
            results.autoApproved++;
            await ctx.db.bankTransaction.update({
              where: { id: transactionId },
              data: {
                categoryId: prediction.categoryId,
                categoryConfidence: prediction.confidence
              }
            });
          } else {
            results.pendingReview++;
          }
        } catch (error) {
          results.errors.push({
            transactionId,
            error: error instanceof Error ? error.message : 'Nieznany błąd'
          });
        }
      }

      await ctx.audit.log({
        action: 'BULK_CATEGORIZATION_COMPLETED',
        resourceType: 'TRANSACTION',
        details: results
      });

      return results;
    }),

  // Approve categorization
  approveCategorization: protectedProcedure
    .input(ApproveCategorrizationRequestSchema)
    .output(CategorizationPredictionSchema)
    .mutation(async ({ ctx, input }) => {
      const prediction = await ctx.db.categorizationPrediction.findFirst({
        where: { id: input.predictionId },
        include: { transaction: true }
      });

      if (!prediction || prediction.transaction.clientId !== ctx.session.clientId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono predykcji'
        });
      }

      const categoryId = input.categoryId || prediction.predictedCategoryId;

      // Update prediction
      const updated = await ctx.db.categorizationPrediction.update({
        where: { id: input.predictionId },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedBy: ctx.session.userId
        }
      });

      // Update transaction
      await ctx.db.bankTransaction.update({
        where: { id: prediction.transactionId },
        data: {
          categoryId,
          categoryConfidence: prediction.confidence,
          isCategoryConfirmed: true
        }
      });

      // Record correction if different from prediction
      if (input.categoryId && input.categoryId !== prediction.predictedCategoryId) {
        await ctx.db.categorizationCorrection.create({
          data: {
            clientId: ctx.session.clientId,
            transactionId: prediction.transactionId,
            originalCategoryId: prediction.predictedCategoryId,
            originalConfidence: prediction.confidence,
            correctedCategoryId: input.categoryId,
            createdBy: ctx.session.userId
          }
        });
      }

      return updated;
    }),

  // Submit correction
  submitCorrection: protectedProcedure
    .input(SubmitCorrectionRequestSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const transaction = await ctx.db.bankTransaction.findFirst({
        where: {
          id: input.transactionId,
          clientId: ctx.session.clientId
        }
      });

      if (!transaction) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono transakcji'
        });
      }

      // Record correction
      await ctx.db.categorizationCorrection.create({
        data: {
          clientId: ctx.session.clientId,
          transactionId: input.transactionId,
          originalCategoryId: transaction.categoryId,
          originalConfidence: transaction.categoryConfidence,
          correctedCategoryId: input.categoryId,
          correctionReason: input.reason,
          createdBy: ctx.session.userId
        }
      });

      // Update transaction
      await ctx.db.bankTransaction.update({
        where: { id: input.transactionId },
        data: {
          categoryId: input.categoryId,
          categoryConfidence: 1.0,
          isCategoryConfirmed: true
        }
      });

      await ctx.audit.log({
        action: 'CATEGORY_CORRECTED',
        resourceType: 'TRANSACTION',
        resourceId: input.transactionId,
        details: {
          originalCategoryId: transaction.categoryId,
          newCategoryId: input.categoryId
        }
      });

      return { success: true };
    }),

  // CRUD for rules
  createRule: protectedProcedure
    .input(CreateRuleRequestSchema)
    .output(CategorizationRuleSchema)
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.db.categorizationRule.create({
        data: {
          clientId: ctx.session.clientId,
          name: input.name,
          description: input.description,
          priority: input.priority,
          conditions: input.conditions,
          categoryId: input.categoryId,
          vatRate: input.vatRate,
          tags: input.tags || [],
          isEnabled: true
        }
      });

      await ctx.audit.log({
        action: 'CATEGORIZATION_RULE_CREATED',
        resourceType: 'CATEGORIZATION_RULE',
        resourceId: rule.id
      });

      return rule;
    }),

  getRules: protectedProcedure
    .input(z.object({
      enabledOnly: z.boolean().default(true)
    }))
    .output(z.array(CategorizationRuleSchema))
    .query(async ({ ctx, input }) => {
      const where: any = {
        clientId: ctx.session.clientId
      };

      if (input.enabledOnly) {
        where.isEnabled = true;
      }

      return ctx.db.categorizationRule.findMany({
        where,
        orderBy: { priority: 'desc' }
      });
    }),

  updateRule: protectedProcedure
    .input(z.object({
      ruleId: z.string().uuid(),
      data: CreateRuleRequestSchema.partial()
    }))
    .output(CategorizationRuleSchema)
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.db.categorizationRule.findFirst({
        where: {
          id: input.ruleId,
          clientId: ctx.session.clientId
        }
      });

      if (!rule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono reguły'
        });
      }

      return ctx.db.categorizationRule.update({
        where: { id: input.ruleId },
        data: input.data
      });
    }),

  deleteRule: protectedProcedure
    .input(z.object({ ruleId: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.db.categorizationRule.findFirst({
        where: {
          id: input.ruleId,
          clientId: ctx.session.clientId
        }
      });

      if (!rule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono reguły'
        });
      }

      await ctx.db.categorizationRule.delete({
        where: { id: input.ruleId }
      });

      return { success: true };
    }),

  // Get pending reviews
  getPendingReviews: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20)
    }))
    .output(z.array(z.object({
      transaction: z.object({
        id: z.string(),
        description: z.string().nullable(),
        counterpartyName: z.string().nullable(),
        amount: z.number(),
        bookingDate: z.string()
      }),
      prediction: CategorizationPredictionSchema,
      suggestedCategory: TransactionCategorySchema.nullable()
    })))
    .query(async ({ ctx, input }) => {
      const predictions = await ctx.db.categorizationPrediction.findMany({
        where: {
          status: 'PENDING',
          transaction: {
            clientId: ctx.session.clientId
          }
        },
        include: {
          transaction: true,
          predictedCategory: true
        },
        take: input.limit,
        orderBy: { createdAt: 'asc' }
      });

      return predictions.map(p => ({
        transaction: {
          id: p.transaction.id,
          description: p.transaction.description,
          counterpartyName: p.transaction.counterpartyName,
          amount: p.transaction.amount,
          bookingDate: p.transaction.bookingDate
        },
        prediction: p,
        suggestedCategory: p.predictedCategory
      }));
    })
});
```

### AI Categorization Service

```typescript
// src/modules/bnk/services/ai-categorization.service.ts
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

interface CategorizationResult {
  categoryId: string;
  confidence: number;
  alternatives: Array<{ categoryId: string; confidence: number }>;
  vatRate: string | null;
  vatConfidence: number;
  modelVersion: string;
}

export class AICategorizationService {
  private openai: OpenAI;
  private db: PrismaClient;

  constructor(db: PrismaClient) {
    this.db = db;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async categorize(
    clientId: string,
    transaction: {
      description: string | null;
      counterpartyName: string | null;
      amount: number;
      transactionType: string;
    }
  ): Promise<CategorizationResult> {
    // Get categories for this client
    const categories = await this.db.transactionCategory.findMany({
      where: {
        OR: [
          { clientId: null },
          { clientId }
        ],
        isActive: true
      }
    });

    // Check counterparty history
    const counterpartyHistory = transaction.counterpartyName
      ? await this.getCounterpartyHistory(clientId, transaction.counterpartyName)
      : null;

    // Build prompt
    const prompt = this.buildCategorizationPrompt(transaction, categories, counterpartyHistory);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `Jesteś ekspertem od księgowości polskiej. Kategoryzujesz transakcje bankowe według polskiego planu kont.

Odpowiedz w formacie JSON:
{
  "categoryId": "uuid kategorii",
  "confidence": 0.0-1.0,
  "alternatives": [{"categoryId": "uuid", "confidence": 0.0-1.0}],
  "vatRate": "23%|8%|5%|0%|ZW|NP",
  "vatConfidence": 0.0-1.0,
  "reasoning": "krótkie uzasadnienie"
}`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        categoryId: result.categoryId,
        confidence: result.confidence || 0.5,
        alternatives: result.alternatives || [],
        vatRate: result.vatRate,
        vatConfidence: result.vatConfidence || 0.5,
        modelVersion: 'gpt-4-turbo-v1'
      };
    } catch (error) {
      console.error('AI categorization failed:', error);

      // Fallback to keyword-based categorization
      return this.keywordFallback(transaction, categories);
    }
  }

  private buildCategorizationPrompt(
    transaction: any,
    categories: any[],
    counterpartyHistory: any | null
  ): string {
    let prompt = `Skategoryzuj następującą transakcję bankową:

Opis: ${transaction.description || 'brak'}
Kontrahent: ${transaction.counterpartyName || 'nieznany'}
Kwota: ${transaction.amount} PLN
Typ: ${transaction.transactionType === 'CREDIT' ? 'Przychód' : 'Wydatek'}

`;

    if (counterpartyHistory) {
      prompt += `\nHistoria kontrahenta: Ostatnio kategoryzowano jako "${counterpartyHistory.categoryName}" (${counterpartyHistory.count} transakcji)\n`;
    }

    prompt += `\nDostępne kategorie:\n`;
    categories.forEach(cat => {
      prompt += `- ${cat.id}: ${cat.name} (${cat.code})`;
      if (cat.keywords?.length) {
        prompt += ` [słowa kluczowe: ${cat.keywords.join(', ')}]`;
      }
      prompt += '\n';
    });

    return prompt;
  }

  private async getCounterpartyHistory(
    clientId: string,
    counterpartyName: string
  ) {
    const mapping = await this.db.counterpartyMapping.findFirst({
      where: {
        clientId,
        normalizedName: this.normalizeCounterpartyName(counterpartyName)
      },
      include: {
        defaultCategory: true
      }
    });

    if (mapping && mapping.defaultCategory) {
      return {
        categoryId: mapping.defaultCategoryId,
        categoryName: mapping.defaultCategory.name,
        count: mapping.transactionCount
      };
    }

    return null;
  }

  private normalizeCounterpartyName(name: string): string {
    return name
      .toLowerCase()
      .replace(/sp\.?\s*z\s*o\.?\s*o\.?/gi, 'sp. z o.o.')
      .replace(/s\.?\s*a\.?$/gi, 's.a.')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private keywordFallback(
    transaction: any,
    categories: any[]
  ): CategorizationResult {
    const text = `${transaction.description || ''} ${transaction.counterpartyName || ''}`.toLowerCase();

    let bestMatch = {
      categoryId: categories[0]?.id,
      score: 0
    };

    for (const category of categories) {
      const keywords = category.keywords || [];
      const negativeKeywords = category.negativeKeywords || [];

      // Check negative keywords first
      if (negativeKeywords.some((kw: string) => text.includes(kw.toLowerCase()))) {
        continue;
      }

      // Score positive keywords
      let score = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }

      if (score > bestMatch.score) {
        bestMatch = { categoryId: category.id, score };
      }
    }

    return {
      categoryId: bestMatch.categoryId,
      confidence: Math.min(0.3 + bestMatch.score * 0.2, 0.7),
      alternatives: [],
      vatRate: null,
      vatConfidence: 0,
      modelVersion: 'keyword-fallback-v1'
    };
  }
}
```

---

## Test Specifications

### Unit Tests

```typescript
// src/modules/bnk/__tests__/ai-categorization.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AICategorizationService } from '../services/ai-categorization.service';

describe('AICategorizationService', () => {
  describe('keywordFallback', () => {
    it('should match category by keywords', () => {
      const service = new AICategorizationService({} as any);
      const categories = [
        {
          id: 'cat1',
          name: 'Usługi IT',
          keywords: ['software', 'informatyczne', 'IT']
        },
        {
          id: 'cat2',
          name: 'Materiały biurowe',
          keywords: ['biurowe', 'papier', 'toner']
        }
      ];

      const result = (service as any).keywordFallback(
        {
          description: 'Faktura za usługi informatyczne',
          counterpartyName: 'IT Solutions'
        },
        categories
      );

      expect(result.categoryId).toBe('cat1');
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should respect negative keywords', () => {
      const service = new AICategorizationService({} as any);
      const categories = [
        {
          id: 'cat1',
          name: 'Przychody ze sprzedaży',
          keywords: ['sprzedaż', 'faktura'],
          negativeKeywords: ['korekta', 'zwrot']
        }
      ];

      const result = (service as any).keywordFallback(
        { description: 'Korekta faktury sprzedaży' },
        categories
      );

      expect(result.categoryId).not.toBe('cat1');
    });
  });

  describe('normalizeCounterpartyName', () => {
    it('should normalize company suffixes', () => {
      const service = new AICategorizationService({} as any);

      expect((service as any).normalizeCounterpartyName('ABC Sp z o o'))
        .toBe('abc sp. z o.o.');
      expect((service as any).normalizeCounterpartyName('XYZ SA'))
        .toBe('xyz s.a.');
    });
  });
});
```

---

## Security Checklist

- [ ] AI responses validated before database write
- [ ] Rate limiting on categorization endpoints
- [ ] User corrections audited
- [ ] Rule conditions sanitized against injection
- [ ] Category IDs validated against allowed list
- [ ] OpenAI API key stored securely
- [ ] Fallback mechanism when AI unavailable

---

## Audit Events

| Event | Trigger | Data |
|-------|---------|------|
| `TRANSACTION_CATEGORIZED` | AI/rule applied | transactionId, categoryId, confidence |
| `BULK_CATEGORIZATION_COMPLETED` | Batch processed | counts, errors |
| `CATEGORY_CORRECTED` | User correction | originalId, newId |
| `CATEGORIZATION_RULE_CREATED` | Rule created | ruleId, conditions |
| `CATEGORIZATION_RULE_UPDATED` | Rule modified | ruleId, changes |

---

## Dependencies

- **BNK-003**: Transaction Import (requires transactions to categorize)
- **ACC**: Accounting module (for chart of accounts mapping)

---

## Polish Language Support

All user-facing messages in Polish:
- "Nie znaleziono transakcji"
- "Nie znaleziono predykcji"
- "Nie znaleziono reguły"
- Category names in Polish (e.g., "Usługi obce", "Koszty reprezentacji")
- VAT rate descriptions ("zwolniony", "nie podlega")

---

*Last updated: December 2024*
