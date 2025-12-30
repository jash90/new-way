# CRM-007: Tagging and Categorization

> **Story ID**: CRM-007
> **Epic**: Core CRM Module (CRM)
> **Priority**: P1
> **Story Points**: 5
> **Status**: 📋 Ready for Development
> **Phase**: Week 5

---

## User Story

**As an** accountant,
**I want to** tag and categorize clients,
**So that** I can organize and filter them efficiently for better management.

---

## Acceptance Criteria

### AC1: Tag Creation and Management

```gherkin
Feature: Tag Management
  As an accountant
  I want to create and manage tags
  So that I can organize clients by various criteria

  Scenario: Create a new tag
    Given I am on the tags management page
    When I create a tag with:
      | Property | Value |
      | name | VIP |
      | color | #FFD700 |
      | description | Klienci priorytetowi |
    Then the tag should be available for assignment
    And it should appear in the tag list

  Scenario: Create tag with category
    Given I am creating a new tag
    When I assign it to category "Status rozliczeń"
    Then the tag should be grouped under that category

  Scenario: Edit existing tag
    Given a tag "VAT Aktywny" exists
    When I change its color to green
    Then all clients with this tag should display the new color

  Scenario: Prevent duplicate tag names
    Given a tag "VIP" already exists
    When I try to create another tag named "VIP"
    Then I should see error "Tag o tej nazwie już istnieje"

  Scenario: Delete unused tag
    Given a tag "Testowy" exists with no clients assigned
    When I delete the tag
    Then it should be removed from the system

  Scenario: Archive tag with clients
    Given a tag "Stary" is assigned to 5 clients
    When I archive the tag
    Then it should be hidden from new assignments
    But existing clients should retain the tag
```

### AC2: Tag Assignment

```gherkin
Feature: Tag Assignment
  As an accountant
  I want to assign tags to clients
  So that I can categorize them properly

  Scenario: Assign single tag to client
    Given a client "ABC Sp. z o.o." exists
    And a tag "VIP" exists
    When I assign tag "VIP" to the client
    Then the tag should appear on the client profile
    And a timeline event should be created

  Scenario: Assign multiple tags
    Given a client exists
    And tags "VIP", "VAT Aktywny", "Księgowość" exist
    When I assign all three tags
    Then the client should display all tags
    And they should be sorted alphabetically

  Scenario: Remove tag from client
    Given a client has tag "Testowy" assigned
    When I remove the tag
    Then the tag should disappear from client profile
    And a timeline event should record the removal

  Scenario: Quick tag from client list
    Given I am viewing the clients list
    When I click the tag icon on client "XYZ S.A."
    Then a tag selector popup should appear
    And I should be able to quickly toggle tags
```

### AC3: Bulk Tag Operations

```gherkin
Feature: Bulk Tagging
  As an accountant
  I want to tag multiple clients at once
  So that I can efficiently organize large groups

  Scenario: Bulk assign tag
    Given 10 clients are selected in the list
    And a tag "Nowi klienci 2024" exists
    When I choose "Przypisz tag" from bulk actions
    And I select "Nowi klienci 2024"
    Then all 10 clients should have this tag

  Scenario: Bulk remove tag
    Given 5 clients have tag "Do przeglądu"
    When I select these clients and remove the tag
    Then none of them should have this tag

  Scenario: Bulk replace tags
    Given clients have various tags
    When I replace tag "Stary" with "Nowy"
    Then all clients with "Stary" should now have "Nowy"
    And "Stary" should be removed from them
```

### AC4: Tag Categories

```gherkin
Feature: Tag Categories
  As an accountant
  I want to group tags into categories
  So that I can organize them logically

  Scenario: Create tag category
    Given I am on tags management
    When I create category "Typ usługi"
    And I assign tags ["Księgowość", "Kadry", "VAT"] to it
    Then tags should be grouped under "Typ usługi"

  Scenario: Display tags by category
    Given multiple tag categories exist
    When I view the tag selector
    Then tags should be grouped by category
    And uncategorized tags should appear at the end

  Scenario: Category with single selection
    Given category "Status" has option "single_select"
    And it contains tags ["Aktywny", "Nieaktywny", "Zawieszony"]
    When I assign "Aktywny" to a client
    And I try to also assign "Zawieszony"
    Then "Aktywny" should be replaced with "Zawieszony"
```

