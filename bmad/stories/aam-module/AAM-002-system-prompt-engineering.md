# Story: System Prompt Engineering

## Story Information

| Field | Value |
|-------|-------|
| Story ID | AAM-002 |
| Epic | AI Agent Module (AAM) |
| Title | System Prompt Engineering |
| Priority | P0 |
| Story Points | 5 |
| Status | Draft |
| Sprint | Sprint 1 - Foundation |

## User Story

**As a** Super Admin,
**I want to** create and manage system prompts with variables, examples, and constraints,
**So that** I can precisely control agent behavior and expertise for specific business domains.

## Acceptance Criteria

### AC1: Prompt Creation
```gherkin
Given I am on the agent configuration page
When I navigate to "System Prompt" tab
And I create a new prompt with:
  | Field | Value |
  | Content | "Jesteś ekspertem od polskiego prawa podatkowego..." |
  | Variables | clientName, taxYear, businessType |
  | Examples | sample conversation pairs |
  | Constraints | "Zawsze cytuj przepisy prawa" |
Then the prompt should be saved as version 1
And a preview should show the expanded prompt with sample values
```

### AC2: Variable Placeholders
```gherkin
Given I am editing a system prompt
When I add a variable placeholder using {{variableName}} syntax
Then the editor should highlight the variable
And I should be able to define:
  | Property | Description |
  | Name | Variable identifier |
  | Type | text, number, date, list |
  | Source | context, client, user |
  | Default | Fallback value |
  | Required | Whether variable must be provided |
And the prompt preview should show variable substitution
```

### AC3: Few-Shot Examples
```gherkin
Given I am configuring a prompt
When I add conversation examples:
  | User | "Jaka jest stawka VAT na usługi IT?" |
  | Assistant | "Standardowa stawka VAT na usługi IT wynosi 23%..." |
Then the examples should be stored as few-shot training
And the agent should use these examples to guide responses
And I should be able to add up to 10 examples
```

### AC4: Prompt Constraints
```gherkin
Given I am editing a prompt
When I add constraints:
  - "Zawsze odpowiadaj po polsku"
  - "Cytuj źródła prawne"
  - "Nie udzielaj porad inwestycyjnych"
Then the constraints should be appended to the system prompt
And the agent should follow these guidelines in responses
```

### AC5: Prompt Versioning
```gherkin
Given I have an active prompt (version 3)
When I modify the prompt content and save
Then a new version 4 should be created
And version 3 should be preserved in history
And I should be able to compare versions side-by-side
And I should be able to rollback to any previous version
```

### AC6: Prompt Testing
```gherkin
Given I have configured a prompt
When I click "Test Prompt"
And I enter a sample user message
Then I should see:
  - The fully expanded system prompt with variables filled
  - A simulated agent response
  - Token count for the prompt
  - Estimated cost per query
And I should be able to iterate on the prompt without activating it
```

### AC7: Prompt Templates
```gherkin
Given I am creating a new prompt
When I click "Use Template"
Then I should see preset templates:
  | Template | Description |
  | Tax Advisor | Polish tax regulations expert |
  | Document Analyst | Invoice and contract analysis |
  | Client Support | Portal assistance |
  | Bookkeeper | Accounting operations help |
And selecting a template should populate the prompt editor
And I should be able to customize the template
```

## Technical Specification

### Database Schema

```sql
-- System Prompts with versioning (from epic, detailed)
CREATE TABLE system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Prompt content
  content TEXT NOT NULL,

  -- Variables configuration
  variables JSONB DEFAULT '[]',
  -- Structure: [{ name, type, source, default, required, description }]

  -- Few-shot examples
  examples JSONB DEFAULT '[]',
  -- Structure: [{ user: string, assistant: string, context?: string }]

  -- Constraints/guidelines
  constraints JSONB DEFAULT '[]',
  -- Structure: [{ text: string, priority: 'required' | 'preferred' }]

  -- Versioning
  version INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT false,

  -- Metadata
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  change_notes TEXT,

  -- Only one active prompt per agent
  UNIQUE(agent_id, is_active) WHERE is_active = true
);

-- Prompt templates library
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  examples JSONB DEFAULT '[]',
  constraints JSONB DEFAULT '[]',
  recommended_model VARCHAR(50),
  recommended_temperature DECIMAL(2,1),
  is_official BOOLEAN DEFAULT false,
  locale VARCHAR(5) DEFAULT 'pl',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_prompts_agent_version ON system_prompts(agent_id, version DESC);
CREATE INDEX idx_prompts_agent_active ON system_prompts(agent_id) WHERE is_active = true;
CREATE INDEX idx_templates_category ON prompt_templates(category);
```

