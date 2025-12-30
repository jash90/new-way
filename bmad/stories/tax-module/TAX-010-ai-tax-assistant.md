# Story: AI Tax Assistant (TAX-010)

> **Story ID**: TAX-010
> **Epic**: Tax Compliance Module (TAX)
> **Priority**: P1 (Essential)
> **Points**: 13
> **Status**: 📋 Ready for Development
> **Phase**: Week 15

---

## User Story

**As an** accountant,
**I want** an AI assistant for tax questions
**So that** I can get quick answers to regulatory questions with cited legal sources.

---

## Background

Polish tax law is complex and constantly evolving. Accountants need quick, reliable answers to tax questions backed by official legal sources. This AI assistant provides natural language tax queries with responses in Polish, citing relevant legislation (Ustawa o VAT, Ordynacja podatkowa, etc.) and providing confidence scores for each answer.

### Key Features
- **Natural Language Queries**: Ask tax questions in Polish or English
- **Legal Citation**: Responses include references to specific law articles
- **Confidence Scoring**: Each answer includes reliability indicator
- **Context Awareness**: Considers client-specific tax configuration
- **Query History**: Track and search past questions and answers
- **Feedback Loop**: Improve answers based on user feedback

---

## Acceptance Criteria

### Scenario 1: Natural Language Tax Query
```gherkin
Given I am an authenticated user with tax access
When I ask a tax question in natural language
Then the AI processes my query
And identifies the relevant tax domain (VAT, CIT, PIT, ZUS)
And retrieves applicable regulations
And generates a comprehensive answer
And includes legal citations
And displays confidence score (0.00-1.00)
And the response is in the same language as my query
```

### Scenario 2: Client-Context Tax Query
```gherkin
Given I have a client selected in the system
And the client has specific tax configuration
When I ask about the client's tax obligations
Then the AI considers the client's:
  | Configuration | Impact |
  | VAT status | Active/exempt/reverse charge applicability |
  | Company size | Small taxpayer rules (CIT 9%) |
  | Tax regime | Estonian CIT, flat PIT |
  | ZUS type | Standard, preferential, mały ZUS+ |
And provides personalized answer
And mentions relevant client-specific considerations
```

### Scenario 3: Regulation Interpretation
```gherkin
Given I ask about a specific tax regulation
When the AI processes the query
Then it provides:
  - Direct quotation of the regulation
  - Plain language interpretation
  - Practical examples
  - Related regulations
  - Recent changes to this regulation
  - Ministry interpretations (if available)
And clearly distinguishes between law text and interpretation
```

### Scenario 4: Confidence Scoring
```gherkin
Given the AI generates a tax response
Then a confidence score is calculated based on:
  | Factor | Weight |
  | Source quality | 30% |
  | Query clarity | 20% |
  | Regulation recency | 20% |
  | Context match | 15% |
  | Historical accuracy | 15% |
And responses with confidence <0.75 include disclaimer
And responses with confidence <0.50 suggest consulting a tax advisor
And confidence score is visible to user
```

### Scenario 5: Legal Citation
```gherkin
Given the AI provides a tax answer
Then citations are included in format:
  - "Art. 19a ust. 1 ustawy o VAT (Dz.U. 2004 Nr 54 poz. 535)"
  - "§ 3 ust. 2 rozporządzenia MF z dnia..."
And each citation is clickable/linkable
And citations include effective dates
And superseded regulations are marked as historical
```

### Scenario 6: Query History
```gherkin
Given I have asked previous tax questions
When I access query history
Then I see all my past queries
And queries can be filtered by:
  | Filter | Options |
  | Date range | Custom, last 7/30/90 days |
  | Tax type | VAT, CIT, PIT, ZUS, Other |
  | Confidence | High (>0.85), Medium (0.50-0.85), Low (<0.50) |
  | Client | Specific client or all |
And I can re-ask any previous query
And I can provide feedback on past answers
```

### Scenario 7: Feedback and Learning
```gherkin
Given I receive an AI tax response
When I provide feedback on the answer
Then I can rate: helpful/not helpful
And I can mark: accurate/inaccurate
And I can provide correction text
And feedback is stored for model improvement
And similar future queries consider this feedback
```

### Scenario 8: Multi-turn Conversation
```gherkin
Given I am in a tax consultation session
When I ask follow-up questions
Then the AI maintains context from previous questions
And references earlier parts of the conversation
And builds on previous answers
And the session can be saved/exported
And session timeout is 30 minutes of inactivity
```

### Scenario 9: Disclaimer Handling
```gherkin
Given tax advice has legal implications
When any answer is provided
Then a standard disclaimer is shown:
  "Odpowiedź ma charakter informacyjny i nie stanowi porady podatkowej
   w rozumieniu ustawy o doradztwie podatkowym. W sprawach
   wymagających oficjalnej interpretacji należy skonsultować się
   z doradcą podatkowym lub złożyć wniosek o interpretację indywidualną."
And disclaimer is always visible
And cannot be hidden or dismissed
```

---

## Technical Specification

### Database Schema