### AC5: Filter by Tags

```gherkin
Feature: Tag Filtering
  As an accountant
  I want to filter clients by tags
  So that I can quickly find specific groups

  Scenario: Filter by single tag
    Given clients have various tags assigned
    When I filter by tag "VIP"
    Then I should see only clients with "VIP" tag

  Scenario: Filter by multiple tags (AND)
    Given clients have various tags
    When I filter by tags ["VIP", "Księgowość"] with AND logic
    Then I should see only clients having BOTH tags

  Scenario: Filter by multiple tags (OR)
    Given clients have various tags
    When I filter by tags ["VIP", "Premium"] with OR logic
    Then I should see clients having ANY of these tags

  Scenario: Filter by tag exclusion
    Given clients have various tags
    When I filter to exclude tag "Archiwum"
    Then I should see clients WITHOUT "Archiwum" tag

  Scenario: Save tag filter as view
    Given I have filtered by several tags
    When I save this filter as "Klienci aktywni VIP"
    Then I should be able to quickly apply this filter later
```

### AC6: Tag Analytics

```gherkin
Feature: Tag Analytics
  As an accountant
  I want to see tag usage statistics
  So that I can understand client distribution

  Scenario: View tag usage count
    Given tags are assigned to clients
    When I view the tags management page
    Then I should see the count of clients per tag

  Scenario: Tag usage chart
    Given multiple tags exist with assigned clients
    When I view tag analytics
    Then I should see a pie/bar chart of tag distribution

  Scenario: Tag trends over time
    Given tag assignment history exists
    When I view tag trends
    Then I should see how tag usage changed over time
```

---

## Technical Specification

### Database Schema

