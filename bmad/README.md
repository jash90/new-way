# 🚀 BMAD Configuration for Accounting CRM Platform

> **Version**: 1.0.0  
> **Framework**: BMAD (Breakthrough Method for Agile AI-Driven Development)  
> **Project**: KsięgowaCRM - Polish Accounting Platform  

---

## 📁 Directory Structure

```
.bmad/
├── README.md                 # This file
├── constitution.md           # Non-negotiable rules and standards
├── project.md               # Project context and overview
│
├── agents/                  # Custom AI agents
│   ├── polish-accounting-expert.md   # Polish regulations expert
│   └── security-architect.md         # Security and auth expert
│
├── workflows/               # Development workflows
│   └── feature-development.md        # Standard feature workflow
│
├── stories/                 # User stories by module
│   └── aim-module/         
│       ├── epic.md                   # Module epic overview
│       └── AIM-001-user-registration.md  # Individual story
│
├── templates/               # Reusable templates
│   └── story.md                      # Story template
│
├── checklists/              # Review checklists
│   └── security-review.md            # Security checklist
│
└── data/                    # Reference data
    └── (future: tax rates, etc.)
```

---

## 🎯 Quick Start

### 1. Read the Constitution First

Before any development work, review the constitution:

```bash
cat .bmad/constitution.md
```

Key rules:
- Use `Decimal.js` for ALL money calculations
- Use `Argon2id` for password hashing
- Use `Zod` for ALL input validation
- RLS enabled on ALL user tables
- Audit logging for ALL mutations

### 2. Consult Relevant Agents

For authentication/security features:
```bash
cat .bmad/agents/security-architect.md
```

For Polish compliance:
```bash
cat .bmad/agents/polish-accounting-expert.md
```

### 3. Follow the Workflow

For any feature development:
```bash
cat .bmad/workflows/feature-development.md
```

Phases:
1. **SPECIFY** - Define what and why
2. **PLAN** - Determine how
3. **TASKS** - Break into units
4. **IMPLEMENT** - Execute with AI
5. **VERIFY** - Ensure quality

### 4. Create Story from Template

```bash
cp .bmad/templates/story.md .bmad/stories/{module}/{STORY-ID}.md
```

Fill in all sections before implementation.

### 5. Complete Security Checklist

Before any PR:
```bash
cat .bmad/checklists/security-review.md
```

---

## 📋 Current Module Status

| Module | Code | Status | Stories |
|--------|------|--------|---------|
| Authentication & Identity | AIM | 🟡 In Progress | 12 |
| Core CRM | CRM | 📋 Specified | 0 |
| Accounting Engine | ACC | 📋 Specified | 0 |
| Tax Compliance | TAX | 📋 Specified | 0 |
| Document Intelligence | DOC | 📋 Specified | 0 |

---

## 🔐 AIM Module Stories

| ID | Title | Points | Status |
|----|-------|--------|--------|
| AIM-001 | User Registration | 8 | 🟢 Ready |
| AIM-002 | Profile Setup | 5 | 🟡 Draft |
| AIM-003 | User Login | 8 | 🟡 Draft |
| AIM-004 | Password Reset | 5 | 🟡 Draft |
| AIM-005 | Session Management | 8 | 🟡 Draft |
| AIM-006 | Logout | 2 | 🟡 Draft |
| AIM-007 | RBAC Setup | 8 | 🟡 Draft |
| AIM-008 | Permission Management | 5 | 🟡 Draft |
| AIM-009 | TOTP MFA Setup | 8 | 🟡 Draft |
| AIM-010 | Backup Codes | 3 | 🟡 Draft |
| AIM-011 | Audit Logging | 8 | 🟡 Draft |
| AIM-012 | Security Events | 5 | 🟡 Draft |

**Total**: 73 points (~3-4 weeks)

---

## 🤖 Agent Usage Guide

### Polish Accounting Expert

Use for:
- NIP/REGON validation rules
- KSeF integration requirements
- ZUS contribution calculations
- Polish tax regulations
- Compliance requirements

Example prompts:
- "What are the NIP validation rules?"
- "How should we structure KSeF invoice submission?"
- "What ZUS declarations are required monthly?"

### Security Architect

Use for:
- Authentication flow design
- Authorization model decisions
- Encryption requirements
- Threat modeling
- Security code review

Example prompts:
- "Review the login flow for security issues"
- "What rate limiting should we apply to this endpoint?"
- "How should we store MFA backup codes?"

---

## ✅ Development Checklist

### Before Starting a Story
- [ ] Read constitution.md
- [ ] Read relevant module spec
- [ ] Consult appropriate agents
- [ ] Create story file from template

### During Implementation
- [ ] Follow story acceptance criteria
- [ ] Write tests alongside code
- [ ] Use Decimal.js for money
- [ ] Add Zod validation
- [ ] Include audit logging

### Before PR
- [ ] Complete security checklist
- [ ] All tests pass
- [ ] Coverage meets thresholds
- [ ] Documentation updated

---

## 📚 Reference Documents

### Core Documents
- [Constitution](constitution.md) - Must-follow rules
- [Project Context](project.md) - Project overview

### Module Specs (in /docs/)
- aim-module-spec.md - Authentication module
- crm-module-spec.md - CRM module
- accounting-engine-spec.md - Accounting module

### External References
- [KSeF Documentation](https://www.podatki.gov.pl/ksef/)
- [ZUS PUE API](https://www.zus.pl/)
- [GUS REGON API](https://api.stat.gov.pl/)

---

## 🔄 Workflow Commands (Future)

```bash
# Initialize BMAD (when CLI available)
npx bmad-method@alpha install

# Start new story
/bmad specify --module aim --title "User Registration"

# Plan with security review
/bmad plan --security-review

# Generate tasks
/bmad tasks --estimate

# Implement story
/bmad implement --story AIM-001

# Verify and create PR
/bmad verify --create-pr
```

---

## 📞 Support

- **Technical Questions**: Review agent files first
- **Process Questions**: Check workflow documentation
- **Security Concerns**: Always escalate immediately

---

*BMAD Configuration created: December 2024*  
*Last updated: December 2024*
