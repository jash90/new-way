# 🇵🇱 Polish Compliance Review Checklist

> **Checklist ID**: `polish-compliance-review`
> **Version**: 1.0.0
> **Purpose**: Ensure compliance with Polish accounting, tax, and data protection regulations

---

## 📋 Overview

This checklist covers compliance requirements specific to Polish law:
- Ustawa o rachunkowości (Accounting Act)
- Ustawa o VAT (VAT Act)
- Ordynacja podatkowa (Tax Ordinance)
- RODO/GDPR (Data Protection)
- Kodeks pracy (Labor Code)
- Ustawa o systemie ubezpieczeń społecznych (ZUS Act)

---

## 1. NIP (Tax Identification Number) Validation

### 1.1 Format Validation
- [ ] NIP format: exactly 10 digits
- [ ] NIP format: XXX-XXX-XX-XX or XXXXXXXXXX accepted
- [ ] NIP checksum algorithm implemented (modulo 11)
- [ ] Invalid NIPs rejected with clear error message

### 1.2 Verification
- [ ] White List API integration for VAT payer verification
- [ ] Verification required for payments >15,000 PLN
- [ ] Verification result cached (max 24h)
- [ ] Verification history maintained for audit

### 1.3 NIP Checksum Algorithm
```typescript
function validateNIP(nip: string): boolean {
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const digits = nip.replace(/\D/g, '');

  if (digits.length !== 10) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * weights[i];
  }

  const checksum = sum % 11;
  return checksum === parseInt(digits[9]);
}
```

---

## 2. REGON Validation

### 2.1 Format Validation
- [ ] REGON-9 format: exactly 9 digits
- [ ] REGON-14 format: exactly 14 digits (local units)
- [ ] REGON checksum algorithm implemented

### 2.2 GUS Integration
- [ ] BIR1 API integration for REGON verification
- [ ] Company data enrichment from GUS
- [ ] PKD codes extraction
- [ ] Legal form identification

### 2.3 REGON Checksum Algorithm
```typescript
function validateREGON(regon: string): boolean {
  const weights9 = [8, 9, 2, 3, 4, 5, 6, 7];
  const weights14 = [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8];

  const digits = regon.replace(/\D/g, '');

  if (digits.length === 9) {
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += parseInt(digits[i]) * weights9[i];
    }
    return (sum % 11 % 10) === parseInt(digits[8]);
  }

  if (digits.length === 14) {
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(digits[i]) * weights14[i];
    }
    return (sum % 11 % 10) === parseInt(digits[13]);
  }

  return false;
}
```

---

## 3. Bank Account (IBAN) Validation

### 3.1 Format Validation
- [ ] Polish IBAN format: PL + 2 check digits + 24 digits
- [ ] IBAN checksum validation (modulo 97)
- [ ] Bank code extraction (digits 3-6)
- [ ] NRB format support (26 digits without PL prefix)

### 3.2 White List Integration
- [ ] Bank account verified against White List
- [ ] Required for B2B payments >15,000 PLN
- [ ] Split payment account detection
- [ ] Verification stored with transaction

---

## 4. VAT Compliance

### 4.1 Invoice Requirements (Faktura VAT)
- [ ] Sequential invoice numbering
- [ ] Required fields present:
  - [ ] Invoice number
  - [ ] Issue date
  - [ ] Sale date (if different)
  - [ ] Seller NIP and name
  - [ ] Buyer NIP and name
  - [ ] Line items with quantities and prices
  - [ ] VAT rates and amounts
  - [ ] Total amounts (net, VAT, gross)
  - [ ] Payment terms
- [ ] Invoice issued within 15 days of sale

### 4.2 VAT Rates
- [ ] Standard rate: 23%
- [ ] Reduced rate: 8% (food, books, hotels)
- [ ] Reduced rate: 5% (basic food, newspapers)
- [ ] Zero rate: 0% (exports, intra-EU)
- [ ] Exempt: "zw" (medical, education)
- [ ] Not applicable: "np" (reverse charge)

