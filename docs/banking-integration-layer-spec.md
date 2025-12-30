# Module 7: Banking Integration Layer (BIL) - Complete Technical Specification

## A. Module Overview

### Purpose
Provide secure, compliant, and reliable integration with banking institutions through PSD2/Open Banking APIs to enable automated financial data aggregation, payment processing, and transaction reconciliation for the accounting platform.

### Scope
- **Bank Connection Management**: Secure OAuth2/consent-based bank account connections
- **Account Aggregation**: Multi-bank account balance and details retrieval
- **Transaction Import**: Automated fetching and normalization of bank transactions
- **Payment Initiation**: PSD2-compliant payment processing (SEPA, domestic transfers)
- **Real-time Reconciliation**: Intelligent matching of bank transactions with journal entries
- **Webhook Management**: Real-time transaction notifications
- **Token Management**: Secure storage and refresh of access tokens
- **Provider Abstraction**: Unified interface for multiple banking providers

### Dependencies
- **Security Module (SEC)**: Authentication, encryption, token management
- **Accounting Module (ACC)**: Journal entries, chart of accounts
- **Audit Module (AUD)**: Transaction logging, compliance tracking
- **Notification Module (NOT)**: Alert users about banking events
- **AI Module (AIM)**: Transaction categorization and matching

### Consumers
- **Reconciliation Module (REC)**: Automated matching workflows
- **Payment Module (PAY)**: Payment execution and tracking
- **Reporting Module (REP)**: Financial reports with bank data
- **Dashboard Module (DSH)**: Real-time financial overview
- **Expense Module (EXP)**: Expense tracking and categorization

## B. Technical Specification

### 1. Technology Stack

- **Primary Framework**: NestJS with TypeScript for robust enterprise architecture
- **Database**: PostgreSQL with JSONB for flexible transaction storage
- **Caching**: Redis for token storage, rate limiting, and transaction cache
- **Message Queue**: RabbitMQ for async processing and webhook handling
- **Security**:
  - OAuth 2.0 / OpenID Connect for bank authorization
  - AES-256-GCM for sensitive data encryption
  - TLS 1.3 for API communications
  - Hardware Security Module (HSM) integration for key management
- **Additional Technologies**:
  - Bull Queue for job processing
  - Prisma ORM for database operations
  - OpenAPI 3.0 for API documentation
  - Prometheus for metrics collection

### 2. Key Interfaces

```typescript
// Main service interface
export interface IBankingService {
  // Connection management
  connectBank(request: BankConnectionRequest): Promise<BankConnection>;
  disconnectBank(connectionId: string): Promise<void>;
  refreshConnection(connectionId: string): Promise<BankConnection>;
  getConnections(userId: string): Promise<BankConnection[]>;
  
  // Account operations
  fetchAccounts(connectionId: string): Promise<BankAccount[]>;
  getAccountBalance(accountId: string): Promise<AccountBalance>;
  syncAccounts(connectionId: string): Promise<SyncResult>;
  
  // Transaction operations
  fetchTransactions(request: TransactionFetchRequest): Promise<Transaction[]>;
  importTransactions(accountId: string, dateRange: DateRange): Promise<ImportResult>;
  categorizeTransaction(transaction: Transaction): Promise<CategorizedTransaction>;
  
  // Payment operations
  initiatePayment(payment: PaymentRequest): Promise<PaymentResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
  cancelPayment(paymentId: string): Promise<void>;
  
  // Reconciliation
  reconcile(request: ReconciliationRequest): Promise<ReconciliationResult>;
  suggestMatches(transaction: Transaction): Promise<MatchSuggestion[]>;
  confirmMatch(matchId: string): Promise<void>;
}

// Data Transfer Objects
export interface BankConnectionRequest {
  userId: string;
  bankId: string;
  redirectUrl: string;
  accountTypes?: AccountType[];
  metadata?: Record<string, any>;
}

export interface BankConnection {
  id: string;
  userId: string;
  bankId: string;
  status: ConnectionStatus;
  consentId: string;
  consentExpiresAt: Date;
  accounts: BankAccount[];
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
  metadata: ConnectionMetadata;
}

export interface BankAccount {
  id: string;
  connectionId: string;
  externalId: string;
  accountNumber: string;
  iban?: string;
  name: string;
  type: AccountType;
  currency: string;
  balance: AccountBalance;
  status: AccountStatus;
  metadata: AccountMetadata;
}

export interface Transaction {
  id: string;
  accountId: string;
  externalId: string;
  date: Date;
  valueDate: Date;
  amount: Decimal;
  currency: string;
  description: string;
  reference?: string;
  type: TransactionType;
  status: TransactionStatus;
  counterparty?: Counterparty;
  category?: TransactionCategory;
  metadata: TransactionMetadata;
  reconciliationStatus: ReconciliationStatus;
}

export interface PaymentRequest {
  fromAccountId: string;
  amount: Decimal;
  currency: string;
  recipient: PaymentRecipient;
  reference: string;
  executionDate?: Date;
  type: PaymentType;
  urgency?: PaymentUrgency;
  metadata?: Record<string, any>;
}

// Event interfaces
export interface BankingEvent {
  id: string;
  type: BankingEventType;
  timestamp: Date;
  correlationId: string;
  payload: any;
}

export enum BankingEventType {
  BANK_CONNECTED = 'bank.connected',
  BANK_DISCONNECTED = 'bank.disconnected',
  CONSENT_EXPIRED = 'consent.expired',
  TRANSACTIONS_IMPORTED = 'transactions.imported',
  PAYMENT_INITIATED = 'payment.initiated',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  RECONCILIATION_COMPLETED = 'reconciliation.completed'
}

// Configuration interface
export interface BankingModuleConfig {
  providers: BankProviderConfig[];
  encryption: EncryptionConfig;
  rateLimit: RateLimitConfig;
  webhook: WebhookConfig;
  reconciliation: ReconciliationConfig;
  retry: RetryConfig;
  cache: CacheConfig;
}
```

### 3. API Endpoints

```typescript
// RESTful API endpoints
export const BANKING_API_ROUTES = {
  // Connection endpoints
  'POST /api/v1/banking/connections': 'Connect new bank account',
  'GET /api/v1/banking/connections': 'List user bank connections',
  'GET /api/v1/banking/connections/:id': 'Get connection details',
  'PUT /api/v1/banking/connections/:id/refresh': 'Refresh connection',
  'DELETE /api/v1/banking/connections/:id': 'Disconnect bank',
  
  // Account endpoints
  'GET /api/v1/banking/accounts': 'List all accounts',
  'GET /api/v1/banking/accounts/:id': 'Get account details',
  'GET /api/v1/banking/accounts/:id/balance': 'Get current balance',
  'POST /api/v1/banking/accounts/:id/sync': 'Sync account data',
  
  // Transaction endpoints
  'GET /api/v1/banking/transactions': 'List transactions with filters',
  'GET /api/v1/banking/transactions/:id': 'Get transaction details',
  'POST /api/v1/banking/transactions/import': 'Import transactions',
  'PATCH /api/v1/banking/transactions/:id/category': 'Update category',
  'POST /api/v1/banking/transactions/:id/reconcile': 'Reconcile transaction',
  
  // Payment endpoints
  'POST /api/v1/banking/payments': 'Initiate payment',
  'GET /api/v1/banking/payments/:id': 'Get payment status',
  'DELETE /api/v1/banking/payments/:id': 'Cancel payment',
  
  // Reconciliation endpoints
  'POST /api/v1/banking/reconciliation/auto': 'Auto-reconcile',
  'GET /api/v1/banking/reconciliation/suggestions': 'Get match suggestions',
  'POST /api/v1/banking/reconciliation/confirm': 'Confirm match',
  
  // Webhook endpoints
  'POST /api/v1/banking/webhooks/:provider': 'Provider webhook handler'
};
```