### Zod Schemas

```typescript
import { z } from 'zod';

export const VariableTypeSchema = z.enum(['text', 'number', 'date', 'list', 'boolean']);
export const VariableSourceSchema = z.enum(['context', 'client', 'user', 'system', 'manual']);

export const PromptVariableSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  type: VariableTypeSchema,
  source: VariableSourceSchema,
  default: z.string().optional(),
  required: z.boolean().default(false),
  description: z.string().max(200).optional(),
  validation: z.string().optional(), // Regex pattern for validation
});

export const ConversationExampleSchema = z.object({
  user: z.string().min(1).max(2000),
  assistant: z.string().min(1).max(4000),
  context: z.string().max(1000).optional(),
});

export const PromptConstraintSchema = z.object({
  text: z.string().min(1).max(500),
  priority: z.enum(['required', 'preferred']).default('preferred'),
});

export const CreatePromptSchema = z.object({
  content: z.string().min(10).max(10000),
  variables: z.array(PromptVariableSchema).max(20).default([]),
  examples: z.array(ConversationExampleSchema).max(10).default([]),
  constraints: z.array(PromptConstraintSchema).max(20).default([]),
  changeNotes: z.string().max(500).optional(),
});

export const UpdatePromptSchema = CreatePromptSchema;

export const TestPromptSchema = z.object({
  promptId: z.string().uuid().optional(), // Use specific version, or latest draft
  variableValues: z.record(z.string()).default({}),
  testMessage: z.string().min(1).max(2000),
  simulateResponse: z.boolean().default(true),
});

export type CreatePromptInput = z.infer<typeof CreatePromptSchema>;
export type UpdatePromptInput = z.infer<typeof UpdatePromptSchema>;
export type TestPromptInput = z.infer<typeof TestPromptSchema>;
```

### Service Implementation