### 4.3 JPK Requirements
- [ ] JPK_V7M/K generated monthly/quarterly
- [ ] XSD schema validation
- [ ] GTU codes applied where required
- [ ] Procedure codes (SW, EE, TP, etc.) applied
- [ ] Submission to e-Urząd within deadline (25th)
- [ ] UPO confirmation stored

### 4.4 Split Payment
- [ ] Split payment mandatory for >15,000 PLN
- [ ] "Mechanizm podzielonej płatności" annotation
- [ ] Applicable for goods/services in Annex 15

---

## 5. Income Tax Compliance

### 5.1 CIT Requirements
- [ ] Correct CIT rate applied (19% or 9%)
- [ ] Small taxpayer status verified (<2M EUR revenue)
- [ ] Estonian CIT option tracked if applicable
- [ ] Advance payments calculated correctly
- [ ] Annual CIT-8 declaration generated

### 5.2 PIT Requirements
- [ ] Tax scale correctly applied (12%/32%)
- [ ] Flat tax option (19%) tracked
- [ ] Tax-free amount considered (30,000 PLN)
- [ ] Deductible expenses validated
- [ ] PIT-36/37 declarations generated

### 5.3 Tax Deductible Expenses
- [ ] Expense documentation required
- [ ] Related to business activity
- [ ] Not on exclusion list (Art. 16 CIT)
- [ ] Properly dated and described
- [ ] VAT input correctly calculated

---

## 6. ZUS Compliance

### 6.1 Contribution Types
- [ ] Retirement insurance (emerytalne)
- [ ] Disability insurance (rentowe)
- [ ] Sickness insurance (chorobowe)
- [ ] Accident insurance (wypadkowe)
- [ ] Health insurance (zdrowotne)
- [ ] Labor Fund (FP)
- [ ] FGŚP

### 6.2 Contribution Rates (2024)
```typescript
const ZUS_RATES = {
  emerytalne: { employee: 9.76, employer: 9.76 },
  rentowe: { employee: 1.5, employer: 6.5 },
  chorobowe: { employee: 2.45, employer: 0 },
  wypadkowe: { employee: 0, employer: 1.67 }, // varies
  zdrowotne: { employee: 9.0, employer: 0 },
  fp: { employee: 0, employer: 2.45 },
  fgsp: { employee: 0, employer: 0.1 }
};
```

### 6.3 ZUS Declarations
- [ ] DRA monthly declaration generated
- [ ] RCA for each employee
- [ ] RSA for absence reports
- [ ] RZA for health-only contributors
- [ ] Submission by 15th (or 20th for firms)

---

## 7. Document Retention

### 7.1 Retention Periods
| Document Type | Period | Legal Basis |
|---------------|--------|-------------|
| Faktury VAT | 5 lat od końca roku | Art. 112 ustawy o VAT |
| Księgi rachunkowe | 5 lat od końca roku | Art. 74 ustawy o rachunkowości |
| Dokumenty płacowe | 10 lat (od 2019) / 50 lat (przed 2019) | Art. 125a ustawy o emeryturach |
| Umowy o pracę | 10 lat od końca stosunku pracy | Art. 94 pkt 9a KP |
| Dokumenty ZUS | 10 lat od przekazania | Art. 47 ust. 3c ustawy o SUS |
| Sprawozdania finansowe | Trwale | Art. 74 ust. 1 ustawy o rachunkowości |

### 7.2 Retention Implementation
- [ ] Automatic retention period calculation
- [ ] Warning before expiration
- [ ] Secure deletion after retention
- [ ] Deletion audit log
- [ ] Legal hold capability

---

## 8. RODO/GDPR Compliance

### 8.1 Data Processing
- [ ] Lawful basis documented for all processing
- [ ] Consent management for optional processing
- [ ] Data minimization principle applied
- [ ] Purpose limitation enforced

### 8.2 Data Subject Rights
- [ ] Right to access (Art. 15)
- [ ] Right to rectification (Art. 16)
- [ ] Right to erasure (Art. 17)
- [ ] Right to data portability (Art. 20)
- [ ] Request handling within 30 days

