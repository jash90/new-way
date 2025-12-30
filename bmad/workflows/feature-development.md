# 🔄 Feature Development Workflow

> **Workflow ID**: `feature-development`  
> **Version**: 1.0.0  
> **Complexity**: Standard (15-30 min planning)  

---

## 📋 Overview

This workflow guides the development of new features for the Accounting CRM Platform. It ensures consistent quality, security review, and proper documentation throughout the development process.

---

## 🎯 Phases

```
┌─────────────────────────────────────────────────────────────┐
│                    FEATURE DEVELOPMENT                       │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│   1. SPECIFY    │  Define what and why
│                 │  • User story
│                 │  • Acceptance criteria
│                 │  • Technical context
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    2. PLAN      │  Determine how
│                 │  • Architecture decisions
│                 │  • Security review
│                 │  • Integration points
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   3. TASKS      │  Break into units
│                 │  • Implementation tasks
│                 │  • Test tasks
│                 │  • Documentation tasks
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  4. IMPLEMENT   │  AI executes, human reviews
│                 │  • Code generation
│                 │  • Test execution
│                 │  • Code review
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   5. VERIFY     │  Ensure quality
│                 │  • Security checklist
│                 │  • Test coverage
│                 │  • Documentation check
└─────────────────┘
```

---

## 📝 Phase 1: SPECIFY

### Inputs Required
- Feature request or user story
- Related epic/module context
- Business requirements

### Steps

1. **Load Context**
   ```
   Action: Read relevant documents
   - Constitution: .bmad/constitution.md
   - Project: .bmad/project.md
   - Module spec: docs/specs/{module}-spec.md
   - Related stories: .bmad/stories/{module}/
   ```

2. **Define User Story**
   ```markdown
   As a [role]
   I want [capability]
   So that [benefit]
   ```

3. **Write Acceptance Criteria**
   ```gherkin
   Given [precondition]
   When [action]
   Then [expected result]
   And [additional expectations]
   ```

4. **Identify Technical Context**
   - Database tables affected
   - API endpoints needed
   - External integrations
   - Security considerations

### Outputs
- Story file in `.bmad/stories/{module}/`
- Clear acceptance criteria
- Technical context documented

### Quality Gate
- [ ] User story follows format
- [ ] Acceptance criteria are testable
- [ ] Technical context is complete
- [ ] Security implications identified

---

## 📐 Phase 2: PLAN

### Inputs Required
- Completed specification from Phase 1
- Constitution rules
- Agent expertise (security, accounting, etc.)

### Steps

1. **Consult Relevant Agents**
   ```
   For authentication features:
   → security-architect agent
   
   For Polish compliance:
   → polish-accounting-expert agent
   
   For data modeling:
   → database-architect agent (if available)
   ```

2. **Architecture Decisions**
   - Define data models
   - Design API contracts
   - Plan integration approach
   - Document decisions

3. **Security Review**
   ```
   Run security checklist:
   - Authentication requirements
   - Authorization model
   - Data protection needs
   - Audit logging requirements
   - Input validation
   - Rate limiting
   ```

4. **Estimate Complexity**
   | Points | Complexity | Duration |
   |--------|------------|----------|
   | 1-2 | Trivial | < 2 hours |
   | 3-5 | Simple | 2-4 hours |
   | 8 | Standard | 1-2 days |
   | 13 | Complex | 3-5 days |
   | 21+ | Epic | Split required |

### Outputs
- Updated story file with technical plan
- Architecture diagrams (if needed)
- Security review completed
- Complexity estimate

### Quality Gate
- [ ] Architecture aligns with constitution
- [ ] Security review passed
- [ ] No blockers identified
- [ ] Estimate is reasonable

---

## 📋 Phase 3: TASKS

### Inputs Required
- Completed plan from Phase 2
- Story file with full context

### Steps

1. **Break Down Implementation**
   ```markdown
   ## Implementation Tasks
   
   - [ ] TASK-001: Create database migration
   - [ ] TASK-002: Implement service layer
   - [ ] TASK-003: Create tRPC router
   - [ ] TASK-004: Build UI components
   - [ ] TASK-005: Add validation schemas
   ```

2. **Define Test Tasks**
   ```markdown
   ## Test Tasks
   
   - [ ] TEST-001: Unit tests for service
   - [ ] TEST-002: Integration tests for API
   - [ ] TEST-003: E2E test for user flow
   ```

3. **Documentation Tasks**
   ```markdown
   ## Documentation Tasks
   
   - [ ] DOC-001: Update API documentation
   - [ ] DOC-002: Add user guide section
   - [ ] DOC-003: Update changelog
   ```