```typescript
import { injectable, inject } from 'inversify';

@injectable()
export class PromptService implements IPromptService {
  constructor(
    @inject('PromptRepository') private promptRepo: IPromptRepository,
    @inject('TemplateRepository') private templateRepo: IPromptTemplateRepository,
    @inject('AgentService') private agentService: IAgentService,
    @inject('LLMService') private llmService: ILLMService,
    @inject('AuditService') private auditService: IAuditService,
  ) {}

  async createPrompt(
    tenantId: string,
    agentId: string,
    userId: string,
    input: CreatePromptInput
  ): Promise<SystemPrompt> {
    // Validate agent exists
    const agent = await this.agentService.getAgent(tenantId, agentId);
    if (!agent) {
      throw new NotFoundException('Agent nie został znaleziony');
    }

    // Validate variables in content
    this.validateVariablesInContent(input.content, input.variables);

    // Get next version number
    const latestVersion = await this.promptRepo.getLatestVersion(agentId);
    const newVersion = latestVersion ? latestVersion + 1 : 1;

    // Create prompt
    const prompt = await this.promptRepo.create({
      tenantId,
      agentId,
      content: input.content,
      variables: input.variables,
      examples: input.examples,
      constraints: input.constraints,
      version: newVersion,
      isActive: false,
      createdBy: userId,
      changeNotes: input.changeNotes,
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'PROMPT_CREATED',
      entityType: 'system_prompt',
      entityId: prompt.id,
      metadata: { agentId, version: newVersion },
    });

    return prompt;
  }

  async activatePrompt(
    tenantId: string,
    agentId: string,
    promptId: string,
    userId: string
  ): Promise<SystemPrompt> {
    const prompt = await this.promptRepo.findById(tenantId, promptId);
    if (!prompt || prompt.agentId !== agentId) {
      throw new NotFoundException('Prompt nie został znaleziony');
    }

    // Deactivate current active prompt
    await this.promptRepo.deactivateAllForAgent(agentId);

    // Activate selected prompt
    const activated = await this.promptRepo.update(promptId, { isActive: true });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'PROMPT_ACTIVATED',
      entityType: 'system_prompt',
      entityId: promptId,
      metadata: { agentId, version: prompt.version },
    });

    return activated;
  }

  async getActivePrompt(tenantId: string, agentId: string): Promise<SystemPrompt | null> {
    return this.promptRepo.findActiveForAgent(tenantId, agentId);
  }

  async getPromptVersions(tenantId: string, agentId: string): Promise<SystemPrompt[]> {
    return this.promptRepo.findAllVersionsForAgent(tenantId, agentId);
  }

  async compareVersions(
    tenantId: string,
    agentId: string,
    version1: number,
    version2: number
  ): Promise<PromptComparison> {
    const [prompt1, prompt2] = await Promise.all([
      this.promptRepo.findByVersion(agentId, version1),
      this.promptRepo.findByVersion(agentId, version2),
    ]);

    if (!prompt1 || !prompt2) {
      throw new NotFoundException('Jedna lub obie wersje nie istnieją');
    }

    return {
      version1: { ...prompt1, diff: null },
      version2: { ...prompt2, diff: null },
      contentDiff: this.generateDiff(prompt1.content, prompt2.content),
      variablesDiff: this.compareArrays(prompt1.variables, prompt2.variables),
      examplesDiff: this.compareArrays(prompt1.examples, prompt2.examples),
      constraintsDiff: this.compareArrays(prompt1.constraints, prompt2.constraints),
    };
  }

  async testPrompt(
    tenantId: string,
    agentId: string,
    input: TestPromptInput
  ): Promise<PromptTestResult> {
    const agent = await this.agentService.getAgent(tenantId, agentId);
    if (!agent) {
      throw new NotFoundException('Agent nie został znaleziony');
    }

    // Get prompt (specific version or latest)
    let prompt: SystemPrompt;
    if (input.promptId) {
      prompt = await this.promptRepo.findById(tenantId, input.promptId);
    } else {
      prompt = await this.promptRepo.findLatestForAgent(tenantId, agentId);
    }

    if (!prompt) {
      throw new NotFoundException('Prompt nie został znaleziony');
    }

    // Expand prompt with variables
    const expandedPrompt = this.expandPrompt(prompt, input.variableValues);

    // Calculate token count
    const tokenCount = await this.llmService.countTokens(expandedPrompt, agent.model);

    // Estimate cost
    const estimatedCost = this.calculatePromptCost(tokenCount, agent.model);

    // Optionally simulate response
    let simulatedResponse: string | null = null;
    let responseTokens = 0;

    if (input.simulateResponse) {
      const response = await this.llmService.complete({
        model: agent.model,
        messages: [
          { role: 'system', content: expandedPrompt },
          { role: 'user', content: input.testMessage },
        ],
        temperature: agent.temperature,
        maxTokens: Math.min(agent.maxTokens, 500), // Limit for testing
      });

      simulatedResponse = response.content;
      responseTokens = response.usage.completionTokens;
    }

    return {
      expandedPrompt,
      tokenCount: {
        system: tokenCount,
        user: await this.llmService.countTokens(input.testMessage, agent.model),
        total: tokenCount + responseTokens,
      },
      estimatedCost: {
        promptCost: estimatedCost,
        responseCost: this.calculateResponseCost(responseTokens, agent.model),
        totalCost: estimatedCost + this.calculateResponseCost(responseTokens, agent.model),
      },
      simulatedResponse,
      warnings: this.analyzePromptIssues(prompt, expandedPrompt),
    };
  }

  async listTemplates(category?: string, locale?: string): Promise<PromptTemplate[]> {
    return this.templateRepo.findAll({ category, locale: locale || 'pl' });
  }

  async useTemplate(
    tenantId: string,
    agentId: string,
    templateId: string,
    userId: string,
    customizations?: Partial<CreatePromptInput>
  ): Promise<SystemPrompt> {
    const template = await this.templateRepo.findById(templateId);
    if (!template) {
      throw new NotFoundException('Szablon nie został znaleziony');
    }

    // Merge template with customizations
    const promptInput: CreatePromptInput = {
      content: customizations?.content || template.content,
      variables: customizations?.variables || template.variables,
      examples: customizations?.examples || template.examples,
      constraints: customizations?.constraints || template.constraints,
      changeNotes: `Utworzono z szablonu: ${template.name}`,
    };

    return this.createPrompt(tenantId, agentId, userId, promptInput);
  }

  // Private helpers

  private validateVariablesInContent(content: string, variables: PromptVariable[]): void {
    const variablePattern = /\{\{(\w+)\}\}/g;
    const contentVariables = new Set<string>();

    let match;
    while ((match = variablePattern.exec(content)) !== null) {
      contentVariables.add(match[1]);
    }

    const definedVariables = new Set(variables.map(v => v.name));

    // Check for undefined variables in content
    for (const varName of contentVariables) {
      if (!definedVariables.has(varName)) {
        throw new BadRequestException(
          `Zmienna {{${varName}}} użyta w treści, ale nie zdefiniowana`
        );
      }
    }

    // Check for required variables not in content
    for (const variable of variables) {
      if (variable.required && !contentVariables.has(variable.name)) {
        throw new BadRequestException(
          `Wymagana zmienna {{${variable.name}}} nie jest użyta w treści`
        );
      }
    }
  }

  private expandPrompt(prompt: SystemPrompt, values: Record<string, string>): string {
    let expanded = prompt.content;

    // Replace variables
    for (const variable of prompt.variables) {
      const value = values[variable.name] || variable.default || `[${variable.name}]`;
      expanded = expanded.replace(new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g'), value);
    }

    // Append constraints
    if (prompt.constraints.length > 0) {
      const constraintSection = prompt.constraints
        .sort((a, b) => (a.priority === 'required' ? -1 : 1))
        .map(c => `- ${c.text}`)
        .join('\n');

      expanded += `\n\nZASADY DO PRZESTRZEGANIA:\n${constraintSection}`;
    }

    return expanded;
  }

  private analyzePromptIssues(prompt: SystemPrompt, expanded: string): string[] {
    const warnings: string[] = [];

    // Check token length
    if (expanded.length > 15000) {
      warnings.push('Prompt jest bardzo długi, może wpłynąć na jakość odpowiedzi');
    }

    // Check for unresolved variables
    if (/\{\{\w+\}\}/.test(expanded)) {
      warnings.push('Prompt zawiera nierozwinięte zmienne');
    }

    // Check for missing examples
    if (prompt.examples.length === 0) {
      warnings.push('Brak przykładów konwersacji (few-shot) może obniżyć jakość');
    }

    // Check for missing constraints
    if (prompt.constraints.length === 0) {
      warnings.push('Brak zdefiniowanych ograniczeń/zasad');
    }

    return warnings;
  }

  private calculatePromptCost(tokens: number, model: string): number {
    const rates: Record<string, number> = {
      'gpt-4-turbo': 0.01,
      'gpt-4': 0.03,
      'gpt-3.5-turbo': 0.0005,
      'claude-3-opus': 0.015,
      'claude-3-sonnet': 0.003,
      'claude-3-haiku': 0.00025,
    };
    const rate = rates[model] || 0.01;
    return (tokens / 1000) * rate;
  }

  private calculateResponseCost(tokens: number, model: string): number {
    const rates: Record<string, number> = {
      'gpt-4-turbo': 0.03,
      'gpt-4': 0.06,
      'gpt-3.5-turbo': 0.0015,
      'claude-3-opus': 0.075,
      'claude-3-sonnet': 0.015,
      'claude-3-haiku': 0.00125,
    };
    const rate = rates[model] || 0.03;
    return (tokens / 1000) * rate;
  }
}
```