### 8.3 Security Measures
- [ ] Encryption at rest (AES-256)
- [ ] Encryption in transit (TLS 1.3)
- [ ] Access logging
- [ ] Breach notification procedure (72h)
- [ ] DPO contact available

---

## 9. KSeF Integration

### 9.1 Structured Invoice Requirements
- [ ] XML format per KSeF schema
- [ ] Digital signature (qualified or trusted profile)
- [ ] Invoice submission to KSeF
- [ ] KSeF number retrieval and storage
- [ ] Status synchronization

### 9.2 KSeF Deadlines
- [ ] Mandatory from 2026 (large enterprises)
- [ ] Transition period handling
- [ ] Fallback for system unavailability

---

## 10. Audit Trail Requirements

### 10.1 Accounting Audit Trail
- [ ] All entries have correlation ID
- [ ] User and timestamp recorded
- [ ] Modification history preserved
- [ ] Posted entries immutable
- [ ] Reversal entries for corrections

### 10.2 Access Audit Trail
- [ ] Login/logout recorded
- [ ] Document access logged
- [ ] Data export logged
- [ ] Administrative actions logged
- [ ] Retention: 5 years minimum

---

## 11. Reporting Requirements

### 11.1 Financial Statements
- [ ] Bilans (Balance Sheet)
- [ ] Rachunek zysków i strat (Income Statement)
- [ ] Informacja dodatkowa (Notes)
- [ ] Zestawienie zmian w kapitale (for larger entities)
- [ ] Rachunek przepływów pieniężnych (for larger entities)

### 11.2 Tax Reports
- [ ] JPK_V7M/K (monthly/quarterly VAT)
- [ ] JPK_KR (accounting books on demand)
- [ ] CIT-8 (annual corporate tax)
- [ ] PIT-36/37 (annual personal tax)
- [ ] IFT-1/IFT-2 (foreign payments)

### 11.3 Statistical Reports
- [ ] GUS reports (F-01, F-02)
- [ ] NBP reports (if applicable)
- [ ] Intrastat (EU trade)

---

## 12. Review Checklist Summary

### Pre-Release Checks
- [ ] All NIP validations passing
- [ ] All REGON validations passing
- [ ] IBAN validations with checksums
- [ ] VAT calculations accurate
- [ ] JPK generation tested
- [ ] Document retention configured
- [ ] RODO consent flows working
- [ ] Audit logging enabled

### Periodic Compliance Checks
- [ ] Monthly: JPK submission verified
- [ ] Monthly: ZUS declarations submitted
- [ ] Quarterly: VAT advance payments
- [ ] Annually: CIT/PIT declarations
- [ ] Annually: Financial statements
- [ ] Annually: Retention policy review

---

## 13. Common Compliance Issues

### 13.1 High Risk Areas
| Issue | Impact | Mitigation |
|-------|--------|------------|
| Invalid NIP on invoice | VAT deduction denied | Pre-validation |
| Missing White List check | 100% tax penalty | Automatic verification |
| JPK submission delay | 500 PLN/day penalty | Deadline alerts |
| Wrong VAT rate | Tax arrears + interest | Rate validation |
| Document destruction too early | Legal liability | Retention system |

### 13.2 Remediation Steps
1. Identify non-compliance
2. Document the issue
3. Implement correction
4. Verify fix
5. Prevent recurrence

---

## 14. External Resources

### Official Sources
- [Ministerstwo Finansów](https://www.gov.pl/web/finanse)
- [KSeF](https://www.podatki.gov.pl/ksef/)
- [e-Urząd Skarbowy](https://www.podatki.gov.pl/e-urzad-skarbowy/)
- [ZUS PUE](https://www.zus.pl/portal/logowanie.npi)
- [Biała Lista](https://www.podatki.gov.pl/wykaz-podatnikow-vat-wyszukiwarka/)

### Legal References
- Ustawa o VAT (Dz.U. 2004 Nr 54 poz. 535)
- Ustawa o rachunkowości (Dz.U. 1994 Nr 121 poz. 591)
- Ordynacja podatkowa (Dz.U. 1997 Nr 137 poz. 926)
- RODO (Rozporządzenie UE 2016/679)

---

*Checklist last updated: December 2024*
