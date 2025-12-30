# Story: AAM-006 - Agent Marketplace

## Story Overview

| Field | Value |
|-------|-------|
| Story ID | AAM-006 |
| Epic | AI Agent Module (AAM) |
| Priority | P2 |
| Story Points | 5 |
| Sprint | Sprint 2 (Week 33) |
| Dependencies | AAM-001, AAM-002 |

## User Story

**As a** super admin
**I want to** browse and install pre-built agent templates from a marketplace
**So that** I can quickly deploy specialized agents without building them from scratch

## Acceptance Criteria

### AC1: Browse Templates
```gherkin
Given I access the agent marketplace
When I view available templates
Then I should see a catalog of pre-built agents
And each template should show name, description, category, and rating
And I can filter by category and use case
```

### AC2: Template Details
```gherkin
Given I view a marketplace template
When I click on it
Then I should see full description and capabilities
And see sample prompts and expected responses
And see required integrations and knowledge bases
And see user reviews and ratings
```

### AC3: Install Template
```gherkin
Given I want to use a marketplace template
When I install it
Then a new agent should be created from the template
And I should be able to customize name and settings
And the agent should be ready to use
```

### AC4: Publish Template
```gherkin
Given I have a well-configured agent
When I publish it to the marketplace
Then it should become available to other organizations
And I can set visibility (public/private)
And include documentation and examples
```

### AC5: Template Versioning
```gherkin
Given a template has been updated
When I view my installed agents
Then I should see if updates are available
And I should be able to update to the latest version
And choose whether to keep my customizations
```

### AC6: Template Reviews
```gherkin
Given I have used an installed template
When I submit a review
Then my rating and feedback should be visible
And help other users make informed decisions
```

## Technical Specification

### Database Schema

