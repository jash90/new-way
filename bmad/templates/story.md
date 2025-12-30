# 📋 Story: {MODULE}-{ID} - {Title}

> **Story ID**: `{MODULE}-{ID}`  
> **Epic**: {EPIC-ID}  
> **Status**: 🔴 Draft | 🟡 Ready | 🟢 In Progress | ✅ Done  
> **Points**: {1|2|3|5|8|13}  
> **Priority**: P0 | P1 | P2 | P3  

---

## 📖 User Story

**As a** {role}  
**I want** {capability}  
**So that** {benefit}  

---

## ✅ Acceptance Criteria

### AC1: {Scenario Name}
```gherkin
Given {precondition}
When {action}
Then {expected result}
And {additional expectation}
```

### AC2: {Scenario Name}
```gherkin
Given {precondition}
When {action}
Then {expected result}
```

<!-- Add more ACs as needed -->

---

## 🔧 Technical Specification

### Database Schema

```sql
-- Tables affected
-- Include CREATE TABLE or ALTER TABLE statements
```

### API Endpoints

```typescript
// Endpoint definitions with request/response types
```

### Zod Schemas

```typescript
// Input validation schemas
```

### Implementation Code

```typescript
// Key implementation snippets
// Service layer, router, components
```

---

## 🧪 Test Specifications

### Unit Tests

```typescript
describe('{Component}', () => {
  it('should {expected behavior}', () => {
    // Test implementation
  });
});
```

### Integration Tests

```typescript
describe('{Feature} Integration', () => {
  it('should {expected behavior}', () => {
    // Test implementation
  });
});
```

### E2E Tests

```typescript
test.describe('{Feature}', () => {
  test('should {expected behavior}', async ({ page }) => {
    // Test implementation
  });
});
```

---

## 🔒 Security Checklist

- [ ] Authentication required
- [ ] Authorization checked
- [ ] Input validation with Zod
- [ ] Rate limiting applied
- [ ] Audit logging implemented
- [ ] Sensitive data protected
- [ ] RLS policies defined

---

## 📊 Audit Events

| Event | When | Data Logged |
|-------|------|-------------|
| {EVENT_TYPE} | {trigger} | {data} |

---

## 📎 Related Stories

- **Depends on**: {story-ids}
- **Blocks**: {story-ids}
- **Related**: {story-ids}

---

## 📝 Implementation Notes

1. {Note 1}
2. {Note 2}
3. {Note 3}

---

## ✅ Definition of Done

- [ ] All acceptance criteria pass
- [ ] Unit tests: >80% coverage
- [ ] Integration tests pass
- [ ] E2E test passes
- [ ] Security checklist complete
- [ ] Audit logging verified
- [ ] Code reviewed
- [ ] Documentation updated

---

## 📋 Tasks

### Implementation
- [ ] TASK-001: {description}
- [ ] TASK-002: {description}

### Testing
- [ ] TEST-001: {description}
- [ ] TEST-002: {description}

### Documentation
- [ ] DOC-001: {description}

---

*Story created: {date}*  
*Last updated: {date}*