4. **Order Tasks**
   - Identify dependencies
   - Create execution order
   - Mark parallel-safe tasks

### Outputs
- Task list with clear ordering
- Dependencies identified
- Effort distributed evenly

### Quality Gate
- [ ] Tasks are atomic (1-4 hours each)
- [ ] Dependencies are clear
- [ ] No task is too large
- [ ] Test coverage planned

---

## ⚙️ Phase 4: IMPLEMENT

### Inputs Required
- Task list from Phase 3
- Full story context
- Development environment ready

### Steps

1. **Setup Branch**
   ```bash
   git checkout -b feature/{module}-{story-id}
   # Example: feature/aim-001-user-registration
   ```

2. **Execute Tasks**
   For each task:
   ```
   a. Read task requirements
   b. Generate/write code
   c. Run linters
   d. Run relevant tests
   e. Self-review changes
   f. Mark task complete
   ```

3. **Code Generation Guidelines**
   ```
   DO:
   - Follow constitution rules
   - Use Decimal.js for money
   - Add Zod schemas
   - Include audit logging
   - Write tests alongside code
   
   DON'T:
   - Use 'any' type
   - Skip error handling
   - Hardcode secrets
   - Ignore security checklist
   ```

4. **Continuous Testing**
   ```bash
   # Run after each significant change
   pnpm test:unit --related
   pnpm lint
   pnpm typecheck
   ```

### Outputs
- Working code implementation
- Tests passing
- Linting clean

### Quality Gate
- [ ] All tasks completed
- [ ] Tests pass locally
- [ ] No linting errors
- [ ] TypeScript compiles

---

## ✅ Phase 5: VERIFY

### Inputs Required
- Completed implementation
- All tests passing

### Steps

1. **Run Full Test Suite**
   ```bash
   pnpm test
   pnpm test:integration
   pnpm test:e2e
   ```

2. **Security Checklist**
   Run `.bmad/checklists/security-review.md`

3. **Coverage Check**
   ```bash
   pnpm test:coverage
   # Verify meets thresholds from constitution
   ```

4. **Documentation Review**
   - [ ] API docs updated
   - [ ] README updated (if needed)
   - [ ] Changelog entry added

5. **Create PR**
   ```markdown
   ## Description
   [Link to story file]
   
   ## Changes
   - [Summary of changes]
   
   ## Testing
   - [ ] Unit tests added/updated
   - [ ] Integration tests pass
   - [ ] E2E tests pass
   
   ## Security
   - [ ] Security checklist completed
   - [ ] No sensitive data exposed
   
   ## Screenshots (if UI)
   [Add screenshots]
   ```

### Outputs
- Pull request ready for review
- All checks passing
- Documentation complete

### Quality Gate
- [ ] All tests pass
- [ ] Coverage meets thresholds
- [ ] Security checklist complete
- [ ] Documentation updated
- [ ] PR description complete

---

## 🔧 Agent Integration

### Which Agent When

| Phase | Primary Agent | Secondary Agents |
|-------|---------------|------------------|
| Specify | PM Agent | Domain Expert |
| Plan | Architect Agent | Security Architect |
| Tasks | Scrum Master | Developer Agent |
| Implement | Developer Agent | Test Agent |
| Verify | QA Agent | Security Architect |

### Agent Commands

```
# Start specification
/bmad specify --story "User Registration"

# Plan with security review
/bmad plan --security-review

# Generate tasks
/bmad tasks --estimate

# Implement with tests
/bmad implement --with-tests

# Verify and create PR
/bmad verify --create-pr
```

---

## 📊 Metrics to Track

| Metric | Target | Measurement |
|--------|--------|-------------|
| Story completion time | 2-3 days (8 points) | Actual vs estimate |
| First-pass PR approval | 80% | PRs without rework |
| Test coverage | >80% | Coverage report |
| Security issues found | 0 | Post-review findings |
| Documentation completeness | 100% | Checklist compliance |

---

## 🚨 Escalation Paths

### Blocked by Technical Issue
1. Document blocker in story file
2. Consult relevant agent
3. If unresolved, flag for human review

### Security Concern Found
1. Stop implementation
2. Document concern
3. Consult security-architect agent
4. Get human approval before proceeding

### Scope Creep Detected
1. Compare to original acceptance criteria
2. If significant, create new story
3. Do not expand current story

### Estimate Exceeded
1. After 1.5x estimated time, pause
2. Review progress and remaining work
3. Decide: push through or split story

---

## 📎 Related Documents

- [Constitution](../constitution.md)
- [Security Review Checklist](../checklists/security-review.md)
- [Story Template](../templates/story.md)
- [PR Template](../templates/pull-request.md)

---

*Workflow version 1.0.0 - December 2024*