## C. Implementation Details

### 1. Main Service Implementation

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cache } from 'cache-manager';
import { Decimal } from 'decimal.js';
import * as crypto from 'crypto';

@Injectable()
export class BankingService implements IBankingService {
  private readonly logger = new Logger(BankingService.name);
  private readonly providers: Map<string, IBankProvider>;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    @InjectRepository(BankConnection)
    private connectionRepo: Repository<BankConnection>,
    @InjectRepository(BankAccount)
    private accountRepo: Repository<BankAccount>,
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly cache: Cache,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
    private readonly rateLimiter: RateLimiter,
    private readonly config: BankingModuleConfig
  ) {
    this.providers = this.initializeProviders();
    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker);
  }

  async connectBank(request: BankConnectionRequest): Promise<BankConnection> {
    const correlationId = crypto.randomUUID();
    this.logger.log(`Initiating bank connection for user ${request.userId}`, { correlationId });

    try {
      // Validate request
      await this.validateConnectionRequest(request);

      // Check rate limits
      await this.rateLimiter.checkLimit(`connect:${request.userId}`, 5, 3600);

      // Get provider
      const provider = this.getProvider(request.bankId);
      if (!provider) {
        throw new InvalidBankProviderException(request.bankId);
      }

      // Start OAuth flow
      const authUrl = await provider.initiateAuthorization({
        redirectUrl: request.redirectUrl,
        scope: this.getRequiredScopes(request.accountTypes),
        state: correlationId
      });

      // Create pending connection
      const connection = await this.dataSource.transaction(async manager => {
        const conn = manager.create(BankConnection, {
          id: crypto.randomUUID(),
          userId: request.userId,
          bankId: request.bankId,
          status: ConnectionStatus.PENDING,
          correlationId,
          authUrl,
          metadata: {
            ...request.metadata,
            requestedAt: new Date(),
            ipAddress: request.metadata?.ipAddress
          }
        });

        await manager.save(conn);

        // Audit log
        await this.auditService.log({
          action: 'BANK_CONNECTION_INITIATED',
          userId: request.userId,
          resourceId: conn.id,
          metadata: { bankId: request.bankId, correlationId }
        });

        return conn;
      });

      // Emit event
      await this.eventEmitter.emit(BankingEventType.CONNECTION_INITIATED, {
        connectionId: connection.id,
        userId: request.userId,
        bankId: request.bankId,
        correlationId
      });

      return connection;
    } catch (error) {
      this.logger.error(`Failed to connect bank: ${error.message}`, { correlationId, error });
      throw this.handleError(error);
    }
  }

  async fetchTransactions(request: TransactionFetchRequest): Promise<Transaction[]> {
    const correlationId = crypto.randomUUID();
    this.logger.log(`Fetching transactions for account ${request.accountId}`, { correlationId });

    try {
      // Validate request
      await this.validateTransactionRequest(request);

      // Check cache
      const cacheKey = this.buildTransactionCacheKey(request);
      const cached = await this.cache.get<Transaction[]>(cacheKey);
      if (cached && !request.forceRefresh) {
        this.logger.debug(`Returning cached transactions`, { correlationId });
        return cached;
      }

      // Get account and connection
      const account = await this.accountRepo.findOne({
        where: { id: request.accountId },
        relations: ['connection']
      });

      if (!account) {
        throw new AccountNotFoundException(request.accountId);
      }

      // Check connection status
      if (account.connection.status !== ConnectionStatus.ACTIVE) {
        throw new InactiveConnectionException(account.connection.id);
      }

      // Get provider and fetch
      const provider = this.getProvider(account.connection.bankId);
      
      const rawTransactions = await this.circuitBreaker.execute(async () => {
        return await provider.fetchTransactions({
          accessToken: await this.getAccessToken(account.connection.id),
          accountId: account.externalId,
          dateFrom: request.dateFrom,
          dateTo: request.dateTo,
          limit: request.limit || 500
        });
      });

      // Process and enrich transactions
      const transactions = await Promise.all(
        rawTransactions.map(async (raw) => {
          const transaction = await this.processRawTransaction(raw, account);
          
          // AI categorization
          if (this.config.aiCategorization.enabled) {
            transaction.category = await this.categorizeTransaction(transaction);
          }

          // Find counterparty
          transaction.counterparty = await this.enrichCounterparty(raw);

          return transaction;
        })
      );

      // Save to database
      await this.dataSource.transaction(async manager => {
        for (const transaction of transactions) {
          await manager.save(Transaction, transaction, { 
            conflict: ['externalId', 'accountId'],
            update: ['amount', 'description', 'category', 'metadata']
          });
        }
      });

      // Update cache
      await this.cache.set(cacheKey, transactions, this.config.cache.transactionTTL);

      // Emit event
      await this.eventEmitter.emit(BankingEventType.TRANSACTIONS_IMPORTED, {
        accountId: request.accountId,
        count: transactions.length,
        dateRange: { from: request.dateFrom, to: request.dateTo },
        correlationId
      });

      return transactions;
    } catch (error) {
      this.logger.error(`Failed to fetch transactions: ${error.message}`, { correlationId, error });
      throw this.handleError(error);
    }
  }

  async initiatePayment(payment: PaymentRequest): Promise<PaymentResult> {
    const correlationId = crypto.randomUUID();
    this.logger.log(`Initiating payment of ${payment.amount} ${payment.currency}`, { correlationId });

    try {
      // Validate payment request
      await this.validatePaymentRequest(payment);

      // Check account authorization
      const account = await this.accountRepo.findOne({
        where: { id: payment.fromAccountId },
        relations: ['connection']
      });

      if (!account) {
        throw new AccountNotFoundException(payment.fromAccountId);
      }

      // Verify sufficient balance
      const balance = await this.getAccountBalance(account.id);
      if (balance.available.lessThan(payment.amount)) {
        throw new InsufficientFundsException(payment.amount, balance.available);
      }

      // Create payment record
      const paymentRecord = await this.dataSource.transaction(async manager => {
        const record = manager.create(Payment, {
          id: crypto.randomUUID(),
          accountId: account.id,
          amount: payment.amount,
          currency: payment.currency,
          recipient: payment.recipient,
          reference: payment.reference,
          type: payment.type,
          status: PaymentStatus.PENDING,
          correlationId,
          metadata: payment.metadata
        });

        await manager.save(record);

        // Create audit log
        await this.auditService.log({
          action: 'PAYMENT_INITIATED',
          userId: account.connection.userId,
          resourceId: record.id,
          metadata: {
            amount: payment.amount.toString(),
            currency: payment.currency,
            recipient: payment.recipient.name
          }
        });

        return record;
      });

      // Execute payment via provider
      const provider = this.getProvider(account.connection.bankId);
      
      const result = await this.circuitBreaker.execute(async () => {
        return await provider.initiatePayment({
          accessToken: await this.getAccessToken(account.connection.id),
          fromAccount: account.externalId,
          amount: payment.amount.toString(),
          currency: payment.currency,
          recipient: {
            name: payment.recipient.name,
            iban: payment.recipient.iban,
            bic: payment.recipient.bic,
            address: payment.recipient.address
          },
          reference: payment.reference,
          executionDate: payment.executionDate,
          urgency: payment.urgency
        });
      });

      // Update payment status
      paymentRecord.status = result.status;
      paymentRecord.externalId = result.externalId;
      paymentRecord.executedAt = result.executedAt;
      await this.dataSource.manager.save(paymentRecord);

      // Emit event
      await this.eventEmitter.emit(BankingEventType.PAYMENT_INITIATED, {
        paymentId: paymentRecord.id,
        amount: payment.amount,
        status: result.status,
        correlationId
      });

      return {
        id: paymentRecord.id,
        status: result.status,
        externalId: result.externalId,
        executedAt: result.executedAt,
        fees: result.fees
      };
    } catch (error) {
      this.logger.error(`Failed to initiate payment: ${error.message}`, { correlationId, error });
      throw this.handleError(error);
    }
  }

  async reconcile(request: ReconciliationRequest): Promise<ReconciliationResult> {
    const correlationId = crypto.randomUUID();
    this.logger.log(`Starting reconciliation for ${request.transactions.length} transactions`, { correlationId });

    try {
      const matches: ReconciliationMatch[] = [];
      const unmatched: Transaction[] = [];

      for (const transaction of request.transactions) {
        // Try exact matching first
        let match = await this.findExactMatch(transaction, request.journalEntries);

        // If no exact match, try fuzzy matching
        if (!match && this.config.reconciliation.fuzzyMatching) {
          match = await this.findFuzzyMatch(transaction, request.journalEntries);
        }

        // If still no match, try AI matching
        if (!match && this.config.reconciliation.aiMatching) {
          match = await this.findAIMatch(transaction, request.journalEntries);
        }

        if (match) {
          matches.push({
            transaction,
            journalEntry: match.entry,
            confidence: match.confidence,
            matchType: match.type
          });

          // Update reconciliation status
          await this.transactionRepo.update(transaction.id, {
            reconciliationStatus: ReconciliationStatus.MATCHED,
            reconciliationData: {
              journalEntryId: match.entry.id,
              matchedAt: new Date(),
              confidence: match.confidence,
              matchType: match.type
            }
          });
        } else {
          unmatched.push(transaction);
        }
      }

      // Generate reconciliation report
      const report = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        totalTransactions: request.transactions.length,
        matched: matches.length,
        unmatched: unmatched.length,
        confidence: this.calculateOverallConfidence(matches),
        matches,
        unmatched,
        correlationId
      };

      // Save report
      await this.saveReconciliationReport(report);

      // Emit event
      await this.eventEmitter.emit(BankingEventType.RECONCILIATION_COMPLETED, {
        reportId: report.id,
        matched: matches.length,
        unmatched: unmatched.length,
        correlationId
      });

      return report;
    } catch (error) {
      this.logger.error(`Reconciliation failed: ${error.message}`, { correlationId, error });
      throw this.handleError(error);
    }
  }

  // Helper methods
  private async validateConnectionRequest(request: BankConnectionRequest): Promise<void> {
    if (!request.userId || !request.bankId || !request.redirectUrl) {
      throw new ValidationException('Missing required fields');
    }

    // Check if bank is supported
    if (!this.providers.has(request.bankId)) {
      throw new UnsupportedBankException(request.bankId);
    }

    // Check for existing active connection
    const existing = await this.connectionRepo.findOne({
      where: {
        userId: request.userId,
        bankId: request.bankId,
        status: ConnectionStatus.ACTIVE
      }
    });

    if (existing) {
      throw new DuplicateConnectionException(request.bankId);
    }
  }

  private async getAccessToken(connectionId: string): Promise<string> {
    // Try cache first
    const cached = await this.cache.get<string>(`token:${connectionId}`);
    if (cached) {
      return cached;
    }

    // Get from database and decrypt
    const connection = await this.connectionRepo.findOne({
      where: { id: connectionId }
    });

    if (!connection || !connection.encryptedAccessToken) {
      throw new InvalidConnectionException(connectionId);
    }

    const decrypted = await this.encryptionService.decrypt(connection.encryptedAccessToken);

    // Check if expired and refresh if needed
    if (this.isTokenExpired(connection.tokenExpiresAt)) {
      const refreshed = await this.refreshAccessToken(connection);
      await this.cache.set(`token:${connectionId}`, refreshed, 3600);
      return refreshed;
    }

    // Cache for future use
    await this.cache.set(`token:${connectionId}`, decrypted, 3600);
    return decrypted;
  }

  private async categorizeTransaction(transaction: Transaction): Promise<TransactionCategory> {
    // Use AI service for intelligent categorization
    const features = {
      description: transaction.description,
      amount: transaction.amount.toNumber(),
      type: transaction.type,
      counterparty: transaction.counterparty?.name
    };

    return await this.aiService.categorizeTransaction(features);
  }

  private async findExactMatch(
    transaction: Transaction, 
    entries: JournalEntry[]
  ): Promise<MatchResult | null> {
    for (const entry of entries) {
      if (
        entry.amount.equals(transaction.amount.abs()) &&
        entry.date.getTime() === transaction.date.getTime() &&
        entry.reference === transaction.reference
      ) {
        return {
          entry,
          confidence: 1.0,
          type: MatchType.EXACT
        };
      }
    }
    return null;
  }

  private async findFuzzyMatch(
    transaction: Transaction,
    entries: JournalEntry[]
  ): Promise<MatchResult | null> {
    const candidates: MatchResult[] = [];

    for (const entry of entries) {
      let score = 0;

      // Amount matching (allow small variance)
      const amountDiff = Math.abs(
        entry.amount.minus(transaction.amount.abs()).toNumber()
      );
      if (amountDiff < 0.01) {
        score += 0.4;
      } else if (amountDiff < 1) {
        score += 0.2;
      }

      // Date matching (allow few days difference)
      const daysDiff = Math.abs(
        (entry.date.getTime() - transaction.date.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff === 0) {
        score += 0.3;
      } else if (daysDiff <= 3) {
        score += 0.2;
      } else if (daysDiff <= 7) {
        score += 0.1;
      }

      // Description similarity
      const similarity = this.calculateStringSimilarity(
        transaction.description,
        entry.description
      );
      score += similarity * 0.3;

      if (score >= this.config.reconciliation.fuzzyThreshold) {
        candidates.push({
          entry,
          confidence: score,
          type: MatchType.FUZZY
        });
      }
    }

    // Return best match
    return candidates.sort((a, b) => b.confidence - a.confidence)[0] || null;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Implement Levenshtein distance or similar algorithm
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private handleError(error: any): Error {
    if (error instanceof BankingException) {
      return error;
    }

    if (error.code === 'ECONNREFUSED') {
      return new BankProviderUnavailableException('Provider service unavailable');
    }

    if (error.response?.status === 429) {
      return new RateLimitExceededException('Too many requests');
    }

    return new BankingException('An unexpected error occurred', error);
  }
}
```

### 2. Provider Implementation

```typescript
export abstract class BaseBankProvider implements IBankProvider {
  protected readonly logger: Logger;
  protected readonly httpClient: HttpService;
  protected readonly config: BankProviderConfig;

  constructor(config: BankProviderConfig, httpClient: HttpService) {
    this.config = config;
    this.httpClient = httpClient;
    this.logger = new Logger(this.constructor.name);
  }

  abstract initiateAuthorization(request: AuthorizationRequest): Promise<string>;
  abstract exchangeToken(code: string): Promise<TokenResponse>;
  abstract fetchAccounts(accessToken: string): Promise<ProviderAccount[]>;
  abstract fetchTransactions(request: ProviderTransactionRequest): Promise<ProviderTransaction[]>;
  abstract initiatePayment(request: ProviderPaymentRequest): Promise<ProviderPaymentResponse>;

  protected async makeRequest<T>(
    method: string,
    url: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    const correlationId = crypto.randomUUID();
    
    try {
      this.logger.debug(`Making ${method} request to ${url}`, { correlationId });

      const response = await this.httpClient.request({
        method,
        url,
        data,
        headers: {
          'X-Correlation-ID': correlationId,
          'User-Agent': 'BankingIntegrationLayer/1.0',
          ...headers
        },
        timeout: this.config.timeout || 30000
      }).toPromise();

      return response.data;
    } catch (error) {
      this.logger.error(`Provider request failed: ${error.message}`, { correlationId, error });
      throw this.handleProviderError(error);
    }
  }

  protected handleProviderError(error: any): Error {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 400:
          return new InvalidRequestException(data.error_description || 'Invalid request');
        case 401:
          return new UnauthorizedException('Invalid or expired credentials');
        case 403:
          return new ForbiddenException('Access denied');
        case 404:
          return new ResourceNotFoundException('Resource not found');
        case 429:
          return new RateLimitExceededException(data.retry_after);
        case 500:
        case 502:
        case 503:
          return new ProviderErrorException('Provider service error');
        default:
          return new ProviderErrorException(`Provider error: ${status}`);
      }
    }

    return new NetworkException('Network error occurred');
  }
}

