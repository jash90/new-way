import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import {
  type ValidateVatInput,
  type ValidateClientVatInput,
  type GetVatStatusInput,
  type RefreshVatStatusInput,
  type BatchValidateVatInput,
  type VatValidationResult,
  type ClientVatStatus,
  type BatchVatValidationResult,
  type ViesData,
  isValidVatFormat,
  formatVatNumber,
} from '@ksiegowacrm/shared';
import type { AuditLogger } from '../../utils/audit-logger';

/**
 * VatService (CRM VAT Validation)
 * Handles EU VAT number validation via VIES API
 *
 * TODO: The following features require Prisma schema additions:
 * - Client fields: vatStatus, vatValidatedAt, viesData
 * - VatValidationHistory model for validation history tracking
 *
 * Methods requiring these features throw NotImplementedError.
 * Standalone VAT validation (validateVat) works without Prisma changes.
 */

// ===========================================
// CONSTANTS
// ===========================================

// Cache TTL in seconds (24 hours)
const VAT_CACHE_TTL = 86400;

// Maximum batch size
const MAX_BATCH_SIZE = 50;

// VIES SOAP API endpoint
const VIES_API_URL = process.env.VIES_API_URL || 'https://ec.europa.eu/taxation_customs/vies/services/checkVatService';

// ===========================================
// VIES CLIENT INTERFACE
// ===========================================

interface ViesClient {
  checkVat(countryCode: string, vatNumber: string): Promise<ViesData>;
}

// ===========================================
// NOT IMPLEMENTED ERROR
// ===========================================

class NotImplementedError extends Error {
  constructor(feature: string, missingModel: string) {
    super(`${feature} requires the ${missingModel} Prisma model/fields which are not yet implemented`);
    this.name = 'NotImplementedError';
  }
}

// ===========================================
// VAT SERVICE
// ===========================================