```sql
-- Marketplace templates
CREATE TABLE agent_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_tenant_id UUID NOT NULL REFERENCES tenants(id),
  author_user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  long_description TEXT,
  category VARCHAR(50) NOT NULL,
  tags JSONB DEFAULT '[]',
  icon_url TEXT,
  banner_url TEXT,
  visibility VARCHAR(20) DEFAULT 'PRIVATE', -- PUBLIC, ORGANIZATION, PRIVATE
  status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, PUBLISHED, DEPRECATED
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  changelog TEXT,
  -- Template configuration
  model VARCHAR(50) NOT NULL,
  temperature DECIMAL(2,1) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2000,
  system_prompt_template TEXT NOT NULL,
  prompt_variables JSONB DEFAULT '[]',
  examples JSONB DEFAULT '[]',
  constraints JSONB DEFAULT '[]',
  -- Required integrations
  required_integrations JSONB DEFAULT '[]',
  -- Sample knowledge base structure
  knowledge_structure JSONB DEFAULT '{}',
  -- Statistics
  install_count INTEGER DEFAULT 0,
  rating_average DECIMAL(2,1) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  deprecated_at TIMESTAMPTZ
);

-- Template versions for updates
CREATE TABLE template_versions (
  version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES agent_templates(template_id) ON DELETE CASCADE,
  version VARCHAR(20) NOT NULL,
  changelog TEXT,
  configuration JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, version)
);

-- Template installations
CREATE TABLE template_installations (
  installation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  template_id UUID NOT NULL REFERENCES agent_templates(template_id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  installed_version VARCHAR(20) NOT NULL,
  current_version VARCHAR(20) NOT NULL,
  customizations JSONB DEFAULT '{}',
  update_available BOOLEAN DEFAULT false,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ,
  UNIQUE(tenant_id, agent_id)
);

-- Template reviews
CREATE TABLE template_reviews (
  review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES agent_templates(template_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  review_text TEXT,
  helpful_count INTEGER DEFAULT 0,
  verified_install BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, tenant_id)
);

-- Indexes
CREATE INDEX idx_templates_category ON agent_templates(category);
CREATE INDEX idx_templates_visibility ON agent_templates(visibility, status);
CREATE INDEX idx_templates_rating ON agent_templates(rating_average DESC);
CREATE INDEX idx_templates_installs ON agent_templates(install_count DESC);
CREATE INDEX idx_templates_search ON agent_templates
  USING gin(to_tsvector('english', name || ' ' || description));
CREATE INDEX idx_installations_tenant ON template_installations(tenant_id);
CREATE INDEX idx_installations_template ON template_installations(template_id);
CREATE INDEX idx_reviews_template ON template_reviews(template_id);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Template categories
export const templateCategorySchema = z.enum([
  'TAX_COMPLIANCE',
  'DOCUMENT_PROCESSING',
  'CLIENT_SUPPORT',
  'REPORTING',
  'DATA_ANALYSIS',
  'WORKFLOW_AUTOMATION',
  'CUSTOM',
]);

// Browse templates filters
export const browseTemplatesSchema = z.object({
  category: templateCategorySchema.optional(),
  search: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(['popularity', 'rating', 'newest', 'name']).default('popularity'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
});

// Template response
export const templateSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  category: templateCategorySchema,
  tags: z.array(z.string()),
  iconUrl: z.string().optional(),
  visibility: z.enum(['PUBLIC', 'ORGANIZATION', 'PRIVATE']),
  version: z.string(),
  model: z.string(),
  installCount: z.number(),
  ratingAverage: z.number(),
  ratingCount: z.number(),
  author: z.object({
    name: z.string(),
    verified: z.boolean(),
  }),
  publishedAt: z.string().datetime().nullable(),
});

// Template detail
export const templateDetailSchema = templateSchema.extend({
  longDescription: z.string().optional(),
  bannerUrl: z.string().optional(),
  systemPromptTemplate: z.string(),
  promptVariables: z.array(z.object({
    name: z.string(),
    description: z.string(),
    required: z.boolean(),
    defaultValue: z.string().optional(),
  })),
  examples: z.array(z.object({
    userMessage: z.string(),
    assistantResponse: z.string(),
  })),
  requiredIntegrations: z.array(z.object({
    moduleId: z.string(),
    moduleName: z.string(),
    permissions: z.array(z.string()),
  })),
  knowledgeStructure: z.object({
    recommendedDocs: z.array(z.string()).optional(),
    minFiles: z.number().optional(),
    fileTypes: z.array(z.string()).optional(),
  }).optional(),
  changelog: z.string().optional(),
  recentReviews: z.array(z.object({
    rating: z.number(),
    title: z.string().optional(),
    reviewText: z.string().optional(),
    authorName: z.string(),
    createdAt: z.string().datetime(),
  })),
});

// Install template
export const installTemplateSchema = z.object({
  templateId: z.string().uuid(),
  customization: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(100).max(128000).optional(),
  }),
});

// Publish template
export const publishTemplateSchema = z.object({
  agentId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().min(10).max(500),
  longDescription: z.string().max(5000).optional(),
  category: templateCategorySchema,
  tags: z.array(z.string().max(50)).max(10),
  visibility: z.enum(['PUBLIC', 'ORGANIZATION']),
  iconUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
  examples: z.array(z.object({
    userMessage: z.string().max(1000),
    assistantResponse: z.string().max(2000),
  })).min(1).max(5),
});

// Submit review
export const submitReviewSchema = z.object({
  templateId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(255).optional(),
  reviewText: z.string().max(2000).optional(),
});

export type BrowseTemplates = z.infer<typeof browseTemplatesSchema>;
export type Template = z.infer<typeof templateSchema>;
export type TemplateDetail = z.infer<typeof templateDetailSchema>;
export type InstallTemplate = z.infer<typeof installTemplateSchema>;
export type PublishTemplate = z.infer<typeof publishTemplateSchema>;
export type SubmitReview = z.infer<typeof submitReviewSchema>;
```

### Service Implementation