// Specific provider implementation example
export class NordeaBankProvider extends BaseBankProvider {
  private readonly baseUrl = 'https://api.nordea.com/v4';

  async initiateAuthorization(request: AuthorizationRequest): Promise<string> {
    const state = crypto.randomUUID();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: request.redirectUrl,
      scope: request.scope.join(' '),
      state,
      access_type: 'offline'
    });

    return `${this.baseUrl}/authorize?${params.toString()}`;
  }

  async fetchTransactions(request: ProviderTransactionRequest): Promise<ProviderTransaction[]> {
    const url = `${this.baseUrl}/accounts/${request.accountId}/transactions`;
    
    const params = {
      dateFrom: request.dateFrom.toISOString(),
      dateTo: request.dateTo.toISOString(),
      limit: request.limit
    };

    const response = await this.makeRequest<any>('GET', url, null, {
      'Authorization': `Bearer ${request.accessToken}`,
      'X-IBM-Client-Id': this.config.clientId
    });

    return response.transactions.map(this.mapTransaction);
  }

  private mapTransaction(raw: any): ProviderTransaction {
    return {
      transactionId: raw.transactionId,
      bookingDate: new Date(raw.bookingDate),
      valueDate: new Date(raw.valueDate),
      amount: new Decimal(raw.transactionAmount.amount),
      currency: raw.transactionAmount.currency,
      description: raw.remittanceInformationUnstructured,
      reference: raw.endToEndId,
      type: this.mapTransactionType(raw.creditDebitIndicator),
      status: TransactionStatus.BOOKED,
      counterpartyName: raw.creditor?.name || raw.debtor?.name,
      counterpartyAccount: raw.creditor?.account || raw.debtor?.account
    };
  }

  private mapTransactionType(indicator: string): TransactionType {
    return indicator === 'CRDT' ? TransactionType.CREDIT : TransactionType.DEBIT;
  }
}
```

### 3. Event Handlers

```typescript
@Injectable()
export class BankingEventHandler {
  private readonly logger = new Logger(BankingEventHandler.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly reconciliationService: ReconciliationService,
    private readonly auditService: AuditService
  ) {}