### API Routes

```typescript
import { Router } from 'express';

export const promptRoutes = Router();

// Get all prompt versions for agent
promptRoutes.get('/agents/:agentId/prompts', async (req, res) => {
  const { tenantId } = req.context;
  const { agentId } = req.params;

  const prompts = await promptService.getPromptVersions(tenantId, agentId);
  res.json(prompts);
});

// Get active prompt
promptRoutes.get('/agents/:agentId/prompts/active', async (req, res) => {
  const { tenantId } = req.context;
  const { agentId } = req.params;

  const prompt = await promptService.getActivePrompt(tenantId, agentId);
  res.json(prompt);
});

// Create new prompt version
promptRoutes.post(
  '/agents/:agentId/prompts',
  validateRequest({ body: CreatePromptSchema }),
  async (req, res) => {
    const { tenantId, userId } = req.context;
    const { agentId } = req.params;

    const prompt = await promptService.createPrompt(tenantId, agentId, userId, req.body);
    res.status(201).json(prompt);
  }
);

// Activate specific prompt version
promptRoutes.post('/agents/:agentId/prompts/:promptId/activate', async (req, res) => {
  const { tenantId, userId } = req.context;
  const { agentId, promptId } = req.params;

  const prompt = await promptService.activatePrompt(tenantId, agentId, promptId, userId);
  res.json(prompt);
});

// Compare versions
promptRoutes.get('/agents/:agentId/prompts/compare', async (req, res) => {
  const { tenantId } = req.context;
  const { agentId } = req.params;
  const { v1, v2 } = req.query;

  const comparison = await promptService.compareVersions(
    tenantId,
    agentId,
    parseInt(v1 as string),
    parseInt(v2 as string)
  );
  res.json(comparison);
});

// Test prompt
promptRoutes.post(
  '/agents/:agentId/prompts/test',
  validateRequest({ body: TestPromptSchema }),
  async (req, res) => {
    const { tenantId } = req.context;
    const { agentId } = req.params;

    const result = await promptService.testPrompt(tenantId, agentId, req.body);
    res.json(result);
  }
);

// List templates
promptRoutes.get('/prompt-templates', async (req, res) => {
  const { category, locale } = req.query;

  const templates = await promptService.listTemplates(
    category as string,
    locale as string
  );
  res.json(templates);
});

// Use template
promptRoutes.post('/agents/:agentId/prompts/from-template', async (req, res) => {
  const { tenantId, userId } = req.context;
  const { agentId } = req.params;
  const { templateId, customizations } = req.body;

  const prompt = await promptService.useTemplate(
    tenantId,
    agentId,
    templateId,
    userId,
    customizations
  );
  res.status(201).json(prompt);
});
```

