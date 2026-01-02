// TAX-007: JPK Reporting Service
// Manages JPK (Jednolity Plik Kontrolny - Standard Audit File) generation for Polish tax compliance

import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';
import {
  CreateJPKReportInput,
  GenerateJPKXMLInput,
  AddJPKSaleRecordInput,
  AddJPKPurchaseRecordInput,
  ImportFromVATTransactionsInput,
  ValidateJPKReportInput,
  SignJPKReportInput,
  SubmitJPKReportInput,
  CheckJPKStatusInput,
  DownloadUPOInput,
  CreateJPKCorrectionInput,
  GetJPKReportInput,
  ListJPKReportsInput,
  DeleteJPKReportInput,
  DownloadJPKXMLInput,
  UpdateJPKDeclarationInput,
  JPKReport,
  JPKReportSummary,
  JPKValidationResult,
  JPKGenerationResult,
  JPKSubmissionResult,
  JPKStatusResult,
  ListJPKReportsResult,
  ImportRecordsResult,
  DownloadResult,
  JPKV7SaleRecord,
  JPKV7PurchaseRecord,
  JPKV7Declaration,
  JPK_SCHEMA_VERSIONS,
  JPK_API_ENDPOINTS,
} from '@ksiegowacrm/shared';

/**
 * JPK Reporting Service
 * Manages generation, validation, signing, and submission of JPK files to Polish tax authorities
 */
export class JPKReportingService {
  private prisma: PrismaClient;
  private organizationId: string;
  private userId: string;

  constructor(prisma: PrismaClient, organizationId: string, userId: string) {
    this.prisma = prisma;
    this.organizationId = organizationId;
    this.userId = userId;
  }

  // =========================================================================
  // REPORT LIFECYCLE MANAGEMENT
  // =========================================================================

  /**
   * Create new JPK report
   * AC-1: Initialize JPK report with basic configuration
   */
  async createReport(input: CreateJPKReportInput): Promise<JPKReport> {
    // Calculate period dates based on report type
    const { periodFrom, periodTo } = this.calculatePeriodDates(
      input.year,
      input.month,
      input.quarter,
      input.reportType,
    );

    // Get client tax configuration for subject info
    const client = await this.prisma.client.findUnique({
      where: { id: input.clientId },
      include: { organization: true },
    });

    if (!client) {
      throw new Error('Klient nie został znaleziony');
    }

    // Check for existing report in same period
    const existingReport = await this.prisma.jpkReport.findFirst({
      where: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        reportType: input.reportType,
        year: input.year,
        month: input.month ?? undefined,
        quarter: input.quarter ?? undefined,
        purpose: 'FIRST',
        status: { notIn: ['REJECTED', 'ERROR'] },
      },
    });

    if (existingReport && input.purpose === 'FIRST') {
      throw new Error(
        'Raport JPK dla tego okresu już istnieje. Użyj korekty zamiast nowego raportu.',
      );
    }

    // Determine correction number
    let correctionNumber: number | undefined;
    if (input.purpose === 'CORRECTION') {
      const correctionCount = await this.prisma.jpkReport.count({
        where: {
          organizationId: this.organizationId,
          clientId: input.clientId,
          reportType: input.reportType,
          year: input.year,
          month: input.month ?? undefined,
          quarter: input.quarter ?? undefined,
          purpose: 'CORRECTION',
        },
      });
      correctionNumber = correctionCount + 1;
    }

