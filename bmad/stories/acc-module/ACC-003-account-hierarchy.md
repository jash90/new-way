# ACC-003: Account Hierarchy and Grouping

> **Story ID**: ACC-003
> **Title**: Account Hierarchy and Grouping
> **Epic**: Accounting Engine (ACC)
> **Priority**: P1
> **Points**: 5
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant preparing financial reports,
**I want to** organize accounts hierarchically with groups,
**So that** I can create structured financial statements and meaningful analysis.

---

## Acceptance Criteria

### AC1: Define Account Groups
```gherkin
Feature: Account Groups

Scenario: Create account group
  Given I have accounts 100, 101, 102
  When I create a group "Środki pieniężne" containing these accounts
  Then the group should aggregate balances from all three accounts
  And the group should appear in reports

Scenario: Nested groups
  Given I have group "Aktywa obrotowe"
  When I create subgroup "Środki pieniężne" under it
  Then the hierarchy should be correctly represented
  And balances should roll up through the hierarchy
```

### AC2: Parent-Child Account Relationships
```gherkin
Feature: Account Hierarchy

Scenario: Set parent account
  Given account "100" exists as a header account
  When I create account "101" with parent "100"
  Then account "101" should be a child of "100"
  And the tree view should show the relationship

Scenario: Calculate parent balance
  Given account "100" has children "101" (1000 PLN) and "102" (500 PLN)
  When I view the balance of "100"
  Then the balance should be 1500 PLN (sum of children)
```

### AC3: Tree View Display
```gherkin
Feature: Tree View

Scenario: Display accounts as tree
  Given accounts exist with parent-child relationships
  When I view the chart of accounts in tree mode
  Then I should see expandable/collapsible tree structure
  And child accounts should be indented under parents
```

---

## Technical Specification

### Database Schema

```sql
-- Account groups for reporting (separate from parent-child)
CREATE TABLE account_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Group definition
  group_code VARCHAR(50) NOT NULL,
  group_name VARCHAR(255) NOT NULL,
  group_name_en VARCHAR(255),

  -- Hierarchy
  parent_group_id UUID REFERENCES account_groups(id),
  level INTEGER NOT NULL DEFAULT 0,
  path LTREE, -- For efficient hierarchy queries

  -- Report mapping
  report_section VARCHAR(50), -- BALANCE_SHEET, INCOME_STATEMENT, etc.
  report_position VARCHAR(50), -- A.I, A.II, B.I, etc.

  -- Metadata
  description TEXT,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(organization_id, group_code)
);

-- Link accounts to groups
CREATE TABLE account_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES account_groups(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,

  UNIQUE(group_id, account_id)
);

-- Indexes
CREATE INDEX idx_account_groups_path ON account_groups USING GIST (path);
CREATE INDEX idx_account_groups_parent ON account_groups(parent_group_id);
CREATE INDEX idx_group_members_group ON account_group_members(group_id);
CREATE INDEX idx_group_members_account ON account_group_members(account_id);
```

### Zod Schemas

```typescript
import { z } from 'zod';

export const CreateAccountGroupInput = z.object({
  groupCode: z.string().min(1).max(50),
  groupName: z.string().min(1).max(255),
  groupNameEn: z.string().max(255).optional(),
  parentGroupId: z.string().uuid().optional(),
  reportSection: z.enum([
    'BALANCE_SHEET_ASSETS',
    'BALANCE_SHEET_LIABILITIES',
    'BALANCE_SHEET_EQUITY',
    'INCOME_STATEMENT_REVENUE',
    'INCOME_STATEMENT_EXPENSES',
    'CASH_FLOW',
  ]).optional(),
  reportPosition: z.string().max(50).optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export const AccountTreeNodeSchema = z.object({
  id: z.string().uuid(),
  accountCode: z.string(),
  accountName: z.string(),
  accountType: z.string(),
  normalBalance: z.enum(['DEBIT', 'CREDIT']),
  level: z.number(),
  hasChildren: z.boolean(),
  balance: z.number().optional(),
  children: z.array(z.lazy(() => AccountTreeNodeSchema)).optional(),
});

export type AccountTreeNode = z.infer<typeof AccountTreeNodeSchema>;
```

### tRPC Router