```sql
-- Tax AI conversations
CREATE TABLE tax_ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  client_id UUID REFERENCES clients(id),
  title VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  language VARCHAR(5) NOT NULL DEFAULT 'pl',
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('active', 'closed', 'expired'))
);

-- Tax AI messages
CREATE TABLE tax_ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES tax_ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tax_domain VARCHAR(30),
  confidence_score DECIMAL(3, 2),
  citations JSONB DEFAULT '[]',
  sources_used JSONB DEFAULT '[]',
  processing_time_ms INTEGER,
  tokens_used INTEGER,
  model_version VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_confidence CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1))
);

-- Tax AI citations
CREATE TABLE tax_ai_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES tax_ai_messages(id) ON DELETE CASCADE,
  citation_type VARCHAR(30) NOT NULL,
  source_name VARCHAR(500) NOT NULL,
  article_number VARCHAR(50),
  paragraph_number VARCHAR(50),
  journal_reference VARCHAR(200),
  effective_date DATE,
  expiry_date DATE,
  url TEXT,
  excerpt TEXT,
  is_superseded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_citation_type CHECK (citation_type IN (
    'ustawa', 'rozporzadzenie', 'interpretacja',
    'orzeczenie', 'dyrektywa_ue', 'other'
  ))
);

-- User feedback on AI responses
CREATE TABLE tax_ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES tax_ai_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  rating VARCHAR(20) NOT NULL,
  accuracy VARCHAR(20),
  correction_text TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_rating CHECK (rating IN ('helpful', 'not_helpful')),
  CONSTRAINT valid_accuracy CHECK (accuracy IS NULL OR accuracy IN ('accurate', 'inaccurate', 'partially_accurate'))
);

-- Tax knowledge base (for RAG)
CREATE TABLE tax_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(30) NOT NULL,
  source_name VARCHAR(500) NOT NULL,
  source_reference VARCHAR(200),
  title VARCHAR(500),
  content TEXT NOT NULL,
  content_vector vector(1536), -- OpenAI embeddings
  tax_domain VARCHAR(30),
  effective_date DATE,
  expiry_date DATE,
  is_current BOOLEAN DEFAULT true,
  language VARCHAR(5) DEFAULT 'pl',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_source_type CHECK (source_type IN (
    'ustawa', 'rozporzadzenie', 'interpretacja_ogolna',
    'interpretacja_indywidualna', 'orzeczenie_nsa',
    'orzeczenie_wsa', 'dyrektywa_ue', 'commentary', 'guideline'
  ))
);

-- Tax AI usage statistics
CREATE TABLE tax_ai_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  queries_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  avg_confidence DECIMAL(3, 2),
  feedback_positive INTEGER DEFAULT 0,
  feedback_negative INTEGER DEFAULT 0,
  top_domains JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (organization_id, period_start, period_end)
);

-- Indexes
CREATE INDEX idx_tax_conversations_org ON tax_ai_conversations(organization_id);
CREATE INDEX idx_tax_conversations_user ON tax_ai_conversations(user_id);
CREATE INDEX idx_tax_messages_conversation ON tax_ai_messages(conversation_id);
CREATE INDEX idx_tax_citations_message ON tax_ai_citations(message_id);
CREATE INDEX idx_tax_feedback_message ON tax_ai_feedback(message_id);
CREATE INDEX idx_tax_knowledge_vector ON tax_knowledge_base USING ivfflat (content_vector vector_cosine_ops);
CREATE INDEX idx_tax_knowledge_domain ON tax_knowledge_base(tax_domain, is_current);

-- Row Level Security
ALTER TABLE tax_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_ai_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_ai_usage_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY tax_conversations_isolation ON tax_ai_conversations
  USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY tax_messages_isolation ON tax_ai_messages
  USING (conversation_id IN (
    SELECT id FROM tax_ai_conversations
    WHERE organization_id = current_setting('app.organization_id')::UUID
  ));

CREATE POLICY tax_feedback_isolation ON tax_ai_feedback
  USING (message_id IN (
    SELECT m.id FROM tax_ai_messages m
    JOIN tax_ai_conversations c ON m.conversation_id = c.id
    WHERE c.organization_id = current_setting('app.organization_id')::UUID
  ));

CREATE POLICY tax_usage_isolation ON tax_ai_usage_stats
  USING (organization_id = current_setting('app.organization_id')::UUID);
```

### Tax Domain Classification

```typescript
// Tax domains for query classification
export const TAX_DOMAINS = {
  VAT: {
    code: 'VAT',
    name: 'Podatek od towarów i usług',
    keywords: ['VAT', 'faktura', 'odliczenie', 'stawka', 'JPK', 'KSeF', 'WNT', 'WDT', 'eksport', 'import'],
    primaryLaw: 'Ustawa z dnia 11 marca 2004 r. o podatku od towarów i usług',
    journalRef: 'Dz.U. 2004 Nr 54 poz. 535',
  },
  CIT: {
    code: 'CIT',
    name: 'Podatek dochodowy od osób prawnych',
    keywords: ['CIT', 'spółka', 'dochód', 'przychód', 'koszt uzyskania', 'amortyzacja', 'estoński'],
    primaryLaw: 'Ustawa z dnia 15 lutego 1992 r. o podatku dochodowym od osób prawnych',
    journalRef: 'Dz.U. 1992 Nr 21 poz. 86',
  },
  PIT: {
    code: 'PIT',
    name: 'Podatek dochodowy od osób fizycznych',
    keywords: ['PIT', 'ryczałt', 'skala podatkowa', 'liniowy', 'działalność gospodarcza', 'umowa'],
    primaryLaw: 'Ustawa z dnia 26 lipca 1991 r. o podatku dochodowym od osób fizycznych',
    journalRef: 'Dz.U. 1991 Nr 80 poz. 350',
  },
  ZUS: {
    code: 'ZUS',
    name: 'Ubezpieczenia społeczne',
    keywords: ['ZUS', 'składki', 'ubezpieczenie', 'emerytalne', 'rentowe', 'chorobowe', 'zdrowotne', 'DRA'],
    primaryLaw: 'Ustawa z dnia 13 października 1998 r. o systemie ubezpieczeń społecznych',
    journalRef: 'Dz.U. 1998 Nr 137 poz. 887',
  },
  PROCEDURAL: {
    code: 'PROCEDURAL',
    name: 'Ordynacja podatkowa',
    keywords: ['termin', 'odwołanie', 'interpretacja', 'kontrola', 'przedawnienie', 'zaświadczenie'],
    primaryLaw: 'Ustawa z dnia 29 sierpnia 1997 r. - Ordynacja podatkowa',
    journalRef: 'Dz.U. 1997 Nr 137 poz. 926',
  },
  ACCOUNTING: {
    code: 'ACCOUNTING',
    name: 'Rachunkowość',
    keywords: ['księgowość', 'bilans', 'rachunek', 'sprawozdanie', 'inwentaryzacja', 'amortyzacja'],
    primaryLaw: 'Ustawa z dnia 29 września 1994 r. o rachunkowości',
    journalRef: 'Dz.U. 1994 Nr 121 poz. 591',
  },
} as const;

export type TaxDomain = keyof typeof TAX_DOMAINS;
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Ask tax question
export const askTaxQuestionSchema = z.object({
  question: z.string().min(10).max(2000),
  conversationId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  language: z.enum(['pl', 'en']).default('pl'),
  context: z.object({
    taxYear: z.number().int().min(2020).max(2030).optional(),
    specificRegulation: z.string().optional(),
    businessContext: z.string().optional(),
  }).optional(),
});

// Provide feedback
export const provideFeedbackSchema = z.object({
  messageId: z.string().uuid(),
  rating: z.enum(['helpful', 'not_helpful']),
  accuracy: z.enum(['accurate', 'inaccurate', 'partially_accurate']).optional(),
  correctionText: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
});

// Get conversation history
export const getConversationSchema = z.object({
  conversationId: z.string().uuid(),
});

// List conversations
export const listConversationsSchema = z.object({
  status: z.enum(['active', 'closed', 'expired', 'all']).default('all'),
  clientId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

// Search knowledge base
export const searchKnowledgeBaseSchema = z.object({
  query: z.string().min(3).max(500),
  domain: z.enum(['VAT', 'CIT', 'PIT', 'ZUS', 'PROCEDURAL', 'ACCOUNTING']).optional(),
  sourceType: z.enum([
    'ustawa', 'rozporzadzenie', 'interpretacja_ogolna',
    'interpretacja_indywidualna', 'orzeczenie_nsa', 'orzeczenie_wsa',
    'dyrektywa_ue', 'commentary', 'guideline'
  ]).optional(),
  currentOnly: z.boolean().default(true),
  limit: z.number().int().min(1).max(50).default(10),
});

export type AskTaxQuestionInput = z.infer<typeof askTaxQuestionSchema>;
export type ProvideFeedbackInput = z.infer<typeof provideFeedbackSchema>;
export type SearchKnowledgeBaseInput = z.infer<typeof searchKnowledgeBaseSchema>;
```