    // Create report entity
    const report = await this.prisma.jpkReport.create({
      data: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        reportType: input.reportType,
        status: 'DRAFT',
        year: input.year,
        month: input.month,
        quarter: input.quarter,
        periodFrom,
        periodTo,
        purpose: input.purpose || 'FIRST',
        correctionNumber,
        recordCount: 0,
        saleRecordCount: 0,
        purchaseRecordCount: 0,
        generatedBy: this.userId,
      },
    });

    return this.mapToJPKReport(report);
  }

  /**
   * Add sale record to JPK_V7 report
   * AC-2: Add VAT sale transaction to report
   */
  async addSaleRecord(input: AddJPKSaleRecordInput): Promise<JPKV7SaleRecord> {
    const report = await this.getReportById(input.reportId);

    if (report.status !== 'DRAFT') {
      throw new Error('Można dodawać rekordy tylko do raportu w stanie DRAFT');
    }

    // Get next record number
    const recordCount = await this.prisma.jpkSaleRecord.count({
      where: { reportId: input.reportId },
    });

    const record = await this.prisma.jpkSaleRecord.create({
      data: {
        reportId: input.reportId,
        recordNumber: recordCount + 1,
        ...input.record,
        gtuCodes: input.record.gtuCodes || [],
        procedureCodes: input.record.procedureCodes || [],
      },
    });

    // Update report counters
    await this.prisma.jpkReport.update({
      where: { id: input.reportId },
      data: {
        saleRecordCount: { increment: 1 },
        recordCount: { increment: 1 },
      },
    });

    return this.mapToSaleRecord(record);
  }

  /**
   * Add purchase record to JPK_V7 report
   * AC-3: Add VAT purchase transaction to report
   */
  async addPurchaseRecord(input: AddJPKPurchaseRecordInput): Promise<JPKV7PurchaseRecord> {
    const report = await this.getReportById(input.reportId);

    if (report.status !== 'DRAFT') {
      throw new Error('Można dodawać rekordy tylko do raportu w stanie DRAFT');
    }

    // Get next record number
    const recordCount = await this.prisma.jpkPurchaseRecord.count({
      where: { reportId: input.reportId },
    });

    const record = await this.prisma.jpkPurchaseRecord.create({
      data: {
        reportId: input.reportId,
        recordNumber: recordCount + 1,
        ...input.record,
        procedureCodes: input.record.procedureCodes || [],
      },
    });

    // Update report counters
    await this.prisma.jpkReport.update({
      where: { id: input.reportId },
      data: {
        purchaseRecordCount: { increment: 1 },
        recordCount: { increment: 1 },
      },
    });

    return this.mapToPurchaseRecord(record);
  }

  /**
   * Import records from VAT transactions
   * AC-4: Bulk import from existing VAT records
   */
  async importFromVATTransactions(input: ImportFromVATTransactionsInput): Promise<ImportRecordsResult> {
    const report = await this.getReportById(input.reportId);

    if (report.status !== 'DRAFT') {
      throw new Error('Można importować rekordy tylko do raportu w stanie DRAFT');
    }

    // Clear existing records if overwriting
    if (input.overwriteExisting) {
      await this.prisma.jpkSaleRecord.deleteMany({
        where: { reportId: input.reportId },
      });
      await this.prisma.jpkPurchaseRecord.deleteMany({
        where: { reportId: input.reportId },
      });
      await this.prisma.jpkReport.update({
        where: { id: input.reportId },
        data: {
          saleRecordCount: 0,
          purchaseRecordCount: 0,
          recordCount: 0,
        },
      });
    }

    // Get client for this report
    const dbReport = await this.prisma.jpkReport.findUnique({
      where: { id: input.reportId },
      select: { clientId: true },
    });

    if (!dbReport) {
      throw new Error('Raport nie został znaleziony');
    }

    // Fetch VAT transactions for the period
    const vatTransactions = await this.prisma.vatTransaction.findMany({
      where: {
        organizationId: this.organizationId,
        clientId: dbReport.clientId,
        transactionDate: {
          gte: new Date(input.periodFrom),
          lte: new Date(input.periodTo),
        },
      },
    });

    let importedSaleRecords = 0;
    let importedPurchaseRecords = 0;
    let skippedRecords = 0;
    const errors: Array<{ transactionId: string; message: string }> = [];

    // Process each transaction
    for (const tx of vatTransactions) {
      try {
        if (tx.direction === 'OUTPUT') {
          // Sale record
          await this.prisma.jpkSaleRecord.create({
            data: {
              reportId: input.reportId,
              recordNumber: importedSaleRecords + 1,
              documentNumber: tx.invoiceNumber || tx.id,
              documentDate: tx.transactionDate.toISOString(),
              saleDate: tx.transactionDate.toISOString(),
              buyerNIP: tx.counterpartyNIP || undefined,
              buyerName: tx.counterpartyName || undefined,
              netAmount23: tx.rateCode === 'VAT_23' ? tx.netAmount.toString() : undefined,
              vatAmount23: tx.rateCode === 'VAT_23' ? tx.vatAmount.toString() : undefined,
              netAmount8: tx.rateCode === 'VAT_8' ? tx.netAmount.toString() : undefined,
              vatAmount8: tx.rateCode === 'VAT_8' ? tx.vatAmount.toString() : undefined,
              netAmount5: tx.rateCode === 'VAT_5' ? tx.netAmount.toString() : undefined,
              vatAmount5: tx.rateCode === 'VAT_5' ? tx.vatAmount.toString() : undefined,
              netAmount0: tx.rateCode === 'VAT_0' ? tx.netAmount.toString() : undefined,
              netAmountExempt: tx.rateCode === 'VAT_ZW' ? tx.netAmount.toString() : undefined,
              gtuCodes: tx.gtuCodes || [],
              procedureCodes: tx.procedureCodes || [],
            },
          });
          importedSaleRecords++;
        } else {
          // Purchase record
          await this.prisma.jpkPurchaseRecord.create({
            data: {
              reportId: input.reportId,
              recordNumber: importedPurchaseRecords + 1,
              documentNumber: tx.invoiceNumber || tx.id,
              documentDate: tx.transactionDate.toISOString(),
              receiptDate: tx.receiptDate?.toISOString(),
              sellerNIP: tx.counterpartyNIP || undefined,
              sellerName: tx.counterpartyName || undefined,
              netAmountTotal: tx.netAmount.toString(),
              vatAmountDeductible: tx.vatAmount.toString(),
              isWNT: tx.transactionType === 'WNT',
              isImportServices: tx.transactionType === 'IMPORT_SERVICES',
              isMPP: tx.procedureCodes?.includes('MPP') || false,
              procedureCodes: tx.procedureCodes || [],
            },
          });
          importedPurchaseRecords++;
        }
      } catch (error) {
        errors.push({
          transactionId: tx.id,
          message: error instanceof Error ? error.message : 'Nieznany błąd',
        });
        skippedRecords++;
      }
    }

    // Update report counters
    await this.prisma.jpkReport.update({
      where: { id: input.reportId },
      data: {
        saleRecordCount: importedSaleRecords,
        purchaseRecordCount: importedPurchaseRecords,
        recordCount: importedSaleRecords + importedPurchaseRecords,
      },
    });

    return {
      success: errors.length === 0,
      importedSaleRecords,
      importedPurchaseRecords,
      skippedRecords,
      errors,
    };
  }

  /**
   * Update JPK_V7 declaration section
   * AC-5: Set declaration values (P_10 through P_70)
   */
  async updateDeclaration(input: UpdateJPKDeclarationInput): Promise<JPKReport> {
    const report = await this.getReportById(input.reportId);

    if (!['DRAFT', 'GENERATED', 'VALIDATED'].includes(report.status)) {
      throw new Error('Można edytować deklarację tylko dla raportu w stanie DRAFT, GENERATED lub VALIDATED');
    }

    await this.prisma.jpkReport.update({
      where: { id: input.reportId },
      data: {
        declaration: input.declaration as object,
        status: 'DRAFT', // Reset status after modification
      },
    });

    return this.getReportById(input.reportId);
  }

  // =========================================================================
  // XML GENERATION
  // =========================================================================

  /**
   * Generate JPK XML file
   * AC-6: Create XML according to Ministry of Finance schema
   */
  async generateXML(input: GenerateJPKXMLInput): Promise<JPKGenerationResult> {
    const report = await this.getReportById(input.reportId);

    if (report.status === 'SUBMITTED' || report.status === 'ACCEPTED') {
      throw new Error('Nie można generować XML dla już złożonego raportu');
    }

    if (!input.regenerate && report.xmlFilePath) {
      throw new Error('XML już istnieje. Użyj regenerate=true aby nadpisać');
    }

    try {
      // Update status to generating
      await this.prisma.jpkReport.update({
        where: { id: input.reportId },
        data: { status: 'GENERATING' },
      });

      // Get all records
      const [saleRecords, purchaseRecords, dbReport] = await Promise.all([
        this.prisma.jpkSaleRecord.findMany({
          where: { reportId: input.reportId },
          orderBy: { recordNumber: 'asc' },
        }),
        this.prisma.jpkPurchaseRecord.findMany({
          where: { reportId: input.reportId },
          orderBy: { recordNumber: 'asc' },
        }),
        this.prisma.jpkReport.findUnique({
          where: { id: input.reportId },
          include: { client: true },
        }),
      ]);

      if (!dbReport) {
        throw new Error('Raport nie został znaleziony');
      }

      // Calculate totals
      const totals = this.calculateTotals(saleRecords, purchaseRecords);

      // Build XML structure
      const xml = this.buildJPKXML(
        dbReport,
        saleRecords.map(r => this.mapToSaleRecord(r)),
        purchaseRecords.map(r => this.mapToPurchaseRecord(r)),
        totals,
      );

      // Calculate hash
      const xmlHash = this.calculateXMLHash(xml);

      // Store XML (in production, would save to file storage)
      const xmlFilePath = `/jpk/${this.organizationId}/${input.reportId}.xml`;
      const xmlFileSize = Buffer.byteLength(xml, 'utf-8');

      // Update report
      await this.prisma.jpkReport.update({
        where: { id: input.reportId },
        data: {
          status: 'GENERATED',
          xmlFilePath,
          xmlFileSize,
          xmlHash,
          generatedAt: new Date(),
          totalSaleNet: totals.totalSaleNet.toString(),
          totalSaleVAT: totals.totalSaleVAT.toString(),
          totalPurchaseNet: totals.totalPurchaseNet.toString(),
          totalPurchaseVAT: totals.totalPurchaseVAT.toString(),
        },
      });

      return {
        success: true,
        reportId: input.reportId,
        xmlFilePath,
        xmlFileSize,
        xmlHash,
        recordCount: saleRecords.length + purchaseRecords.length,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      await this.prisma.jpkReport.update({
        where: { id: input.reportId },
        data: {
          status: 'ERROR',
          errorMessage: error instanceof Error ? error.message : 'Błąd generowania XML',
        },
      });

      return {
        success: false,
        reportId: input.reportId,
        recordCount: 0,
        generatedAt: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : 'Błąd generowania XML',
      };
    }
  }

  // =========================================================================
  // VALIDATION
  // =========================================================================

  /**
   * Validate JPK report
   * AC-7: Validate against XSD schema and business rules
   */
  async validateReport(input: ValidateJPKReportInput): Promise<JPKValidationResult> {
    const report = await this.getReportById(input.reportId);

    if (!report.xmlFilePath) {
      return {
        isValid: false,
        xsdValid: false,
        businessValid: false,
        issues: [
          {
            code: 'XML_NOT_GENERATED',
            message: 'XML nie został wygenerowany. Wygeneruj XML przed walidacją.',
            severity: 'error',
          },
        ],
        errorCount: 1,
        warningCount: 0,
      };
    }

    await this.prisma.jpkReport.update({
      where: { id: input.reportId },
      data: { status: 'VALIDATING' },
    });

    const issues: Array<{
      code: string;
      field?: string;
      line?: number;
      message: string;
      severity: 'error' | 'warning' | 'info';
      xPath?: string;
    }> = [];

    // XSD validation (simulated)
    let xsdValid = true;
    if (input.validateXSD) {
      // In production, would validate against actual XSD schema
      // For now, perform basic structural validation
      if (!report.recordCount || report.recordCount === 0) {
        issues.push({
          code: 'EMPTY_RECORDS',
          message: 'Raport nie zawiera żadnych rekordów',
          severity: 'warning',
        });
      }
    }

    // Business rules validation
    let businessValid = true;
    if (input.validateBusiness) {
      // Get records for validation
      const [saleRecords, purchaseRecords] = await Promise.all([
        this.prisma.jpkSaleRecord.findMany({ where: { reportId: input.reportId } }),
        this.prisma.jpkPurchaseRecord.findMany({ where: { reportId: input.reportId } }),
      ]);

      // Validate NIP format
      for (const record of saleRecords) {
        if (record.buyerNIP && !this.validateNIP(record.buyerNIP)) {
          issues.push({
            code: 'INVALID_NIP',
            field: 'buyerNIP',
            line: record.recordNumber,
            message: `Nieprawidłowy NIP nabywcy w rekordzie ${record.recordNumber}`,
            severity: 'error',
          });
          businessValid = false;
        }
      }

      for (const record of purchaseRecords) {
        if (record.sellerNIP && !this.validateNIP(record.sellerNIP)) {
          issues.push({
            code: 'INVALID_NIP',
            field: 'sellerNIP',
            line: record.recordNumber,
            message: `Nieprawidłowy NIP sprzedawcy w rekordzie ${record.recordNumber}`,
            severity: 'error',
          });
          businessValid = false;
        }
      }

      // Validate amounts
      const dbReport = await this.prisma.jpkReport.findUnique({
        where: { id: input.reportId },
      });

      if (dbReport?.declaration) {
        const declaration = dbReport.declaration as Record<string, unknown>;
        const p_28 = parseFloat(declaration.p_28 as string || '0');
        const p_43 = parseFloat(declaration.p_43 as string || '0');
        const diff = p_28 - p_43;

        if (diff > 0 && !declaration.p_48 && !declaration.p_46) {
          issues.push({
            code: 'MISSING_TAX_PAYABLE',
            field: 'p_48',
            message: 'Brak kwoty podatku do zapłaty przy nadwyżce podatku należnego',
            severity: 'warning',
          });
        }

        if (diff < 0 && !declaration.p_50 && !declaration.p_53) {
          issues.push({
            code: 'MISSING_TAX_REFUND',
            field: 'p_50',
            message: 'Brak deklaracji zwrotu lub przeniesienia przy nadwyżce podatku naliczonego',
            severity: 'warning',
          });
        }
      }
    }

    const isValid = xsdValid && businessValid;

    await this.prisma.jpkReport.update({
      where: { id: input.reportId },
      data: {
        status: isValid ? 'VALIDATED' : 'DRAFT',
      },
    });

    return {
      isValid,
      xsdValid,
      businessValid,
      issues,
      errorCount: issues.filter(i => i.severity === 'error').length,
      warningCount: issues.filter(i => i.severity === 'warning').length,
    };
  }

  // =========================================================================
  // SIGNING AND SUBMISSION
  // =========================================================================

  /**
   * Sign JPK report with digital signature
   * AC-8: Apply qualified signature or Trusted Profile
   */
  async signReport(input: SignJPKReportInput): Promise<JPKReport> {
    const report = await this.getReportById(input.reportId);

    if (!['GENERATED', 'VALIDATED'].includes(report.status)) {
      throw new Error('Raport musi być wygenerowany lub zwalidowany przed podpisaniem');
    }

    await this.prisma.jpkReport.update({
      where: { id: input.reportId },
      data: { status: 'SIGNING' },
    });

    try {
      // In production, would integrate with qualified signature service
      // or Trusted Profile (Profil Zaufany) API
      const signedXmlFilePath = `/jpk/${this.organizationId}/${input.reportId}_signed.xml`;

      await this.prisma.jpkReport.update({
        where: { id: input.reportId },
        data: {
          status: 'SIGNED',
          signedXmlFilePath,
        },
      });

      return this.getReportById(input.reportId);
    } catch (error) {
      await this.prisma.jpkReport.update({
        where: { id: input.reportId },
        data: {
          status: 'ERROR',
          errorMessage: error instanceof Error ? error.message : 'Błąd podpisywania',
        },
      });
      throw error;
    }
  }

  /**
   * Submit JPK report to tax authority
   * AC-9: Send to Ministry of Finance gateway
   */
  async submitReport(input: SubmitJPKReportInput): Promise<JPKSubmissionResult> {
    const report = await this.getReportById(input.reportId);

    if (report.status !== 'SIGNED') {
      throw new Error('Raport musi być podpisany przed wysłaniem');
    }

    await this.prisma.jpkReport.update({
      where: { id: input.reportId },
      data: { status: 'SUBMITTING' },
    });

    try {
      // Select endpoint based on test mode
      const _endpoint = input.testMode ? JPK_API_ENDPOINTS.TEST : JPK_API_ENDPOINTS.PRODUCTION;

      // In production, would call Ministry of Finance API
      // Simulate submission
      const referenceNumber = `JPK-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      await this.prisma.jpkReport.update({
        where: { id: input.reportId },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          referenceNumber,
        },
      });

      return {
        success: true,
        reportId: input.reportId,
        referenceNumber,
        status: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
      };
    } catch (error) {
      await this.prisma.jpkReport.update({
        where: { id: input.reportId },
        data: {
          status: 'ERROR',
          errorMessage: error instanceof Error ? error.message : 'Błąd wysyłania',
        },
      });

      return {
        success: false,
        reportId: input.reportId,
        status: 'ERROR',
        errorMessage: error instanceof Error ? error.message : 'Błąd wysyłania',
        errorCode: 'SUBMISSION_FAILED',
      };
    }
  }

  /**
   * Check submission status
   * AC-10: Query Ministry of Finance for UPO status
   */
  async checkStatus(input: CheckJPKStatusInput): Promise<JPKStatusResult> {
    const report = await this.getReportById(input.reportId);

    if (!report.referenceNumber) {
      return {
        reportId: input.reportId,
        status: report.status,
        errorMessage: 'Raport nie został jeszcze wysłany',
      };
    }

    // In production, would query Ministry API for status
    // Simulate status check
    const isAccepted = Math.random() > 0.3; // 70% acceptance rate for simulation

    if (isAccepted && report.status === 'SUBMITTED') {
      const upoNumber = `UPO-${Date.now()}`;

      await this.prisma.jpkReport.update({
        where: { id: input.reportId },
        data: {
          status: 'ACCEPTED',
          upoNumber,
          upoReceivedAt: new Date(),
        },
      });

      return {
        reportId: input.reportId,
        status: 'ACCEPTED',
        referenceNumber: report.referenceNumber,
        upoNumber,
        upoReceivedAt: new Date().toISOString(),
        processingStage: 'COMPLETED',
      };
    }

    return {
      reportId: input.reportId,
      status: report.status,
      referenceNumber: report.referenceNumber,
      processingStage: 'PROCESSING',
    };
  }

  /**
   * Download UPO (official receipt)
   * AC-11: Get Urzędowe Poświadczenie Odbioru
   */
  async downloadUPO(input: DownloadUPOInput): Promise<DownloadResult> {
    const report = await this.getReportById(input.reportId);

    if (!report.upoNumber) {
      throw new Error('UPO nie jest jeszcze dostępne dla tego raportu');
    }

    // In production, would fetch actual UPO from Ministry
    const upoContent = this.generateUPOContent(report);

    return {
      fileName: `UPO_${report.upoNumber}.xml`,
      contentType: 'application/xml',
      fileSize: Buffer.byteLength(upoContent, 'utf-8'),
      content: Buffer.from(upoContent).toString('base64'),
    };
  }

  // =========================================================================
  // CORRECTION AND RETRIEVAL
  // =========================================================================

  /**
   * Create correction report
   * AC-12: Create korekta for previously submitted report
   */
  async createCorrection(input: CreateJPKCorrectionInput): Promise<JPKReport> {
    const originalReport = await this.getReportById(input.originalReportId);

    if (!['SUBMITTED', 'ACCEPTED'].includes(originalReport.status)) {
      throw new Error('Można tworzyć korektę tylko dla złożonego lub zaakceptowanego raportu');
    }

    const correctionInput: CreateJPKReportInput = {
      clientId: originalReport.clientId,
      reportType: originalReport.reportType,
      year: originalReport.year,
      month: originalReport.month,
      quarter: originalReport.quarter,
      purpose: 'CORRECTION',
    };

    const correction = await this.createReport(correctionInput);

    // Copy records from original
    const [saleRecords, purchaseRecords, originalDbReport] = await Promise.all([
      this.prisma.jpkSaleRecord.findMany({
        where: { reportId: input.originalReportId },
      }),
      this.prisma.jpkPurchaseRecord.findMany({
        where: { reportId: input.originalReportId },
      }),
      this.prisma.jpkReport.findUnique({
        where: { id: input.originalReportId },
      }),
    ]);

    // Duplicate sale records
    for (const record of saleRecords) {
      await this.prisma.jpkSaleRecord.create({
        data: {
          ...record,
          id: undefined,
          reportId: correction.id,
        },
      });
    }

    // Duplicate purchase records
    for (const record of purchaseRecords) {
      await this.prisma.jpkPurchaseRecord.create({
        data: {
          ...record,
          id: undefined,
          reportId: correction.id,
        },
      });
    }

    // Update correction with original report reference
    await this.prisma.jpkReport.update({
      where: { id: correction.id },
      data: {
        originalReportId: input.originalReportId,
        correctionReason: input.correctionReason,
        saleRecordCount: saleRecords.length,
        purchaseRecordCount: purchaseRecords.length,
        recordCount: saleRecords.length + purchaseRecords.length,
        declaration: originalDbReport?.declaration || undefined,
      },
    });

    return this.getReportById(correction.id);
  }

  /**
   * Get report by ID with optional records
   * AC-13: Retrieve full report details
   */
  async getReport(input: GetJPKReportInput): Promise<JPKReportSummary> {
    const report = await this.getReportById(input.reportId);

    const result: JPKReportSummary = { report };

    if (input.includeRecords) {
      const [saleRecords, purchaseRecords] = await Promise.all([
        this.prisma.jpkSaleRecord.findMany({
          where: { reportId: input.reportId },
          orderBy: { recordNumber: 'asc' },
        }),
        this.prisma.jpkPurchaseRecord.findMany({
          where: { reportId: input.reportId },
          orderBy: { recordNumber: 'asc' },
        }),
      ]);

      result.saleRecords = saleRecords.map(r => this.mapToSaleRecord(r));
      result.purchaseRecords = purchaseRecords.map(r => this.mapToPurchaseRecord(r));
    }

    if (input.includeDeclaration) {
      const dbReport = await this.prisma.jpkReport.findUnique({
        where: { id: input.reportId },
      });
      if (dbReport?.declaration) {
        result.declaration = dbReport.declaration as JPKV7Declaration;
      }
    }

    return result;
  }

  /**
   * List reports with filters
   * AC-14: Query reports with pagination
   */
  async listReports(input: ListJPKReportsInput): Promise<ListJPKReportsResult> {
    const where: Record<string, unknown> = {
      organizationId: this.organizationId,
    };

    if (input.clientId) where.clientId = input.clientId;
    if (input.reportType) where.reportType = input.reportType;
    if (input.status) where.status = input.status;
    if (input.year) where.year = input.year;
    if (input.month) where.month = input.month;

    const [reports, total] = await Promise.all([
      this.prisma.jpkReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.jpkReport.count({ where }),
    ]);

    return {
      reports: reports.map(r => this.mapToJPKReport(r)),
      total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.ceil(total / input.pageSize),
    };
  }

  /**
   * Delete report (only draft/error status)
   * AC-15: Remove incomplete reports
   */
  async deleteReport(input: DeleteJPKReportInput): Promise<void> {
    const report = await this.getReportById(input.reportId);

    if (!['DRAFT', 'ERROR'].includes(report.status)) {
      throw new Error('Można usunąć tylko raporty w stanie DRAFT lub ERROR');
    }

    // Delete related records first
    await this.prisma.jpkSaleRecord.deleteMany({
      where: { reportId: input.reportId },
    });
    await this.prisma.jpkPurchaseRecord.deleteMany({
      where: { reportId: input.reportId },
    });

    // Delete report
    await this.prisma.jpkReport.delete({
      where: { id: input.reportId },
    });
  }

  /**
   * Download XML file
   * AC-16: Get generated XML content
   */
  async downloadXML(input: DownloadJPKXMLInput): Promise<DownloadResult> {
    const report = await this.getReportById(input.reportId);

    const filePath = input.signed ? report.signedXmlFilePath : report.xmlFilePath;

    if (!filePath) {
      throw new Error(input.signed ? 'Podpisany XML nie istnieje' : 'XML nie został wygenerowany');
    }

    // In production, would fetch from file storage
    // Regenerate XML for download
    const [saleRecords, purchaseRecords, dbReport] = await Promise.all([
      this.prisma.jpkSaleRecord.findMany({
        where: { reportId: input.reportId },
        orderBy: { recordNumber: 'asc' },
      }),
      this.prisma.jpkPurchaseRecord.findMany({
        where: { reportId: input.reportId },
        orderBy: { recordNumber: 'asc' },
      }),
      this.prisma.jpkReport.findUnique({
        where: { id: input.reportId },
        include: { client: true },
      }),
    ]);

    if (!dbReport) {
      throw new Error('Raport nie został znaleziony');
    }

    const totals = this.calculateTotals(saleRecords, purchaseRecords);
    const xml = this.buildJPKXML(
      dbReport,
      saleRecords.map(r => this.mapToSaleRecord(r)),
      purchaseRecords.map(r => this.mapToPurchaseRecord(r)),
      totals,
    );

    return {
      fileName: `JPK_${report.reportType}_${report.year}_${report.month || report.quarter}.xml`,
      contentType: 'application/xml',
      fileSize: Buffer.byteLength(xml, 'utf-8'),
      content: Buffer.from(xml).toString('base64'),
    };
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  private async getReportById(reportId: string): Promise<JPKReport> {
    const report = await this.prisma.jpkReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new Error('Raport JPK nie został znaleziony');
    }

    if (report.organizationId !== this.organizationId) {
      throw new Error('Brak dostępu do tego raportu');
    }

    return this.mapToJPKReport(report);
  }

  private calculatePeriodDates(
    year: number,
    month?: number,
    quarter?: number,
    _reportType?: string,
  ): { periodFrom: Date; periodTo: Date } {
    if (month) {
      const periodFrom = new Date(year, month - 1, 1);
      const periodTo = new Date(year, month, 0); // Last day of month
      return { periodFrom, periodTo };
    }

    if (quarter) {
      const startMonth = (quarter - 1) * 3;
      const periodFrom = new Date(year, startMonth, 1);
      const periodTo = new Date(year, startMonth + 3, 0);
      return { periodFrom, periodTo };
    }

    // Full year for on-demand reports
    return {
      periodFrom: new Date(year, 0, 1),
      periodTo: new Date(year, 11, 31),
    };
  }

  private validateNIP(nip: string): boolean {
    if (!nip || nip.length !== 10) return false;

    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    let sum = 0;

    for (let i = 0; i < 9; i++) {
      sum += parseInt(nip[i], 10) * weights[i];
    }

    const checksum = sum % 11;
    return checksum === parseInt(nip[9], 10);
  }

  private calculateTotals(
    saleRecords: Array<Record<string, unknown>>,
    purchaseRecords: Array<Record<string, unknown>>,
  ): {
    totalSaleNet: Decimal;
    totalSaleVAT: Decimal;
    totalPurchaseNet: Decimal;
    totalPurchaseVAT: Decimal;
  } {
    let totalSaleNet = new Decimal(0);
    let totalSaleVAT = new Decimal(0);

    for (const record of saleRecords) {
      if (record.netAmount23) totalSaleNet = totalSaleNet.plus(record.netAmount23 as string);
      if (record.netAmount8) totalSaleNet = totalSaleNet.plus(record.netAmount8 as string);
      if (record.netAmount5) totalSaleNet = totalSaleNet.plus(record.netAmount5 as string);
      if (record.netAmount0) totalSaleNet = totalSaleNet.plus(record.netAmount0 as string);
      if (record.netAmountExempt) totalSaleNet = totalSaleNet.plus(record.netAmountExempt as string);
      if (record.vatAmount23) totalSaleVAT = totalSaleVAT.plus(record.vatAmount23 as string);
      if (record.vatAmount8) totalSaleVAT = totalSaleVAT.plus(record.vatAmount8 as string);
      if (record.vatAmount5) totalSaleVAT = totalSaleVAT.plus(record.vatAmount5 as string);
    }

    let totalPurchaseNet = new Decimal(0);
    let totalPurchaseVAT = new Decimal(0);

    for (const record of purchaseRecords) {
      if (record.netAmountTotal) totalPurchaseNet = totalPurchaseNet.plus(record.netAmountTotal as string);
      if (record.vatAmountDeductible) totalPurchaseVAT = totalPurchaseVAT.plus(record.vatAmountDeductible as string);
    }

    return { totalSaleNet, totalSaleVAT, totalPurchaseNet, totalPurchaseVAT };
  }

  private buildJPKXML(
    report: Record<string, unknown>,
    saleRecords: JPKV7SaleRecord[],
    purchaseRecords: JPKV7PurchaseRecord[],
    totals: { totalSaleNet: Decimal; totalSaleVAT: Decimal; totalPurchaseNet: Decimal; totalPurchaseVAT: Decimal },
  ): string {
    // Simplified XML generation - in production would use proper XML builder
    const client = report.client as Record<string, unknown>;
    const schemaVersion = JPK_SCHEMA_VERSIONS[report.reportType as keyof typeof JPK_SCHEMA_VERSIONS] || '1-2E';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2022/02/17/02171/" xmlns:etd="http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2021/06/08/eD/DefinicjeTypy/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (${schemaVersion})" wersjaSchemy="${schemaVersion}">JPK_VAT</KodFormularza>
    <WariantFormularza>1</WariantFormularza>
    <DataWytworzeniaJPK>${new Date().toISOString()}</DataWytworzeniaJPK>
    <CelZlozenia plesent="1">${report.purpose === 'FIRST' ? '1' : '2'}</CelZlozenia>
    <DataOd>${new Date(report.periodFrom as string).toISOString().split('T')[0]}</DataOd>
    <DataDo>${new Date(report.periodTo as string).toISOString().split('T')[0]}</DataDo>
    <NazwaUrzedu>Urząd Skarbowy</NazwaUrzedu>
  </Naglowek>
  <Podmiot1>
    <NIP>${client?.nip || ''}</NIP>
    <PelnaNazwa>${client?.name || ''}</PelnaNazwa>
  </Podmiot1>`;

    // Add sale records
    if (saleRecords.length > 0) {
      xml += '\n  <SprzedazWiersz>';
      for (const record of saleRecords) {
        xml += `
    <LpSprzedazy>${record.recordNumber}</LpSprzedazy>
    <NrDokumentu>${record.documentNumber}</NrDokumentu>
    <DataWystawienia>${record.documentDate.split('T')[0]}</DataWystawienia>`;
        if (record.buyerNIP) xml += `\n    <NrKontrahenta>${record.buyerNIP}</NrKontrahenta>`;
        if (record.netAmount23) xml += `\n    <K_19>${record.netAmount23}</K_19>`;
        if (record.vatAmount23) xml += `\n    <K_20>${record.vatAmount23}</K_20>`;
      }
      xml += '\n  </SprzedazWiersz>';
    }

    // Add purchase records
    if (purchaseRecords.length > 0) {
      xml += '\n  <ZakupWiersz>';
      for (const record of purchaseRecords) {
        xml += `
    <LpZakupu>${record.recordNumber}</LpZakupu>
    <NrDostawcy>${record.documentNumber}</NrDostawcy>
    <DataZakupu>${record.documentDate.split('T')[0]}</DataZakupu>`;
        if (record.sellerNIP) xml += `\n    <NrDostawcy>${record.sellerNIP}</NrDostawcy>`;
        xml += `\n    <K_42>${record.netAmountTotal}</K_42>`;
        xml += `\n    <K_43>${record.vatAmountDeductible}</K_43>`;
      }
      xml += '\n  </ZakupWiersz>';
    }

    // Add summary
    xml += `
  <SprzedazCtrl>
    <LiczbaWierszySprzedazy>${saleRecords.length}</LiczbaWierszySprzedazy>
    <PodatekNalezny>${totals.totalSaleVAT.toFixed(2)}</PodatekNalezny>
  </SprzedazCtrl>
  <ZakupCtrl>
    <LiczbaWierszyZakupow>${purchaseRecords.length}</LiczbaWierszyZakupow>
    <PodatekNaliczony>${totals.totalPurchaseVAT.toFixed(2)}</PodatekNaliczony>
  </ZakupCtrl>
</JPK>`;

    return xml;
  }

  private calculateXMLHash(xml: string): string {
    // Simple hash for demonstration - in production would use SHA-256
    let hash = 0;
    for (let i = 0; i < xml.length; i++) {
      const char = xml.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  private generateUPOContent(report: JPKReport): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<UPO xmlns="http://upo.mf.gov.pl">
  <NumerUPO>${report.upoNumber}</NumerUPO>
  <DataOdbioru>${report.upoReceivedAt}</DataOdbioru>
  <NumerReferencyjny>${report.referenceNumber}</NumerReferencyjny>
  <Status>ACCEPTED</Status>
  <KodFormularza>${report.reportType}</KodFormularza>
  <OkresRozliczeniowy>${report.year}-${report.month?.toString().padStart(2, '0') || 'Q' + report.quarter}</OkresRozliczeniowy>
</UPO>`;
  }

  private mapToJPKReport(report: Record<string, unknown>): JPKReport {
    return {
      id: report.id as string,
      organizationId: report.organizationId as string,
      clientId: report.clientId as string,
      reportType: report.reportType as JPKReport['reportType'],
      status: report.status as JPKReport['status'],
      year: report.year as number,
      month: report.month as number | undefined,
      quarter: report.quarter as number | undefined,
      periodFrom: (report.periodFrom as Date).toISOString(),
      periodTo: (report.periodTo as Date).toISOString(),
      purpose: report.purpose as JPKReport['purpose'],
      correctionNumber: report.correctionNumber as number | undefined,
      originalReportId: report.originalReportId as string | undefined,
      correctionReason: report.correctionReason as string | undefined,
      recordCount: report.recordCount as number,
      saleRecordCount: report.saleRecordCount as number | undefined,
      purchaseRecordCount: report.purchaseRecordCount as number | undefined,
      totalSaleNet: report.totalSaleNet as string | undefined,
      totalSaleVAT: report.totalSaleVAT as string | undefined,
      totalPurchaseNet: report.totalPurchaseNet as string | undefined,
      totalPurchaseVAT: report.totalPurchaseVAT as string | undefined,
      xmlFilePath: report.xmlFilePath as string | undefined,
      xmlFileSize: report.xmlFileSize as number | undefined,
      xmlHash: report.xmlHash as string | undefined,
      signedXmlFilePath: report.signedXmlFilePath as string | undefined,
      submittedAt: report.submittedAt ? (report.submittedAt as Date).toISOString() : undefined,
      referenceNumber: report.referenceNumber as string | undefined,
      upoNumber: report.upoNumber as string | undefined,
      upoReceivedAt: report.upoReceivedAt ? (report.upoReceivedAt as Date).toISOString() : undefined,
      upoFilePath: report.upoFilePath as string | undefined,
      errorMessage: report.errorMessage as string | undefined,
      errorDetails: report.errorDetails as Record<string, unknown> | undefined,
      generatedBy: report.generatedBy as string,
      generatedAt: report.generatedAt ? (report.generatedAt as Date).toISOString() : undefined,
      createdAt: (report.createdAt as Date).toISOString(),
      updatedAt: (report.updatedAt as Date).toISOString(),
    };
  }

  private mapToSaleRecord(record: Record<string, unknown>): JPKV7SaleRecord {
    return {
      recordNumber: record.recordNumber as number,
      documentType: record.documentType as JPKV7SaleRecord['documentType'],
      documentNumber: record.documentNumber as string,
      documentDate: record.documentDate as string,
      saleDate: record.saleDate as string | undefined,
      buyerNIP: record.buyerNIP as string | undefined,
      buyerName: record.buyerName as string | undefined,
      buyerCountryCode: record.buyerCountryCode as string | undefined,
      netAmount23: record.netAmount23 as string | undefined,
      vatAmount23: record.vatAmount23 as string | undefined,
      netAmount8: record.netAmount8 as string | undefined,
      vatAmount8: record.vatAmount8 as string | undefined,
      netAmount5: record.netAmount5 as string | undefined,
      vatAmount5: record.vatAmount5 as string | undefined,
      netAmount0: record.netAmount0 as string | undefined,
      netAmountExempt: record.netAmountExempt as string | undefined,
      netAmountWDT: record.netAmountWDT as string | undefined,
      netAmountExport: record.netAmountExport as string | undefined,
      gtuCodes: record.gtuCodes as JPKV7SaleRecord['gtuCodes'],
      procedureCodes: record.procedureCodes as JPKV7SaleRecord['procedureCodes'],
      correctedInvoiceNumber: record.correctedInvoiceNumber as string | undefined,
      correctedInvoiceDate: record.correctedInvoiceDate as string | undefined,
    };
  }

  private mapToPurchaseRecord(record: Record<string, unknown>): JPKV7PurchaseRecord {
    return {
      recordNumber: record.recordNumber as number,
      documentNumber: record.documentNumber as string,
      documentDate: record.documentDate as string,
      receiptDate: record.receiptDate as string | undefined,
      sellerNIP: record.sellerNIP as string | undefined,
      sellerName: record.sellerName as string | undefined,
      sellerCountryCode: record.sellerCountryCode as string | undefined,
      netAmountTotal: record.netAmountTotal as string,
      vatAmountDeductible: record.vatAmountDeductible as string,
      vatAmountNonDeductible: record.vatAmountNonDeductible as string | undefined,
      isWNT: record.isWNT as boolean,
      isImportServices: record.isImportServices as boolean,
      isMPP: record.isMPP as boolean,
      procedureCodes: record.procedureCodes as JPKV7PurchaseRecord['procedureCodes'],
    };
  }
}

export type JPKReportingServiceType = InstanceType<typeof JPKReportingService>;
