# Data Privacy Review Checklist (RODO/GDPR)

## Overview

This checklist ensures GDPR (RODO in Polish) compliance for all features handling personal data within the Polish Accounting Platform. All stories involving personal data processing must pass this review before deployment.

**Legal Basis**: Regulation (EU) 2016/679 (GDPR) and Polish Act on Personal Data Protection (Ustawa o ochronie danych osobowych)

---

## 1. Data Classification

### 1.1 Personal Data Identification

- [ ] **Data Mapping Complete**: All personal data fields identified and documented
- [ ] **Data Categories Defined**: Data classified by sensitivity level
  - [ ] Basic personal data (name, email, phone)
  - [ ] Contact data (address, correspondence)
  - [ ] Financial data (salary, bank accounts, tax information)
  - [ ] Employment data (contracts, position, department)
  - [ ] Identification data (PESEL, NIP, ID numbers)
  - [ ] Sensitive/Special category data (health, religion, political views)
- [ ] **Data Subjects Identified**: Categories of people whose data is processed
  - [ ] Employees
  - [ ] Clients (business representatives)
  - [ ] Contractors
  - [ ] Users (system users)

### 1.2 Polish-Specific Data

- [ ] **PESEL Handling**: 11-digit national ID number properly protected
  - [ ] Masked in UI (show only last 4 digits)
  - [ ] Encrypted at rest
  - [ ] Access logged
- [ ] **NIP Handling**: Tax identification number appropriately stored
- [ ] **REGON Handling**: Business registry number managed correctly
- [ ] **Bank Account Numbers (IBAN)**: Encrypted and access-controlled

---

## 2. Legal Basis for Processing

### 2.1 Processing Justification

- [ ] **Legal Basis Documented**: Each data processing activity has valid legal basis
  - [ ] Contract performance (Art. 6(1)(b))
  - [ ] Legal obligation (Art. 6(1)(c)) - Polish tax law, labor law
  - [ ] Legitimate interest (Art. 6(1)(f))
  - [ ] Consent (Art. 6(1)(a)) - only when necessary
- [ ] **Purpose Limitation**: Data used only for stated purposes
- [ ] **Necessity Assessment**: Only necessary data collected (data minimization)

### 2.2 Polish Legal Requirements

- [ ] **Tax Obligations**: Data processing complies with Ordynacja podatkowa
- [ ] **Labor Law**: Employee data handling meets Kodeks pracy requirements
- [ ] **Social Security**: ZUS reporting requirements satisfied
- [ ] **Accounting Law**: Ustawa o rachunkowości compliance ensured

---

## 3. Data Subject Rights

### 3.1 Rights Implementation

- [ ] **Right to Access (Art. 15)**
  - [ ] Users can view all their personal data
  - [ ] Export functionality available (machine-readable format)
  - [ ] Response within 30 days guaranteed
- [ ] **Right to Rectification (Art. 16)**
  - [ ] Users can correct inaccurate data
  - [ ] Correction propagates to all systems
  - [ ] Audit trail of changes maintained
- [ ] **Right to Erasure (Art. 17)**
  - [ ] Deletion request mechanism exists
  - [ ] Exceptions documented (legal retention requirements)
  - [ ] Deletion confirmation provided
- [ ] **Right to Restriction (Art. 18)**
  - [ ] Processing can be restricted on request
  - [ ] Restricted data marked appropriately
- [ ] **Right to Data Portability (Art. 20)**
  - [ ] Export in common format (JSON, CSV)
  - [ ] Transfer to another controller supported
- [ ] **Right to Object (Art. 21)**
  - [ ] Objection mechanism implemented
  - [ ] Marketing opt-out available

### 3.2 Polish-Specific Rights

- [ ] **Request Handling in Polish**: All communications in Polish
- [ ] **UODO Complaint Information**: Users informed about complaint rights to Urząd Ochrony Danych Osobowych

---

## 4. Consent Management

### 4.1 Consent Requirements

- [ ] **Explicit Consent**: Where consent is legal basis
  - [ ] Consent is freely given
  - [ ] Consent is specific to purpose
  - [ ] Consent is informed (clear explanation)
  - [ ] Consent is unambiguous (affirmative action)
- [ ] **Consent Records**: Evidence of consent stored
  - [ ] Timestamp of consent
  - [ ] Version of privacy policy accepted
  - [ ] IP address (for audit)
  - [ ] Consent text shown at time of consent
- [ ] **Consent Withdrawal**: Easy withdrawal mechanism
  - [ ] As easy to withdraw as to give
  - [ ] Processing stops after withdrawal
  - [ ] Withdrawal doesn't affect prior lawful processing

### 4.2 Cookie Consent (if applicable)

