// TAX-013: White List Verification Service
// Manages Polish White List (Biała Lista) verification for VAT payer status and bank accounts
// Per Art. 96b VAT Act - mandatory verification for B2B payments over 15,000 PLN

import { TRPCError } from '@trpc/server';
import type {
  VerifyNIPRequestInput,
  VerifyIBANRequestInput,
  BatchVerifyRequestInput,
  PaymentVerificationRequestInput,
  VerificationHistoryFilterInput,
  GetVerificationByIdInput,
  GetWhiteListAlertsInput,
  CreateWhiteListAlertInput,
  ResolveWhiteListAlertInput,
  AcknowledgeWhiteListAlertInput,
  EscalateWhiteListAlertInput,
  UpdateWhiteListConfigInput,
  ExportHistoryInput,
  VerificationResult,
  PaymentAuthorizationResult,
  BatchVerificationResult,
  VerificationHistoryResult,
  AlertListResult,
  ExportResult,
  WhiteListVerification,
  WhiteListAlert,
  WhiteListConfig,
  NIPStatus,
  WhiteListRiskLevel,
  PaymentAuthorizationStatus,
  RegisteredAccount,
} from '@ksiegowacrm/shared';
import {
  RISK_THRESHOLDS,
  SPLIT_PAYMENT_PKD_CODES,
  POLISH_BANK_CODES,
} from '@ksiegowacrm/shared';
import type { PrismaClient } from '@prisma/client';

// ===========================================================================
// CONSTANTS - MF API
// ===========================================================================

const MF_API_BASE_URL = 'https://wl-api.mf.gov.pl/api';
const MF_API_ENDPOINTS = {
  CHECK_NIP: '/search/nip',
  CHECK_NIPS: '/search/nips',
  CHECK_IBAN_NIP: '/check/nip',
} as const;

const DEFAULT_CONFIG: WhiteListConfig = {
  autoVerifyInvoices: true,
  autoVerifyPayments: true,
  verificationThreshold: RISK_THRESHOLDS.MANDATORY_VERIFICATION_AMOUNT,
  blockUnverifiedInvoices: false,
  blockUnverifiedPayments: true,
  cacheDurationHours: 24,
  forceFreshOnPayment: true,
  alertThresholdHours: 24,
  escalationThresholdHours: 48,
  alertRecipients: [],
  autoDetectSplitPayment: true,
  splitPaymentPkdCodes: [...SPLIT_PAYMENT_PKD_CODES],
  apiTimeoutMs: 5000,
  maxRetries: 3,
};

// ===========================================================================
// MF API RESPONSE TYPES (Internal)
// ===========================================================================

interface MFApiSubject {
  name: string;
  nip: string;
  statusVat: 'Czynny' | 'Zwolniony' | 'Niezarejestrowany';
  regon?: string;
  pesel?: string;
  krs?: string;
  residenceAddress?: string;
  workingAddress?: string;
  representatives?: Array<{
    firstName: string;
    lastName: string;
    nip?: string;
    companyName?: string;
  }>;
  authorizedClerks?: Array<{
    firstName: string;
    lastName: string;
    nip?: string;
    companyName?: string;
  }>;
  partners?: Array<{
    firstName: string;
    lastName: string;
    nip?: string;
    companyName?: string;
  }>;
  registrationLegalDate?: string;
  registrationDenialDate?: string;
  registrationDenialBasis?: string;
  restorationDate?: string;
  restorationBasis?: string;
  removalDate?: string;
  removalBasis?: string;
  accountNumbers: string[];
  hasVirtualAccounts: boolean;
}

interface MFApiNIPResponse {
  result: {
    requestId: string;
    requestDateTime: string;
    subject: MFApiSubject | null;
  };
}

interface MFApiNIPsResponse {
  result: {
    requestId: string;
    requestDateTime: string;
    subjects: MFApiSubject[];
  };
}