```typescript
export const accountHierarchyRouter = router({
  // Get accounts as tree structure
  getAccountTree: protectedProcedure
    .input(z.object({
      includeBalances: z.boolean().default(false),
      periodId: z.string().uuid().optional(),
      rootAccountId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      // Fetch all accounts with their balances if requested
      const accounts = await ctx.db.chartOfAccounts.findMany({
        where: { organizationId, isActive: true },
        orderBy: { accountCode: 'asc' },
      });

      let balanceMap = new Map<string, Decimal>();

      if (input.includeBalances && input.periodId) {
        const balances = await ctx.db.accountBalance.findMany({
          where: {
            accountId: { in: accounts.map(a => a.id) },
            periodId: input.periodId,
          },
        });

        balanceMap = new Map(
          balances.map(b => [b.accountId, b.closingBalance])
        );
      }

      // Build tree structure
      const tree = buildAccountTree(accounts, balanceMap, input.rootAccountId);

      return tree;
    }),

  // Create account group
  createGroup: protectedProcedure
    .input(CreateAccountGroupInput)
    .mutation(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      // Calculate path for hierarchy
      let path = input.groupCode;
      let level = 0;

      if (input.parentGroupId) {
        const parent = await ctx.db.accountGroups.findFirst({
          where: { id: input.parentGroupId, organizationId },
        });

        if (!parent) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Parent group not found',
          });
        }

        path = `${parent.path}.${input.groupCode}`;
        level = parent.level + 1;
      }

      const group = await ctx.db.accountGroups.create({
        data: {
          organizationId,
          ...input,
          path,
          level,
        },
      });

      return group;
    }),

  // Add accounts to group
  addAccountsToGroup: protectedProcedure
    .input(z.object({
      groupId: z.string().uuid(),
      accountIds: z.array(z.string().uuid()),
    }))
    .mutation(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      // Verify group belongs to organization
      const group = await ctx.db.accountGroups.findFirst({
        where: { id: input.groupId, organizationId },
      });

      if (!group) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group not found',
        });
      }

      // Add members
      const members = input.accountIds.map((accountId, index) => ({
        groupId: input.groupId,
        accountId,
        sortOrder: index,
      }));

      await ctx.db.accountGroupMembers.createMany({
        data: members,
        skipDuplicates: true,
      });

      return { added: members.length };
    }),

  // Get group with aggregated balance
  getGroupBalance: protectedProcedure
    .input(z.object({
      groupId: z.string().uuid(),
      periodId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      // Get group with descendants (using path)
      const group = await ctx.db.accountGroups.findFirst({
        where: { id: input.groupId, organizationId },
      });

      if (!group) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group not found',
        });
      }

      // Get all account IDs in this group and subgroups
      const allGroups = await ctx.db.accountGroups.findMany({
        where: {
          organizationId,
          path: { startsWith: group.path },
        },
      });

      const groupIds = allGroups.map(g => g.id);

      const members = await ctx.db.accountGroupMembers.findMany({
        where: { groupId: { in: groupIds } },
      });

      const accountIds = members.map(m => m.accountId);

      // Get balances
      const balances = await ctx.db.accountBalance.findMany({
        where: {
          accountId: { in: accountIds },
          periodId: input.periodId,
        },
      });

      const totalBalance = balances.reduce(
        (sum, b) => sum.plus(b.closingBalance),
        new Decimal(0)
      );

      return {
        group,
        accountCount: accountIds.length,
        totalBalance,
      };
    }),
});

// Helper function to build tree
function buildAccountTree(
  accounts: ChartOfAccount[],
  balanceMap: Map<string, Decimal>,
  rootId?: string
): AccountTreeNode[] {
  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const childrenMap = new Map<string | null, ChartOfAccount[]>();

  // Group accounts by parent
  for (const account of accounts) {
    const parentId = account.parentAccountId;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(account);
  }

  // Recursive tree builder
  function buildNode(account: ChartOfAccount, level: number): AccountTreeNode {
    const children = childrenMap.get(account.id) || [];
    const childNodes = children.map(c => buildNode(c, level + 1));

    // Calculate balance (own + children for summary accounts)
    let balance = balanceMap.get(account.id) || new Decimal(0);
    if (!account.allowsPosting && childNodes.length > 0) {
      balance = childNodes.reduce(
        (sum, c) => sum.plus(c.balance || 0),
        new Decimal(0)
      );
    }

    return {
      id: account.id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      normalBalance: account.normalBalance,
      level,
      hasChildren: children.length > 0,
      balance: balance.toNumber(),
      children: childNodes.length > 0 ? childNodes : undefined,
    };
  }

  // Start from root accounts (no parent or specified root)
  const rootAccounts = rootId
    ? [accountMap.get(rootId)].filter(Boolean)
    : childrenMap.get(null) || [];

  return rootAccounts.map(a => buildNode(a!, 0));
}
```

---

## Test Specifications

### Unit Tests

```typescript
describe('Account Hierarchy', () => {
  describe('buildAccountTree', () => {
    it('should create nested tree structure', () => {
      const accounts = [
        { id: '1', accountCode: '100', parentAccountId: null },
        { id: '2', accountCode: '101', parentAccountId: '1' },
        { id: '3', accountCode: '102', parentAccountId: '1' },
      ];

      const tree = buildAccountTree(accounts, new Map());

      expect(tree).toHaveLength(1);
      expect(tree[0].children).toHaveLength(2);
    });

    it('should calculate parent balance from children', () => {
      const accounts = [
        { id: '1', accountCode: '100', allowsPosting: false },
        { id: '2', accountCode: '101', parentAccountId: '1', allowsPosting: true },
        { id: '3', accountCode: '102', parentAccountId: '1', allowsPosting: true },
      ];

      const balances = new Map([
        ['2', new Decimal(1000)],
        ['3', new Decimal(500)],
      ]);

      const tree = buildAccountTree(accounts, balances);

      expect(tree[0].balance).toBe(1500);
    });
  });

  describe('getGroupBalance', () => {
    it('should aggregate balances across group hierarchy', async () => {
      // Setup: Group A with subgroups A.1 and A.2
      const result = await service.getGroupBalance({
        groupId: 'group-a',
        periodId: 'period-1',
      });

      expect(result.totalBalance.toNumber()).toBe(5000);
    });
  });
});
```

---

## Security Checklist

- [x] Organization isolation for groups
- [x] RLS policies for account_groups table
- [x] Only authorized users can modify hierarchy
- [x] Audit logging for group changes

---

## Tasks

- [ ] Create database migrations
- [ ] Implement LTREE extension for PostgreSQL
- [ ] Create tree-building utility functions
- [ ] Implement group balance aggregation
- [ ] Create tree view UI component
- [ ] Write tests

---

*Last updated: December 2024*