```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { TemplateRepository } from '../repositories/template.repository';
import { AgentService } from './agent.service';
import { AuditService } from '../../audit/audit.service';
import slugify from 'slugify';

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly templateRepo: TemplateRepository,
    private readonly agentService: AgentService,
    private readonly auditService: AuditService,
  ) {}

  async browseTemplates(
    tenantId: string,
    filters: BrowseTemplates,
  ): Promise<PaginatedResult<Template>> {
    return this.templateRepo.findPublic({
      ...filters,
      includeTenantTemplates: tenantId,
    });
  }

  async getTemplateDetail(
    tenantId: string,
    templateIdOrSlug: string,
  ): Promise<TemplateDetail> {
    const template = await this.templateRepo.findByIdOrSlug(templateIdOrSlug);

    if (!template) {
      throw new NotFoundException('Szablon nie został znaleziony');
    }

    // Check access for non-public templates
    if (template.visibility !== 'PUBLIC' && template.authorTenantId !== tenantId) {
      throw new NotFoundException('Szablon nie został znaleziony');
    }

    // Get recent reviews
    const recentReviews = await this.templateRepo.getReviews(
      template.templateId,
      { limit: 5 },
    );

    return {
      ...template,
      recentReviews,
    };
  }

  async installTemplate(
    tenantId: string,
    userId: string,
    input: InstallTemplate,
  ): Promise<Agent> {
    const template = await this.templateRepo.findById(input.templateId);

    if (!template || template.status !== 'PUBLISHED') {
      throw new NotFoundException('Szablon nie jest dostępny');
    }

    // Check access
    if (template.visibility !== 'PUBLIC' && template.authorTenantId !== tenantId) {
      throw new NotFoundException('Szablon nie jest dostępny');
    }

    // Create agent from template
    const agent = await this.agentService.createAgent(tenantId, userId, {
      name: input.customization.name,
      description: input.customization.description || template.description,
      model: input.customization.model || template.model,
      temperature: input.customization.temperature || template.temperature,
      maxTokens: input.customization.maxTokens || template.maxTokens,
      status: 'DRAFT',
    });

    // Copy system prompt
    await this.agentService.updateSystemPrompt(tenantId, agent.id, {
      content: template.systemPromptTemplate,
      variables: template.promptVariables,
      examples: template.examples,
      constraints: template.constraints,
    });

    // Record installation
    await this.templateRepo.recordInstallation({
      tenantId,
      templateId: template.templateId,
      agentId: agent.id,
      installedVersion: template.version,
      currentVersion: template.version,
      customizations: input.customization,
    });

    // Increment install count
    await this.templateRepo.incrementInstallCount(template.templateId);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'TEMPLATE_INSTALLED',
      entityType: 'agent_template',
      entityId: template.templateId,
      metadata: {
        agentId: agent.id,
        version: template.version,
      },
    });

    return agent;
  }

  async publishTemplate(
    tenantId: string,
    userId: string,
    input: PublishTemplate,
  ): Promise<Template> {
    // Get source agent
    const agent = await this.agentService.getAgent(tenantId, input.agentId);

    if (!agent) {
      throw new NotFoundException('Agent nie został znaleziony');
    }

    // Generate unique slug
    const baseSlug = slugify(input.name, { lower: true, strict: true });
    const slug = await this.templateRepo.generateUniqueSlug(baseSlug);

    // Create template
    const template = await this.templateRepo.create({
      authorTenantId: tenantId,
      authorUserId: userId,
      name: input.name,
      slug,
      description: input.description,
      longDescription: input.longDescription,
      category: input.category,
      tags: input.tags,
      iconUrl: input.iconUrl,
      bannerUrl: input.bannerUrl,
      visibility: input.visibility,
      status: 'PUBLISHED',
      version: '1.0.0',
      model: agent.model,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      systemPromptTemplate: agent.systemPrompt.content,
      promptVariables: agent.systemPrompt.variables,
      examples: input.examples,
      constraints: agent.systemPrompt.constraints,
      requiredIntegrations: agent.integrations,
      publishedAt: new Date(),
    });

    // Create initial version
    await this.templateRepo.createVersion({
      templateId: template.templateId,
      version: '1.0.0',
      configuration: this.extractConfiguration(agent),
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'TEMPLATE_PUBLISHED',
      entityType: 'agent_template',
      entityId: template.templateId,
      metadata: {
        name: template.name,
        visibility: template.visibility,
      },
    });

    return template;
  }

  async updateTemplate(
    tenantId: string,
    userId: string,
    templateId: string,
    input: UpdateTemplateInput,
  ): Promise<Template> {
    const template = await this.templateRepo.findById(templateId);

    if (!template || template.authorTenantId !== tenantId) {
      throw new NotFoundException('Szablon nie został znaleziony');
    }

    // If updating configuration, create new version
    if (input.agentId) {
      const agent = await this.agentService.getAgent(tenantId, input.agentId);
      const newVersion = this.incrementVersion(template.version);

      await this.templateRepo.createVersion({
        templateId,
        version: newVersion,
        changelog: input.changelog,
        configuration: this.extractConfiguration(agent),
      });

      // Mark installations as having update available
      await this.templateRepo.markUpdateAvailable(templateId, newVersion);

      input.version = newVersion;
    }

    const updated = await this.templateRepo.update(templateId, input);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'TEMPLATE_UPDATED',
      entityType: 'agent_template',
      entityId: templateId,
      metadata: { version: updated.version },
    });

    return updated;
  }

  async updateInstalledAgent(
    tenantId: string,
    userId: string,
    agentId: string,
    options: UpdateOptions,
  ): Promise<Agent> {
    const installation = await this.templateRepo.getInstallation(tenantId, agentId);

    if (!installation) {
      throw new NotFoundException('Agent nie pochodzi z szablonu');
    }

    const template = await this.templateRepo.findById(installation.templateId);
    const latestVersion = await this.templateRepo.getLatestVersion(installation.templateId);

    if (options.keepCustomizations) {
      // Merge new template with existing customizations
      await this.mergeConfiguration(
        tenantId,
        agentId,
        latestVersion.configuration,
        installation.customizations,
      );
    } else {
      // Replace with fresh template
      await this.applyConfiguration(tenantId, agentId, latestVersion.configuration);
    }

    // Update installation record
    await this.templateRepo.updateInstallation(installation.installationId, {
      currentVersion: latestVersion.version,
      updateAvailable: false,
      lastUpdatedAt: new Date(),
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'TEMPLATE_AGENT_UPDATED',
      entityType: 'agent',
      entityId: agentId,
      metadata: {
        templateId: installation.templateId,
        fromVersion: installation.currentVersion,
        toVersion: latestVersion.version,
      },
    });

    return this.agentService.getAgent(tenantId, agentId);
  }

  async submitReview(
    tenantId: string,
    userId: string,
    input: SubmitReview,
  ): Promise<Review> {
    // Check if user has installed the template
    const installation = await this.templateRepo.findInstallationByTemplate(
      tenantId,
      input.templateId,
    );

    const review = await this.templateRepo.createOrUpdateReview({
      templateId: input.templateId,
      tenantId,
      userId,
      rating: input.rating,
      title: input.title,
      reviewText: input.reviewText,
      verifiedInstall: !!installation,
    });

    // Update template rating
    await this.templateRepo.recalculateRating(input.templateId);

    return review;
  }

  async getInstalledTemplates(
    tenantId: string,
  ): Promise<InstalledTemplate[]> {
    const installations = await this.templateRepo.getInstallations(tenantId);

    return Promise.all(
      installations.map(async (inst) => {
        const template = await this.templateRepo.findById(inst.templateId);
        return {
          ...inst,
          templateName: template.name,
          templateVersion: template.version,
          updateAvailable: inst.currentVersion !== template.version,
        };
      }),
    );
  }

  private extractConfiguration(agent: Agent): TemplateConfiguration {
    return {
      model: agent.model,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      systemPrompt: agent.systemPrompt,
      integrations: agent.integrations,
    };
  }

  private incrementVersion(version: string): string {
    const [major, minor, patch] = version.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
  }
}
```