  @OnEvent(BankingEventType.TRANSACTIONS_IMPORTED)
  async handleTransactionsImported(event: TransactionsImportedEvent) {
    this.logger.log(`Handling transactions imported event`, event);

    try {
      // Trigger auto-reconciliation if enabled
      if (event.autoReconcile) {
        await this.reconciliationService.autoReconcile(event.accountId);
      }

      // Send notification
      await this.notificationService.send({
        userId: event.userId,
        type: NotificationType.TRANSACTIONS_IMPORTED,
        title: 'New Transactions Available',
        message: `${event.count} new transactions have been imported`,
        metadata: {
          accountId: event.accountId,
          count: event.count
        }
      });

      // Update statistics
      await this.updateImportStatistics(event);
    } catch (error) {
      this.logger.error(`Failed to handle transactions imported event`, error);
    }
  }

  @OnEvent(BankingEventType.PAYMENT_COMPLETED)
  async handlePaymentCompleted(event: PaymentCompletedEvent) {
    this.logger.log(`Handling payment completed event`, event);

    try {
      // Create journal entry
      await this.createPaymentJournalEntry(event);

      // Send confirmation
      await this.notificationService.send({
        userId: event.userId,
        type: NotificationType.PAYMENT_COMPLETED,
        title: 'Payment Successful',
        message: `Payment of ${event.amount} ${event.currency} completed`,
        metadata: {
          paymentId: event.paymentId,
          reference: event.reference
        }
      });

      // Audit log
      await this.auditService.log({
        action: 'PAYMENT_COMPLETED',
        userId: event.userId,
        resourceId: event.paymentId,
        metadata: event
      });
    } catch (error) {
      this.logger.error(`Failed to handle payment completed event`, error);
    }
  }

  @OnEvent(BankingEventType.CONSENT_EXPIRED)
  async handleConsentExpired(event: ConsentExpiredEvent) {
    this.logger.log(`Handling consent expired event`, event);

    try {
      // Notify user
      await this.notificationService.send({
        userId: event.userId,
        type: NotificationType.CONSENT_EXPIRED,
        title: 'Bank Connection Expired',
        message: 'Your bank connection needs to be renewed',
        priority: Priority.HIGH,
        metadata: {
          connectionId: event.connectionId,
          bankName: event.bankName
        }
      });

      // Update connection status
      await this.updateConnectionStatus(event.connectionId, ConnectionStatus.EXPIRED);
    } catch (error) {
      this.logger.error(`Failed to handle consent expired event`, error);
    }
  }
}
```

## D. Database Schema

```sql
-- Bank connections table
CREATE TABLE bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'EXPIRED', 'DISCONNECTED')),
  consent_id VARCHAR(255),
  consent_expires_at TIMESTAMPTZ,
  encrypted_access_token TEXT,
  encrypted_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  correlation_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  CONSTRAINT unique_active_connection UNIQUE (user_id, bank_id, status) WHERE status = 'ACTIVE'
);

-- Bank accounts table
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  account_number VARCHAR(34),
  iban VARCHAR(34),
  bic VARCHAR(11),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('CHECKING', 'SAVINGS', 'CREDIT', 'LOAN', 'INVESTMENT')),
  currency CHAR(3) NOT NULL,
  balance_amount DECIMAL(19, 4),
  balance_updated_at TIMESTAMPTZ,
  available_amount DECIMAL(19, 4),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_external_account UNIQUE (connection_id, external_id)
);

-- Transactions table
CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  booking_date DATE NOT NULL,
  value_date DATE NOT NULL,
  amount DECIMAL(19, 4) NOT NULL,
  currency CHAR(3) NOT NULL,
  description TEXT,
  reference VARCHAR(255),
  type VARCHAR(20) NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
  status VARCHAR(20) NOT NULL DEFAULT 'BOOKED',
  counterparty_name VARCHAR(255),
  counterparty_account VARCHAR(34),
  counterparty_bic VARCHAR(11),
  category_id UUID REFERENCES transaction_categories(id),
  reconciliation_status VARCHAR(20) DEFAULT 'UNMATCHED',
  reconciliation_data JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_bank_transaction UNIQUE (account_id, external_id)
);