```sql
-- Tag categories
CREATE TABLE tag_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    selection_mode VARCHAR(20) NOT NULL DEFAULT 'MULTIPLE',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_category_name UNIQUE (organization_id, name),
    CONSTRAINT valid_selection_mode CHECK (selection_mode IN ('SINGLE', 'MULTIPLE'))
);

-- Tags definition
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    category_id UUID REFERENCES tag_categories(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    description TEXT,
    icon VARCHAR(50),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_tag_name UNIQUE (organization_id, name),
    CONSTRAINT unique_tag_slug UNIQUE (organization_id, slug),
    CONSTRAINT valid_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

-- Client-tag associations
CREATE TABLE client_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID NOT NULL REFERENCES users(id),

    CONSTRAINT unique_client_tag UNIQUE (client_id, tag_id)
);

-- Indexes
CREATE INDEX idx_tag_categories_org ON tag_categories(organization_id);
CREATE INDEX idx_tags_organization ON tags(organization_id);
CREATE INDEX idx_tags_category ON tags(category_id);
CREATE INDEX idx_tags_active ON tags(organization_id, is_active, is_archived);
CREATE INDEX idx_tags_slug ON tags(organization_id, slug);
CREATE INDEX idx_client_tags_client ON client_tags(client_id);
CREATE INDEX idx_client_tags_tag ON client_tags(tag_id);
CREATE INDEX idx_client_tags_org ON client_tags(organization_id);

-- Row Level Security
ALTER TABLE tag_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY tag_categories_isolation ON tag_categories
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY tags_isolation ON tags
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY client_tags_isolation ON client_tags
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Comments
COMMENT ON TABLE tag_categories IS 'Categories for organizing tags into logical groups';
COMMENT ON TABLE tags IS 'Tags for categorizing and organizing clients';
COMMENT ON TABLE client_tags IS 'Many-to-many relationship between clients and tags';
COMMENT ON COLUMN tag_categories.selection_mode IS 'SINGLE = only one tag from category, MULTIPLE = multiple allowed';
COMMENT ON COLUMN tags.is_system IS 'System tags cannot be modified or deleted';
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Selection mode enum
export const SelectionModeSchema = z.enum(['SINGLE', 'MULTIPLE']);

// Color validation (hex format)
const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Nieprawidłowy format koloru (wymagany: #RRGGBB)');

// Create tag category
export const CreateTagCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  selectionMode: SelectionModeSchema.default('MULTIPLE'),
  displayOrder: z.number().int().min(0).default(0)
});

// Update tag category
export const UpdateTagCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  selectionMode: SelectionModeSchema.optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional()
});

// Create tag
export const CreateTagSchema = z.object({
  name: z.string().min(1).max(100),
  categoryId: z.string().uuid().optional(),
  color: HexColorSchema.default('#3B82F6'),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  displayOrder: z.number().int().min(0).default(0)
});

// Update tag
export const UpdateTagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  color: HexColorSchema.optional(),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  displayOrder: z.number().int().min(0).optional()
});

// Assign tags to client
export const AssignTagsSchema = z.object({
  clientId: z.string().uuid(),
  tagIds: z.array(z.string().uuid()).min(1).max(50)
});

// Remove tags from client
export const RemoveTagsSchema = z.object({
  clientId: z.string().uuid(),
  tagIds: z.array(z.string().uuid()).min(1).max(50)
});

// Bulk tag operation
export const BulkTagOperationSchema = z.object({
  clientIds: z.array(z.string().uuid()).min(1).max(1000),
  operation: z.enum(['ADD', 'REMOVE', 'REPLACE']),
  tagIds: z.array(z.string().uuid()).min(1).max(50),
  replaceTagId: z.string().uuid().optional() // Only for REPLACE operation
});

// Tag filter input
export const TagFilterSchema = z.object({
  includeTags: z.array(z.string().uuid()).optional(),
  excludeTags: z.array(z.string().uuid()).optional(),
  tagLogic: z.enum(['AND', 'OR']).default('AND')
});

// Tag response
export const TagSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  color: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  categoryId: z.string().uuid().nullable(),
  categoryName: z.string().nullable(),
  displayOrder: z.number(),
  isSystem: z.boolean(),
  isActive: z.boolean(),
  isArchived: z.boolean(),
  clientCount: z.number().optional(),
  createdAt: z.string().datetime()
});

// Tag category response
export const TagCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  selectionMode: SelectionModeSchema,
  displayOrder: z.number(),
  isActive: z.boolean(),
  tags: z.array(TagSchema).optional(),
  createdAt: z.string().datetime()
});

// Client tag response
export const ClientTagSchema = z.object({
  tagId: z.string().uuid(),
  tagName: z.string(),
  tagColor: z.string(),
  categoryName: z.string().nullable(),
  assignedAt: z.string().datetime(),
  assignedBy: z.object({
    id: z.string().uuid(),
    name: z.string()
  }).nullable()
});

// Export types
export type SelectionMode = z.infer<typeof SelectionModeSchema>;
export type CreateTagCategory = z.infer<typeof CreateTagCategorySchema>;
export type UpdateTagCategory = z.infer<typeof UpdateTagCategorySchema>;
export type CreateTag = z.infer<typeof CreateTagSchema>;
export type UpdateTag = z.infer<typeof UpdateTagSchema>;
export type AssignTags = z.infer<typeof AssignTagsSchema>;
export type RemoveTags = z.infer<typeof RemoveTagsSchema>;
export type BulkTagOperation = z.infer<typeof BulkTagOperationSchema>;
export type TagFilter = z.infer<typeof TagFilterSchema>;
export type Tag = z.infer<typeof TagSchema>;
export type TagCategory = z.infer<typeof TagCategorySchema>;
export type ClientTag = z.infer<typeof ClientTagSchema>;
```

### tRPC Router Implementation