### tRPC Router

```typescript
export const marketplaceRouter = router({
  // Browse templates
  browse: protectedProcedure
    .input(browseTemplatesSchema)
    .query(async ({ ctx, input }) => {
      return ctx.marketplaceService.browseTemplates(ctx.tenantId, input);
    }),

  // Get template detail
  getTemplate: protectedProcedure
    .input(z.object({ templateIdOrSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.marketplaceService.getTemplateDetail(
        ctx.tenantId,
        input.templateIdOrSlug,
      );
    }),

  // Install template
  install: superAdminProcedure
    .input(installTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.marketplaceService.installTemplate(
        ctx.tenantId,
        ctx.userId,
        input,
      );
    }),

  // Publish template
  publish: superAdminProcedure
    .input(publishTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.marketplaceService.publishTemplate(
        ctx.tenantId,
        ctx.userId,
        input,
      );
    }),

  // Update installed agent
  updateAgent: superAdminProcedure
    .input(z.object({
      agentId: z.string().uuid(),
      keepCustomizations: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.marketplaceService.updateInstalledAgent(
        ctx.tenantId,
        ctx.userId,
        input.agentId,
        { keepCustomizations: input.keepCustomizations },
      );
    }),

  // Submit review
  submitReview: protectedProcedure
    .input(submitReviewSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.marketplaceService.submitReview(
        ctx.tenantId,
        ctx.userId,
        input,
      );
    }),

  // Get installed templates
  installed: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.marketplaceService.getInstalledTemplates(ctx.tenantId);
    }),
});
```