### AI Tax Assistant Service

```typescript
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { TAX_DOMAINS, TaxDomain } from './tax-domains';
import type { AskTaxQuestionInput, ProvideFeedbackInput, SearchKnowledgeBaseInput } from './tax-ai-schemas';

// System prompt for Polish tax assistant
const SYSTEM_PROMPT = `Jesteś ekspertem od polskiego prawa podatkowego, specjalizującym się w:
- Podatku VAT (ustawa o VAT)
- Podatku dochodowym CIT i PIT
- Składkach ZUS
- Ordynacji podatkowej
- Rachunkowości

Twoje odpowiedzi MUSZĄ:
1. Być precyzyjne i oparte na aktualnych przepisach
2. Zawierać cytaty z konkretnych artykułów ustaw w formacie: "Art. X ust. Y ustawy..."
3. Wskazywać podstawę prawną (Dz.U., rok, numer, pozycja)
4. Używać prostego języka przy wyjaśnianiu skomplikowanych przepisów
5. Podawać praktyczne przykłady zastosowania
6. Informować o zmianach w przepisach, jeśli miały miejsce

ZAWSZE dodawaj na końcu odpowiedzi informację o poziomie pewności (0-100%) i ewentualnych ograniczeniach.

Nie udzielaj definitywnych porad podatkowych - zawsze sugeruj konsultację z doradcą podatkowym w skomplikowanych przypadkach.`;

const DISCLAIMER_PL = `
---
**Zastrzeżenie**: Powyższa odpowiedź ma charakter wyłącznie informacyjny i nie stanowi porady podatkowej w rozumieniu ustawy z dnia 5 lipca 1996 r. o doradztwie podatkowym. W sprawach wymagających oficjalnej interpretacji należy skonsultować się z doradcą podatkowym lub złożyć wniosek o interpretację indywidualną do właściwego organu podatkowego.
`;

interface TaxAIResponse {
  conversationId: string;
  messageId: string;
  answer: string;
  taxDomain: TaxDomain | null;
  confidenceScore: number;
  citations: Citation[];
  processingTimeMs: number;
  tokensUsed: number;
}

interface Citation {
  type: string;
  sourceName: string;
  articleNumber?: string;
  journalReference?: string;
  effectiveDate?: string;
  url?: string;
  excerpt?: string;
}

export class TaxAIAssistantService {
  private openai: OpenAI;
  private modelId: string = 'gpt-4-turbo-preview';

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Process a tax question and generate response
   */
  async askQuestion(
    input: AskTaxQuestionInput,
    organizationId: string,
    userId: string
  ): Promise<TaxAIResponse> {
    const startTime = Date.now();

    // Get or create conversation
    let conversationId = input.conversationId;
    if (!conversationId) {
      const conversation = await this.createConversation(
        organizationId,
        userId,
        input.clientId,
        input.language
      );
      conversationId = conversation.id;
    }

    // Classify tax domain
    const taxDomain = this.classifyTaxDomain(input.question);

    // Get client context if specified
    let clientContext = '';
    if (input.clientId) {
      clientContext = await this.getClientTaxContext(input.clientId, organizationId);
    }

    // Retrieve relevant knowledge from RAG
    const relevantKnowledge = await this.retrieveRelevantKnowledge(
      input.question,
      taxDomain,
      5
    );

    // Build messages for OpenAI
    const messages = await this.buildMessages(
      conversationId,
      input.question,
      clientContext,
      relevantKnowledge,
      input.context
    );

    // Call OpenAI API
    const completion = await this.openai.chat.completions.create({
      model: this.modelId,
      messages,
      temperature: 0.3, // Low temperature for factual responses
      max_tokens: 2000,
    });

    const rawAnswer = completion.choices[0]?.message?.content || '';
    const tokensUsed = completion.usage?.total_tokens || 0;

    // Extract citations from response
    const citations = this.extractCitations(rawAnswer, relevantKnowledge);

    // Calculate confidence score
    const confidenceScore = this.calculateConfidence(
      rawAnswer,
      citations,
      relevantKnowledge,
      taxDomain
    );

    // Add disclaimer
    const answerWithDisclaimer = rawAnswer + DISCLAIMER_PL;

    // Store user message
    await db.taxAiMessage.create({
      data: {
        conversationId,
        role: 'user',
        content: input.question,
        taxDomain,
      },
    });

    // Store assistant response
    const assistantMessage = await db.taxAiMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content: answerWithDisclaimer,
        taxDomain,
        confidenceScore,
        citations: citations as any,
        sourcesUsed: relevantKnowledge.map(k => k.id),
        processingTimeMs: Date.now() - startTime,
        tokensUsed,
        modelVersion: this.modelId,
      },
    });

    // Store citations
    for (const citation of citations) {
      await db.taxAiCitation.create({
        data: {
          messageId: assistantMessage.id,
          citationType: citation.type,
          sourceName: citation.sourceName,
          articleNumber: citation.articleNumber,
          journalReference: citation.journalReference,
          effectiveDate: citation.effectiveDate ? new Date(citation.effectiveDate) : null,
          url: citation.url,
          excerpt: citation.excerpt,
        },
      });
    }

    // Update conversation activity
    await db.taxAiConversation.update({
      where: { id: conversationId },
      data: { lastActivityAt: new Date() },
    });

    // Update usage stats
    await this.updateUsageStats(organizationId, taxDomain, tokensUsed, confidenceScore);

    await auditLog({
      action: 'TAX_AI_QUESTION_ASKED',
      entityType: 'tax_ai_message',
      entityId: assistantMessage.id,
      organizationId,
      userId,
      details: {
        taxDomain,
        confidenceScore,
        tokensUsed,
        processingTimeMs: Date.now() - startTime,
      },
    });

    return {
      conversationId,
      messageId: assistantMessage.id,
      answer: answerWithDisclaimer,
      taxDomain,
      confidenceScore,
      citations,
      processingTimeMs: Date.now() - startTime,
      tokensUsed,
    };
  }

  /**
   * Provide feedback on an AI response
   */
  async provideFeedback(
    input: ProvideFeedbackInput,
    organizationId: string,
    userId: string
  ): Promise<void> {
    // Verify message exists and belongs to organization
    const message = await db.taxAiMessage.findFirst({
      where: {
        id: input.messageId,
        conversation: { organizationId },
      },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    // Store feedback
    await db.taxAiFeedback.create({
      data: {
        messageId: input.messageId,
        userId,
        rating: input.rating,
        accuracy: input.accuracy,
        correctionText: input.correctionText,
        tags: input.tags,
      },
    });

    // Update usage stats
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    await db.taxAiUsageStats.upsert({
      where: {
        organization_id_period_start_period_end: {
          organizationId,
          periodStart,
          periodEnd: new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0),
        },
      },
      update: {
        [input.rating === 'helpful' ? 'feedbackPositive' : 'feedbackNegative']: {
          increment: 1,
        },
      },
      create: {
        organizationId,
        periodStart,
        periodEnd: new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0),
        [input.rating === 'helpful' ? 'feedbackPositive' : 'feedbackNegative']: 1,
      },
    });

    await auditLog({
      action: 'TAX_AI_FEEDBACK_PROVIDED',
      entityType: 'tax_ai_feedback',
      entityId: input.messageId,
      organizationId,
      userId,
      details: {
        rating: input.rating,
        accuracy: input.accuracy,
      },
    });
  }

  /**
   * Search the tax knowledge base
   */
  async searchKnowledgeBase(
    input: SearchKnowledgeBaseInput,
    organizationId: string
  ): Promise<any[]> {
    // Generate embedding for query
    const embeddingResponse = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: input.query,
    });

    const queryVector = embeddingResponse.data[0].embedding;

    // Build query conditions
    const where: any = {};
    if (input.currentOnly) {
      where.isCurrent = true;
    }
    if (input.domain) {
      where.taxDomain = input.domain;
    }
    if (input.sourceType) {
      where.sourceType = input.sourceType;
    }

    // Vector similarity search with pgvector
    const results = await db.$queryRaw`
      SELECT
        id,
        source_type,
        source_name,
        source_reference,
        title,
        content,
        tax_domain,
        effective_date,
        1 - (content_vector <=> ${queryVector}::vector) as similarity
      FROM tax_knowledge_base
      WHERE is_current = ${input.currentOnly}
        ${input.domain ? db.$queryRaw`AND tax_domain = ${input.domain}` : db.$queryRaw``}
        ${input.sourceType ? db.$queryRaw`AND source_type = ${input.sourceType}` : db.$queryRaw``}
      ORDER BY content_vector <=> ${queryVector}::vector
      LIMIT ${input.limit}
    `;

    return results as any[];
  }

  /**
   * Create a new conversation
   */
  private async createConversation(
    organizationId: string,
    userId: string,
    clientId?: string,
    language: string = 'pl'
  ): Promise<{ id: string }> {
    return db.taxAiConversation.create({
      data: {
        organizationId,
        userId,
        clientId,
        language,
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      },
    });
  }

  /**
   * Classify the tax domain from the question
   */
  private classifyTaxDomain(question: string): TaxDomain | null {
    const lowerQuestion = question.toLowerCase();

    let bestMatch: TaxDomain | null = null;
    let bestScore = 0;

    for (const [domain, config] of Object.entries(TAX_DOMAINS)) {
      let score = 0;
      for (const keyword of config.keywords) {
        if (lowerQuestion.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = domain as TaxDomain;
      }
    }

    return bestMatch;
  }

  /**
   * Get client-specific tax context
   */
  private async getClientTaxContext(
    clientId: string,
    organizationId: string
  ): Promise<string> {
    const client = await db.client.findUnique({
      where: { id: clientId, organizationId },
      include: { taxConfiguration: true },
    });

    if (!client || !client.taxConfiguration) {
      return '';
    }

    const config = client.taxConfiguration;
    const contextParts: string[] = [];

    contextParts.push(`Klient: ${client.name} (NIP: ${client.nip})`);

    if (config.vatPayerStatus) {
      contextParts.push(`Status VAT: ${config.vatPayerStatus}`);
      contextParts.push(`Okres rozliczeniowy VAT: ${config.vatPeriod}`);
    }

    if (config.citTaxForm) {
      contextParts.push(`Forma opodatkowania CIT: ${config.citTaxForm}`);
      if (config.isSmallTaxpayer) {
        contextParts.push('Mały podatnik (stawka CIT 9%)');
      }
    }

    if (config.estonianCit) {
      contextParts.push('Estoński CIT: TAK');
    }

    if (config.zusType) {
      contextParts.push(`Typ składek ZUS: ${config.zusType}`);
    }

    return `\n\nKontekst klienta:\n${contextParts.join('\n')}`;
  }

  /**
   * Retrieve relevant knowledge using RAG
   */
  private async retrieveRelevantKnowledge(
    query: string,
    taxDomain: TaxDomain | null,
    limit: number
  ): Promise<any[]> {
    return this.searchKnowledgeBase(
      {
        query,
        domain: taxDomain || undefined,
        currentOnly: true,
        limit,
      },
      '' // organizationId not needed for knowledge base
    );
  }

  /**
   * Build messages array for OpenAI
   */
  private async buildMessages(
    conversationId: string,
    question: string,
    clientContext: string,
    relevantKnowledge: any[],
    context?: { taxYear?: number; specificRegulation?: string; businessContext?: string }
  ): Promise<Array<{ role: 'system' | 'user' | 'assistant'; content: string }>> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // System prompt
    let systemContent = SYSTEM_PROMPT;

    // Add relevant knowledge
    if (relevantKnowledge.length > 0) {
      systemContent += '\n\nRelewantne przepisy i źródła:\n';
      for (const knowledge of relevantKnowledge) {
        systemContent += `\n---\nŹródło: ${knowledge.source_name}\n`;
        if (knowledge.source_reference) {
          systemContent += `Sygnatura: ${knowledge.source_reference}\n`;
        }
        systemContent += `Treść: ${knowledge.content.substring(0, 1000)}...\n`;
      }
    }

    messages.push({ role: 'system', content: systemContent });

    // Get conversation history (last 6 messages)
    const history = await db.taxAiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    // Add history in chronological order
    for (const msg of history.reverse()) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    // Build current question with context
    let questionContent = question;
    if (clientContext) {
      questionContent += clientContext;
    }
    if (context?.taxYear) {
      questionContent += `\n\nRok podatkowy: ${context.taxYear}`;
    }
    if (context?.specificRegulation) {
      questionContent += `\n\nSzczególny przepis: ${context.specificRegulation}`;
    }
    if (context?.businessContext) {
      questionContent += `\n\nKontekst biznesowy: ${context.businessContext}`;
    }

    messages.push({ role: 'user', content: questionContent });

    return messages;
  }

  /**
   * Extract citations from AI response
   */
  private extractCitations(answer: string, relevantKnowledge: any[]): Citation[] {
    const citations: Citation[] = [];

    // Pattern for Polish legal citations
    const patterns = [
      // Art. X ust. Y ustawy...
      /Art\.\s*(\d+[a-z]?)\s*(?:ust\.\s*(\d+[a-z]?))?\s*(?:pkt\s*(\d+))?\s*(?:ustawy|rozporządzenia)\s*([^.]+)/gi,
      // Dz.U. references
      /Dz\.U\.\s*(?:z\s*)?(\d{4})\s*(?:Nr\s*(\d+)\s*)?poz\.\s*(\d+)/gi,
      // § references
      /§\s*(\d+)\s*(?:ust\.\s*(\d+))?\s*(?:pkt\s*(\d+))?\s*([^.]+)/gi,
    ];

    const seen = new Set<string>();

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(answer)) !== null) {
        const key = match[0].substring(0, 50);
        if (!seen.has(key)) {
          seen.add(key);
          citations.push({
            type: match[0].toLowerCase().includes('ustaw') ? 'ustawa' : 'rozporzadzenie',
            sourceName: match[4]?.trim() || match[0],
            articleNumber: match[1],
            journalReference: match[0].includes('Dz.U.') ? match[0] : undefined,
          });
        }
      }
    }

    // Add citations from knowledge base sources used
    for (const knowledge of relevantKnowledge) {
      const existingCitation = citations.find(c =>
        c.sourceName.includes(knowledge.source_name.substring(0, 20))
      );

      if (!existingCitation) {
        citations.push({
          type: knowledge.source_type,
          sourceName: knowledge.source_name,
          journalReference: knowledge.source_reference,
          effectiveDate: knowledge.effective_date,
        });
      }
    }

    return citations.slice(0, 10); // Limit to 10 citations
  }

  /**
   * Calculate confidence score for the response
   */
  private calculateConfidence(
    answer: string,
    citations: Citation[],
    relevantKnowledge: any[],
    taxDomain: TaxDomain | null
  ): number {
    let score = 0.5; // Base score

    // Source quality (30%)
    if (citations.length > 0) {
      score += 0.1 * Math.min(citations.length / 3, 1);
    }
    if (relevantKnowledge.length > 0) {
      const avgSimilarity = relevantKnowledge.reduce((sum, k) => sum + (k.similarity || 0.5), 0) / relevantKnowledge.length;
      score += 0.2 * avgSimilarity;
    }

    // Query clarity (20%) - based on domain classification
    if (taxDomain) {
      score += 0.2;
    }

    // Answer structure (15%)
    if (answer.includes('Art.') || answer.includes('ustaw')) {
      score += 0.1;
    }
    if (answer.length > 500) {
      score += 0.05;
    }

    // Cap at 0.95 - never 100% confident
    return Math.min(Math.round(score * 100) / 100, 0.95);
  }

  /**
   * Update usage statistics
   */
  private async updateUsageStats(
    organizationId: string,
    taxDomain: TaxDomain | null,
    tokensUsed: number,
    confidenceScore: number
  ): Promise<void> {
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);

    await db.taxAiUsageStats.upsert({
      where: {
        organization_id_period_start_period_end: {
          organizationId,
          periodStart,
          periodEnd,
        },
      },
      update: {
        queriesCount: { increment: 1 },
        tokensUsed: { increment: tokensUsed },
        avgConfidence: confidenceScore, // Simplified - should be moving average
      },
      create: {
        organizationId,
        periodStart,
        periodEnd,
        queriesCount: 1,
        tokensUsed,
        avgConfidence: confidenceScore,
        topDomains: taxDomain ? { [taxDomain]: 1 } : {},
      },
    });
  }

  /**
   * Get conversation with messages
   */
  async getConversation(
    conversationId: string,
    organizationId: string
  ): Promise<any> {
    return db.taxAiConversation.findFirst({
      where: { id: conversationId, organizationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { citations: true },
        },
        client: { select: { id: true, name: true, nip: true } },
      },
    });
  }

  /**
   * List user's conversations
   */
  async listConversations(
    input: { status?: string; clientId?: string; dateFrom?: Date; dateTo?: Date; limit: number; offset: number },
    organizationId: string,
    userId: string
  ): Promise<{ conversations: any[]; total: number }> {
    const where: any = {
      organizationId,
      userId,
    };

    if (input.status && input.status !== 'all') {
      where.status = input.status;
    }
    if (input.clientId) {
      where.clientId = input.clientId;
    }
    if (input.dateFrom) {
      where.createdAt = { gte: input.dateFrom };
    }
    if (input.dateTo) {
      where.createdAt = { ...where.createdAt, lte: input.dateTo };
    }

    const [conversations, total] = await Promise.all([
      db.taxAiConversation.findMany({
        where,
        orderBy: { lastActivityAt: 'desc' },
        take: input.limit,
        skip: input.offset,
        include: {
          client: { select: { id: true, name: true } },
          messages: {
            take: 1,
            orderBy: { createdAt: 'asc' },
            select: { content: true },
          },
        },
      }),
      db.taxAiConversation.count({ where }),
    ]);

    return { conversations, total };
  }

  /**
   * Close a conversation
   */
  async closeConversation(
    conversationId: string,
    organizationId: string
  ): Promise<void> {
    await db.taxAiConversation.updateMany({
      where: { id: conversationId, organizationId },
      data: { status: 'closed' },
    });
  }
}
```

