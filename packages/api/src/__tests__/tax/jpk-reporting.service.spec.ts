// TAX-007: JPK Reporting Service Tests
// Tests for Polish JPK (Standard Audit File) generation and submission

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JPKReportingService } from '../../services/tax/jpk-reporting.service';
import Decimal from 'decimal.js';

// ===========================================================================
// MOCK DATA
// ===========================================================================

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_ID = '33333333-3333-3333-3333-333333333333';
const REPORT_ID = '44444444-4444-4444-4444-444444444444';
const SALE_RECORD_ID = '55555555-5555-5555-5555-555555555555';
const PURCHASE_RECORD_ID = '66666666-6666-6666-6666-666666666666';

const mockClient = {
  id: CLIENT_ID,
  organizationId: ORG_ID,
  name: 'Test Company Sp. z o.o.',
  nip: '5213017228',
  regon: '012345678',
  email: 'test@company.pl',
  organization: {
    id: ORG_ID,
    name: 'Test Organization',
  },
};

const mockJPKReport = {
  id: REPORT_ID,
  organizationId: ORG_ID,
  clientId: CLIENT_ID,
  reportType: 'JPK_V7M',
  status: 'DRAFT',
  year: 2024,
  month: 1,
  quarter: null,
  periodFrom: new Date('2024-01-01'),
  periodTo: new Date('2024-01-31'),
  purpose: 'FIRST',
  correctionNumber: null,
  originalReportId: null,
  correctionReason: null,
  recordCount: 0,
  saleRecordCount: 0,
  purchaseRecordCount: 0,
  totalSaleNet: null,
  totalSaleVAT: null,
  totalPurchaseNet: null,
  totalPurchaseVAT: null,
  xmlFilePath: null,
  xmlFileSize: null,
  xmlHash: null,
  signedXmlFilePath: null,
  submittedAt: null,
  referenceNumber: null,
  upoNumber: null,
  upoReceivedAt: null,
  upoFilePath: null,
  errorMessage: null,
  errorDetails: null,
  declaration: null,
  generatedBy: USER_ID,
  generatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  client: mockClient,
};

const mockSaleRecord = {
  id: SALE_RECORD_ID,
  reportId: REPORT_ID,
  recordNumber: 1,
  documentType: 'FP',
  documentNumber: 'FV/2024/001',
  documentDate: '2024-01-15',
  saleDate: '2024-01-15',
  buyerNIP: '1234567890',
  buyerName: 'Kupujący Sp. z o.o.',
  buyerCountryCode: 'PL',
  netAmount23: '1000.00',
  vatAmount23: '230.00',
  netAmount8: null,
  vatAmount8: null,
  netAmount5: null,
  vatAmount5: null,
  netAmount0: null,
  netAmountExempt: null,
  netAmountWDT: null,
  netAmountExport: null,
  gtuCodes: ['GTU_12'],
  procedureCodes: [],
  correctedInvoiceNumber: null,
  correctedInvoiceDate: null,
  createdAt: new Date(),
};

const mockPurchaseRecord = {
  id: PURCHASE_RECORD_ID,
  reportId: REPORT_ID,
  recordNumber: 1,
  documentNumber: 'FZ/2024/001',
  documentDate: '2024-01-10',
  receiptDate: '2024-01-12',
  sellerNIP: '9876543210',
  sellerName: 'Sprzedawca Sp. z o.o.',
  sellerCountryCode: 'PL',
  netAmountTotal: '500.00',
  vatAmountDeductible: '115.00',
  vatAmountNonDeductible: null,
  isWNT: false,
  isImportServices: false,
  isMPP: false,
  procedureCodes: [],
  createdAt: new Date(),
};

const mockVATTransaction = {
  id: '77777777-7777-7777-7777-777777777777',
  organizationId: ORG_ID,
  clientId: CLIENT_ID,
  direction: 'OUTPUT',
  transactionDate: new Date('2024-01-15'),
  invoiceNumber: 'FV/2024/002',
  counterpartyNIP: '1234567890',
  counterpartyName: 'Kontrahent Sp. z o.o.',
  netAmount: new Decimal(2000),
  vatAmount: new Decimal(460),
  rateCode: 'VAT_23',
  transactionType: 'STANDARD',
  gtuCodes: ['GTU_01'],
  procedureCodes: [],
  receiptDate: null,
};

// ===========================================================================
// MOCK PRISMA
// ===========================================================================