## Test Specification

### Unit Tests

```typescript
describe('MarketplaceService', () => {
  describe('installTemplate', () => {
    it('should create agent from template', async () => {
      const template = await createTestTemplate();

      const agent = await service.installTemplate(
        'tenant-1',
        'user-1',
        {
          templateId: template.templateId,
          customization: { name: 'Mój Agent Podatkowy' },
        },
      );

      expect(agent.name).toBe('Mój Agent Podatkowy');
      expect(agent.model).toBe(template.model);
    });

    it('should increment install count', async () => {
      const template = await createTestTemplate();
      const initialCount = template.installCount;

      await service.installTemplate('tenant-1', 'user-1', {
        templateId: template.templateId,
        customization: { name: 'Test Agent' },
      });

      const updated = await templateRepo.findById(template.templateId);
      expect(updated.installCount).toBe(initialCount + 1);
    });
  });

  describe('publishTemplate', () => {
    it('should create template from agent', async () => {
      const agent = await createTestAgent();

      const template = await service.publishTemplate('tenant-1', 'user-1', {
        agentId: agent.id,
        name: 'Tax Expert Template',
        description: 'Template for tax compliance',
        category: 'TAX_COMPLIANCE',
        tags: ['tax', 'VAT', 'compliance'],
        visibility: 'PUBLIC',
        examples: [{ userMessage: 'Test', assistantResponse: 'Response' }],
      });

      expect(template.name).toBe('Tax Expert Template');
      expect(template.status).toBe('PUBLISHED');
      expect(template.version).toBe('1.0.0');
    });
  });
});
```

## Security Checklist

- [x] Only super admins can install/publish templates
- [x] Visibility controls enforced (public/organization/private)
- [x] Template content validated before publish
- [x] Reviews linked to verified installations
- [x] Rate limiting on browse/install operations
- [x] All operations logged for audit

## Audit Events

| Event | Description | Data |
|-------|-------------|------|
| TEMPLATE_INSTALLED | Template installed | templateId, agentId, version |
| TEMPLATE_PUBLISHED | Template published | templateId, visibility |
| TEMPLATE_UPDATED | Template updated | templateId, version |
| TEMPLATE_AGENT_UPDATED | Installed agent updated | agentId, fromVersion, toVersion |
| TEMPLATE_REVIEW_SUBMITTED | Review submitted | templateId, rating |

## Definition of Done

- [x] Template browsing and filtering
- [x] Template installation working
- [x] Template publishing working
- [x] Version management implemented
- [x] Review system implemented
- [x] Unit test coverage ≥ 80%
- [x] Security review completed
- [x] Documentation updated