- [ ] **Cookie Banner**: Clear cookie consent mechanism
- [ ] **Granular Consent**: Users can choose cookie categories
- [ ] **Pre-checked Boxes**: Not used for consent

---

## 5. Security Measures

### 5.1 Technical Measures

- [ ] **Encryption at Rest**
  - [ ] Personal data encrypted (AES-256)
  - [ ] Encryption keys properly managed
  - [ ] PESEL, bank accounts always encrypted
- [ ] **Encryption in Transit**
  - [ ] TLS 1.3 for all connections
  - [ ] Certificate pinning for mobile apps
- [ ] **Access Control**
  - [ ] Role-based access control (RBAC) implemented
  - [ ] Principle of least privilege applied
  - [ ] Regular access reviews scheduled
- [ ] **Authentication**
  - [ ] Strong password policy
  - [ ] Multi-factor authentication available
  - [ ] Session management secure

### 5.2 Data Masking & Pseudonymization

- [ ] **UI Masking**: Sensitive data masked by default
  - [ ] PESEL: `***********` or `*******1234`
  - [ ] Bank accounts: `PL** **** **** **** **** **** ****`
  - [ ] Salary: visible only to authorized roles
- [ ] **Logs Sanitization**: No personal data in logs
  - [ ] User IDs instead of names
  - [ ] Request bodies sanitized
  - [ ] Stack traces reviewed

### 5.3 Polish Security Standards

- [ ] **KNF Requirements**: If financial data - compliance with Polish Financial Supervision Authority
- [ ] **National Cybersecurity System**: Alignment with Krajowy System Cyberbezpieczeństwa

---

## 6. Data Retention

### 6.1 Retention Policies

- [ ] **Retention Periods Defined**: For each data category
  - [ ] Tax documents: 5 years (Ordynacja podatkowa)
  - [ ] Employment records: 10 years from employment end (Kodeks pracy)
  - [ ] Accounting documents: 5 years (Ustawa o rachunkowości)
  - [ ] User accounts: Duration of service + 30 days
  - [ ] Logs: 90 days standard, 1 year for security logs
- [ ] **Automatic Deletion**: Expired data automatically removed
- [ ] **Retention Override**: Legal hold capability for investigations

### 6.2 Archive vs Delete

- [ ] **Archiving Process**: Data moved to cold storage before deletion
- [ ] **Permanent Deletion**: Secure deletion methods used
  - [ ] Database records: Hard delete (not soft delete for expired retention)
  - [ ] Files: Secure overwrite or cryptographic erasure
  - [ ] Backups: Retention aligned or anonymized

---

## 7. Third-Party Processing

### 7.1 Data Processors

- [ ] **Processor Agreements (DPA)**: Art. 28 agreements in place
  - [ ] AWS (infrastructure)
  - [ ] Email providers (SendGrid, etc.)
  - [ ] Analytics (if any)
  - [ ] AI/LLM providers (OpenAI, Anthropic)
- [ ] **Sub-processor List**: All sub-processors documented
- [ ] **Due Diligence**: Processor security assessed

### 7.2 International Transfers

- [ ] **Transfer Mechanisms**: Valid transfer basis for non-EU
  - [ ] Standard Contractual Clauses (SCCs)
  - [ ] Adequacy decisions (US via Data Privacy Framework)
- [ ] **AI Provider Data**: LLM interactions don't store Polish personal data
  - [ ] Prompts sanitized before sending to AI
  - [ ] No PESEL, NIP in AI requests
  - [ ] AI responses don't contain personal data

---

## 8. Breach Management

### 8.1 Breach Response

- [ ] **Detection Capability**: Monitoring for data breaches
- [ ] **Response Procedure**: Documented breach response plan
  - [ ] Incident classification
  - [ ] Containment measures
  - [ ] Assessment of risk to data subjects
- [ ] **Notification Procedures**
  - [ ] UODO notification: Within 72 hours (Art. 33)
  - [ ] Data subject notification: Without undue delay (Art. 34)
  - [ ] Polish language notifications
- [ ] **Breach Register**: All breaches recorded (even if not reported)

### 8.2 Polish Notification Requirements

- [ ] **UODO Contact**: Urząd Ochrony Danych Osobowych notification template ready
- [ ] **CERT Polska**: Cybersecurity incident reporting if required

---

## 9. Privacy by Design

### 9.1 Design Principles

- [ ] **Data Minimization**: Only necessary fields collected
- [ ] **Purpose Limitation**: No feature creep in data usage
- [ ] **Storage Limitation**: No indefinite storage
- [ ] **Accuracy**: Mechanisms for keeping data accurate
- [ ] **Integrity & Confidentiality**: Security by design

### 9.2 Default Settings