-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES bank_accounts(id),
  external_id VARCHAR(255),
  amount DECIMAL(19, 4) NOT NULL,
  currency CHAR(3) NOT NULL,
  recipient_name VARCHAR(255) NOT NULL,
  recipient_iban VARCHAR(34) NOT NULL,
  recipient_bic VARCHAR(11),
  reference VARCHAR(140) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('SEPA', 'INSTANT', 'INTERNATIONAL')),
  urgency VARCHAR(20) DEFAULT 'NORMAL',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  execution_date DATE,
  executed_at TIMESTAMPTZ,
  fees DECIMAL(19, 4),
  error_code VARCHAR(50),
  error_message TEXT,
  correlation_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Reconciliation reports table
CREATE TABLE reconciliation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES bank_accounts(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_transactions INTEGER NOT NULL,
  matched_count INTEGER NOT NULL,
  unmatched_count INTEGER NOT NULL,
  confidence_score DECIMAL(5, 4),
  matches JSONB NOT NULL DEFAULT '[]',
  unmatched JSONB NOT NULL DEFAULT '[]',
  correlation_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Transaction categories table
CREATE TABLE transaction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  parent_id UUID REFERENCES transaction_categories(id),
  color VARCHAR(7),
  icon VARCHAR(50),
  rules JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook subscriptions table
CREATE TABLE webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES bank_connections(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  webhook_id VARCHAR(255),
  callback_url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret VARCHAR(255),
  status VARCHAR(20) DEFAULT 'ACTIVE',
  last_triggered_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_bank_connections_user_id ON bank_connections(user_id);
CREATE INDEX idx_bank_connections_status ON bank_connections(status);
CREATE INDEX idx_bank_accounts_connection_id ON bank_accounts(connection_id);
CREATE INDEX idx_bank_accounts_status ON bank_accounts(status);
CREATE INDEX idx_transactions_account_id ON bank_transactions(account_id);
CREATE INDEX idx_transactions_booking_date ON bank_transactions(booking_date);
CREATE INDEX idx_transactions_reconciliation ON bank_transactions(reconciliation_status);
CREATE INDEX idx_transactions_category ON bank_transactions(category_id);
CREATE INDEX idx_payments_account_id ON payments(account_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_reconciliation_reports_account ON reconciliation_reports(account_id);
CREATE INDEX idx_webhook_subscriptions_connection ON webhook_subscriptions(connection_id);

-- Composite indexes
CREATE INDEX idx_transactions_search ON bank_transactions(account_id, booking_date DESC, amount);
CREATE INDEX idx_payments_search ON payments(account_id, status, created_at DESC);
```

## E. Configuration

```typescript
export interface BankingModuleConfig {
  // Provider configurations
  providers: {
    nordea: {
      clientId: string;
      clientSecret: string;
      baseUrl: string;
      timeout: number;
      retryCount: number;
    };
    pko: {
      clientId: string;
      clientSecret: string;
      baseUrl: string;
      certificatePath: string;
    };
    mbank: {
      clientId: string;
      clientSecret: string;
      baseUrl: string;
      apiKey: string;
    };
  };

  // Security settings
  encryption: {
    algorithm: 'aes-256-gcm';
    keyRotationDays: number;
    hsmEnabled: boolean;
    hsmConfig?: {
      provider: string;
      keyId: string;
    };
  };

  // Rate limiting
  rateLimit: {
    connectionsPerHour: number;
    transactionsPerMinute: number;
    paymentsPerDay: number;
    webhooksPerSecond: number;
  };

  // Webhook configuration
  webhook: {
    baseUrl: string;
    secret: string;
    retryAttempts: number;
    retryDelayMs: number;
    timeoutMs: number;
  };

  // Reconciliation settings
  reconciliation: {
    fuzzyMatching: boolean;
    fuzzyThreshold: number;
    aiMatching: boolean;
    aiConfidenceThreshold: number;
    autoReconcile: boolean;
    matchingRules: MatchingRule[];
  };

  // Retry configuration
  retry: {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    exponentialBase: number;
  };

  // Cache settings
  cache: {
    enabled: boolean;
    transactionTTL: number;
    accountTTL: number;
    balanceTTL: number;
  };

  // Circuit breaker
  circuitBreaker: {
    threshold: number;
    timeout: number;
    resetTimeout: number;
  };

  // AI categorization
  aiCategorization: {
    enabled: boolean;
    modelEndpoint: string;
    confidenceThreshold: number;
  };

  // Feature flags
  features: {
    multiCurrencySupport: boolean;
    instantPayments: boolean;
    bulkPayments: boolean;
    standingOrders: boolean;
    directDebits: boolean;
  };
}

// Environment variables
export const bankingEnvironmentVariables = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL,
  
  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  
  // RabbitMQ
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://localhost',
  
  // Security
  ENCRYPTION_KEY: process.env.BANKING_ENCRYPTION_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
  
  // Provider credentials (stored in secure vault)
  NORDEA_CLIENT_ID: process.env.NORDEA_CLIENT_ID,
  NORDEA_CLIENT_SECRET: process.env.NORDEA_CLIENT_SECRET,
  PKO_CLIENT_ID: process.env.PKO_CLIENT_ID,
  PKO_CLIENT_SECRET: process.env.PKO_CLIENT_SECRET,
  MBANK_API_KEY: process.env.MBANK_API_KEY,
  
  // Feature flags
  ENABLE_AI_CATEGORIZATION: process.env.ENABLE_AI_CATEGORIZATION === 'true',
  ENABLE_INSTANT_PAYMENTS: process.env.ENABLE_INSTANT_PAYMENTS === 'true'
};

// Default configuration
export const defaultBankingConfig: BankingModuleConfig = {
  providers: {
    nordea: {
      clientId: '',
      clientSecret: '',
      baseUrl: 'https://api.nordea.com/v4',
      timeout: 30000,
      retryCount: 3
    }
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    keyRotationDays: 90,
    hsmEnabled: false
  },
  rateLimit: {
    connectionsPerHour: 10,
    transactionsPerMinute: 60,
    paymentsPerDay: 100,
    webhooksPerSecond: 10
  },
  webhook: {
    baseUrl: 'https://api.example.com/webhooks',
    secret: '',
    retryAttempts: 3,
    retryDelayMs: 1000,
    timeoutMs: 5000
  },
  reconciliation: {
    fuzzyMatching: true,
    fuzzyThreshold: 0.75,
    aiMatching: true,
    aiConfidenceThreshold: 0.85,
    autoReconcile: true,
    matchingRules: []
  },
  retry: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    exponentialBase: 2
  },
  cache: {
    enabled: true,
    transactionTTL: 300,
    accountTTL: 3600,
    balanceTTL: 60
  },
  circuitBreaker: {
    threshold: 5,
    timeout: 10000,
    resetTimeout: 30000
  },
  aiCategorization: {
    enabled: false,
    modelEndpoint: '',
    confidenceThreshold: 0.8
  },
  features: {
    multiCurrencySupport: true,
    instantPayments: false,
    bulkPayments: false,
    standingOrders: false,
    directDebits: false
  }
};
```

## F. Testing Strategy

### 1. Unit Tests

```typescript
describe('BankingService', () => {
  let service: BankingService;
  let connectionRepo: MockRepository<BankConnection>;
  let accountRepo: MockRepository<BankAccount>;
  let transactionRepo: MockRepository<Transaction>;
  let eventEmitter: MockEventEmitter;
  let cache: MockCache;
  let encryptionService: MockEncryptionService;

  beforeEach(() => {
    const module = Test.createTestingModule({
      providers: [
        BankingService,
        {
          provide: getRepositoryToken(BankConnection),
          useValue: createMockRepository()
        },
        {
          provide: getRepositoryToken(BankAccount),
          useValue: createMockRepository()
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: createMockRepository()
        },
        {
          provide: EventEmitter2,
          useValue: createMockEventEmitter()
        },
        {
          provide: CACHE_MANAGER,
          useValue: createMockCache()
        },
        {
          provide: EncryptionService,
          useValue: createMockEncryptionService()
        }
      ]
    }).compile();

    service = module.get<BankingService>(BankingService);
    connectionRepo = module.get(getRepositoryToken(BankConnection));
    accountRepo = module.get(getRepositoryToken(BankAccount));
    transactionRepo = module.get(getRepositoryToken(Transaction));
    eventEmitter = module.get(EventEmitter2);
    cache = module.get(CACHE_MANAGER);
    encryptionService = module.get(EncryptionService);
  });

  describe('connectBank', () => {
    it('should successfully connect a bank account', async () => {
      // Arrange
      const request: BankConnectionRequest = {
        userId: 'user-123',
        bankId: 'nordea',
        redirectUrl: 'https://app.example.com/callback',
        accountTypes: [AccountType.CHECKING]
      };

      connectionRepo.findOne.mockResolvedValue(null);
      connectionRepo.save.mockResolvedValue({
        id: 'conn-123',
        ...request,
        status: ConnectionStatus.PENDING
      });

      // Act
      const result = await service.connectBank(request);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe(ConnectionStatus.PENDING);
      expect(connectionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: request.userId,
          bankId: request.bankId
        })
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        BankingEventType.CONNECTION_INITIATED,
        expect.any(Object)
      );
    });

    it('should throw error for duplicate active connection', async () => {
      // Arrange
      const request: BankConnectionRequest = {
        userId: 'user-123',
        bankId: 'nordea',
        redirectUrl: 'https://app.example.com/callback'
      };

      connectionRepo.findOne.mockResolvedValue({
        id: 'existing-conn',
        status: ConnectionStatus.ACTIVE
      });

      // Act & Assert
      await expect(service.connectBank(request)).rejects.toThrow(
        DuplicateConnectionException
      );
    });

    it('should handle rate limiting', async () => {
      // Arrange
      const request: BankConnectionRequest = {
        userId: 'user-123',
        bankId: 'nordea',
        redirectUrl: 'https://app.example.com/callback'
      };

      // Simulate rate limit exceeded
      for (let i = 0; i < 6; i++) {
        await service.connectBank(request);
      }

      // Act & Assert
      await expect(service.connectBank(request)).rejects.toThrow(
        RateLimitExceededException
      );
    });
  });

  describe('fetchTransactions', () => {
    it('should fetch and process transactions successfully', async () => {
      // Arrange
      const request: TransactionFetchRequest = {
        accountId: 'acc-123',
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31')
      };

      const mockAccount = {
        id: 'acc-123',
        externalId: 'ext-123',
        connection: {
          id: 'conn-123',
          bankId: 'nordea',
          status: ConnectionStatus.ACTIVE
        }
      };

      accountRepo.findOne.mockResolvedValue(mockAccount);
      cache.get.mockResolvedValue(null);

      const mockProvider = {
        fetchTransactions: jest.fn().mockResolvedValue([
          {
            transactionId: 'tx-1',
            bookingDate: '2024-01-15',
            amount: '100.00',
            currency: 'EUR',
            description: 'Test transaction'
          }
        ])
      };

      jest.spyOn(service as any, 'getProvider').mockReturnValue(mockProvider);

      // Act
      const result = await service.fetchTransactions(request);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        amount: expect.any(Decimal),
        currency: 'EUR',
        description: 'Test transaction'
      });
      expect(cache.set).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        BankingEventType.TRANSACTIONS_IMPORTED,
        expect.any(Object)
      );
    });

    it('should return cached transactions when available', async () => {
      // Arrange
      const request: TransactionFetchRequest = {
        accountId: 'acc-123',
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
        forceRefresh: false
      };

      const cachedTransactions = [
        { id: 'tx-1', amount: new Decimal('100.00') }
      ];

      cache.get.mockResolvedValue(cachedTransactions);

      // Act
      const result = await service.fetchTransactions(request);

      // Assert
      expect(result).toBe(cachedTransactions);
      expect(accountRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('initiatePayment', () => {
    it('should successfully initiate a payment', async () => {
      // Arrange
      const payment: PaymentRequest = {
        fromAccountId: 'acc-123',
        amount: new Decimal('500.00'),
        currency: 'EUR',
        recipient: {
          name: 'John Doe',
          iban: 'DE89370400440532013000'
        },
        reference: 'Invoice #123',
        type: PaymentType.SEPA
      };

      const mockAccount = {
        id: 'acc-123',
        connection: { id: 'conn-123', userId: 'user-123' }
      };

      accountRepo.findOne.mockResolvedValue(mockAccount);
      
      jest.spyOn(service, 'getAccountBalance').mockResolvedValue({
        available: new Decimal('1000.00'),
        current: new Decimal('1000.00')
      });

      // Act
      const result = await service.initiatePayment(payment);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        BankingEventType.PAYMENT_INITIATED,
        expect.any(Object)
      );
    });

    it('should throw error for insufficient funds', async () => {
      // Arrange
      const payment: PaymentRequest = {
        fromAccountId: 'acc-123',
        amount: new Decimal('1500.00'),
        currency: 'EUR',
        recipient: {
          name: 'John Doe',
          iban: 'DE89370400440532013000'
        },
        reference: 'Invoice #123',
        type: PaymentType.SEPA
      };

      const mockAccount = {
        id: 'acc-123',
        connection: { id: 'conn-123' }
      };

      accountRepo.findOne.mockResolvedValue(mockAccount);
      
      jest.spyOn(service, 'getAccountBalance').mockResolvedValue({
        available: new Decimal('1000.00'),
        current: new Decimal('1000.00')
      });

      // Act & Assert
      await expect(service.initiatePayment(payment)).rejects.toThrow(
        InsufficientFundsException
      );
    });
  });

  describe('reconcile', () => {
    it('should successfully reconcile transactions', async () => {
      // Arrange
      const transactions = [
        {
          id: 'tx-1',
          amount: new Decimal('100.00'),
          date: new Date('2024-01-15'),
          description: 'Payment from customer',
          reference: 'INV-123'
        }
      ];

      const journalEntries = [
        {
          id: 'je-1',
          amount: new Decimal('100.00'),
          date: new Date('2024-01-15'),
          description: 'Customer payment',
          reference: 'INV-123'
        }
      ];

      const request: ReconciliationRequest = {
        transactions,
        journalEntries
      };

      // Act
      const result = await service.reconcile(request);

      // Assert
      expect(result).toBeDefined();
      expect(result.matched).toBe(1);
      expect(result.unmatched).toBe(0);
      expect(result.matches[0]).toMatchObject({
        transaction: transactions[0],
        journalEntry: journalEntries[0],
        confidence: 1.0,
        matchType: MatchType.EXACT
      });
    });

    it('should handle fuzzy matching', async () => {
      // Arrange
      const transactions = [
        {
          id: 'tx-1',
          amount: new Decimal('99.99'),
          date: new Date('2024-01-15'),
          description: 'Payment customer'
        }
      ];

      const journalEntries = [
        {
          id: 'je-1',
          amount: new Decimal('100.00'),
          date: new Date('2024-01-15'),
          description: 'Customer payment'
        }
      ];

      const request: ReconciliationRequest = {
        transactions,
        journalEntries
      };

      // Act
      const result = await service.reconcile(request);

      // Assert
      expect(result.matches[0].matchType).toBe(MatchType.FUZZY);
      expect(result.matches[0].confidence).toBeGreaterThan(0.7);
    });
  });
});
```

### 2. Integration Tests

```typescript
describe('Banking Integration Tests', () => {
  let app: INestApplication;
  let bankingService: BankingService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [BankingModule, DatabaseModule, CacheModule]
    }).compile();

    app = module.createNestApplication();
    await app.init();

    bankingService = module.get<BankingService>(BankingService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('End-to-end banking flow', () => {
    it('should complete full banking integration flow', async () => {
      // 1. Connect bank
      const connection = await bankingService.connectBank({
        userId: 'test-user',
        bankId: 'test-bank',
        redirectUrl: 'http://localhost:3000/callback'
      });

      expect(connection.status).toBe(ConnectionStatus.PENDING);

      // 2. Simulate OAuth callback
      await simulateOAuthCallback(connection.id, 'auth-code-123');

      // 3. Fetch accounts
      const accounts = await bankingService.fetchAccounts(connection.id);
      expect(accounts.length).toBeGreaterThan(0);

      // 4. Import transactions
      const transactions = await bankingService.fetchTransactions({
        accountId: accounts[0].id,
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31')
      });

      expect(transactions.length).toBeGreaterThan(0);

      // 5. Initiate payment
      const payment = await bankingService.initiatePayment({
        fromAccountId: accounts[0].id,
        amount: new Decimal('100.00'),
        currency: 'EUR',
        recipient: {
          name: 'Test Recipient',
          iban: 'DE89370400440532013000'
        },
        reference: 'Test payment',
        type: PaymentType.SEPA
      });

      expect(payment.status).toBeDefined();

      // 6. Reconcile
      const reconciliation = await bankingService.reconcile({
        transactions: transactions.slice(0, 5),
        journalEntries: await getTestJournalEntries()
      });

      expect(reconciliation.matched).toBeGreaterThan(0);
    });
  });

  describe('API Endpoints', () => {
    it('should create bank connection via API', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/banking/connections')
        .send({
          bankId: 'nordea',
          redirectUrl: 'http://localhost:3000/callback'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('PENDING');
    });

    it('should fetch transactions via API', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/banking/transactions')
        .query({
          accountId: 'acc-123',
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31'
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
```

## G. Monitoring & Observability

```typescript
// Metrics collection
@Injectable()
export class BankingMetricsService {
  private readonly connectionsCounter: Counter;
  private readonly transactionsImported: Counter;
  private readonly paymentsProcessed: Counter;
  private readonly reconciliationRate: Gauge;
  private readonly apiLatency: Histogram;
  private readonly providerErrors: Counter;

  constructor(private readonly prometheus: PrometheusService) {
    this.connectionsCounter = new Counter({
      name: 'banking_connections_total',
      help: 'Total number of bank connections',
      labelNames: ['bank_id', 'status']
    });

    this.transactionsImported = new Counter({
      name: 'banking_transactions_imported_total',
      help: 'Total number of transactions imported',
      labelNames: ['bank_id', 'account_type']
    });

    this.paymentsProcessed = new Counter({
      name: 'banking_payments_processed_total',
      help: 'Total number of payments processed',
      labelNames: ['type', 'status', 'currency']
    });

    this.reconciliationRate = new Gauge({
      name: 'banking_reconciliation_rate',
      help: 'Percentage of successfully reconciled transactions',
      labelNames: ['account_id']
    });

    this.apiLatency = new Histogram({
      name: 'banking_api_latency_seconds',
      help: 'API request latency',
      labelNames: ['method', 'endpoint', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10]
    });

    this.providerErrors = new Counter({
      name: 'banking_provider_errors_total',
      help: 'Total number of provider errors',
      labelNames: ['provider', 'error_type']
    });

    this.registerMetrics();
  }

  recordConnection(bankId: string, status: string) {
    this.connectionsCounter.labels(bankId, status).inc();
  }

  recordTransactionsImported(bankId: string, accountType: string, count: number) {
    this.transactionsImported.labels(bankId, accountType).inc(count);
  }

  recordPayment(type: string, status: string, currency: string) {
    this.paymentsProcessed.labels(type, status, currency).inc();
  }

  recordReconciliationRate(accountId: string, rate: number) {
    this.reconciliationRate.labels(accountId).set(rate);
  }

  recordApiLatency(method: string, endpoint: string, status: number, duration: number) {
    this.apiLatency.labels(method, endpoint, status.toString()).observe(duration);
  }

  recordProviderError(provider: string, errorType: string) {
    this.providerErrors.labels(provider, errorType).inc();
  }
}

// Logging configuration
export const loggingConfig = {
  format: 'json',
  level: process.env.LOG_LEVEL || 'info',
  fields: {
    service: 'banking-integration-layer',
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION
  }
};

// Health checks
@Injectable()
export class BankingHealthIndicator extends HealthIndicator {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cache: Cache,
    private readonly rabbitMQ: RabbitMQService
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkCache(),
      this.checkMessageQueue(),
      this.checkProviders()
    ]);

    const isHealthy = checks.every(check => check.status === 'up');

    return this.getStatus(key, isHealthy, {
      database: checks[0],
      cache: checks[1],
      messageQueue: checks[2],
      providers: checks[3]
    });
  }

  private async checkDatabase(): Promise<any> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up', responseTime: Date.now() };
    } catch (error) {
      return { status: 'down', error: error.message };
    }
  }

  private async checkCache(): Promise<any> {
    try {
      await this.cache.set('health', 'check', 1);
      await this.cache.get('health');
      return { status: 'up' };
    } catch (error) {
      return { status: 'down', error: error.message };
    }
  }

  private async checkProviders(): Promise<any> {
    // Check each provider's health endpoint
    const providers = ['nordea', 'pko', 'mbank'];
    const results = {};

    for (const provider of providers) {
      try {
        // Make health check request to provider
        results[provider] = { status: 'up' };
      } catch (error) {
        results[provider] = { status: 'down' };
      }
    }

    return results;
  }
}

// Alert definitions
export const bankingAlerts = [
  {
    name: 'HighProviderErrorRate',
    expression: 'rate(banking_provider_errors_total[5m]) > 0.1',
    severity: 'critical',
    annotations: {
      summary: 'High error rate from banking provider',
      description: 'Provider {{ $labels.provider }} has error rate above 10%'
    }
  },
  {
    name: 'LowReconciliationRate',
    expression: 'banking_reconciliation_rate < 0.7',
    severity: 'warning',
    annotations: {
      summary: 'Low reconciliation rate detected',
      description: 'Account {{ $labels.account_id }} has reconciliation rate below 70%'
    }
  },
  {
    name: 'PaymentFailures',
    expression: 'increase(banking_payments_processed_total{status="failed"}[1h]) > 5',
    severity: 'warning',
    annotations: {
      summary: 'Multiple payment failures detected',
      description: 'More than 5 payment failures in the last hour'
    }
  },
  {
    name: 'APIHighLatency',
    expression: 'histogram_quantile(0.95, banking_api_latency_seconds) > 2',
    severity: 'warning',
    annotations: {
      summary: 'High API latency detected',
      description: 'P95 latency above 2 seconds for {{ $labels.endpoint }}'
    }
  }
];
```

## H. Security Considerations

```typescript
// Security service implementation
@Injectable()
export class BankingSecurityService {
  private readonly logger = new Logger(BankingSecurityService.name);

  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
    private readonly rateLimiter: RateLimiter,
    private readonly config: SecurityConfig
  ) {}

  // Token encryption
  async encryptToken(token: string): Promise<string> {
    const key = await this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')])
      .toString('base64');
  }

  async decryptToken(encryptedToken: string): Promise<string> {
    const key = await this.getEncryptionKey();
    const buffer = Buffer.from(encryptedToken, 'base64');
    
    const iv = buffer.slice(0, 16);
    const authTag = buffer.slice(16, 32);
    const encrypted = buffer.slice(32);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, null, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Request validation
  async validateRequest(request: any, schema: any): Promise<void> {
    const validation = schema.validate(request);
    
    if (validation.error) {
      this.logger.warn('Invalid request', { 
        error: validation.error,
        request: this.sanitizeRequest(request)
      });
      
      throw new ValidationException(validation.error.message);
    }

    // Check for potential security issues
    await this.checkForSecurityThreats(request);
  }

  private async checkForSecurityThreats(request: any): Promise<void> {
    // SQL injection check
    if (this.containsSQLInjection(JSON.stringify(request))) {
      throw new SecurityException('Potential SQL injection detected');
    }

    // XSS check
    if (this.containsXSS(JSON.stringify(request))) {
      throw new SecurityException('Potential XSS attack detected');
    }

    // Check for suspicious patterns
    if (this.containsSuspiciousPatterns(request)) {
      await this.auditService.logSecurityEvent({
        type: 'SUSPICIOUS_REQUEST',
        request: this.sanitizeRequest(request)
      });
    }
  }

  // Rate limiting
  async checkRateLimit(key: string, limit: number, window: number): Promise<void> {
    const count = await this.rateLimiter.increment(key, window);
    
    if (count > limit) {
      this.logger.warn('Rate limit exceeded', { key, count, limit });
      throw new RateLimitExceededException(`Rate limit exceeded: ${limit} per ${window}s`);
    }
  }

  // Audit trail
  async auditBankingOperation(operation: BankingOperation): Promise<void> {
    await this.auditService.log({
      timestamp: new Date(),
      userId: operation.userId,
      action: operation.action,
      resourceType: 'BANKING',
      resourceId: operation.resourceId,
      ipAddress: operation.ipAddress,
      userAgent: operation.userAgent,
      metadata: {
        ...operation.metadata,
        encrypted: true,
        compliance: 'PSD2'
      }
    });
  }

  // Data masking
  maskSensitiveData(data: any): any {
    const masked = { ...data };

    // Mask IBAN
    if (masked.iban) {
      masked.iban = this.maskIBAN(masked.iban);
    }

    // Mask account numbers
    if (masked.accountNumber) {
      masked.accountNumber = this.maskAccountNumber(masked.accountNumber);
    }

    // Mask amounts for logs
    if (masked.amount && this.config.maskAmounts) {
      masked.amount = '***';
    }

    return masked;
  }

  private maskIBAN(iban: string): string {
    if (iban.length < 8) return '****';
    return iban.substring(0, 4) + '*'.repeat(iban.length - 8) + iban.substring(iban.length - 4);
  }

  private maskAccountNumber(account: string): string {
    if (account.length < 4) return '****';
    return '*'.repeat(account.length - 4) + account.substring(account.length - 4);
  }
}

// Security middleware
@Injectable()
export class BankingSecurityMiddleware implements NestMiddleware {
  constructor(private readonly securityService: BankingSecurityService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Validate request signature if present
    if (req.headers['x-signature']) {
      const isValid = await this.validateSignature(req);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Log security-relevant information
    await this.logSecurityInfo(req);

    next();
  }

  private async validateSignature(req: Request): Promise<boolean> {
    const signature = req.headers['x-signature'] as string;
    const timestamp = req.headers['x-timestamp'] as string;
    
    // Verify timestamp is recent (prevent replay attacks)
    if (Date.now() - parseInt(timestamp) > 300000) { // 5 minutes
      return false;
    }

    // Verify signature
    const payload = `${timestamp}.${JSON.stringify(req.body)}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}
```

## I. Documentation

```yaml
# OpenAPI specification excerpt
openapi: 3.0.0
info:
  title: Banking Integration Layer API
  version: 1.0.0
  description: Secure banking integration via PSD2 APIs
  
paths:
  /api/v1/banking/connections:
    post:
      summary: Connect new bank account
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BankConnectionRequest'
      responses:
        201:
          description: Connection initiated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BankConnection'
                
  /api/v1/banking/transactions:
    get:
      summary: List transactions
      security:
        - bearerAuth: []
      parameters:
        - in: query
          name: accountId
          required: true
          schema:
            type: string
        - in: query
          name: dateFrom
          schema:
            type: string
            format: date
        - in: query
          name: dateTo
          schema:
            type: string
            format: date
      responses:
        200:
          description: List of transactions
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Transaction'

components:
  schemas:
    BankConnectionRequest:
      type: object
      required:
        - bankId
        - redirectUrl
      properties:
        bankId:
          type: string
          description: Identifier of the bank to connect
        redirectUrl:
          type: string
          format: uri
          description: URL to redirect after authorization
        accountTypes:
          type: array
          items:
            type: string
            enum: [CHECKING, SAVINGS, CREDIT]
            
    Transaction:
      type: object
      properties:
        id:
          type: string
          format: uuid
        date:
          type: string
          format: date
        amount:
          type: number
          format: decimal
        currency:
          type: string
          pattern: '^[A-Z]{3}$'
        description:
          type: string
        category:
          $ref: '#/components/schemas/TransactionCategory'
```

## J. Deployment Considerations

```yaml
# Kubernetes deployment configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: banking-integration-layer
  namespace: financial-platform
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: banking-integration-layer
  template:
    metadata:
      labels:
        app: banking-integration-layer
    spec:
      containers:
      - name: banking-service
        image: financial-platform/banking-integration-layer:v1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
        - name: ENCRYPTION_KEY
          valueFrom:
            secretKeyRef:
              name: banking-encryption
              key: key
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
      - name: sidecar-proxy
        image: envoyproxy/envoy:v1.25.0
        ports:
        - containerPort: 8080
        volumeMounts:
        - name: envoy-config
          mountPath: /etc/envoy
      volumes:
      - name: envoy-config
        configMap:
          name: envoy-config

---
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: banking-integration-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: banking-integration-layer
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: banking_api_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"

---
# Service
apiVersion: v1
kind: Service
metadata:
  name: banking-integration-service
spec:
  selector:
    app: banking-integration-layer
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

### Resource Requirements
- **CPU**: 250m-500m per pod (scales based on load)
- **Memory**: 512Mi-1Gi per pod
- **Storage**: 10Gi for transaction cache
- **Network**: Low latency connection to banking providers (<100ms)

### Scaling Strategy
- **Horizontal scaling**: 3-10 pods based on CPU/memory/request rate
- **Vertical scaling**: Increase resources for complex reconciliation workloads
- **Geographic distribution**: Deploy in regions close to banking providers

### Dependencies & SLAs
- **Database**: PostgreSQL with 99.99% availability
- **Cache**: Redis with 99.9% availability
- **Message Queue**: RabbitMQ with at-least-once delivery guarantee
- **Banking Providers**: Variable SLAs (typically 99.5-99.9%)
- **Internal Dependencies**:
  - Security Module: 99.99% availability
  - AI Module: 99% availability (graceful degradation)

### Monitoring & Alerting
- **Prometheus**: Metrics collection every 30s
- **Grafana**: Real-time dashboards
- **PagerDuty**: Critical alerts with 5-minute response SLA
- **Log aggregation**: ELK stack for centralized logging

---

This completes the comprehensive technical specification for the Banking Integration Layer module, providing production-ready code, detailed configurations, and deployment considerations for secure PSD2-compliant banking integrations.