## Test Specification

### Unit Tests

```typescript
describe('PromptService', () => {
  describe('createPrompt', () => {
    it('should create prompt with incremented version', async () => {
      mockPromptRepo.getLatestVersion.mockResolvedValue(2);
      mockPromptRepo.create.mockImplementation(async (data) => ({
        id: 'prompt-1',
        ...data,
      }));

      const result = await service.createPrompt('tenant-1', 'agent-1', 'user-1', {
        content: 'Test prompt with {{variable}}',
        variables: [{ name: 'variable', type: 'text', source: 'context', required: true }],
      });

      expect(result.version).toBe(3);
    });

    it('should reject prompt with undefined variables', async () => {
      await expect(
        service.createPrompt('tenant-1', 'agent-1', 'user-1', {
          content: 'Test with {{undefined}}',
          variables: [],
        })
      ).rejects.toThrow('Zmienna {{undefined}} użyta w treści');
    });
  });

  describe('expandPrompt', () => {
    it('should replace all variables with provided values', () => {
      const prompt = {
        content: 'Witaj {{clientName}}, rok podatkowy {{taxYear}}',
        variables: [
          { name: 'clientName', type: 'text', source: 'context' },
          { name: 'taxYear', type: 'number', source: 'context' },
        ],
        constraints: [],
      };

      const expanded = service['expandPrompt'](prompt as any, {
        clientName: 'Jan Kowalski',
        taxYear: '2024',
      });

      expect(expanded).toContain('Jan Kowalski');
      expect(expanded).toContain('2024');
      expect(expanded).not.toContain('{{');
    });

    it('should use default values when not provided', () => {
      const prompt = {
        content: 'Język: {{language}}',
        variables: [
          { name: 'language', type: 'text', source: 'context', default: 'polski' },
        ],
        constraints: [],
      };

      const expanded = service['expandPrompt'](prompt as any, {});

      expect(expanded).toContain('polski');
    });
  });

  describe('testPrompt', () => {
    it('should return token counts and cost estimates', async () => {
      mockLLMService.countTokens.mockResolvedValue(500);
      mockLLMService.complete.mockResolvedValue({
        content: 'Test response',
        usage: { completionTokens: 100 },
      });

      const result = await service.testPrompt('tenant-1', 'agent-1', {
        testMessage: 'Test question',
        simulateResponse: true,
      });

      expect(result.tokenCount.system).toBe(500);
      expect(result.estimatedCost.promptCost).toBeGreaterThan(0);
      expect(result.simulatedResponse).toBe('Test response');
    });
  });
});
```