interface MFApiCheckResponse {
  result: {
    requestId: string;
    requestDateTime: string;
    accountAssigned: 'TAK' | 'NIE';
  };
}

// ===========================================================================
// NOT IMPLEMENTED ERROR
// ===========================================================================

class NotImplementedError extends Error {
  constructor(feature: string, missingModel: string) {
    super(`${feature} requires the ${missingModel} Prisma model which is not yet implemented`);
    this.name = 'NotImplementedError';
  }
}

// ===========================================================================
// WHITE LIST VERIFICATION SERVICE
// ===========================================================================

/**
 * WhiteListService (TAX-013)
 * Manages Polish White List (Biała Lista) verification for VAT payer status and bank accounts
 *
 * TODO: This service requires the following Prisma schema additions:
 * - WhiteListVerification model for storing verification results
 * - WhiteListAlert model for alert management
 * - WhiteListConfig model for organization configuration
 *
 * Methods that interact with these models throw NotImplementedError.
 * API-only methods (verifyNIP, verifyIBAN, etc.) work by returning mock/API data.
 */
export class WhiteListService {
  constructor(
    private readonly db: PrismaClient,
    private readonly organizationId: string,
    private readonly userId: string,
  ) {
    // Suppress unused warnings - reserved for future Prisma implementation
    void this.db;
    void this.organizationId;
    void this.userId;
    // Suppress unused warnings for reserved export helper methods
    void this._generateCSV;
    void this._generatePDFContent;
  }

  // =========================================================================
  // VERIFICATION METHODS
  // =========================================================================

  /**
   * Verify NIP against White List
   * AC-1: Basic NIP verification with active VAT payer status
   */
  async verifyNIP(input: VerifyNIPRequestInput): Promise<VerificationResult> {
    const startTime = Date.now();
    const verificationDate = input.date || this.getCurrentDate();

    // Check cache first (unless force refresh)
    if (!input.forceRefresh) {
      const cached = await this.getCachedVerification(input.nip, verificationDate);
      if (cached) {
        return this.mapVerificationToResult(cached, true);
      }
    }

    // Call MF API
    const response = await this.callMFApiNIP(input.nip, verificationDate);
    const responseTime = Date.now() - startTime;

    // Parse and store verification
    const verification = await this.storeVerification({
      nip: input.nip,
      verificationType: 'nip_only',
      requestId: response.result.requestId,
      requestTimestamp: new Date(response.result.requestDateTime),
      requestDate: new Date(verificationDate),
      responseTimeMs: responseTime,
      subject: response.result.subject,
    });

    return this.mapVerificationToResult(verification, false, responseTime);
  }

  /**
   * Verify NIP and IBAN combination against White List
   * AC-2: Bank account verification for payment safety
   */
  async verifyIBAN(input: VerifyIBANRequestInput): Promise<VerificationResult> {
    const startTime = Date.now();
    const verificationDate = input.date || this.getCurrentDate();

    // Check cache first (unless force refresh)
    if (!input.forceRefresh) {
      const cached = await this.getCachedVerification(input.nip, verificationDate, input.iban);
      if (cached) {
        return this.mapVerificationToResult(cached, true);
      }
    }

    // First, verify NIP to get subject details
    const nipResponse = await this.callMFApiNIP(input.nip, verificationDate);

    // Then, check if IBAN is registered for this NIP
    const ibanResponse = await this.callMFApiCheckIBAN(input.nip, input.iban, verificationDate);
    const responseTime = Date.now() - startTime;

    // Parse and store verification
    const verification = await this.storeVerification({
      nip: input.nip,
      iban: input.iban,
      verificationType: 'nip_and_iban',
      requestId: nipResponse.result.requestId,
      requestTimestamp: new Date(nipResponse.result.requestDateTime),
      requestDate: new Date(verificationDate),
      responseTimeMs: responseTime,
      subject: nipResponse.result.subject,
      ibanRegistered: ibanResponse.result.accountAssigned === 'TAK',
      amountVerified: input.amount?.toString(),
    });

    return this.mapVerificationToResult(verification, false, responseTime);
  }