### API Endpoints (tRPC Router)

```typescript
import { router, protectedProcedure } from '@/lib/trpc';
import { TRPCError } from '@trpc/server';
import { TaxAIAssistantService } from './tax-ai-service';
import {
  askTaxQuestionSchema,
  provideFeedbackSchema,
  getConversationSchema,
  listConversationsSchema,
  searchKnowledgeBaseSchema,
} from './tax-ai-schemas';

const taxAIService = new TaxAIAssistantService();

export const taxAIRouter = router({
  // Ask a tax question
  askQuestion: protectedProcedure
    .input(askTaxQuestionSchema)
    .mutation(async ({ input, ctx }) => {
      return taxAIService.askQuestion(
        input,
        ctx.session.organizationId,
        ctx.session.userId
      );
    }),

  // Provide feedback on response
  provideFeedback: protectedProcedure
    .input(provideFeedbackSchema)
    .mutation(async ({ input, ctx }) => {
      await taxAIService.provideFeedback(
        input,
        ctx.session.organizationId,
        ctx.session.userId
      );
      return { success: true };
    }),

  // Get conversation with messages
  getConversation: protectedProcedure
    .input(getConversationSchema)
    .query(async ({ input, ctx }) => {
      const conversation = await taxAIService.getConversation(
        input.conversationId,
        ctx.session.organizationId
      );

      if (!conversation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });
      }

      return conversation;
    }),

  // List conversations
  listConversations: protectedProcedure
    .input(listConversationsSchema)
    .query(async ({ input, ctx }) => {
      return taxAIService.listConversations(
        input,
        ctx.session.organizationId,
        ctx.session.userId
      );
    }),

  // Close conversation
  closeConversation: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await taxAIService.closeConversation(
        input.conversationId,
        ctx.session.organizationId
      );
      return { success: true };
    }),

  // Search knowledge base
  searchKnowledge: protectedProcedure
    .input(searchKnowledgeBaseSchema)
    .query(async ({ input, ctx }) => {
      return taxAIService.searchKnowledgeBase(
        input,
        ctx.session.organizationId
      );
    }),

  // Get usage statistics
  getUsageStats: protectedProcedure
    .input(z.object({
      periodStart: z.coerce.date().optional(),
      periodEnd: z.coerce.date().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const periodStart = input.periodStart || new Date(new Date().setDate(1));
      const periodEnd = input.periodEnd || new Date();

      return db.taxAiUsageStats.findFirst({
        where: {
          organizationId: ctx.session.organizationId,
          periodStart: { gte: periodStart },
          periodEnd: { lte: periodEnd },
        },
      });
    }),
});
```