- [ ] **Privacy-Friendly Defaults**: Most restrictive by default
- [ ] **Marketing Opt-in**: Not opt-out
- [ ] **Sharing Disabled**: Data sharing off by default

---

## 10. Documentation

### 10.1 Privacy Documentation

- [ ] **Privacy Policy**: Clear, accessible privacy policy
  - [ ] Polish version available
  - [ ] Plain language used
  - [ ] All processing purposes listed
  - [ ] Data subject rights explained
- [ ] **Records of Processing (RoPA)**: Art. 30 register maintained
- [ ] **Data Protection Impact Assessment (DPIA)**: If high risk processing
  - [ ] Large-scale employee data
  - [ ] Systematic monitoring
  - [ ] Automated decision-making

### 10.2 Internal Documentation

- [ ] **Data Flow Diagrams**: How personal data flows through system
- [ ] **Access Matrix**: Who can access what data
- [ ] **Vendor Assessment**: Third-party risk assessment

---

## 11. AI-Specific Privacy Considerations

### 11.1 AI Agent Data Handling

- [ ] **No Personal Data to External AI**: PESEL, names, addresses not sent to LLM
- [ ] **Prompt Sanitization**: Personal identifiers replaced with placeholders
- [ ] **AI Response Filtering**: Responses checked for leaked personal data
- [ ] **Knowledge Base Privacy**: Documents with personal data properly handled
  - [ ] Anonymization before indexing
  - [ ] Access controls on knowledge base

### 11.2 Automated Decision-Making

- [ ] **Art. 22 Compliance**: No solely automated decisions with legal effects
- [ ] **Human Oversight**: Human review available for AI recommendations
- [ ] **Explanation Capability**: AI decisions can be explained to users
- [ ] **Right to Contest**: Users can challenge AI-assisted decisions

---

## 12. Audit Trail Requirements

### 12.1 Logging Requirements

- [ ] **Access Logs**: Who accessed personal data
  - [ ] User ID
  - [ ] Timestamp
  - [ ] Data accessed (type, not content)
  - [ ] Access reason (if required)
- [ ] **Change Logs**: Modifications to personal data
  - [ ] Before/after values (encrypted)
  - [ ] Who made change
  - [ ] When changed
- [ ] **Export Logs**: When data exported/downloaded
- [ ] **Deletion Logs**: Record of data deletions

### 12.2 Polish Audit Requirements

- [ ] **Tax Audit Support**: Logs available for 5 years
- [ ] **ZUS Audit Support**: Employment records accessible
- [ ] **UODO Inspection Ready**: Documentation prepared for regulatory inspection

---

## Feature-Specific Checklists

### Employee Data (HRP Module)

- [ ] PESEL encrypted and masked
- [ ] Salary data restricted to authorized roles
- [ ] Bank account details encrypted
- [ ] Employment contracts retention: 10 years
- [ ] Medical certificates handling (sensitive data)
- [ ] ZUS reporting data protection

### Client Data (CRM Module)

- [ ] Business vs personal client distinction
- [ ] Contact person data minimized
- [ ] Data sharing permissions tracked
- [ ] Marketing consent managed

### Financial Data (ACC/TAX Modules)

- [ ] Invoice data with personal details protected
- [ ] JPK files generated securely
- [ ] Tax data retention enforced (5 years)
- [ ] Bank statements handled securely

### Document Data (DOC Module)

- [ ] Personal data in documents identified
- [ ] OCR results with personal data encrypted
- [ ] Document retention policies applied
- [ ] Secure deletion of processed documents

### AI Agent Data (AAM Module)

- [ ] Conversation data retention limited
- [ ] No personal data in AI prompts
- [ ] Knowledge base content reviewed
- [ ] AI-generated responses filtered

### Portal Data (CSP Module)

- [ ] Client self-service access logged
- [ ] Document downloads tracked
- [ ] Session data minimal
- [ ] Messaging content encrypted

---

## Sign-Off

### Review Completion

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Security Engineer | | | |
| Data Protection Officer | | | |
| Product Owner | | | |

### Review Outcome

- [ ] **APPROVED**: All requirements met
- [ ] **APPROVED WITH CONDITIONS**: Minor issues to address post-deployment
- [ ] **REJECTED**: Critical issues must be resolved before deployment

### Conditions/Notes

```
[Document any conditions for approval or rejection reasons here]
```

---

## References

- [GDPR Full Text](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [UODO - Polish Data Protection Authority](https://uodo.gov.pl)
- [Polish Personal Data Protection Act](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20180001000)
- [Ordynacja podatkowa](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=wdu19971370926)
- [Kodeks pracy](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19740240141)
- [Ustawa o rachunkowości](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=wdu19941210591)

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-XX | BMAD System | Initial version |