  /**
   * Batch verify multiple NIPs
   * AC-3: Bulk verification for client portfolio
   */
  async batchVerify(input: BatchVerifyRequestInput): Promise<BatchVerificationResult> {
    const verificationDate = input.date || this.getCurrentDate();
    const results: VerificationResult[] = [];

    // MF API supports up to 30 NIPs in batch
    const response = await this.callMFApiNIPs(input.nips, verificationDate);

    // Process each subject
    for (const nip of input.nips) {
      const subject = response.result.subjects.find(s => s.nip === nip);

      const verification = await this.storeVerification({
        nip,
        verificationType: 'batch',
        requestId: response.result.requestId,
        requestTimestamp: new Date(response.result.requestDateTime),
        requestDate: new Date(verificationDate),
        responseTimeMs: 0,
        subject: subject || null,
      });

      results.push(this.mapVerificationToResult(verification, false, 0));
    }

    // Calculate summary
    const summary = {
      total: results.length,
      active: results.filter(r => r.nipStatus === 'active').length,
      inactive: results.filter(r => r.nipStatus === 'inactive').length,
      notRegistered: results.filter(r => r.nipStatus === 'not_registered').length,
      errors: results.filter(r => r.nipStatus === 'error').length,
    };

    return { results, summary };
  }

  /**
   * Verify payment before execution
   * AC-4: Payment authorization with risk assessment
   */
  async verifyPayment(input: PaymentVerificationRequestInput): Promise<PaymentAuthorizationResult> {
    // Check if verification is required based on amount
    const requiresVerification = input.amount >= RISK_THRESHOLDS.MANDATORY_VERIFICATION_AMOUNT;

    // Perform verification
    const verification = await this.verifyIBAN({
      nip: input.recipientNip,
      iban: input.recipientIban,
      amount: input.amount,
      date: input.paymentDate,
      forceRefresh: input.forceRefresh,
    });

    // Check if split payment is required
    const requiresSplitPayment = this.checkSplitPaymentRequired(
      input.amount,
      input.pkdCodes || [],
    );

    // Determine authorization status
    const { status, authorized } = this.determineAuthorizationStatus(
      verification,
      input.amount,
      requiresVerification,
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      verification,
      input.amount,
      requiresSplitPayment,
    );

    // Create alert if necessary
    if (!authorized || verification.riskLevel === 'high' || verification.riskLevel === 'critical') {
      await this.createPaymentAlert(verification, input, status);
    }

    return {
      authorized,
      status,
      verification,
      message: this.getAuthorizationMessage(status),
      recommendations,
    };
  }

  // =========================================================================
  // HISTORY AND RETRIEVAL METHODS
  // =========================================================================

  /**
   * Get verification history
   */
  async getVerificationHistory(_input: VerificationHistoryFilterInput): Promise<VerificationHistoryResult> {
    void _input;
    throw new NotImplementedError('getVerificationHistory', 'WhiteListVerification');
  }

  /**
   * Get verification by ID
   */
  async getVerificationById(_input: GetVerificationByIdInput): Promise<WhiteListVerification> {
    void _input;
    throw new NotImplementedError('getVerificationById', 'WhiteListVerification');
  }

  // =========================================================================
  // ALERT METHODS
  // =========================================================================

  /**
   * Get alerts
   */
  async getAlerts(_input: GetWhiteListAlertsInput): Promise<AlertListResult> {
    void _input;
    throw new NotImplementedError('getAlerts', 'WhiteListAlert');
  }