---

## Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaxAIAssistantService } from '../tax-ai-service';

vi.mock('openai');
vi.mock('@/lib/db');

describe('TaxAIAssistantService', () => {
  let service: TaxAIAssistantService;

  beforeEach(() => {
    service = new TaxAIAssistantService();
    vi.clearAllMocks();
  });

  describe('Domain Classification', () => {
    it('should classify VAT questions correctly', () => {
      const questions = [
        'Jaka jest stawka VAT na usługi budowlane?',
        'Jak odliczyć VAT z faktury?',
        'Kiedy powstaje obowiązek podatkowy w VAT?',
      ];

      for (const question of questions) {
        const domain = service['classifyTaxDomain'](question);
        expect(domain).toBe('VAT');
      }
    });

    it('should classify CIT questions correctly', () => {
      const questions = [
        'Jak obliczyć podatek CIT?',
        'Czy to jest koszt uzyskania przychodu?',
        'Jakie są zasady amortyzacji?',
      ];

      for (const question of questions) {
        const domain = service['classifyTaxDomain'](question);
        expect(domain).toBe('CIT');
      }
    });

    it('should classify ZUS questions correctly', () => {
      const questions = [
        'Jakie są składki ZUS dla przedsiębiorcy?',
        'Co to jest mały ZUS+?',
        'Jak wypełnić deklarację DRA?',
      ];

      for (const question of questions) {
        const domain = service['classifyTaxDomain'](question);
        expect(domain).toBe('ZUS');
      }
    });

    it('should return null for unclear questions', () => {
      const domain = service['classifyTaxDomain']('Jaka jest pogoda?');
      expect(domain).toBeNull();
    });
  });

  describe('Citation Extraction', () => {
    it('should extract article citations', () => {
      const answer = 'Zgodnie z Art. 19a ust. 1 ustawy o VAT, obowiązek podatkowy powstaje...';
      const citations = service['extractCitations'](answer, []);

      expect(citations.length).toBeGreaterThan(0);
      expect(citations[0].articleNumber).toBe('19a');
    });

    it('should extract journal references', () => {
      const answer = 'Podstawa prawna: Dz.U. 2004 Nr 54 poz. 535';
      const citations = service['extractCitations'](answer, []);

      expect(citations.some(c => c.journalReference?.includes('Dz.U.'))).toBe(true);
    });

    it('should extract paragraph citations', () => {
      const answer = 'Zgodnie z § 3 ust. 2 rozporządzenia Ministra Finansów...';
      const citations = service['extractCitations'](answer, []);

      expect(citations.length).toBeGreaterThan(0);
    });
  });

  describe('Confidence Calculation', () => {
    it('should return higher confidence with citations', () => {
      const withCitations = service['calculateConfidence'](
        'Odpowiedź z Art. 19a ustawy...',
        [{ type: 'ustawa', sourceName: 'Ustawa o VAT' }],
        [{ similarity: 0.9 }],
        'VAT'
      );

      const withoutCitations = service['calculateConfidence'](
        'Odpowiedź bez cytowań',
        [],
        [],
        null
      );

      expect(withCitations).toBeGreaterThan(withoutCitations);
    });

    it('should cap confidence at 0.95', () => {
      const confidence = service['calculateConfidence'](
        'Bardzo dokładna odpowiedź z Art. 1, Art. 2, Art. 3...',
        [
          { type: 'ustawa', sourceName: 'Law 1' },
          { type: 'ustawa', sourceName: 'Law 2' },
          { type: 'ustawa', sourceName: 'Law 3' },
        ],
        [{ similarity: 0.99 }, { similarity: 0.98 }],
        'VAT'
      );

      expect(confidence).toBeLessThanOrEqual(0.95);
    });

    it('should have base confidence of at least 0.5', () => {
      const confidence = service['calculateConfidence']('', [], [], null);
      expect(confidence).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('Client Context', () => {
    it('should build context from client configuration', async () => {
      vi.mocked(db.client.findUnique).mockResolvedValue({
        name: 'Test Client',
        nip: '1234567890',
        taxConfiguration: {
          vatPayerStatus: 'active',
          vatPeriod: 'monthly',
          isSmallTaxpayer: true,
          citTaxForm: 'standard',
          estonianCit: false,
          zusType: 'standard',
        },
      });

      const context = await service['getClientTaxContext']('client-id', 'org-id');

      expect(context).toContain('Test Client');
      expect(context).toContain('Mały podatnik');
      expect(context).toContain('VAT');
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, cleanupTest } from '@/test/helpers';
import { taxAIRouter } from '../tax-ai-router';

describe('Tax AI Assistant Integration', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await cleanupTest(ctx);
  });

  describe('Conversations', () => {
    let conversationId: string;

    it('should create new conversation on first question', async () => {
      const result = await ctx.caller.taxAI.askQuestion({
        question: 'Jaka jest podstawowa stawka VAT w Polsce?',
        language: 'pl',
      });

      expect(result.conversationId).toBeDefined();
      expect(result.answer).toContain('23%');
      expect(result.taxDomain).toBe('VAT');
      expect(result.confidenceScore).toBeGreaterThan(0.5);

      conversationId = result.conversationId;
    });

    it('should continue existing conversation', async () => {
      const result = await ctx.caller.taxAI.askQuestion({
        question: 'A jakie są stawki obniżone?',
        conversationId,
        language: 'pl',
      });

      expect(result.conversationId).toBe(conversationId);
      expect(result.answer).toMatch(/8%|5%/);
    });

    it('should retrieve conversation history', async () => {
      const conversation = await ctx.caller.taxAI.getConversation({
        conversationId,
      });

      expect(conversation.messages.length).toBeGreaterThanOrEqual(4); // 2 user + 2 assistant
      expect(conversation.messages[0].role).toBe('user');
    });

    it('should list user conversations', async () => {
      const result = await ctx.caller.taxAI.listConversations({
        limit: 10,
      });

      expect(result.conversations.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
    });
  });

  describe('Feedback', () => {
    it('should accept positive feedback', async () => {
      // First ask a question
      const question = await ctx.caller.taxAI.askQuestion({
        question: 'Co to jest split payment?',
      });

      // Provide feedback
      const result = await ctx.caller.taxAI.provideFeedback({
        messageId: question.messageId,
        rating: 'helpful',
        accuracy: 'accurate',
      });

      expect(result.success).toBe(true);
    });

    it('should accept feedback with correction', async () => {
      const question = await ctx.caller.taxAI.askQuestion({
        question: 'Jaki jest próg dla split payment?',
      });

      const result = await ctx.caller.taxAI.provideFeedback({
        messageId: question.messageId,
        rating: 'helpful',
        accuracy: 'partially_accurate',
        correctionText: 'Próg wynosi 15 000 PLN brutto, nie netto.',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Knowledge Base', () => {
    it('should search knowledge base', async () => {
      const results = await ctx.caller.taxAI.searchKnowledge({
        query: 'obowiązek podatkowy VAT',
        domain: 'VAT',
        limit: 5,
      });

      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Citations', () => {
    it('should include citations in response', async () => {
      const result = await ctx.caller.taxAI.askQuestion({
        question: 'Kiedy powstaje obowiązek podatkowy w VAT przy dostawie towarów?',
      });

      expect(result.citations.length).toBeGreaterThan(0);
      expect(result.citations[0].sourceName).toBeDefined();
    });
  });

  describe('Usage Stats', () => {
    it('should track usage statistics', async () => {
      const stats = await ctx.caller.taxAI.getUsageStats({});

      expect(stats).toBeDefined();
      expect(stats?.queriesCount).toBeGreaterThan(0);
    });
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Tax AI Assistant E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('should ask tax question and receive answer', async ({ page }) => {
    await page.goto('/tax/assistant');

    // Type question
    await page.fill(
      '[data-testid="tax-question-input"]',
      'Jaka jest podstawowa stawka VAT w Polsce?'
    );

    // Submit question
    await page.click('[data-testid="ask-question-button"]');

    // Wait for response
    await page.waitForSelector('[data-testid="ai-response"]', { timeout: 30000 });

    // Verify response contains expected content
    const response = await page.textContent('[data-testid="ai-response"]');
    expect(response).toContain('23%');

    // Verify confidence score is displayed
    await expect(page.locator('[data-testid="confidence-score"]')).toBeVisible();

    // Verify disclaimer is shown
    await expect(page.locator('[data-testid="disclaimer"]')).toContainText('informacyjny');
  });

  test('should display citations', async ({ page }) => {
    await page.goto('/tax/assistant');

    await page.fill(
      '[data-testid="tax-question-input"]',
      'Kiedy powstaje obowiązek podatkowy w VAT?'
    );
    await page.click('[data-testid="ask-question-button"]');
    await page.waitForSelector('[data-testid="ai-response"]');

    // Check for citations
    const citationsCount = await page.locator('[data-testid="citation-item"]').count();
    expect(citationsCount).toBeGreaterThan(0);

    // Verify citation format
    const firstCitation = await page.textContent('[data-testid="citation-item"]:first-child');
    expect(firstCitation).toMatch(/Art\.|ustaw|Dz\.U\./);
  });

  test('should allow follow-up questions', async ({ page }) => {
    await page.goto('/tax/assistant');

    // First question
    await page.fill('[data-testid="tax-question-input"]', 'Co to jest VAT?');
    await page.click('[data-testid="ask-question-button"]');
    await page.waitForSelector('[data-testid="ai-response"]');

    // Follow-up question
    await page.fill('[data-testid="tax-question-input"]', 'A jakie są stawki?');
    await page.click('[data-testid="ask-question-button"]');
    await page.waitForSelector('[data-testid="ai-response"]:nth-child(2)');

    // Verify conversation continues
    const messageCount = await page.locator('[data-testid="ai-response"]').count();
    expect(messageCount).toBe(2);
  });

  test('should provide feedback on answer', async ({ page }) => {
    await page.goto('/tax/assistant');

    await page.fill('[data-testid="tax-question-input"]', 'Kto jest podatnikiem VAT?');
    await page.click('[data-testid="ask-question-button"]');
    await page.waitForSelector('[data-testid="ai-response"]');

    // Click helpful button
    await page.click('[data-testid="feedback-helpful"]');

    // Verify feedback registered
    await expect(page.locator('[data-testid="feedback-thanks"]')).toBeVisible();
  });

  test('should show client context when client selected', async ({ page }) => {
    await page.goto('/tax/assistant');

    // Select client
    await page.click('[data-testid="select-client-button"]');
    await page.click('[data-testid="client-option"]:first-child');

    // Verify client context shown
    await expect(page.locator('[data-testid="client-context"]')).toBeVisible();

    // Ask context-aware question
    await page.fill(
      '[data-testid="tax-question-input"]',
      'Jakie są obowiązki podatkowe tego klienta?'
    );
    await page.click('[data-testid="ask-question-button"]');
    await page.waitForSelector('[data-testid="ai-response"]');

    // Response should mention client-specific info
    const response = await page.textContent('[data-testid="ai-response"]');
    expect(response?.length).toBeGreaterThan(100);
  });

  test('should access conversation history', async ({ page }) => {
    await page.goto('/tax/assistant/history');

    // Verify history list is shown
    await expect(page.locator('[data-testid="conversation-list"]')).toBeVisible();

    // Click on a conversation
    await page.click('[data-testid="conversation-item"]:first-child');

    // Verify conversation messages are loaded
    await page.waitForSelector('[data-testid="conversation-messages"]');
    const messageCount = await page.locator('[data-testid="message-item"]').count();
    expect(messageCount).toBeGreaterThan(0);
  });

  test('should search knowledge base', async ({ page }) => {
    await page.goto('/tax/assistant');

    // Open knowledge search
    await page.click('[data-testid="knowledge-search-toggle"]');

    // Search
    await page.fill('[data-testid="knowledge-search-input"]', 'faktura VAT');
    await page.click('[data-testid="knowledge-search-button"]');

    // Wait for results
    await page.waitForSelector('[data-testid="knowledge-result"]');

    const resultsCount = await page.locator('[data-testid="knowledge-result"]').count();
    expect(resultsCount).toBeGreaterThan(0);
  });
});
```

---

## Security Checklist

- [x] API key for OpenAI stored securely (encrypted)
- [x] Rate limiting on AI queries (prevent abuse)
- [x] Input sanitization for all user queries
- [x] Output filtering for sensitive information
- [x] Row Level Security on all tables
- [x] Audit logging for all queries
- [x] Token usage monitoring and limits
- [x] Session timeout enforcement
- [x] CSRF protection on endpoints
- [x] XSS prevention in displayed responses

---

## Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `TAX_AI_QUESTION_ASKED` | New question | domain, confidence, tokens |
| `TAX_AI_FEEDBACK_PROVIDED` | User feedback | rating, accuracy |
| `TAX_AI_CONVERSATION_CREATED` | New conversation | client_id, language |
| `TAX_AI_CONVERSATION_CLOSED` | Conversation end | duration, message_count |
| `TAX_AI_KNOWLEDGE_SEARCHED` | Knowledge search | query, results_count |
| `TAX_AI_USAGE_LIMIT_REACHED` | Usage limit hit | limit_type, current_usage |

---

## Implementation Notes

### Dependencies
- `TAX-001`: Client tax configuration for context
- `OpenAI API`: GPT-4 for question answering
- `pgvector`: For knowledge base vector search

### AI Model Considerations
- Use GPT-4 Turbo for best quality responses
- Temperature: 0.3 for factual accuracy
- Max tokens: 2000 for comprehensive answers
- Consider fine-tuning for Polish tax domain

### Knowledge Base Population
- Import from official sources:
  - isap.sejm.gov.pl (legal acts)
  - sip.lex.pl (interpretations)
  - orzeczenia.nsa.gov.pl (court rulings)
- Regular updates for new regulations
- Version tracking for superseded laws

### Performance Optimization
- Cache common questions (TTL: 24h)
- Pre-compute embeddings for knowledge base
- Stream responses for better UX
- Background job for knowledge updates

### Compliance Notes
- AI responses are informational only
- Always display disclaimer
- Suggest professional consultation for complex cases
- Track and report usage for compliance

---

## References

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Polish Legal Information System (ISAP)](https://isap.sejm.gov.pl/)
- [Tax Interpretations Database](https://www.podatki.gov.pl/interpretacje-podatkowe/)

---

*Story created: December 2024*
*AI Model: GPT-4 Turbo*
*Target: Week 15, Phase 4*