const mockDb = vi.hoisted(() => ({
  client: {
    findUnique: vi.fn(),
  },
  jpkReport: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  jpkSaleRecord: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  jpkPurchaseRecord: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  vatTransaction: {
    findMany: vi.fn(),
  },
}));

// ===========================================================================
// TESTS
// ===========================================================================

describe('JPKReportingService', () => {
  let service: JPKReportingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JPKReportingService(mockDb as never, ORG_ID, USER_ID);
  });

  // =========================================================================
  // REPORT CREATION TESTS
  // =========================================================================

  describe('createReport', () => {
    it('should create a new JPK_V7M report for monthly period', async () => {
      mockDb.client.findUnique.mockResolvedValue(mockClient);
      mockDb.jpkReport.findFirst.mockResolvedValue(null);
      mockDb.jpkReport.create.mockResolvedValue(mockJPKReport);

      const result = await service.createReport({
        clientId: CLIENT_ID,
        reportType: 'JPK_V7M',
        year: 2024,
        month: 1,
        purpose: 'FIRST',
      });

      expect(result.reportType).toBe('JPK_V7M');
      expect(result.year).toBe(2024);
      expect(result.month).toBe(1);
      expect(result.status).toBe('DRAFT');
      expect(mockDb.jpkReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: ORG_ID,
            clientId: CLIENT_ID,
            reportType: 'JPK_V7M',
            purpose: 'FIRST',
          }),
        })
      );
    });

    it('should create a JPK_V7K report for quarterly period', async () => {
      const quarterlyReport = {
        ...mockJPKReport,
        reportType: 'JPK_V7K',
        month: null,
        quarter: 1,
        periodFrom: new Date('2024-01-01'),
        periodTo: new Date('2024-03-31'),
      };

      mockDb.client.findUnique.mockResolvedValue(mockClient);
      mockDb.jpkReport.findFirst.mockResolvedValue(null);
      mockDb.jpkReport.create.mockResolvedValue(quarterlyReport);

      const result = await service.createReport({
        clientId: CLIENT_ID,
        reportType: 'JPK_V7K',
        year: 2024,
        quarter: 1,
        purpose: 'FIRST',
      });

      expect(result.reportType).toBe('JPK_V7K');
      expect(result.quarter).toBe(1);
    });

    it('should throw error when client not found', async () => {
      mockDb.client.findUnique.mockResolvedValue(null);

      await expect(
        service.createReport({
          clientId: 'nonexistent',
          reportType: 'JPK_V7M',
          year: 2024,
          month: 1,
          purpose: 'FIRST',
        })
      ).rejects.toThrow('Klient nie został znaleziony');
    });

    it('should throw error when report for period already exists', async () => {
      mockDb.client.findUnique.mockResolvedValue(mockClient);
      mockDb.jpkReport.findFirst.mockResolvedValue(mockJPKReport);

      await expect(
        service.createReport({
          clientId: CLIENT_ID,
          reportType: 'JPK_V7M',
          year: 2024,
          month: 1,
          purpose: 'FIRST',
        })
      ).rejects.toThrow('Raport JPK dla tego okresu już istnieje');
    });

    it('should allow creating correction when original exists', async () => {
      const correctionReport = {
        ...mockJPKReport,
        purpose: 'CORRECTION',
        correctionNumber: 1,
      };

      mockDb.client.findUnique.mockResolvedValue(mockClient);
      mockDb.jpkReport.findFirst.mockResolvedValue(mockJPKReport);
      mockDb.jpkReport.count.mockResolvedValue(0);
      mockDb.jpkReport.create.mockResolvedValue(correctionReport);

      const result = await service.createReport({
        clientId: CLIENT_ID,
        reportType: 'JPK_V7M',
        year: 2024,
        month: 1,
        purpose: 'CORRECTION',
      });

      expect(result.purpose).toBe('CORRECTION');
      expect(result.correctionNumber).toBe(1);
    });
  });

  // =========================================================================
  // SALE RECORD TESTS
  // =========================================================================

  describe('addSaleRecord', () => {
    it('should add a sale record to a draft report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue(mockJPKReport);
      mockDb.jpkSaleRecord.count.mockResolvedValue(0);
      mockDb.jpkSaleRecord.create.mockResolvedValue(mockSaleRecord);
      mockDb.jpkReport.update.mockResolvedValue({
        ...mockJPKReport,
        saleRecordCount: 1,
        recordCount: 1,
      });

      const result = await service.addSaleRecord({
        reportId: REPORT_ID,
        record: {
          documentType: 'FP',
          documentNumber: 'FV/2024/001',
          documentDate: '2024-01-15',
          saleDate: '2024-01-15',
          buyerNIP: '1234567890',
          buyerName: 'Kupujący Sp. z o.o.',
          netAmount23: '1000.00',
          vatAmount23: '230.00',
          gtuCodes: ['GTU_12'],
          procedureCodes: [],
        },
      });

      expect(result.recordNumber).toBe(1);
      expect(result.documentNumber).toBe('FV/2024/001');
      expect(mockDb.jpkReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            saleRecordCount: { increment: 1 },
            recordCount: { increment: 1 },
          }),
        })
      );
    });

    it('should throw error when adding to non-draft report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        status: 'SUBMITTED',
      });

      await expect(
        service.addSaleRecord({
          reportId: REPORT_ID,
          record: {
            documentType: 'FP',
            documentNumber: 'FV/2024/001',
            documentDate: '2024-01-15',
          },
        })
      ).rejects.toThrow('Można dodawać rekordy tylko do raportu w stanie DRAFT');
    });

    it('should assign sequential record numbers', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue(mockJPKReport);
      mockDb.jpkSaleRecord.count.mockResolvedValue(5);
      mockDb.jpkSaleRecord.create.mockResolvedValue({
        ...mockSaleRecord,
        recordNumber: 6,
      });
      mockDb.jpkReport.update.mockResolvedValue(mockJPKReport);

      const result = await service.addSaleRecord({
        reportId: REPORT_ID,
        record: {
          documentType: 'FP',
          documentNumber: 'FV/2024/006',
          documentDate: '2024-01-20',
        },
      });

      expect(mockDb.jpkSaleRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recordNumber: 6,
          }),
        })
      );
    });
  });

  // =========================================================================
  // PURCHASE RECORD TESTS
  // =========================================================================

  describe('addPurchaseRecord', () => {
    it('should add a purchase record to a draft report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue(mockJPKReport);
      mockDb.jpkPurchaseRecord.count.mockResolvedValue(0);
      mockDb.jpkPurchaseRecord.create.mockResolvedValue(mockPurchaseRecord);
      mockDb.jpkReport.update.mockResolvedValue({
        ...mockJPKReport,
        purchaseRecordCount: 1,
        recordCount: 1,
      });

      const result = await service.addPurchaseRecord({
        reportId: REPORT_ID,
        record: {
          documentNumber: 'FZ/2024/001',
          documentDate: '2024-01-10',
          receiptDate: '2024-01-12',
          sellerNIP: '9876543210',
          sellerName: 'Sprzedawca Sp. z o.o.',
          netAmountTotal: '500.00',
          vatAmountDeductible: '115.00',
          isWNT: false,
          isImportServices: false,
          isMPP: false,
          procedureCodes: [],
        },
      });

      expect(result.recordNumber).toBe(1);
      expect(result.documentNumber).toBe('FZ/2024/001');
    });

    it('should throw error when adding to non-draft report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        status: 'VALIDATED',
      });

      await expect(
        service.addPurchaseRecord({
          reportId: REPORT_ID,
          record: {
            documentNumber: 'FZ/2024/001',
            documentDate: '2024-01-10',
            netAmountTotal: '500.00',
            vatAmountDeductible: '115.00',
            isWNT: false,
            isImportServices: false,
            isMPP: false,
            procedureCodes: [],
          },
        })
      ).rejects.toThrow('Można dodawać rekordy tylko do raportu w stanie DRAFT');
    });
  });

  // =========================================================================
  // IMPORT FROM VAT TRANSACTIONS TESTS
  // =========================================================================

  describe('importFromVATTransactions', () => {
    it('should import VAT transactions into report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        clientId: CLIENT_ID,
      });
      mockDb.vatTransaction.findMany.mockResolvedValue([
        mockVATTransaction,
        { ...mockVATTransaction, id: '88888888', direction: 'INPUT' },
      ]);
      mockDb.jpkSaleRecord.create.mockResolvedValue(mockSaleRecord);
      mockDb.jpkPurchaseRecord.create.mockResolvedValue(mockPurchaseRecord);
      mockDb.jpkReport.update.mockResolvedValue({
        ...mockJPKReport,
        saleRecordCount: 1,
        purchaseRecordCount: 1,
        recordCount: 2,
      });

      const result = await service.importFromVATTransactions({
        reportId: REPORT_ID,
        periodFrom: '2024-01-01',
        periodTo: '2024-01-31',
        overwriteExisting: false,
      });

      expect(result.success).toBe(true);
      expect(result.importedSaleRecords).toBe(1);
      expect(result.importedPurchaseRecords).toBe(1);
    });

    it('should clear existing records when overwriteExisting is true', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        clientId: CLIENT_ID,
      });
      mockDb.jpkSaleRecord.deleteMany.mockResolvedValue({ count: 5 });
      mockDb.jpkPurchaseRecord.deleteMany.mockResolvedValue({ count: 3 });
      mockDb.jpkReport.update.mockResolvedValue(mockJPKReport);
      mockDb.vatTransaction.findMany.mockResolvedValue([]);

      await service.importFromVATTransactions({
        reportId: REPORT_ID,
        periodFrom: '2024-01-01',
        periodTo: '2024-01-31',
        overwriteExisting: true,
      });

      expect(mockDb.jpkSaleRecord.deleteMany).toHaveBeenCalledWith({
        where: { reportId: REPORT_ID },
      });
      expect(mockDb.jpkPurchaseRecord.deleteMany).toHaveBeenCalledWith({
        where: { reportId: REPORT_ID },
      });
    });

    it('should return errors for failed imports', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        clientId: CLIENT_ID,
      });
      mockDb.vatTransaction.findMany.mockResolvedValue([mockVATTransaction]);
      mockDb.jpkSaleRecord.create.mockRejectedValue(new Error('Database error'));
      mockDb.jpkReport.update.mockResolvedValue(mockJPKReport);

      const result = await service.importFromVATTransactions({
        reportId: REPORT_ID,
        periodFrom: '2024-01-01',
        periodTo: '2024-01-31',
        overwriteExisting: false,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.skippedRecords).toBe(1);
    });
  });

  // =========================================================================
  // DECLARATION UPDATE TESTS
  // =========================================================================

  describe('updateDeclaration', () => {
    it('should update declaration for draft report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue(mockJPKReport);
      mockDb.jpkReport.update.mockResolvedValue({
        ...mockJPKReport,
        declaration: { p_10: 'Tax Office', p_28: '1000' },
      });

      const result = await service.updateDeclaration({
        reportId: REPORT_ID,
        declaration: { p_10: 'Tax Office', p_28: '1000' },
      });

      expect(mockDb.jpkReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            declaration: { p_10: 'Tax Office', p_28: '1000' },
            status: 'DRAFT',
          }),
        })
      );
    });

    it('should throw error for submitted report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        status: 'SUBMITTED',
      });

      await expect(
        service.updateDeclaration({
          reportId: REPORT_ID,
          declaration: { p_10: 'Test' },
        })
      ).rejects.toThrow('Można edytować deklarację tylko dla raportu w stanie DRAFT, GENERATED lub VALIDATED');
    });
  });

  // =========================================================================
  // XML GENERATION TESTS
  // =========================================================================

  describe('generateXML', () => {
    it('should generate XML for a report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue(mockJPKReport);
      mockDb.jpkReport.update.mockResolvedValue({
        ...mockJPKReport,
        status: 'GENERATED',
      });
      mockDb.jpkSaleRecord.findMany.mockResolvedValue([mockSaleRecord]);
      mockDb.jpkPurchaseRecord.findMany.mockResolvedValue([mockPurchaseRecord]);

      const result = await service.generateXML({
        reportId: REPORT_ID,
        regenerate: false,
      });

      expect(result.success).toBe(true);
      expect(result.xmlFilePath).toContain('.xml');
      expect(result.xmlHash).toBeDefined();
    });

    it('should throw error for already submitted report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        status: 'SUBMITTED',
      });

      await expect(
        service.generateXML({
          reportId: REPORT_ID,
          regenerate: false,
        })
      ).rejects.toThrow('Nie można generować XML dla już złożonego raportu');
    });

    it('should require regenerate flag when XML exists', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        xmlFilePath: '/jpk/existing.xml',
      });

      await expect(
        service.generateXML({
          reportId: REPORT_ID,
          regenerate: false,
        })
      ).rejects.toThrow('XML już istnieje. Użyj regenerate=true aby nadpisać');
    });

    it('should allow regeneration with regenerate flag', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        xmlFilePath: '/jpk/existing.xml',
      });
      mockDb.jpkReport.update.mockResolvedValue({
        ...mockJPKReport,
        status: 'GENERATED',
      });
      mockDb.jpkSaleRecord.findMany.mockResolvedValue([]);
      mockDb.jpkPurchaseRecord.findMany.mockResolvedValue([]);

      const result = await service.generateXML({
        reportId: REPORT_ID,
        regenerate: true,
      });

      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // VALIDATION TESTS
  // =========================================================================

  describe('validateReport', () => {
    it('should return error when XML not generated', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue(mockJPKReport);

      const result = await service.validateReport({
        reportId: REPORT_ID,
        validateXSD: true,
        validateBusiness: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'XML_NOT_GENERATED',
        })
      );
    });

    it('should validate XSD schema', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        xmlFilePath: '/jpk/test.xml',
        recordCount: 5,
      });
      mockDb.jpkReport.update.mockResolvedValue(mockJPKReport);
      mockDb.jpkSaleRecord.findMany.mockResolvedValue([mockSaleRecord]);
      mockDb.jpkPurchaseRecord.findMany.mockResolvedValue([mockPurchaseRecord]);

      const result = await service.validateReport({
        reportId: REPORT_ID,
        validateXSD: true,
        validateBusiness: false,
      });

      expect(result.xsdValid).toBe(true);
    });

    it('should detect invalid NIP in business validation', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        xmlFilePath: '/jpk/test.xml',
        recordCount: 1,
      });
      mockDb.jpkReport.update.mockResolvedValue(mockJPKReport);
      mockDb.jpkSaleRecord.findMany.mockResolvedValue([
        { ...mockSaleRecord, buyerNIP: '1234567891' }, // Invalid NIP
      ]);
      mockDb.jpkPurchaseRecord.findMany.mockResolvedValue([]);

      const result = await service.validateReport({
        reportId: REPORT_ID,
        validateXSD: false,
        validateBusiness: true,
      });

      expect(result.businessValid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_NIP',
          field: 'buyerNIP',
        })
      );
    });

    it('should update status to VALIDATED on success', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        xmlFilePath: '/jpk/test.xml',
        recordCount: 1,
      });
      mockDb.jpkReport.update.mockResolvedValue({
        ...mockJPKReport,
        status: 'VALIDATED',
      });
      // Use valid Polish NIPs for validation to pass
      mockDb.jpkSaleRecord.findMany.mockResolvedValue([{
        ...mockSaleRecord,
        buyerNIP: '5213017228', // Valid test NIP
      }]);
      mockDb.jpkPurchaseRecord.findMany.mockResolvedValue([{
        ...mockPurchaseRecord,
        sellerNIP: '5213017228', // Valid test NIP
      }]);

      const result = await service.validateReport({
        reportId: REPORT_ID,
        validateXSD: true,
        validateBusiness: true,
      });

      expect(result.isValid).toBe(true);
      expect(mockDb.jpkReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'VALIDATED',
          }),
        })
      );
    });
  });

  // =========================================================================
  // SIGNING TESTS
  // =========================================================================

  describe('signReport', () => {
    it('should sign a validated report', async () => {
      // First call returns VALIDATED for initial check, second call returns SIGNED for return
      mockDb.jpkReport.findUnique
        .mockResolvedValueOnce({
          ...mockJPKReport,
          status: 'VALIDATED',
          xmlFilePath: '/jpk/test.xml',
        })
        .mockResolvedValueOnce({
          ...mockJPKReport,
          status: 'SIGNED',
          signedXmlFilePath: '/jpk/test_signed.xml',
        });
      mockDb.jpkReport.update.mockResolvedValue({
        ...mockJPKReport,
        status: 'SIGNED',
        signedXmlFilePath: '/jpk/test_signed.xml',
      });

      const result = await service.signReport({
        reportId: REPORT_ID,
        signatureType: 'TRUSTED_PROFILE',
      });

      expect(result.status).toBe('SIGNED');
    });

    it('should throw error for non-validated report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        status: 'DRAFT',
      });

      await expect(
        service.signReport({
          reportId: REPORT_ID,
          signatureType: 'TRUSTED_PROFILE',
        })
      ).rejects.toThrow('Raport musi być wygenerowany lub zwalidowany przed podpisaniem');
    });
  });

  // =========================================================================
  // SUBMISSION TESTS
  // =========================================================================

  describe('submitReport', () => {
    it('should submit a signed report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        status: 'SIGNED',
        signedXmlFilePath: '/jpk/test_signed.xml',
      });
      mockDb.jpkReport.update.mockResolvedValue({
        ...mockJPKReport,
        status: 'SUBMITTED',
        referenceNumber: 'JPK-TEST-123',
      });

      const result = await service.submitReport({
        reportId: REPORT_ID,
        testMode: true,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUBMITTED');
      expect(result.referenceNumber).toBeDefined();
    });

    it('should throw error for non-signed report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        status: 'VALIDATED',
      });

      await expect(
        service.submitReport({
          reportId: REPORT_ID,
          testMode: true,
        })
      ).rejects.toThrow('Raport musi być podpisany przed wysłaniem');
    });
  });

  // =========================================================================
  // STATUS CHECK TESTS
  // =========================================================================

  describe('checkStatus', () => {
    it('should check status for submitted report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        status: 'SUBMITTED',
        referenceNumber: 'JPK-TEST-123',
      });
      mockDb.jpkReport.update.mockResolvedValue({
        ...mockJPKReport,
        status: 'ACCEPTED',
        upoNumber: 'UPO-123',
      });

      const result = await service.checkStatus({
        reportId: REPORT_ID,
      });

      // Result depends on simulation random outcome
      expect(['SUBMITTED', 'ACCEPTED']).toContain(result.status);
      expect(result.referenceNumber).toBe('JPK-TEST-123');
    });

    it('should return error message for unsubmitted report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        status: 'DRAFT',
        referenceNumber: null,
      });

      const result = await service.checkStatus({
        reportId: REPORT_ID,
      });

      expect(result.errorMessage).toBe('Raport nie został jeszcze wysłany');
    });
  });

  // =========================================================================
  // UPO DOWNLOAD TESTS
  // =========================================================================

  describe('downloadUPO', () => {
    it('should download UPO for accepted report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        status: 'ACCEPTED',
        upoNumber: 'UPO-12345',
        upoReceivedAt: new Date(),
        referenceNumber: 'JPK-REF-123',
      });

      const result = await service.downloadUPO({
        reportId: REPORT_ID,
      });

      expect(result.fileName).toContain('UPO');
      expect(result.contentType).toBe('application/xml');
      expect(result.content).toBeDefined();
    });

    it('should throw error when UPO not available', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        status: 'SUBMITTED',
        upoNumber: null,
      });

      await expect(
        service.downloadUPO({
          reportId: REPORT_ID,
        })
      ).rejects.toThrow('UPO nie jest jeszcze dostępne dla tego raportu');
    });
  });

  // =========================================================================
  // CORRECTION TESTS
  // =========================================================================

  describe('createCorrection', () => {
    it('should create correction for submitted report', async () => {
      const submittedReport = {
        ...mockJPKReport,
        status: 'SUBMITTED',
        referenceNumber: 'JPK-REF-123',
      };
      const correctionReport = {
        ...mockJPKReport,
        id: 'correction-id-123',
        purpose: 'CORRECTION',
        correctionNumber: 1,
        originalReportId: REPORT_ID,
      };

      // Chain all findUnique calls in order:
      // 1. getReportById(originalReportId) - initial check
      // 2. jpkReport.findUnique in Promise.all for declaration copy
      // 3. getReportById(correction.id) - final return
      mockDb.jpkReport.findUnique
        .mockResolvedValueOnce(submittedReport)   // 1st call
        .mockResolvedValueOnce(submittedReport)   // 2nd call (Promise.all)
        .mockResolvedValueOnce(correctionReport); // 3rd call (return)

      mockDb.client.findUnique.mockResolvedValue(mockClient);
      mockDb.jpkReport.findFirst.mockResolvedValue(null); // No existing report
      mockDb.jpkReport.count.mockResolvedValue(0);
      mockDb.jpkReport.create.mockResolvedValue(correctionReport);
      mockDb.jpkSaleRecord.findMany.mockResolvedValue([mockSaleRecord]);
      mockDb.jpkPurchaseRecord.findMany.mockResolvedValue([mockPurchaseRecord]);
      mockDb.jpkSaleRecord.create.mockResolvedValue(mockSaleRecord);
      mockDb.jpkPurchaseRecord.create.mockResolvedValue(mockPurchaseRecord);
      mockDb.jpkReport.update.mockResolvedValue(correctionReport);

      const result = await service.createCorrection({
        originalReportId: REPORT_ID,
        correctionReason: 'Correction of VAT amounts',
      });

      expect(result.purpose).toBe('CORRECTION');
    });

    it('should throw error for draft report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        status: 'DRAFT',
      });

      await expect(
        service.createCorrection({
          originalReportId: REPORT_ID,
          correctionReason: 'Test',
        })
      ).rejects.toThrow('Można tworzyć korektę tylko dla złożonego lub zaakceptowanego raportu');
    });
  });

  // =========================================================================
  // REPORT RETRIEVAL TESTS
  // =========================================================================

  describe('getReport', () => {
    it('should get report without records', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue(mockJPKReport);

      const result = await service.getReport({
        reportId: REPORT_ID,
        includeRecords: false,
        includeDeclaration: false,
      });

      expect(result.report.id).toBe(REPORT_ID);
      expect(result.saleRecords).toBeUndefined();
      expect(result.purchaseRecords).toBeUndefined();
    });

    it('should include records when requested', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue(mockJPKReport);
      mockDb.jpkSaleRecord.findMany.mockResolvedValue([mockSaleRecord]);
      mockDb.jpkPurchaseRecord.findMany.mockResolvedValue([mockPurchaseRecord]);

      const result = await service.getReport({
        reportId: REPORT_ID,
        includeRecords: true,
        includeDeclaration: false,
      });

      expect(result.saleRecords).toHaveLength(1);
      expect(result.purchaseRecords).toHaveLength(1);
    });

    it('should include declaration when requested', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        declaration: { p_10: 'Test Office', p_28: '1000' },
      });

      const result = await service.getReport({
        reportId: REPORT_ID,
        includeRecords: false,
        includeDeclaration: true,
      });

      expect(result.declaration).toBeDefined();
    });
  });

  describe('listReports', () => {
    it('should list reports with pagination', async () => {
      mockDb.jpkReport.findMany.mockResolvedValue([mockJPKReport]);
      mockDb.jpkReport.count.mockResolvedValue(1);

      const result = await service.listReports({
        page: 1,
        pageSize: 10,
      });

      expect(result.reports).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by client and status', async () => {
      mockDb.jpkReport.findMany.mockResolvedValue([]);
      mockDb.jpkReport.count.mockResolvedValue(0);

      await service.listReports({
        clientId: CLIENT_ID,
        status: 'SUBMITTED',
        page: 1,
        pageSize: 10,
      });

      expect(mockDb.jpkReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: ORG_ID,
            clientId: CLIENT_ID,
            status: 'SUBMITTED',
          }),
        })
      );
    });

    it('should filter by year and month', async () => {
      mockDb.jpkReport.findMany.mockResolvedValue([]);
      mockDb.jpkReport.count.mockResolvedValue(0);

      await service.listReports({
        year: 2024,
        month: 1,
        page: 1,
        pageSize: 10,
      });

      expect(mockDb.jpkReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            year: 2024,
            month: 1,
          }),
        })
      );
    });
  });

  describe('deleteReport', () => {
    it('should delete a draft report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue(mockJPKReport);
      mockDb.jpkSaleRecord.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.jpkPurchaseRecord.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.jpkReport.delete.mockResolvedValue(mockJPKReport);

      await service.deleteReport({
        reportId: REPORT_ID,
      });

      expect(mockDb.jpkSaleRecord.deleteMany).toHaveBeenCalled();
      expect(mockDb.jpkPurchaseRecord.deleteMany).toHaveBeenCalled();
      expect(mockDb.jpkReport.delete).toHaveBeenCalled();
    });

    it('should throw error for non-draft report', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        status: 'SUBMITTED',
      });

      await expect(
        service.deleteReport({
          reportId: REPORT_ID,
        })
      ).rejects.toThrow('Można usunąć tylko raporty w stanie DRAFT lub ERROR');
    });
  });

  // =========================================================================
  // XML DOWNLOAD TESTS
  // =========================================================================

  describe('downloadXML', () => {
    it('should download generated XML', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        xmlFilePath: '/jpk/test.xml',
      });
      mockDb.jpkSaleRecord.findMany.mockResolvedValue([mockSaleRecord]);
      mockDb.jpkPurchaseRecord.findMany.mockResolvedValue([mockPurchaseRecord]);

      const result = await service.downloadXML({
        reportId: REPORT_ID,
        signed: false,
      });

      expect(result.fileName).toContain('JPK');
      expect(result.contentType).toBe('application/xml');
      expect(result.content).toBeDefined();
    });

    it('should throw error when XML not generated', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        xmlFilePath: null,
      });

      await expect(
        service.downloadXML({
          reportId: REPORT_ID,
          signed: false,
        })
      ).rejects.toThrow('XML nie został wygenerowany');
    });

    it('should throw error when signed XML requested but not available', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        xmlFilePath: '/jpk/test.xml',
        signedXmlFilePath: null,
      });

      await expect(
        service.downloadXML({
          reportId: REPORT_ID,
          signed: true,
        })
      ).rejects.toThrow('Podpisany XML nie istnieje');
    });
  });

  // =========================================================================
  // HELPER METHOD TESTS
  // =========================================================================

  describe('NIP validation', () => {
    it('should validate correct NIP (5213017228)', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        xmlFilePath: '/jpk/test.xml',
        recordCount: 1,
      });
      mockDb.jpkReport.update.mockResolvedValue(mockJPKReport);
      mockDb.jpkSaleRecord.findMany.mockResolvedValue([
        { ...mockSaleRecord, buyerNIP: '5213017228' },
      ]);
      mockDb.jpkPurchaseRecord.findMany.mockResolvedValue([]);

      const result = await service.validateReport({
        reportId: REPORT_ID,
        validateXSD: false,
        validateBusiness: true,
      });

      // Should not have INVALID_NIP error for valid NIP
      const nipErrors = result.issues.filter(i => i.code === 'INVALID_NIP');
      expect(nipErrors).toHaveLength(0);
    });

    it('should reject invalid NIP (checksum mismatch)', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        xmlFilePath: '/jpk/test.xml',
        recordCount: 1,
      });
      mockDb.jpkReport.update.mockResolvedValue(mockJPKReport);
      mockDb.jpkSaleRecord.findMany.mockResolvedValue([
        { ...mockSaleRecord, buyerNIP: '5213017229' }, // Invalid checksum
      ]);
      mockDb.jpkPurchaseRecord.findMany.mockResolvedValue([]);

      const result = await service.validateReport({
        reportId: REPORT_ID,
        validateXSD: false,
        validateBusiness: true,
      });

      const nipErrors = result.issues.filter(i => i.code === 'INVALID_NIP');
      expect(nipErrors.length).toBeGreaterThan(0);
    });
  });

  describe('period calculation', () => {
    it('should correctly calculate monthly period', async () => {
      mockDb.client.findUnique.mockResolvedValue(mockClient);
      mockDb.jpkReport.findFirst.mockResolvedValue(null);
      mockDb.jpkReport.create.mockImplementation(({ data }) => {
        return Promise.resolve({
          ...mockJPKReport,
          periodFrom: data.periodFrom,
          periodTo: data.periodTo,
        });
      });

      await service.createReport({
        clientId: CLIENT_ID,
        reportType: 'JPK_V7M',
        year: 2024,
        month: 2, // February
        purpose: 'FIRST',
      });

      expect(mockDb.jpkReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            periodFrom: new Date(2024, 1, 1), // Feb 1
            periodTo: new Date(2024, 2, 0), // Feb 29 (2024 is leap year)
          }),
        })
      );
    });

    it('should correctly calculate quarterly period', async () => {
      mockDb.client.findUnique.mockResolvedValue(mockClient);
      mockDb.jpkReport.findFirst.mockResolvedValue(null);
      mockDb.jpkReport.create.mockImplementation(({ data }) => {
        return Promise.resolve({
          ...mockJPKReport,
          periodFrom: data.periodFrom,
          periodTo: data.periodTo,
          quarter: 2,
        });
      });

      await service.createReport({
        clientId: CLIENT_ID,
        reportType: 'JPK_V7K',
        year: 2024,
        quarter: 2, // Q2
        purpose: 'FIRST',
      });

      expect(mockDb.jpkReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            periodFrom: new Date(2024, 3, 1), // Apr 1
            periodTo: new Date(2024, 6, 0), // Jun 30
          }),
        })
      );
    });
  });

  // =========================================================================
  // ACCESS CONTROL TESTS
  // =========================================================================

  describe('access control', () => {
    it('should throw error when accessing report from different organization', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue({
        ...mockJPKReport,
        organizationId: 'different-org-id',
      });

      await expect(
        service.getReport({
          reportId: REPORT_ID,
          includeRecords: false,
          includeDeclaration: false,
        })
      ).rejects.toThrow('Brak dostępu do tego raportu');
    });

    it('should throw error when report not found', async () => {
      mockDb.jpkReport.findUnique.mockResolvedValue(null);

      await expect(
        service.getReport({
          reportId: 'nonexistent',
          includeRecords: false,
          includeDeclaration: false,
        })
      ).rejects.toThrow('Raport JPK nie został znaleziony');
    });
  });
});