### Integration Tests

```typescript
describe('Prompt API Integration', () => {
  it('should support full prompt lifecycle', async () => {
    // Create agent first
    const agentRes = await request(app.getHttpServer())
      .post('/api/v1/agents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Prompt Test Agent', model: 'gpt-4', modelProvider: 'openai' })
      .expect(201);

    const agentId = agentRes.body.id;

    // Create prompt v1
    const v1Res = await request(app.getHttpServer())
      .post(`/api/v1/agents/${agentId}/prompts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        content: 'Jesteś pomocnym asystentem dla {{clientName}}.',
        variables: [{ name: 'clientName', type: 'text', source: 'context', required: true }],
      })
      .expect(201);

    expect(v1Res.body.version).toBe(1);

    // Create prompt v2
    const v2Res = await request(app.getHttpServer())
      .post(`/api/v1/agents/${agentId}/prompts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        content: 'Jesteś ekspertem podatkowym dla {{clientName}}.',
        variables: [{ name: 'clientName', type: 'text', source: 'context', required: true }],
        changeNotes: 'Zmiana roli na eksperta podatkowego',
      })
      .expect(201);

    expect(v2Res.body.version).toBe(2);

    // Activate v2
    await request(app.getHttpServer())
      .post(`/api/v1/agents/${agentId}/prompts/${v2Res.body.id}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Test prompt
    const testRes = await request(app.getHttpServer())
      .post(`/api/v1/agents/${agentId}/prompts/test`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        variableValues: { clientName: 'Test Client' },
        testMessage: 'Jaka jest stawka VAT?',
        simulateResponse: false,
      })
      .expect(200);

    expect(testRes.body.expandedPrompt).toContain('Test Client');
    expect(testRes.body.tokenCount).toBeDefined();
  });
});
```

## Security Checklist

- [x] Only Super Admin can manage prompts
- [x] Tenant isolation enforced
- [x] Input validation for prompt content and variables
- [x] Token counting prevents excessive prompt length
- [x] Cost estimation before activation
- [x] Version history prevents data loss
- [x] Audit logging for all prompt changes

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| PROMPT_CREATED | New version created | agentId, version |
| PROMPT_ACTIVATED | Prompt activated | agentId, version |
| PROMPT_TESTED | Test executed | agentId, tokenCount |

## Implementation Notes

### Prompt Best Practices
- Keep prompts under 4000 tokens for efficiency
- Use specific constraints for Polish legal context
- Include 3-5 few-shot examples for consistency
- Test with edge cases before activation

### Variable Sources
- `context`: Runtime context (current client, date)
- `client`: Client profile data
- `user`: User preferences/locale
- `system`: Platform configuration
- `manual`: User-provided at runtime