```typescript
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  CreateTagCategorySchema,
  UpdateTagCategorySchema,
  CreateTagSchema,
  UpdateTagSchema,
  AssignTagsSchema,
  RemoveTagsSchema,
  BulkTagOperationSchema,
  TagSchema,
  TagCategorySchema,
  ClientTagSchema
} from './schemas';
import { slugify } from '../utils/slugify';

export const tagsRouter = router({
  // Get all tag categories with tags
  getCategories: protectedProcedure
    .input(z.object({
      includeInactive: z.boolean().default(false),
      includeTags: z.boolean().default(true)
    }))
    .output(z.array(TagCategorySchema))
    .query(async ({ ctx, input }) => {
      const { db, user } = ctx;

      const where: any = {
        organizationId: user.organizationId
      };

      if (!input.includeInactive) {
        where.isActive = true;
      }

      const categories = await db.tagCategory.findMany({
        where,
        include: input.includeTags ? {
          tags: {
            where: { isActive: true, isArchived: false },
            orderBy: { displayOrder: 'asc' },
            include: {
              _count: { select: { clientTags: true } }
            }
          }
        } : undefined,
        orderBy: { displayOrder: 'asc' }
      });

      return categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        selectionMode: cat.selectionMode,
        displayOrder: cat.displayOrder,
        isActive: cat.isActive,
        tags: cat.tags?.map(t => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          color: t.color,
          description: t.description,
          icon: t.icon,
          categoryId: t.categoryId,
          categoryName: cat.name,
          displayOrder: t.displayOrder,
          isSystem: t.isSystem,
          isActive: t.isActive,
          isArchived: t.isArchived,
          clientCount: t._count.clientTags,
          createdAt: t.createdAt.toISOString()
        })),
        createdAt: cat.createdAt.toISOString()
      }));
    }),

  // Get all tags (flat list)
  getTags: protectedProcedure
    .input(z.object({
      categoryId: z.string().uuid().optional(),
      includeArchived: z.boolean().default(false),
      includeClientCount: z.boolean().default(false)
    }))
    .output(z.array(TagSchema))
    .query(async ({ ctx, input }) => {
      const { db, user } = ctx;

      const where: any = {
        organizationId: user.organizationId,
        isActive: true
      };

      if (input.categoryId) {
        where.categoryId = input.categoryId;
      }

      if (!input.includeArchived) {
        where.isArchived = false;
      }

      const tags = await db.tag.findMany({
        where,
        include: {
          category: { select: { name: true } },
          ...(input.includeClientCount && {
            _count: { select: { clientTags: true } }
          })
        },
        orderBy: [
          { category: { displayOrder: 'asc' } },
          { displayOrder: 'asc' }
        ]
      });

      return tags.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        color: t.color,
        description: t.description,
        icon: t.icon,
        categoryId: t.categoryId,
        categoryName: t.category?.name ?? null,
        displayOrder: t.displayOrder,
        isSystem: t.isSystem,
        isActive: t.isActive,
        isArchived: t.isArchived,
        clientCount: (t as any)._count?.clientTags,
        createdAt: t.createdAt.toISOString()
      }));
    }),

  // Create tag category
  createCategory: adminProcedure
    .input(CreateTagCategorySchema)
    .output(TagCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Check for duplicate name
      const existing = await db.tagCategory.findFirst({
        where: {
          organizationId: user.organizationId,
          name: input.name
        }
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Kategoria o tej nazwie już istnieje'
        });
      }

      const category = await db.tagCategory.create({
        data: {
          organizationId: user.organizationId,
          name: input.name,
          description: input.description,
          selectionMode: input.selectionMode,
          displayOrder: input.displayOrder,
          createdBy: user.id
        }
      });

      return {
        id: category.id,
        name: category.name,
        description: category.description,
        selectionMode: category.selectionMode,
        displayOrder: category.displayOrder,
        isActive: category.isActive,
        createdAt: category.createdAt.toISOString()
      };
    }),

  // Create tag
  createTag: protectedProcedure
    .input(CreateTagSchema)
    .output(TagSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Check for duplicate name
      const existing = await db.tag.findFirst({
        where: {
          organizationId: user.organizationId,
          name: input.name
        }
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Tag o tej nazwie już istnieje'
        });
      }

      // Generate slug
      const baseSlug = slugify(input.name);
      let slug = baseSlug;
      let counter = 1;

      while (await db.tag.findFirst({
        where: { organizationId: user.organizationId, slug }
      })) {
        slug = `${baseSlug}-${counter++}`;
      }

      const tag = await db.tag.create({
        data: {
          organizationId: user.organizationId,
          name: input.name,
          slug,
          categoryId: input.categoryId,
          color: input.color,
          description: input.description,
          icon: input.icon,
          displayOrder: input.displayOrder,
          createdBy: user.id
        },
        include: {
          category: { select: { name: true } }
        }
      });

      // Audit log
      await createAuditLog(db, {
        eventType: 'TAG_CREATED',
        entityType: 'TAG',
        entityId: tag.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { name: tag.name, color: tag.color }
      });

      return {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        color: tag.color,
        description: tag.description,
        icon: tag.icon,
        categoryId: tag.categoryId,
        categoryName: tag.category?.name ?? null,
        displayOrder: tag.displayOrder,
        isSystem: tag.isSystem,
        isActive: tag.isActive,
        isArchived: tag.isArchived,
        createdAt: tag.createdAt.toISOString()
      };
    }),

  // Update tag
  updateTag: protectedProcedure
    .input(UpdateTagSchema)
    .output(TagSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      const existing = await db.tag.findFirst({
        where: {
          id: input.id,
          organizationId: user.organizationId
        }
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tag nie został znaleziony'
        });
      }

      if (existing.isSystem) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Nie można modyfikować tagów systemowych'
        });
      }

      // Check name uniqueness if changed
      if (input.name && input.name !== existing.name) {
        const duplicate = await db.tag.findFirst({
          where: {
            organizationId: user.organizationId,
            name: input.name,
            id: { not: input.id }
          }
        });

        if (duplicate) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Tag o tej nazwie już istnieje'
          });
        }
      }

      const tag = await db.tag.update({
        where: { id: input.id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
          ...(input.color && { color: input.color }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.icon !== undefined && { icon: input.icon }),
          ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder }),
          updatedAt: new Date()
        },
        include: {
          category: { select: { name: true } }
        }
      });

      return {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        color: tag.color,
        description: tag.description,
        icon: tag.icon,
        categoryId: tag.categoryId,
        categoryName: tag.category?.name ?? null,
        displayOrder: tag.displayOrder,
        isSystem: tag.isSystem,
        isActive: tag.isActive,
        isArchived: tag.isArchived,
        createdAt: tag.createdAt.toISOString()
      };
    }),

  // Archive tag
  archiveTag: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      const tag = await db.tag.findFirst({
        where: {
          id: input.id,
          organizationId: user.organizationId
        }
      });

      if (!tag) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tag nie został znaleziony'
        });
      }

      if (tag.isSystem) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Nie można archiwizować tagów systemowych'
        });
      }

      await db.tag.update({
        where: { id: input.id },
        data: {
          isArchived: true,
          archivedAt: new Date(),
          updatedAt: new Date()
        }
      });

      await createAuditLog(db, {
        eventType: 'TAG_ARCHIVED',
        entityType: 'TAG',
        entityId: tag.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { name: tag.name }
      });

      return { success: true };
    }),

  // Delete tag (only if unused)
  deleteTag: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      const tag = await db.tag.findFirst({
        where: {
          id: input.id,
          organizationId: user.organizationId
        },
        include: {
          _count: { select: { clientTags: true } }
        }
      });

      if (!tag) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tag nie został znaleziony'
        });
      }

      if (tag.isSystem) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Nie można usunąć tagów systemowych'
        });
      }

      if (tag._count.clientTags > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Tag jest przypisany do ${tag._count.clientTags} klientów. Zarchiwizuj tag zamiast usuwać.`
        });
      }

      await db.tag.delete({ where: { id: input.id } });

      await createAuditLog(db, {
        eventType: 'TAG_DELETED',
        entityType: 'TAG',
        entityId: tag.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { name: tag.name }
      });

      return { success: true };
    }),

  // Get client tags
  getClientTags: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .output(z.array(ClientTagSchema))
    .query(async ({ ctx, input }) => {
      const { db, user } = ctx;

      const clientTags = await db.clientTag.findMany({
        where: {
          clientId: input.clientId,
          organizationId: user.organizationId
        },
        include: {
          tag: {
            include: { category: { select: { name: true } } }
          },
          assignedByUser: {
            select: { id: true, name: true }
          }
        },
        orderBy: { assignedAt: 'asc' }
      });

      return clientTags.map(ct => ({
        tagId: ct.tag.id,
        tagName: ct.tag.name,
        tagColor: ct.tag.color,
        categoryName: ct.tag.category?.name ?? null,
        assignedAt: ct.assignedAt.toISOString(),
        assignedBy: ct.assignedByUser ? {
          id: ct.assignedByUser.id,
          name: ct.assignedByUser.name
        } : null
      }));
    }),

  // Assign tags to client
  assignTags: protectedProcedure
    .input(AssignTagsSchema)
    .output(z.object({ assignedCount: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Verify client access
      const client = await db.client.findFirst({
        where: {
          id: input.clientId,
          organizationId: user.organizationId,
          isDeleted: false
        }
      });

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Klient nie został znaleziony'
        });
      }

      // Verify all tags exist and are active
      const tags = await db.tag.findMany({
        where: {
          id: { in: input.tagIds },
          organizationId: user.organizationId,
          isActive: true,
          isArchived: false
        },
        include: { category: true }
      });

      if (tags.length !== input.tagIds.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Niektóre tagi nie istnieją lub są nieaktywne'
        });
      }

      // Check single-select categories
      const singleSelectCategories = tags
        .filter(t => t.category?.selectionMode === 'SINGLE')
        .map(t => t.categoryId);

      if (singleSelectCategories.length > 0) {
        // Get existing tags from same single-select categories
        const existingTags = await db.clientTag.findMany({
          where: {
            clientId: input.clientId,
            tag: {
              categoryId: { in: singleSelectCategories as string[] }
            }
          }
        });

        // Remove old tags from single-select categories
        if (existingTags.length > 0) {
          await db.clientTag.deleteMany({
            where: {
              id: { in: existingTags.map(t => t.id) }
            }
          });
        }
      }

      // Create new tag assignments
      const assignedCount = await db.$transaction(async (tx) => {
        let count = 0;
        for (const tagId of input.tagIds) {
          try {
            await tx.clientTag.create({
              data: {
                clientId: input.clientId,
                tagId,
                organizationId: user.organizationId,
                assignedBy: user.id
              }
            });
            count++;

            // Record timeline event
            const tag = tags.find(t => t.id === tagId);
            await recordTagAdded(tx, {
              clientId: input.clientId,
              organizationId: user.organizationId,
              tagName: tag!.name,
              userId: user.id
            });
          } catch (error) {
            // Ignore duplicate key errors (tag already assigned)
          }
        }
        return count;
      });

      return { assignedCount };
    }),

  // Remove tags from client
  removeTags: protectedProcedure
    .input(RemoveTagsSchema)
    .output(z.object({ removedCount: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Verify client access
      const client = await db.client.findFirst({
        where: {
          id: input.clientId,
          organizationId: user.organizationId,
          isDeleted: false
        }
      });

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Klient nie został znaleziony'
        });
      }

      // Get tags being removed for timeline events
      const tagsToRemove = await db.clientTag.findMany({
        where: {
          clientId: input.clientId,
          tagId: { in: input.tagIds }
        },
        include: { tag: true }
      });

      // Remove tags
      const { count } = await db.clientTag.deleteMany({
        where: {
          clientId: input.clientId,
          tagId: { in: input.tagIds },
          organizationId: user.organizationId
        }
      });

      // Record timeline events
      for (const ct of tagsToRemove) {
        await recordTagRemoved(db, {
          clientId: input.clientId,
          organizationId: user.organizationId,
          tagName: ct.tag.name,
          userId: user.id
        });
      }

      return { removedCount: count };
    }),

  // Bulk tag operation
  bulkTagOperation: protectedProcedure
    .input(BulkTagOperationSchema)
    .output(z.object({
      successCount: z.number(),
      failedCount: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Verify all clients exist
      const clients = await db.client.findMany({
        where: {
          id: { in: input.clientIds },
          organizationId: user.organizationId,
          isDeleted: false
        },
        select: { id: true }
      });

      const validClientIds = new Set(clients.map(c => c.id));
      let successCount = 0;
      let failedCount = 0;

      for (const clientId of input.clientIds) {
        if (!validClientIds.has(clientId)) {
          failedCount++;
          continue;
        }

        try {
          if (input.operation === 'ADD') {
            await db.clientTag.createMany({
              data: input.tagIds.map(tagId => ({
                clientId,
                tagId,
                organizationId: user.organizationId,
                assignedBy: user.id
              })),
              skipDuplicates: true
            });
          } else if (input.operation === 'REMOVE') {
            await db.clientTag.deleteMany({
              where: {
                clientId,
                tagId: { in: input.tagIds }
              }
            });
          } else if (input.operation === 'REPLACE' && input.replaceTagId) {
            await db.$transaction([
              db.clientTag.deleteMany({
                where: {
                  clientId,
                  tagId: input.replaceTagId
                }
              }),
              db.clientTag.createMany({
                data: input.tagIds.map(tagId => ({
                  clientId,
                  tagId,
                  organizationId: user.organizationId,
                  assignedBy: user.id
                })),
                skipDuplicates: true
              })
            ]);
          }
          successCount++;
        } catch {
          failedCount++;
        }
      }

      // Audit log
      await createAuditLog(db, {
        eventType: 'BULK_TAG_OPERATION',
        entityType: 'CLIENT_TAG',
        entityId: input.tagIds[0],
        userId: user.id,
        organizationId: user.organizationId,
        metadata: {
          operation: input.operation,
          clientCount: successCount,
          failedCount
        }
      });

      return { successCount, failedCount };
    }),

  // Get tag statistics
  getTagStatistics: protectedProcedure
    .output(z.array(z.object({
      tagId: z.string().uuid(),
      tagName: z.string(),
      tagColor: z.string(),
      categoryName: z.string().nullable(),
      clientCount: z.number(),
      percentage: z.number()
    })))
    .query(async ({ ctx }) => {
      const { db, user } = ctx;

      const totalClients = await db.client.count({
        where: {
          organizationId: user.organizationId,
          isDeleted: false
        }
      });

      const tags = await db.tag.findMany({
        where: {
          organizationId: user.organizationId,
          isActive: true,
          isArchived: false
        },
        include: {
          category: { select: { name: true } },
          _count: { select: { clientTags: true } }
        },
        orderBy: { name: 'asc' }
      });

      return tags.map(t => ({
        tagId: t.id,
        tagName: t.name,
        tagColor: t.color,
        categoryName: t.category?.name ?? null,
        clientCount: t._count.clientTags,
        percentage: totalClients > 0
          ? Math.round((t._count.clientTags / totalClients) * 100 * 10) / 10
          : 0
      }));
    })
});
```

---

## Test Specification

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { slugify } from './utils/slugify';

describe('Tag Utils', () => {
  describe('slugify', () => {
    it('should convert Polish characters', () => {
      expect(slugify('Księgowość')).toBe('ksiegowosc');
      expect(slugify('Żółć')).toBe('zolc');
    });

    it('should convert spaces to hyphens', () => {
      expect(slugify('Tag Name')).toBe('tag-name');
    });

    it('should remove special characters', () => {
      expect(slugify('Tag@#$%Name')).toBe('tagname');
    });

    it('should convert to lowercase', () => {
      expect(slugify('VIP Client')).toBe('vip-client');
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, cleanupTestData } from '../test-utils';

describe('Tags Router Integration', () => {
  let ctx: any;
  let adminUser: any;
  let testClient: any;

  beforeAll(async () => {
    ctx = await createTestContext();
    adminUser = await ctx.createAdminUser();
    testClient = await ctx.createTestClient({ companyName: 'Tag Test Client' });
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  beforeEach(async () => {
    await ctx.db.clientTag.deleteMany({});
    await ctx.db.tag.deleteMany({});
    await ctx.db.tagCategory.deleteMany({});
  });

  describe('createTag', () => {
    it('should create tag with auto-generated slug', async () => {
      const tag = await ctx.caller.tags.createTag({
        name: 'VIP Klient',
        color: '#FFD700'
      });

      expect(tag.name).toBe('VIP Klient');
      expect(tag.slug).toBe('vip-klient');
      expect(tag.color).toBe('#FFD700');
    });

    it('should reject duplicate tag name', async () => {
      await ctx.caller.tags.createTag({ name: 'Test', color: '#000000' });

      await expect(
        ctx.caller.tags.createTag({ name: 'Test', color: '#FFFFFF' })
      ).rejects.toThrow('już istnieje');
    });
  });

  describe('assignTags', () => {
    it('should assign multiple tags to client', async () => {
      const tag1 = await ctx.caller.tags.createTag({ name: 'Tag1', color: '#FF0000' });
      const tag2 = await ctx.caller.tags.createTag({ name: 'Tag2', color: '#00FF00' });

      const result = await ctx.caller.tags.assignTags({
        clientId: testClient.id,
        tagIds: [tag1.id, tag2.id]
      });

      expect(result.assignedCount).toBe(2);

      const clientTags = await ctx.caller.tags.getClientTags({ clientId: testClient.id });
      expect(clientTags).toHaveLength(2);
    });

    it('should enforce single-select category', async () => {
      const category = await ctx.adminCaller.tags.createCategory({
        name: 'Status',
        selectionMode: 'SINGLE'
      });

      const tag1 = await ctx.caller.tags.createTag({
        name: 'Active',
        color: '#00FF00',
        categoryId: category.id
      });
      const tag2 = await ctx.caller.tags.createTag({
        name: 'Inactive',
        color: '#FF0000',
        categoryId: category.id
      });

      // Assign first tag
      await ctx.caller.tags.assignTags({
        clientId: testClient.id,
        tagIds: [tag1.id]
      });

      // Assign second tag - should replace first
      await ctx.caller.tags.assignTags({
        clientId: testClient.id,
        tagIds: [tag2.id]
      });

      const clientTags = await ctx.caller.tags.getClientTags({ clientId: testClient.id });
      expect(clientTags).toHaveLength(1);
      expect(clientTags[0].tagName).toBe('Inactive');
    });
  });

  describe('bulkTagOperation', () => {
    it('should add tag to multiple clients', async () => {
      const tag = await ctx.caller.tags.createTag({ name: 'Bulk Tag', color: '#0000FF' });
      const client2 = await ctx.createTestClient({ companyName: 'Client 2' });

      const result = await ctx.caller.tags.bulkTagOperation({
        clientIds: [testClient.id, client2.id],
        operation: 'ADD',
        tagIds: [tag.id]
      });

      expect(result.successCount).toBe(2);
    });

    it('should replace tag across clients', async () => {
      const oldTag = await ctx.caller.tags.createTag({ name: 'Old', color: '#FF0000' });
      const newTag = await ctx.caller.tags.createTag({ name: 'New', color: '#00FF00' });

      await ctx.caller.tags.assignTags({
        clientId: testClient.id,
        tagIds: [oldTag.id]
      });

      await ctx.caller.tags.bulkTagOperation({
        clientIds: [testClient.id],
        operation: 'REPLACE',
        tagIds: [newTag.id],
        replaceTagId: oldTag.id
      });

      const clientTags = await ctx.caller.tags.getClientTags({ clientId: testClient.id });
      expect(clientTags.map(t => t.tagName)).toContain('New');
      expect(clientTags.map(t => t.tagName)).not.toContain('Old');
    });
  });
});
```

---

## Security Checklist

- [x] Row Level Security enabled on all tables
- [x] Organization isolation via RLS policies
- [x] System tags protected from modification/deletion
- [x] Admin-only access for category management
- [x] Input validation via Zod schemas
- [x] SQL injection prevented via parameterized queries
- [x] Audit logging for tag operations

---

## Audit Events

| Event Type | Trigger | Data Captured |
|------------|---------|---------------|
| TAG_CREATED | New tag created | name, color |
| TAG_UPDATED | Tag modified | changed fields |
| TAG_ARCHIVED | Tag archived | name |
| TAG_DELETED | Tag permanently removed | name |
| TAG_ADDED | Tag assigned to client | clientId, tagName |
| TAG_REMOVED | Tag removed from client | clientId, tagName |
| BULK_TAG_OPERATION | Bulk tag change | operation, clientCount |

---

*Last updated: December 2024*