  /**
   * Create alert
   */
  async createAlert(_input: CreateWhiteListAlertInput): Promise<WhiteListAlert> {
    void _input;
    throw new NotImplementedError('createAlert', 'WhiteListAlert');
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(_input: AcknowledgeWhiteListAlertInput): Promise<WhiteListAlert> {
    void _input;
    throw new NotImplementedError('acknowledgeAlert', 'WhiteListAlert');
  }

  /**
   * Resolve alert
   */
  async resolveAlert(_input: ResolveWhiteListAlertInput): Promise<WhiteListAlert> {
    void _input;
    throw new NotImplementedError('resolveAlert', 'WhiteListAlert');
  }

  /**
   * Escalate alert
   */
  async escalateAlert(_input: EscalateWhiteListAlertInput): Promise<WhiteListAlert> {
    void _input;
    throw new NotImplementedError('escalateAlert', 'WhiteListAlert');
  }

  // =========================================================================
  // CONFIGURATION METHODS
  // =========================================================================

  /**
   * Get organization configuration
   * Note: Returns default config until WhiteListConfig Prisma model is implemented
   */
  async getConfig(): Promise<WhiteListConfig> {
    // Return default config - full persistence requires WhiteListConfig model
    return DEFAULT_CONFIG;
  }

  /**
   * Update organization configuration
   */
  async updateConfig(_input: UpdateWhiteListConfigInput): Promise<WhiteListConfig> {
    void _input;
    throw new NotImplementedError('updateConfig', 'WhiteListConfig');
  }

  // =========================================================================
  // EXPORT METHODS
  // =========================================================================

  /**
   * Export verification history
   */
  async exportHistory(_input: ExportHistoryInput): Promise<ExportResult> {
    void _input;
    throw new NotImplementedError('exportHistory', 'WhiteListVerification');
  }

  // =========================================================================
  // PRIVATE HELPER METHODS - MF API
  // =========================================================================

  /**
   * Call MF API to verify single NIP
   */
  private async callMFApiNIP(nip: string, date: string): Promise<MFApiNIPResponse> {
    const config = await this.getConfig();
    const url = `${MF_API_BASE_URL}${MF_API_ENDPOINTS.CHECK_NIP}/${nip}?date=${date}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.apiTimeoutMs);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`MF API error: ${response.status} ${response.statusText}`);
      }

      return await response.json() as MFApiNIPResponse;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TRPCError({
          code: 'TIMEOUT',
          message: 'MF API request timed out',
        });
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to verify NIP: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Call MF API to verify multiple NIPs
   */
  private async callMFApiNIPs(nips: string[], date: string): Promise<MFApiNIPsResponse> {
    const config = await this.getConfig();
    const url = `${MF_API_BASE_URL}${MF_API_ENDPOINTS.CHECK_NIPS}/${nips.join(',')}?date=${date}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.apiTimeoutMs * 2);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`MF API error: ${response.status} ${response.statusText}`);
      }

      return await response.json() as MFApiNIPsResponse;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TRPCError({
          code: 'TIMEOUT',
          message: 'MF API batch request timed out',
        });
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to batch verify NIPs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Call MF API to check if IBAN is registered for NIP
   */
  private async callMFApiCheckIBAN(nip: string, iban: string, date: string): Promise<MFApiCheckResponse> {
    const config = await this.getConfig();
    // Normalize IBAN to 26 digits (remove PL prefix)
    const normalizedIban = iban.startsWith('PL') ? iban.substring(2) : iban;
    const url = `${MF_API_BASE_URL}${MF_API_ENDPOINTS.CHECK_IBAN_NIP}/${nip}/bank-account/${normalizedIban}?date=${date}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.apiTimeoutMs);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`MF API error: ${response.status} ${response.statusText}`);
      }

      return await response.json() as MFApiCheckResponse;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TRPCError({
          code: 'TIMEOUT',
          message: 'MF API IBAN check timed out',
        });
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to verify IBAN: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  // =========================================================================
  // PRIVATE HELPER METHODS - CACHE
  // =========================================================================

  /**
   * Get cached verification
   * Note: Returns null (cache miss) until WhiteListVerification Prisma model is implemented
   */
  private async getCachedVerification(
    _nip: string,
    _date: string,
    _iban?: string,
  ): Promise<WhiteListVerification | null> {
    // No caching without WhiteListVerification model - always return cache miss
    void _nip;
    void _date;
    void _iban;
    return null;
  }

  // =========================================================================
  // PRIVATE HELPER METHODS - STORAGE
  // =========================================================================

  /**
   * Store verification result
   * Note: Returns mock verification without persistence until WhiteListVerification Prisma model is implemented
   */
  private async storeVerification(data: {
    nip: string;
    iban?: string;
    verificationType: 'nip_only' | 'nip_and_iban' | 'batch' | 'iban_only';
    requestId: string;
    requestTimestamp: Date;
    requestDate: Date;
    responseTimeMs: number;
    subject: MFApiSubject | null;
    ibanRegistered?: boolean;
    amountVerified?: string;
  }): Promise<WhiteListVerification> {
    const nipStatus = this.mapNipStatus(data.subject?.statusVat);
    const riskLevel = this.calculateRiskLevel(nipStatus, data.ibanRegistered, data.amountVerified);
    const riskReasons = this.getRiskReasons(nipStatus, data.ibanRegistered, data.amountVerified);

    const registeredAccounts = (data.subject?.accountNumbers || []).map(iban => ({
      iban,
      bankName: this.getBankName(iban),
      assignmentDate: null,
    }));

    // Return mock verification without DB persistence (requires WhiteListVerification model)
    const now = new Date();
    return {
      id: `mock-${Date.now()}`,
      organizationId: this.organizationId,
      nip: data.nip,
      iban: data.iban || null,
      verificationType: data.verificationType,
      contextType: null,
      contextReferenceId: null,
      contextReferenceType: null,
      requestId: data.requestId,
      requestTimestamp: data.requestTimestamp,
      requestDate: data.requestDate,
      responseTimestamp: now,
      responseTimeMs: data.responseTimeMs,
      nipStatus,
      registrationDate: data.subject?.registrationLegalDate
        ? new Date(data.subject.registrationLegalDate)
        : null,
      deregistrationDate: data.subject?.removalDate
        ? new Date(data.subject.removalDate)
        : null,
      restorationDate: data.subject?.restorationDate
        ? new Date(data.subject.restorationDate)
        : null,
      ibanRegistered: data.ibanRegistered ?? null,
      ibanAssignmentDate: null,
      subjectName: data.subject?.name || null,
      subjectLegalForm: null,
      subjectAddress: data.subject?.workingAddress || data.subject?.residenceAddress || null,
      krsNumber: data.subject?.krs || null,
      regon: data.subject?.regon || null,
      registeredAccounts,
      amountVerified: data.amountVerified || null,
      requiresSplitPayment: false,
      riskLevel,
      riskReasons,
      verifiedBy: this.userId,
      isCached: false,
      cacheSourceId: null,
      createdAt: now,
    };
  }

  // =========================================================================
  // PRIVATE HELPER METHODS - MAPPING
  // =========================================================================

  /**
   * Map MF API status to internal status
   */
  private mapNipStatus(statusVat?: string): NIPStatus {
    if (!statusVat) return 'not_registered';

    switch (statusVat) {
      case 'Czynny':
        return 'active';
      case 'Zwolniony':
        return 'inactive';
      case 'Niezarejestrowany':
        return 'not_registered';
      default:
        return 'error';
    }
  }

  /**
   * Map verification to result
   */
  private mapVerificationToResult(
    verification: WhiteListVerification,
    isCached: boolean,
    responseTimeMs?: number,
  ): VerificationResult {
    const cacheExpiresAt = new Date(verification.createdAt);
    cacheExpiresAt.setHours(cacheExpiresAt.getHours() + 24);

    return {
      verificationId: verification.id,
      nip: verification.nip,
      iban: verification.iban || undefined,
      nipStatus: verification.nipStatus || 'error',
      registrationDate: verification.registrationDate?.toISOString().split('T')[0] || null,
      deregistrationDate: verification.deregistrationDate?.toISOString().split('T')[0] || null,
      subjectName: verification.subjectName,
      subjectAddress: verification.subjectAddress,
      krs: verification.krsNumber,
      regon: verification.regon,
      ibanRegistered: verification.ibanRegistered,
      registeredAccounts: (verification.registeredAccounts || []) as RegisteredAccount[],
      riskLevel: verification.riskLevel,
      riskReasons: verification.riskReasons,
      requiresSplitPayment: verification.requiresSplitPayment,
      isCached,
      verifiedAt: verification.createdAt.toISOString(),
      cacheExpiresAt: cacheExpiresAt.toISOString(),
      requestId: verification.requestId || '',
      responseTimeMs: responseTimeMs ?? verification.responseTimeMs ?? 0,
    };
  }

  // =========================================================================
  // PRIVATE HELPER METHODS - RISK ASSESSMENT
  // =========================================================================

  /**
   * Calculate risk level based on verification results
   */
  private calculateRiskLevel(
    nipStatus: NIPStatus,
    ibanRegistered?: boolean,
    amountVerified?: string,
  ): WhiteListRiskLevel {
    let riskScore = 0;

    // NIP status scoring
    if (nipStatus === 'not_registered') riskScore += 50;
    else if (nipStatus === 'inactive') riskScore += 50;
    else if (nipStatus === 'error') riskScore += 40;

    // IBAN status scoring
    if (ibanRegistered === false) riskScore += 30;

    // Amount scoring
    if (amountVerified) {
      const amount = parseFloat(amountVerified);
      if (amount >= RISK_THRESHOLDS.CRITICAL_RISK_AMOUNT) riskScore += 20;
      else if (amount >= RISK_THRESHOLDS.HIGH_RISK_AMOUNT) riskScore += 10;
      else if (amount >= RISK_THRESHOLDS.MANDATORY_VERIFICATION_AMOUNT) riskScore += 5;
    }

    // Determine risk level
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 50) return 'high';
    if (riskScore >= 20) return 'medium';
    return 'low';
  }

  /**
   * Get risk reasons
   */
  private getRiskReasons(
    nipStatus: NIPStatus,
    ibanRegistered?: boolean,
    amountVerified?: string,
  ): string[] {
    const reasons: string[] = [];

    if (nipStatus === 'not_registered') {
      reasons.push('Podmiot nie jest zarejestrowany jako podatnik VAT');
    } else if (nipStatus === 'inactive') {
      reasons.push('Podmiot jest zwolniony z VAT');
    } else if (nipStatus === 'error') {
      reasons.push('Błąd podczas weryfikacji statusu VAT');
    }

    if (ibanRegistered === false) {
      reasons.push('Rachunek bankowy nie jest zarejestrowany na Białej Liście');
    }

    if (amountVerified) {
      const amount = parseFloat(amountVerified);
      if (amount >= RISK_THRESHOLDS.MANDATORY_VERIFICATION_AMOUNT) {
        reasons.push(`Kwota ${amount.toLocaleString('pl-PL')} PLN wymaga obowiązkowej weryfikacji`);
      }
    }

    return reasons;
  }

  // =========================================================================
  // PRIVATE HELPER METHODS - AUTHORIZATION
  // =========================================================================

  /**
   * Determine payment authorization status
   */
  private determineAuthorizationStatus(
    verification: VerificationResult,
    _amount: number,
    requiresVerification: boolean,
  ): { status: PaymentAuthorizationStatus; authorized: boolean } {
    // Critical failures
    if (verification.nipStatus === 'not_registered' || verification.nipStatus === 'inactive') {
      return { status: 'blocked_inactive_vat', authorized: false };
    }

    if (verification.nipStatus === 'error') {
      return { status: 'blocked_verification_failed', authorized: false };
    }

    // IBAN check for amounts requiring verification
    if (requiresVerification && verification.ibanRegistered === false) {
      return { status: 'blocked_unregistered_account', authorized: false };
    }

    // Split payment check
    if (verification.requiresSplitPayment) {
      return { status: 'requires_split_payment', authorized: true };
    }

    // Below threshold warning
    if (!requiresVerification) {
      return { status: 'warning_below_threshold', authorized: true };
    }

    return { status: 'approved', authorized: true };
  }

  /**
   * Get authorization message
   */
  private getAuthorizationMessage(status: PaymentAuthorizationStatus): string {
    switch (status) {
      case 'approved':
        return 'Płatność zatwierdzona - odbiorca zweryfikowany na Białej Liście';
      case 'requires_split_payment':
        return 'Wymagany mechanizm podzielonej płatności (split payment)';
      case 'blocked_unregistered_account':
        return 'Płatność zablokowana - rachunek nie jest zarejestrowany na Białej Liście';
      case 'blocked_inactive_vat':
        return 'Płatność zablokowana - odbiorca nie jest czynnym podatnikiem VAT';
      case 'blocked_verification_failed':
        return 'Płatność zablokowana - nie można zweryfikować odbiorcy';
      case 'warning_below_threshold':
        return 'Weryfikacja opcjonalna - kwota poniżej 15 000 PLN';
      default:
        return 'Status nieznany';
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    verification: VerificationResult,
    amount: number,
    requiresSplitPayment: boolean,
  ): string[] {
    const recommendations: string[] = [];

    if (verification.nipStatus !== 'active') {
      recommendations.push('Zweryfikuj status podatnika VAT odbiorcy przed dokonaniem płatności');
    }

    if (verification.ibanRegistered === false) {
      recommendations.push('Uzyskaj potwierdzenie numeru rachunku bankowego od odbiorcy');
      recommendations.push('Rozważ płatność na inny, zweryfikowany rachunek');
    }

    if (requiresSplitPayment) {
      recommendations.push('Zastosuj mechanizm podzielonej płatności (MPP)');
    }

    if (amount >= RISK_THRESHOLDS.HIGH_RISK_AMOUNT) {
      recommendations.push('Ze względu na wysoką kwotę, zachowaj szczególną ostrożność');
    }

    if (verification.riskLevel === 'high' || verification.riskLevel === 'critical') {
      recommendations.push('Rozważ dodatkową weryfikację kontrahenta');
      recommendations.push('Zachowaj dokumentację potwierdzającą należytą staranność');
    }

    return recommendations;
  }

  // =========================================================================
  // PRIVATE HELPER METHODS - SPLIT PAYMENT
  // =========================================================================

  /**
   * Check if split payment is required
   */
  private checkSplitPaymentRequired(amount: number, pkdCodes: string[]): boolean {
    // Split payment required for amounts >= 15,000 PLN and Annex 15 goods/services
    if (amount < RISK_THRESHOLDS.MANDATORY_VERIFICATION_AMOUNT) {
      return false;
    }

    return pkdCodes.some(code =>
      SPLIT_PAYMENT_PKD_CODES.includes(code as typeof SPLIT_PAYMENT_PKD_CODES[number])
    );
  }

  // =========================================================================
  // PRIVATE HELPER METHODS - ALERTS
  // =========================================================================

  /**
   * Create payment alert
   */
  private async createPaymentAlert(
    verification: VerificationResult,
    input: PaymentVerificationRequestInput,
    status: PaymentAuthorizationStatus,
  ): Promise<void> {
    let alertType: CreateWhiteListAlertInput['alertType'];
    let severity: CreateWhiteListAlertInput['severity'];
    let title: string;
    let message: string;

    switch (status) {
      case 'blocked_unregistered_account':
        alertType = 'account_not_registered';
        severity = 'critical';
        title = 'Rachunek niezarejestrowany na Białej Liście';
        message = `Płatność na kwotę ${input.amount.toLocaleString('pl-PL')} PLN do ${verification.subjectName || input.recipientNip} została zablokowana - rachunek nie jest zarejestrowany.`;
        break;
      case 'blocked_inactive_vat':
        alertType = 'verification_failed';
        severity = 'critical';
        title = 'Nieaktywny podatnik VAT';
        message = `Płatność na kwotę ${input.amount.toLocaleString('pl-PL')} PLN do ${verification.subjectName || input.recipientNip} została zablokowana - odbiorca nie jest czynnym podatnikiem VAT.`;
        break;
      case 'blocked_verification_failed':
        alertType = 'verification_failed';
        severity = 'error';
        title = 'Błąd weryfikacji';
        message = `Nie udało się zweryfikować odbiorcy ${input.recipientNip} dla płatności na kwotę ${input.amount.toLocaleString('pl-PL')} PLN.`;
        break;
      case 'requires_split_payment':
        alertType = 'split_payment_required';
        severity = 'warning';
        title = 'Wymagany split payment';
        message = `Płatność na kwotę ${input.amount.toLocaleString('pl-PL')} PLN wymaga mechanizmu podzielonej płatności.`;
        break;
      default:
        if (verification.riskLevel === 'high' || verification.riskLevel === 'critical') {
          alertType = 'unverified_payment';
          severity = verification.riskLevel === 'critical' ? 'critical' : 'warning';
          title = 'Płatność wysokiego ryzyka';
          message = `Płatność na kwotę ${input.amount.toLocaleString('pl-PL')} PLN do ${verification.subjectName || input.recipientNip} wymaga dodatkowej weryfikacji.`;
        } else {
          return; // No alert needed
        }
    }

    await this.createAlert({
      alertType,
      severity,
      nip: input.recipientNip,
      iban: input.recipientIban,
      paymentId: input.paymentId,
      invoiceId: input.invoiceId,
      title,
      message,
      amount: input.amount,
    });
  }

  // =========================================================================
  // PRIVATE HELPER METHODS - UTILITIES
  // =========================================================================

  /**
   * Get current date in YYYY-MM-DD format
   */
  private getCurrentDate(): string {
    return new Date().toISOString().split('T')[0] ?? new Date().toISOString().slice(0, 10);
  }

  /**
   * Get bank name from IBAN
   */
  private getBankName(iban: string): string | null {
    // Extract bank code (first 4 digits after country code)
    const normalizedIban = iban.startsWith('PL') ? iban.substring(2) : iban;
    const bankCode = normalizedIban.substring(2, 6);
    return POLISH_BANK_CODES[bankCode] || null;
  }

  /**
   * Generate CSV export
   * Reserved for exportHistory implementation
   */
  private _generateCSV(verifications: unknown[]): string {
    const headers = [
      'Data weryfikacji',
      'NIP',
      'IBAN',
      'Status VAT',
      'Poziom ryzyka',
      'Nazwa podmiotu',
      'Adres',
      'KRS',
      'REGON',
    ];

    const rows = (verifications as WhiteListVerification[]).map(v => [
      v.createdAt.toISOString(),
      v.nip,
      v.iban || '',
      v.nipStatus || '',
      v.riskLevel,
      v.subjectName || '',
      v.subjectAddress || '',
      v.krsNumber || '',
      v.regon || '',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Generate PDF content (placeholder - would use PDF library in production)
   * Reserved for exportHistory implementation
   */
  private _generatePDFContent(verifications: unknown[]): string {
    // In production, this would use a PDF generation library
    // For now, return a base64 placeholder
    return Buffer.from(JSON.stringify(verifications)).toString('base64');
  }
}