export class VatService {
  private viesClient: ViesClient;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly auditLogger: AuditLogger,
    private readonly userId: string,
    private readonly organizationId: string | null
  ) {
    // Suppress unused warnings - reserved for future implementation
    void this.prisma;
    void this.auditLogger;
    void this.userId;
    void this.organizationId;

    // Initialize VIES client
    this.viesClient = this.createViesClient();
  }

  // ===========================================================================
  // VALIDATE VAT NUMBER (Standalone) - Works without Prisma changes
  // ===========================================================================

  async validateVat(input: ValidateVatInput): Promise<VatValidationResult> {
    const { countryCode, vatNumber } = input;

    // Normalize VAT number (remove spaces, dashes, country prefix if present)
    const normalizedVat = this.normalizeVatNumber(vatNumber, countryCode);
    const cacheKey = `vat:${countryCode}:${normalizedVat}`;

    // Check cache first
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const cachedResult = JSON.parse(cached);
        return {
          ...cachedResult,
          validatedAt: new Date(cachedResult.validatedAt),
        };
      }
    } catch {
      // Cache miss or error, continue to validation
    }

    // Validate VAT format for the country
    if (!isValidVatFormat(countryCode, normalizedVat)) {
      return {
        valid: false,
        status: 'INVALID',
        countryCode,
        vatNumber: normalizedVat,
        formattedVatNumber: formatVatNumber(countryCode, normalizedVat),
        companyName: null,
        companyAddress: null,
        validatedAt: new Date(),
        cached: false,
        viesData: null,
        message: 'Nieprawidłowy format numeru VAT dla podanego kraju',
      };
    }

    // Call VIES API
    try {
      const viesData = await this.viesClient.checkVat(countryCode, normalizedVat);

      const result: VatValidationResult = {
        valid: viesData.valid,
        status: viesData.valid ? 'ACTIVE' : 'NOT_REGISTERED',
        countryCode,
        vatNumber: normalizedVat,
        formattedVatNumber: formatVatNumber(countryCode, normalizedVat),
        companyName: viesData.name || viesData.traderName || null,
        companyAddress: viesData.address || viesData.traderAddress || null,
        validatedAt: new Date(),
        cached: false,
        viesData,
        message: viesData.valid
          ? 'Numer VAT jest aktywny'
          : 'Numer VAT nie jest zarejestrowany w VIES',
      };

      // Cache the result
      try {
        await this.redis.setex(cacheKey, VAT_CACHE_TTL, JSON.stringify(result));
      } catch {
        // Ignore cache errors
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
      const isTimeout = errorMessage.includes('timeout');

      return {
        valid: false,
        status: 'UNKNOWN',
        countryCode,
        vatNumber: normalizedVat,
        formattedVatNumber: formatVatNumber(countryCode, normalizedVat),
        companyName: null,
        companyAddress: null,
        validatedAt: new Date(),
        cached: false,
        viesData: null,
        message: isTimeout
          ? 'Przekroczono limit czasu połączenia z VIES (timeout)'
          : 'Wystąpił błąd podczas walidacji VAT',
      };
    }
  }

  // ===========================================================================
  // VALIDATE CLIENT VAT - Requires Client.vatStatus, Client.vatValidatedAt,
  // Client.viesData fields and VatValidationHistory model
  // ===========================================================================

  async validateClientVat(_input: ValidateClientVatInput): Promise<VatValidationResult> {
    void _input;
    throw new NotImplementedError('validateClientVat', 'Client.vatStatus/vatValidatedAt/viesData and VatValidationHistory');
  }

  // ===========================================================================
  // GET VAT STATUS - Requires Client.vatStatus, Client.vatValidatedAt,
  // Client.viesData fields
  // ===========================================================================

  async getVatStatus(input: GetVatStatusInput): Promise<ClientVatStatus> {
    const { clientId } = input;

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Klient nie został znaleziony',
      });
    }

    // Check if client can be validated (has NIP and is company type)
    const canValidate = client.type === 'company' && !!client.nip;

    // Since vatStatus, vatValidatedAt, viesData fields don't exist yet,
    // return a basic status
    return {
      clientId,
      vatStatus: 'UNKNOWN',
      vatNumber: client.nip || null,
      countryCode: client.country || null,
      validatedAt: null,
      viesData: null,
      isExpired: false,
      canValidate,
      message: canValidate
        ? 'Funkcja walidacji VAT wymaga rozszerzenia schematu bazy danych'
        : 'Klient nie posiada numeru NIP do walidacji',
    };
  }

  // ===========================================================================
  // REFRESH VAT STATUS - Requires Client.vatStatus, Client.vatValidatedAt,
  // Client.viesData fields and VatValidationHistory model
  // ===========================================================================

  async refreshVatStatus(_input: RefreshVatStatusInput): Promise<VatValidationResult> {
    void _input;
    throw new NotImplementedError('refreshVatStatus', 'Client.vatStatus/vatValidatedAt/viesData and VatValidationHistory');
  }

  // ===========================================================================
  // BATCH VALIDATE VAT - Requires Client.vatStatus, Client.vatValidatedAt,
  // Client.viesData fields and VatValidationHistory model
  // ===========================================================================

  async batchValidateVat(input: BatchValidateVatInput): Promise<BatchVatValidationResult> {
    const { clientIds } = input;

    // Check batch size limit
    if (clientIds.length > MAX_BATCH_SIZE) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Maksymalna liczba klientów w jednym żądaniu to ${MAX_BATCH_SIZE}`,
      });
    }

    // This method requires missing Prisma fields
    throw new NotImplementedError('batchValidateVat', 'Client.vatStatus/vatValidatedAt/viesData and VatValidationHistory');
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Normalize VAT number by removing spaces, dashes, and country prefix
   */
  private normalizeVatNumber(vatNumber: string, countryCode: string): string {
    // Remove all non-alphanumeric characters except the country prefix
    let normalized = vatNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Remove country code prefix if present
    if (normalized.startsWith(countryCode)) {
      normalized = normalized.slice(countryCode.length);
    }

    return normalized;
  }

  /**
   * Create VIES API client
   */
  private createViesClient(): ViesClient {
    return {
      checkVat: async (countryCode: string, vatNumber: string): Promise<ViesData> => {
        // In production, this would make a SOAP request to the VIES API
        // For now, provide a mock implementation for testing
        if (process.env.NODE_ENV === 'test' || process.env.VIES_MOCK === 'true') {
          // Mock response for testing
          const dateStr = new Date().toISOString().split('T')[0];
          return {
            valid: true,
            countryCode,
            vatNumber,
            requestDate: dateStr ?? new Date().toISOString().slice(0, 10),
            name: 'Test Company Sp. z o.o.',
            address: 'ul. Testowa 1, 00-001 Warszawa',
            traderName: 'Test Company Sp. z o.o.',
            traderCompanyType: 'Spółka z ograniczoną odpowiedzialnością',
            traderAddress: 'ul. Testowa 1, 00-001 Warszawa',
            requestIdentifier: `req-${Date.now()}`,
          };
        }

        // Production VIES SOAP API call
        const soapEnvelope = this.buildViesSoapRequest(countryCode, vatNumber);

        try {
          const response = await fetch(VIES_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/xml; charset=utf-8',
              'SOAPAction': '',
            },
            body: soapEnvelope,
            signal: AbortSignal.timeout(10000), // 10 second timeout
          });

          if (!response.ok) {
            throw new Error(`VIES API error: ${response.status}`);
          }

          const xml = await response.text();
          return this.parseViesSoapResponse(xml, countryCode, vatNumber);
        } catch (error) {
          if (error instanceof Error && error.name === 'TimeoutError') {
            throw new Error('Timeout');
          }
          throw error;
        }
      },
    };
  }

  /**
   * Build VIES SOAP request envelope
   */
  private buildViesSoapRequest(countryCode: string, vatNumber: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
   <soapenv:Header/>
   <soapenv:Body>
      <urn:checkVat>
         <urn:countryCode>${countryCode}</urn:countryCode>
         <urn:vatNumber>${vatNumber}</urn:vatNumber>
      </urn:checkVat>
   </soapenv:Body>
</soapenv:Envelope>`;
  }

  /**
   * Parse VIES SOAP response
   */
  private parseViesSoapResponse(xml: string, countryCode: string, vatNumber: string): ViesData {
    // Extract values from SOAP XML response
    const getXmlValue = (tag: string): string | null => {
      const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
      return match && match[1] !== undefined ? match[1] : null;
    };

    const valid = getXmlValue('valid') === 'true';
    const name = getXmlValue('name');
    const address = getXmlValue('address');
    const dateStr = new Date().toISOString().split('T')[0];
    const requestDate = getXmlValue('requestDate') ?? dateStr ?? new Date().toISOString().slice(0, 10);

    return {
      valid,
      countryCode,
      vatNumber,
      requestDate,
      name,
      address,
      traderName: name,
      traderCompanyType: null,
      traderAddress: address,
    };
  }
}
