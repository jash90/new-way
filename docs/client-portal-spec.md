# Client Self-Service Portal (CSP) Module Specification

## A. Module Overview

### Purpose
The Client Self-Service Portal (CSP) provides a secure, user-friendly web interface for clients to independently access their financial data, upload documents, view reports, and communicate with their accounting team without direct intervention from staff.

### Scope
- **Client Dashboard**: Real-time KPIs, revenue charts, expense breakdowns, tax calendars
- **Document Management**: Secure upload, categorization, viewing, and downloading of financial documents
- **Report Access**: View and download financial reports, tax returns, and custom analytics
- **Secure Communication**: Two-way encrypted messaging with accounting team
- **Notification Center**: Alerts for deadlines, document requests, and important updates
- **Profile Management**: Client information updates and preference settings
- **Activity Tracking**: Audit trail of all client actions within the portal
- **Multi-language Support**: Internationalization for global clients

### Dependencies
- **AUTH**: Authentication and authorization services
- **CRM**: Client relationship and profile data
- **DOC**: Document storage and management
- **RPT**: Report generation and retrieval
- **NOT**: Notification service
- **AUDIT**: Activity logging and compliance

### Consumers
- End clients (businesses and individuals)
- Mobile applications (iOS/Android)
- Third-party integrations via API gateway

## B. Technical Specification

### 1. Technology Stack

- **Frontend Framework**: React 18 with TypeScript - component reusability and type safety
- **State Management**: Redux Toolkit with RTK Query - centralized state and efficient caching
- **UI Library**: Material-UI v5 - consistent design system and accessibility
- **Backend Framework**: Node.js with Express - JavaScript ecosystem consistency
- **Database**: PostgreSQL 15 - ACID compliance for financial data integrity
- **Caching**: Redis 7 - session management and frequently accessed data
- **File Storage**: AWS S3 with CloudFront CDN - scalable document storage
- **Real-time Communication**: WebSockets with Socket.io - instant messaging
- **Security**: JWT tokens, OAuth 2.0, AES-256 encryption
- **Monitoring**: DataDog for APM, Sentry for error tracking

### 2. Key Interfaces

```typescript
// Main Service Interface
export interface IClientPortalService {
  // Dashboard operations
  getClientDashboard(clientId: string, dateRange?: DateRange): Promise<DashboardData>;
  getKPIMetrics(clientId: string, metrics: KPIType[]): Promise<KPIData[]>;
  
  // Document operations
  uploadDocument(clientId: string, document: DocumentUploadDTO): Promise<DocumentMetadata>;
  getDocuments(clientId: string, filters: DocumentFilters): Promise<PaginatedDocuments>;
  downloadDocument(clientId: string, documentId: string): Promise<DocumentStream>;
  deleteDocument(clientId: string, documentId: string): Promise<void>;
  
  // Report operations
  getReports(clientId: string, type: ReportType): Promise<Report[]>;
  generateReport(clientId: string, request: ReportRequest): Promise<Report>;
  scheduleReport(clientId: string, schedule: ReportSchedule): Promise<ScheduleConfirmation>;
  
  // Communication operations
  sendMessage(message: SecureMessageDTO): Promise<MessageResponse>;
  getMessages(clientId: string, filters: MessageFilters): Promise<Message[]>;
  markMessageAsRead(clientId: string, messageId: string): Promise<void>;
  
  // Profile operations
  updateClientProfile(clientId: string, updates: ProfileUpdateDTO): Promise<ClientProfile>;
  updatePreferences(clientId: string, preferences: PreferencesDTO): Promise<void>;
  
  // Activity operations
  getActivityLog(clientId: string, filters: ActivityFilters): Promise<Activity[]>;
  exportActivityReport(clientId: string, format: ExportFormat): Promise<Buffer>;
}

// Data Transfer Objects
export interface DashboardData {
  clientId: string;
  companyName: string;
  lastUpdated: Date;
  kpis: KPIData[];
  revenueData: RevenueChart;
  expenseBreakdown: ExpenseCategory[];
  taxCalendar: TaxEvent[];
  recentDocuments: DocumentSummary[];
  pendingTasks: Task[];
  notifications: Notification[];
}

export interface DocumentUploadDTO {
  file: Buffer;
  fileName: string;
  mimeType: string;
  category: DocumentCategory;
  taxYear?: number;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface SecureMessageDTO {
  clientId: string;
  subject: string;
  body: string;
  priority: MessagePriority;
  attachments?: string[];
  replyToMessageId?: string;
  encrypted: boolean;
}

// Request/Response Types
export interface PortalAuthRequest {
  email: string;
  password: string;
  mfaCode?: string;
  rememberDevice?: boolean;
}

export interface PortalAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  clientProfile: ClientProfile;
  permissions: Permission[];
}

// Event Interfaces
export interface PortalEvent {
  eventId: string;
  eventType: PortalEventType;
  clientId: string;
  timestamp: Date;
  metadata: Record<string, any>;
  correlationId: string;
}

export enum PortalEventType {
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  REPORT_GENERATED = 'REPORT_GENERATED',
  MESSAGE_SENT = 'MESSAGE_SENT',
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  SESSION_EXPIRED = 'SESSION_EXPIRED'
}

// Configuration Interface
export interface PortalConfiguration {
  apiUrl: string;
  wsUrl: string;
  cdnUrl: string;
  maxFileSize: number;
  allowedFileTypes: string[];
  sessionTimeout: number;
  enableMFA: boolean;
  encryptionKey: string;
  rateLimits: RateLimitConfig;
  features: FeatureFlags;
}
```

### 3. API Endpoints

```typescript
// RESTful API Routes
export const portalRoutes = {
  // Authentication
  'POST /api/v1/portal/auth/login': 'Authenticate client',
  'POST /api/v1/portal/auth/logout': 'Logout client',
  'POST /api/v1/portal/auth/refresh': 'Refresh access token',
  'POST /api/v1/portal/auth/mfa/verify': 'Verify MFA code',
  
  // Dashboard
  'GET /api/v1/portal/dashboard': 'Get dashboard data',
  'GET /api/v1/portal/dashboard/kpis': 'Get KPI metrics',
  'GET /api/v1/portal/dashboard/revenue': 'Get revenue data',
  'GET /api/v1/portal/dashboard/expenses': 'Get expense breakdown',
  
  // Documents
  'GET /api/v1/portal/documents': 'List documents with pagination',
  'GET /api/v1/portal/documents/:id': 'Get document details',
  'GET /api/v1/portal/documents/:id/download': 'Download document',
  'POST /api/v1/portal/documents/upload': 'Upload new document',
  'PUT /api/v1/portal/documents/:id': 'Update document metadata',
  'DELETE /api/v1/portal/documents/:id': 'Delete document',
  
  // Reports
  'GET /api/v1/portal/reports': 'List available reports',
  'GET /api/v1/portal/reports/:id': 'Get report details',
  'GET /api/v1/portal/reports/:id/download': 'Download report',
  'POST /api/v1/portal/reports/generate': 'Generate new report',
  'POST /api/v1/portal/reports/schedule': 'Schedule recurring report',
  
  // Messages
  'GET /api/v1/portal/messages': 'Get messages with filters',
  'GET /api/v1/portal/messages/:id': 'Get message details',
  'POST /api/v1/portal/messages': 'Send new message',
  'PUT /api/v1/portal/messages/:id/read': 'Mark message as read',
  'DELETE /api/v1/portal/messages/:id': 'Delete message',
  
  // Profile
  'GET /api/v1/portal/profile': 'Get client profile',
  'PUT /api/v1/portal/profile': 'Update profile information',
  'PUT /api/v1/portal/profile/preferences': 'Update preferences',
  'PUT /api/v1/portal/profile/password': 'Change password',
  
  // Activity
  'GET /api/v1/portal/activity': 'Get activity log',
  'GET /api/v1/portal/activity/export': 'Export activity report'
};
```

## C. Implementation Details

### 1. Main Service Implementation

```typescript
import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { validate } from 'class-validator';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@injectable()
export class ClientPortalService implements IClientPortalService {
  private readonly eventEmitter: EventEmitter;
  private readonly cache: RedisClient;
  private readonly circuitBreaker: CircuitBreaker;
  
  constructor(
    @inject('AuthService') private authService: IAuthService,
    @inject('CRMService') private crmService: ICRMService,
    @inject('DocumentService') private docService: IDocumentService,
    @inject('ReportService') private reportService: IReportService,
    @inject('NotificationService') private notificationService: INotificationService,
    @inject('AuditService') private auditService: IAuditService,
    @inject('Logger') private logger: Logger,
    @inject('Database') private db: Database,
    @inject('Cache') cache: RedisClient,
    @inject('EventEmitter') eventEmitter: EventEmitter,
    @inject('Config') private config: PortalConfiguration
  ) {
    this.eventEmitter = eventEmitter;
    this.cache = cache;
    this.circuitBreaker = new CircuitBreaker({
      timeout: 5000,
      errorThreshold: 50,
      resetTimeout: 30000
    });
  }

  async getClientDashboard(
    clientId: string, 
    dateRange?: DateRange
  ): Promise<DashboardData> {
    const correlationId = uuidv4();
    
    try {
      // Validate input
      if (!this.isValidUUID(clientId)) {
        throw new InvalidClientIdException('Invalid client ID format');
      }
      
      // Check cache first
      const cacheKey = `dashboard:${clientId}:${dateRange?.start || 'default'}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.info('Dashboard cache hit', { clientId, correlationId });
        return JSON.parse(cached);
      }
      
      // Fetch data in parallel for performance
      const [
        clientProfile,
        kpis,
        revenueData,
        expenseData,
        taxEvents,
        recentDocs,
        pendingTasks,
        notifications
      ] = await Promise.all([
        this.crmService.getClientProfile(clientId),
        this.fetchKPIMetrics(clientId, dateRange),
        this.fetchRevenueData(clientId, dateRange),
        this.fetchExpenseBreakdown(clientId, dateRange),
        this.fetchTaxCalendar(clientId),
        this.fetchRecentDocuments(clientId, 5),
        this.fetchPendingTasks(clientId),
        this.notificationService.getUnreadNotifications(clientId)
      ]);
      
      const dashboardData: DashboardData = {
        clientId,
        companyName: clientProfile.companyName,
        lastUpdated: new Date(),
        kpis,
        revenueData,
        expenseBreakdown: expenseData,
        taxCalendar: taxEvents,
        recentDocuments: recentDocs,
        pendingTasks,
        notifications
      };
      
      // Cache the result
      await this.cache.setex(
        cacheKey,
        this.config.features.dashboardCacheTTL || 300,
        JSON.stringify(dashboardData)
      );
      
      // Audit the access
      await this.auditService.log({
        action: 'DASHBOARD_ACCESS',
        clientId,
        timestamp: new Date(),
        correlationId,
        metadata: { dateRange }
      });
      
      // Emit event
      this.emitPortalEvent({
        eventType: PortalEventType.DASHBOARD_VIEWED,
        clientId,
        metadata: { dateRange },
        correlationId
      });
      
      return dashboardData;
      
    } catch (error) {
      this.logger.error('Failed to fetch dashboard', {
        clientId,
        error: error.message,
        correlationId
      });
      
      throw new DashboardFetchException(
        'Unable to load dashboard data',
        error
      );
    }
  }

  async uploadDocument(
    clientId: string,
    documentDto: DocumentUploadDTO
  ): Promise<DocumentMetadata> {
    const correlationId = uuidv4();
    const transaction = await this.db.beginTransaction();
    
    try {
      // Validate file
      this.validateDocumentUpload(documentDto);
      
      // Check client permissions
      const hasPermission = await this.authService.checkPermission(
        clientId,
        'DOCUMENT_UPLOAD'
      );
      
      if (!hasPermission) {
        throw new InsufficientPermissionsException(
          'Client does not have upload permissions'
        );
      }
      
      // Scan for viruses
      const isSafe = await this.scanDocument(documentDto.file);
      if (!isSafe) {
        throw new SecurityException('Document failed security scan');
      }
      
      // Encrypt document
      const encryptedFile = await this.encryptDocument(
        documentDto.file,
        clientId
      );
      
      // Generate unique document ID
      const documentId = uuidv4();
      
      // Upload to S3
      const s3Location = await this.uploadToS3(
        encryptedFile,
        documentId,
        documentDto.mimeType
      );
      
      // Save metadata to database
      const metadata: DocumentMetadata = {
        documentId,
        clientId,
        fileName: documentDto.fileName,
        fileSize: documentDto.file.length,
        mimeType: documentDto.mimeType,
        category: documentDto.category,
        taxYear: documentDto.taxYear,
        description: documentDto.description,
        tags: documentDto.tags || [],
        s3Location,
        uploadedAt: new Date(),
        uploadedBy: clientId,
        checksum: this.calculateChecksum(documentDto.file),
        encrypted: true,
        version: 1,
        status: DocumentStatus.ACTIVE
      };
      
      await this.db.query(
        `INSERT INTO portal_documents 
         (document_id, client_id, file_name, file_size, mime_type, 
          category, tax_year, description, tags, s3_location, 
          uploaded_at, uploaded_by, checksum, encrypted, version, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          metadata.documentId,
          metadata.clientId,
          metadata.fileName,
          metadata.fileSize,
          metadata.mimeType,
          metadata.category,
          metadata.taxYear,
          metadata.description,
          JSON.stringify(metadata.tags),
          metadata.s3Location,
          metadata.uploadedAt,
          metadata.uploadedBy,
          metadata.checksum,
          metadata.encrypted,
          metadata.version,
          metadata.status
        ],
        transaction
      );
      
      // Index document for search
      await this.indexDocument(metadata);
      
      // Commit transaction
      await transaction.commit();
      
      // Clear cache
      await this.cache.del(`documents:${clientId}:*`);
      
      // Audit
      await this.auditService.log({
        action: 'DOCUMENT_UPLOAD',
        clientId,
        documentId,
        timestamp: new Date(),
        correlationId,
        metadata: {
          fileName: documentDto.fileName,
          category: documentDto.category,
          fileSize: documentDto.file.length
        }
      });
      
      // Emit event
      this.emitPortalEvent({
        eventType: PortalEventType.DOCUMENT_UPLOADED,
        clientId,
        metadata: { documentId, fileName: documentDto.fileName },
        correlationId
      });
      
      // Send notification
      await this.notificationService.notify({
        clientId,
        type: 'DOCUMENT_UPLOADED',
        title: 'Document uploaded successfully',
        body: `${documentDto.fileName} has been uploaded to your portal`,
        priority: NotificationPriority.LOW
      });
      
      this.logger.info('Document uploaded successfully', {
        clientId,
        documentId,
        correlationId
      });
      
      return metadata;
      
    } catch (error) {
      await transaction.rollback();
      
      this.logger.error('Document upload failed', {
        clientId,
        error: error.message,
        correlationId
      });
      
      throw new DocumentUploadException(
        'Failed to upload document',
        error
      );
    }
  }

  async sendMessage(message: SecureMessageDTO): Promise<MessageResponse> {
    const correlationId = uuidv4();
    
    try {
      // Validate message
      const validationErrors = await validate(message);
      if (validationErrors.length > 0) {
        throw new ValidationException('Invalid message format', validationErrors);
      }
      
      // Encrypt message if required
      let messageBody = message.body;
      if (message.encrypted) {
        messageBody = await this.encryptMessage(
          message.body,
          message.clientId
        );
      }
      
      // Check for rate limiting
      const isRateLimited = await this.checkRateLimit(
        message.clientId,
        'MESSAGE_SEND'
      );
      
      if (isRateLimited) {
        throw new RateLimitException('Message rate limit exceeded');
      }
      
      // Generate message ID
      const messageId = uuidv4();
      
      // Store message
      const storedMessage = await this.db.query(
        `INSERT INTO portal_messages 
         (message_id, client_id, subject, body, priority, 
          attachments, reply_to_message_id, encrypted, sent_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          messageId,
          message.clientId,
          message.subject,
          messageBody,
          message.priority,
          JSON.stringify(message.attachments || []),
          message.replyToMessageId,
          message.encrypted,
          new Date(),
          MessageStatus.SENT
        ]
      );
      
      // Send real-time notification via WebSocket
      this.sendWebSocketNotification(message.clientId, {
        type: 'NEW_MESSAGE',
        messageId,
        subject: message.subject,
        priority: message.priority
      });
      
      // Queue for processing
      await this.queueMessageForProcessing(messageId);
      
      // Audit
      await this.auditService.log({
        action: 'MESSAGE_SENT',
        clientId: message.clientId,
        messageId,
        timestamp: new Date(),
        correlationId,
        metadata: {
          subject: message.subject,
          priority: message.priority,
          encrypted: message.encrypted
        }
      });
      
      // Emit event
      this.emitPortalEvent({
        eventType: PortalEventType.MESSAGE_SENT,
        clientId: message.clientId,
        metadata: { messageId, subject: message.subject },
        correlationId
      });
      
      return {
        messageId,
        status: MessageStatus.SENT,
        sentAt: storedMessage.rows[0].sent_at,
        estimatedResponseTime: this.calculateEstimatedResponseTime(message.priority)
      };
      
    } catch (error) {
      this.logger.error('Failed to send message', {
        clientId: message.clientId,
        error: error.message,
        correlationId
      });
      
      throw new MessageSendException('Unable to send message', error);
    }
  }

  // Helper methods
  private async fetchKPIMetrics(
    clientId: string,
    dateRange?: DateRange
  ): Promise<KPIData[]> {
    const metrics = await this.db.query(
      `SELECT 
         metric_type,
         metric_value,
         trend,
         comparison_value,
         comparison_period
       FROM portal_kpi_metrics
       WHERE client_id = $1
         AND date >= $2
         AND date <= $3
       ORDER BY display_order`,
      [
        clientId,
        dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        dateRange?.end || new Date()
      ]
    );
    
    return metrics.rows.map(row => ({
      type: row.metric_type,
      value: row.metric_value,
      trend: row.trend,
      comparison: {
        value: row.comparison_value,
        period: row.comparison_period
      },
      formatted: this.formatKPIValue(row.metric_type, row.metric_value)
    }));
  }

  private validateDocumentUpload(document: DocumentUploadDTO): void {
    // Check file size
    if (document.file.length > this.config.maxFileSize) {
      throw new ValidationException(
        `File size exceeds maximum of ${this.config.maxFileSize} bytes`
      );
    }
    
    // Check file type
    if (!this.config.allowedFileTypes.includes(document.mimeType)) {
      throw new ValidationException(
        `File type ${document.mimeType} is not allowed`
      );
    }
    
    // Validate file name
    if (!/^[\w\-. ]+$/.test(document.fileName)) {
      throw new ValidationException('Invalid file name format');
    }
    
    // Check for malicious content patterns
    if (this.containsMaliciousPattern(document.file)) {
      throw new SecurityException('File contains potentially malicious content');
    }
  }

  private async encryptDocument(
    file: Buffer,
    clientId: string
  ): Promise<Buffer> {
    const algorithm = 'aes-256-gcm';
    const key = await this.deriveEncryptionKey(clientId);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(file),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return Buffer.concat([iv, authTag, encrypted]);
  }

  private async scanDocument(file: Buffer): Promise<boolean> {
    try {
      return await this.circuitBreaker.fire(async () => {
        const scanResult = await this.antivirusService.scan(file);
        return scanResult.clean;
      });
    } catch (error) {
      this.logger.warn('Antivirus scan failed, falling back to pattern check', {
        error: error.message
      });
      return !this.containsMaliciousPattern(file);
    }
  }

  private calculateChecksum(file: Buffer): string {
    return crypto
      .createHash('sha256')
      .update(file)
      .digest('hex');
  }

  private emitPortalEvent(event: Partial<PortalEvent>): void {
    const fullEvent: PortalEvent = {
      eventId: uuidv4(),
      timestamp: new Date(),
      ...event
    } as PortalEvent;
    
    this.eventEmitter.emit('portal.event', fullEvent);
  }
}
```

### 2. Core Methods

```typescript
export class PortalAuthenticationHandler {
  async authenticateClient(request: PortalAuthRequest): Promise<PortalAuthResponse> {
    const transaction = await this.db.beginTransaction();
    
    try {
      // Validate credentials
      const client = await this.validateCredentials(
        request.email,
        request.password
      );
      
      if (!client) {
        await this.recordFailedLogin(request.email);
        throw new AuthenticationException('Invalid credentials');
      }
      
      // Check if account is locked
      if (client.accountLocked) {
        throw new AccountLockedException('Account is locked');
      }
      
      // Verify MFA if enabled
      if (client.mfaEnabled) {
        if (!request.mfaCode) {
          throw new MFARequiredException('MFA code required');
        }
        
        const mfaValid = await this.verifyMFACode(
          client.id,
          request.mfaCode
        );
        
        if (!mfaValid) {
          throw new InvalidMFAException('Invalid MFA code');
        }
      }
      
      // Generate tokens
      const accessToken = await this.generateAccessToken(client);
      const refreshToken = await this.generateRefreshToken(client);
      
      // Create session
      const sessionId = uuidv4();
      await this.createSession({
        sessionId,
        clientId: client.id,
        accessToken,
        refreshToken,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        rememberDevice: request.rememberDevice,
        expiresAt: new Date(Date.now() + this.config.sessionTimeout)
      });
      
      // Update last login
      await this.updateLastLogin(client.id);
      
      // Get permissions
      const permissions = await this.getClientPermissions(client.id);
      
      await transaction.commit();
      
      // Audit successful login
      await this.auditService.log({
        action: 'LOGIN_SUCCESS',
        clientId: client.id,
        timestamp: new Date(),
        metadata: {
          sessionId,
          ipAddress: request.ipAddress,
          mfaUsed: client.mfaEnabled
        }
      });
      
      return {
        accessToken,
        refreshToken,
        expiresIn: this.config.sessionTimeout,
        clientProfile: this.sanitizeClientProfile(client),
        permissions
      };
      
    } catch (error) {
      await transaction.rollback();
      
      // Audit failed login
      await this.auditService.log({
        action: 'LOGIN_FAILED',
        email: request.email,
        timestamp: new Date(),
        metadata: {
          reason: error.message,
          ipAddress: request.ipAddress
        }
      });
      
      throw error;
    }
  }

  private async validateCredentials(
    email: string,
    password: string
  ): Promise<Client | null> {
    const client = await this.db.query(
      'SELECT * FROM clients WHERE email = $1 AND active = true',
      [email]
    );
    
    if (!client.rows[0]) {
      return null;
    }
    
    const validPassword = await bcrypt.compare(
      password,
      client.rows[0].password_hash
    );
    
    return validPassword ? client.rows[0] : null;
  }
}
```

### 3. Event Definitions

```typescript
export class PortalEventManager {
  private readonly eventHandlers: Map<PortalEventType, EventHandler[]>;
  
  constructor() {
    this.eventHandlers = new Map();
    this.registerDefaultHandlers();
  }
  
  private registerDefaultHandlers(): void {
    // Document events
    this.on(PortalEventType.DOCUMENT_UPLOADED, async (event) => {
      await this.processDocumentUpload(event);
    });
    
    // Message events
    this.on(PortalEventType.MESSAGE_SENT, async (event) => {
      await this.routeMessageToTeam(event);
    });
    
    // Security events
    this.on(PortalEventType.LOGIN_FAILED, async (event) => {
      await this.checkForBruteForce(event);
    });
  }
  
  async emit(event: PortalEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.eventType) || [];
    
    await Promise.all(
      handlers.map(handler => 
        this.executeHandler(handler, event)
      )
    );
  }
  
  private async executeHandler(
    handler: EventHandler,
    event: PortalEvent
  ): Promise<void> {
    try {
      await handler(event);
    } catch (error) {
      this.logger.error('Event handler failed', {
        eventType: event.eventType,
        eventId: event.eventId,
        error: error.message
      });
    }
  }
}
```

### 4. Custom Exceptions

```typescript
export class PortalException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly innerError?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationException extends PortalException {
  constructor(message: string, innerError?: Error) {
    super(message, 'AUTH_FAILED', 401, innerError);
  }
}

export class InsufficientPermissionsException extends PortalException {
  constructor(message: string, innerError?: Error) {
    super(message, 'INSUFFICIENT_PERMISSIONS', 403, innerError);
  }
}

export class DocumentUploadException extends PortalException {
  constructor(message: string, innerError?: Error) {
    super(message, 'DOCUMENT_UPLOAD_FAILED', 400, innerError);
  }
}

export class RateLimitException extends PortalException {
  constructor(message: string, innerError?: Error) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, innerError);
  }
}
```

## D. Database Schema

```sql
-- Main portal tables
CREATE TABLE portal_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(client_id),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    device_fingerprint TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    CONSTRAINT fk_client FOREIGN KEY (client_id) 
        REFERENCES clients(client_id) ON DELETE CASCADE
);

CREATE TABLE portal_documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(client_id),
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    tax_year INTEGER,
    description TEXT,
    tags JSONB DEFAULT '[]',
    s3_location TEXT NOT NULL,
    thumbnail_url TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID NOT NULL,
    modified_at TIMESTAMPTZ DEFAULT NOW(),
    modified_by UUID,
    checksum VARCHAR(64) NOT NULL,
    encrypted BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT fk_client FOREIGN KEY (client_id) 
        REFERENCES clients(client_id) ON DELETE CASCADE,
    CONSTRAINT chk_status CHECK (status IN ('ACTIVE', 'ARCHIVED', 'DELETED'))
);

CREATE TABLE portal_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(client_id),
    thread_id UUID,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'NORMAL',
    sender_type VARCHAR(20) NOT NULL,
    sender_id UUID NOT NULL,
    recipient_type VARCHAR(20) NOT NULL,
    recipient_id UUID NOT NULL,
    attachments JSONB DEFAULT '[]',
    reply_to_message_id UUID,
    encrypted BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'SENT',
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT fk_client FOREIGN KEY (client_id) 
        REFERENCES clients(client_id) ON DELETE CASCADE,
    CONSTRAINT fk_reply_to FOREIGN KEY (reply_to_message_id)
        REFERENCES portal_messages(message_id),
    CONSTRAINT chk_priority CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    CONSTRAINT chk_status CHECK (status IN ('DRAFT', 'SENT', 'READ', 'ARCHIVED'))
);

CREATE TABLE portal_activity_log (
    activity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(client_id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    ip_address INET,
    user_agent TEXT,
    session_id UUID REFERENCES portal_sessions(session_id),
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    correlation_id UUID,
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT fk_client FOREIGN KEY (client_id) 
        REFERENCES clients(client_id) ON DELETE CASCADE
);

CREATE TABLE portal_notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(client_id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'NORMAL',
    action_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'PENDING',
    delivery_channels JSONB DEFAULT '["portal"]',
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT fk_client FOREIGN KEY (client_id) 
        REFERENCES clients(client_id) ON DELETE CASCADE,
    CONSTRAINT chk_status CHECK (status IN ('PENDING', 'SENT', 'READ', 'EXPIRED'))
);

-- Indexes for performance
CREATE INDEX idx_sessions_client_active ON portal_sessions(client_id, is_active);
CREATE INDEX idx_sessions_expires ON portal_sessions(expires_at) WHERE is_active = true;
CREATE INDEX idx_documents_client_category ON portal_documents(client_id, category);
CREATE INDEX idx_documents_client_tax_year ON portal_documents(client_id, tax_year);
CREATE INDEX idx_documents_tags ON portal_documents USING gin(tags);
CREATE INDEX idx_messages_client_status ON portal_messages(client_id, status);
CREATE INDEX idx_messages_thread ON portal_messages(thread_id);
CREATE INDEX idx_activity_client_date ON portal_activity_log(client_id, performed_at DESC);
CREATE INDEX idx_activity_correlation ON portal_activity_log(correlation_id);
CREATE INDEX idx_notifications_client_unread ON portal_notifications(client_id, read_at) 
    WHERE read_at IS NULL;

-- Full text search
CREATE INDEX idx_documents_search ON portal_documents 
    USING gin(to_tsvector('english', file_name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_messages_search ON portal_messages 
    USING gin(to_tsvector('english', subject || ' ' || body));
```

## E. Configuration

```typescript
export interface PortalConfiguration {
  // API Configuration
  api: {
    baseUrl: string;
    version: string;
    timeout: number;
    retryAttempts: number;
    rateLimits: {
      windowMs: number;
      maxRequests: number;
      skipSuccessfulRequests: boolean;
    };
  };
  
  // Security Configuration
  security: {
    jwtSecret: string;
    jwtExpiresIn: string;
    refreshTokenExpiresIn: string;
    encryptionKey: string;
    allowedOrigins: string[];
    enableMFA: boolean;
    sessionTimeout: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      maxAge: number;
    };
  };
  
  // Storage Configuration
  storage: {
    s3: {
      bucket: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
      signedUrlExpiry: number;
    };
    maxFileSize: number;
    allowedFileTypes: string[];
    compressionEnabled: boolean;
  };
  
  // Cache Configuration
  cache: {
    redis: {
      host: string;
      port: number;
      password: string;
      db: number;
      keyPrefix: string;
    };
    ttl: {
      dashboard: number;
      documents: number;
      reports: number;
      messages: number;
    };
  };
  
  // Feature Flags
  features: {
    enableDocumentPreview: boolean;
    enableVideoMessages: boolean;
    enableMobileApp: boolean;
    enableOfflineMode: boolean;
    enableAIAssistant: boolean;
    maxConcurrentUploads: number;
    dashboardRefreshInterval: number;
  };
  
  // Monitoring
  monitoring: {
    sentryDsn: string;
    datadogApiKey: string;
    logLevel: string;
    enablePerformanceMonitoring: boolean;
    enableErrorTracking: boolean;
  };
}

// Environment variables
export const envConfig = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000'),
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
  AWS_REGION: process.env.AWS_REGION,
  JWT_SECRET: process.env.JWT_SECRET,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  SENTRY_DSN: process.env.SENTRY_DSN,
  DATADOG_API_KEY: process.env.DATADOG_API_KEY,
  ENABLE_MFA: process.env.ENABLE_MFA === 'true',
  SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT || '3600000'),
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '52428800'), // 50MB
  DASHBOARD_CACHE_TTL: parseInt(process.env.DASHBOARD_CACHE_TTL || '300'),
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100')
};

// Default configuration
export const defaultConfig: PortalConfiguration = {
  api: {
    baseUrl: '/api/v1/portal',
    version: '1.0.0',
    timeout: 30000,
    retryAttempts: 3,
    rateLimits: {
      windowMs: envConfig.RATE_LIMIT_WINDOW,
      maxRequests: envConfig.RATE_LIMIT_MAX,
      skipSuccessfulRequests: false
    }
  },
  security: {
    jwtSecret: envConfig.JWT_SECRET,
    jwtExpiresIn: '1h',
    refreshTokenExpiresIn: '7d',
    encryptionKey: envConfig.ENCRYPTION_KEY,
    allowedOrigins: ['https://portal.example.com'],
    enableMFA: envConfig.ENABLE_MFA,
    sessionTimeout: envConfig.SESSION_TIMEOUT,
    maxLoginAttempts: 5,
    lockoutDuration: 900000, // 15 minutes
    passwordPolicy: {
      minLength: 12,
      requireUppercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      maxAge: 7776000000 // 90 days
    }
  },
  storage: {
    s3: {
      bucket: envConfig.AWS_S3_BUCKET,
      region: envConfig.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      signedUrlExpiry: 3600
    },
    maxFileSize: envConfig.MAX_FILE_SIZE,
    allowedFileTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ],
    compressionEnabled: true
  },
  cache: {
    redis: {
      host: 'localhost',
      port: 6379,
      password: '',
      db: 0,
      keyPrefix: 'portal:'
    },
    ttl: {
      dashboard: envConfig.DASHBOARD_CACHE_TTL,
      documents: 600,
      reports: 1800,
      messages: 300
    }
  },
  features: {
    enableDocumentPreview: true,
    enableVideoMessages: false,
    enableMobileApp: true,
    enableOfflineMode: false,
    enableAIAssistant: false,
    maxConcurrentUploads: 3,
    dashboardRefreshInterval: 60000
  },
  monitoring: {
    sentryDsn: envConfig.SENTRY_DSN,
    datadogApiKey: envConfig.DATADOG_API_KEY,
    logLevel: envConfig.NODE_ENV === 'production' ? 'info' : 'debug',
    enablePerformanceMonitoring: true,
    enableErrorTracking: true
  }
};
```

## F. Testing Strategy

### 1. Unit Tests

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ClientPortalService } from '../src/services/ClientPortalService';

describe('ClientPortalService', () => {
  let service: ClientPortalService;
  let mockAuthService: jest.Mocked<IAuthService>;
  let mockCRMService: jest.Mocked<ICRMService>;
  let mockCache: jest.Mocked<RedisClient>;
  let mockDB: jest.Mocked<Database>;
  
  beforeEach(() => {
    mockAuthService = {
      checkPermission: jest.fn(),
      validateToken: jest.fn()
    };
    
    mockCRMService = {
      getClientProfile: jest.fn()
    };
    
    mockCache = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn()
    };
    
    mockDB = {
      query: jest.fn(),
      beginTransaction: jest.fn()
    };
    
    service = new ClientPortalService(
      mockAuthService,
      mockCRMService,
      // ... other mocks
    );
  });
  
  describe('getClientDashboard', () => {
    it('should return cached dashboard if available', async () => {
      const clientId = 'client-123';
      const cachedData = { kpis: [], revenueData: {} };
      
      mockCache.get.mockResolvedValue(JSON.stringify(cachedData));
      
      const result = await service.getClientDashboard(clientId);
      
      expect(mockCache.get).toHaveBeenCalledWith(`dashboard:${clientId}:default`);
      expect(result).toEqual(expect.objectContaining(cachedData));
      expect(mockCRMService.getClientProfile).not.toHaveBeenCalled();
    });
    
    it('should fetch fresh data if cache miss', async () => {
      const clientId = 'client-123';
      
      mockCache.get.mockResolvedValue(null);
      mockCRMService.getClientProfile.mockResolvedValue({
        companyName: 'Test Corp'
      });
      mockDB.query.mockResolvedValue({ rows: [] });
      
      const result = await service.getClientDashboard(clientId);
      
      expect(mockCRMService.getClientProfile).toHaveBeenCalledWith(clientId);
      expect(mockCache.setex).toHaveBeenCalled();
      expect(result.companyName).toBe('Test Corp');
    });
    
    it('should throw error for invalid client ID', async () => {
      const invalidId = 'not-a-uuid';
      
      await expect(
        service.getClientDashboard(invalidId)
      ).rejects.toThrow(InvalidClientIdException);
    });
  });
  
  describe('uploadDocument', () => {
    it('should successfully upload valid document', async () => {
      const clientId = 'client-123';
      const document = {
        file: Buffer.from('test content'),
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        category: DocumentCategory.TAX_RETURN
      };
      
      mockAuthService.checkPermission.mockResolvedValue(true);
      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };
      mockDB.beginTransaction.mockResolvedValue(mockTransaction);
      
      const result = await service.uploadDocument(clientId, document);
      
      expect(result).toHaveProperty('documentId');
      expect(result.fileName).toBe('test.pdf');
      expect(mockTransaction.commit).toHaveBeenCalled();
    });
    
    it('should reject oversized files', async () => {
      const clientId = 'client-123';
      const largeFile = Buffer.alloc(100 * 1024 * 1024); // 100MB
      const document = {
        file: largeFile,
        fileName: 'large.pdf',
        mimeType: 'application/pdf',
        category: DocumentCategory.TAX_RETURN
      };
      
      await expect(
        service.uploadDocument(clientId, document)
      ).rejects.toThrow(ValidationException);
    });
    
    it('should rollback transaction on error', async () => {
      const clientId = 'client-123';
      const document = {
        file: Buffer.from('test'),
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        category: DocumentCategory.TAX_RETURN
      };
      
      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };
      mockDB.beginTransaction.mockResolvedValue(mockTransaction);
      mockDB.query.mockRejectedValue(new Error('DB Error'));
      
      await expect(
        service.uploadDocument(clientId, document)
      ).rejects.toThrow(DocumentUploadException);
      
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });
});
```

### 2. Integration Tests

```typescript
import request from 'supertest';
import { app } from '../src/app';

describe('Portal API Integration Tests', () => {
  describe('POST /api/v1/portal/auth/login', () => {
    it('should authenticate valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/portal/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
          mfaCode: '123456'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('clientProfile');
    });
    
    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/portal/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });
    
    it('should enforce rate limiting', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/v1/portal/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrong'
          })
      );
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);
      
      expect(rateLimited).toBe(true);
    });
  });
  
  describe('Document Operations', () => {
    let authToken: string;
    
    beforeEach(async () => {
      const authResponse = await request(app)
        .post('/api/v1/portal/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!'
        });
      
      authToken = authResponse.body.accessToken;
    });
    
    it('should upload document successfully', async () => {
      const response = await request(app)
        .post('/api/v1/portal/documents/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('test content'), 'test.pdf')
        .field('category', 'TAX_RETURN')
        .field('taxYear', '2024');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('documentId');
      expect(response.body.status).toBe('ACTIVE');
    });
    
    it('should list client documents', async () => {
      const response = await request(app)
        .get('/api/v1/portal/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          page: 1,
          limit: 10,
          category: 'TAX_RETURN'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('documents');
      expect(response.body).toHaveProperty('pagination');
    });
  });
});
```

### 3. Test Coverage Requirements

- **Unit Test Coverage**: Minimum 80% code coverage
- **Integration Test Coverage**: All critical paths tested
- **Performance Tests**: Load testing for concurrent users
- **Security Tests**: Penetration testing for vulnerabilities
- **Accessibility Tests**: WCAG 2.1 AA compliance

## G. Monitoring & Observability

### 1. Metrics

```typescript
export class PortalMetricsCollector {
  private readonly metrics: MetricsRegistry;
  
  constructor() {
    this.metrics = new MetricsRegistry();
    this.initializeMetrics();
  }
  
  private initializeMetrics(): void {
    // Performance metrics
    this.metrics.register('portal.request.duration', new Histogram({
      name: 'portal_request_duration_seconds',
      help: 'Request duration in seconds',
      labelNames: ['method', 'endpoint', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5]
    }));
    
    this.metrics.register('portal.dashboard.load_time', new Histogram({
      name: 'portal_dashboard_load_time_seconds',
      help: 'Dashboard load time in seconds',
      buckets: [0.5, 1, 2, 5, 10]
    }));
    
    // Business metrics
    this.metrics.register('portal.documents.uploaded', new Counter({
      name: 'portal_documents_uploaded_total',
      help: 'Total documents uploaded',
      labelNames: ['category', 'client_tier']
    }));
    
    this.metrics.register('portal.active_sessions', new Gauge({
      name: 'portal_active_sessions',
      help: 'Number of active portal sessions'
    }));
    
    // Error metrics
    this.metrics.register('portal.errors', new Counter({
      name: 'portal_errors_total',
      help: 'Total errors',
      labelNames: ['error_type', 'endpoint']
    }));
    
    this.metrics.register('portal.auth.failures', new Counter({
      name: 'portal_auth_failures_total',
      help: 'Authentication failures',
      labelNames: ['reason']
    }));
  }
  
  recordRequestMetric(
    method: string,
    endpoint: string,
    status: number,
    duration: number
  ): void {
    this.metrics
      .get('portal.request.duration')
      .observe({ method, endpoint, status: status.toString() }, duration);
  }
}
```

### 2. Logging Strategy

```typescript
export class PortalLogger {
  private readonly logger: winston.Logger;
  
  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: 'client-portal',
        environment: process.env.NODE_ENV
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'portal-error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: 'portal-combined.log',
          maxsize: 5242880,
          maxFiles: 5
        })
      ]
    });
  }
  
  logRequest(req: Request, res: Response, duration: number): void {
    this.logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      clientId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  }
  
  logSecurityEvent(event: SecurityEvent): void {
    this.logger.warn('Security Event', {
      type: event.type,
      clientId: event.clientId,
      details: event.details,
      timestamp: event.timestamp,
      severity: event.severity
    });
  }
}
```

### 3. Health Checks

```typescript
export class PortalHealthCheck {
  async check(): Promise<HealthCheckResult> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkS3(),
      this.checkAuthService(),
      this.checkCRMService()
    ]);
    
    const allHealthy = checks.every(c => c.status === 'healthy');
    
    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      checks,
      version: process.env.APP_VERSION
    };
  }
  
  private async checkDatabase(): Promise<ComponentHealth> {
    try {
      await this.db.query('SELECT 1');
      return {
        component: 'database',
        status: 'healthy',
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        component: 'database',
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}
```

### 4. Alerts

```yaml
alerts:
  - name: HighErrorRate
    condition: rate(portal_errors_total[5m]) > 10
    severity: critical
    notification:
      - email: oncall@example.com
      - slack: #portal-alerts
    
  - name: SlowDashboardLoad
    condition: histogram_quantile(0.95, portal_dashboard_load_time_seconds) > 5
    severity: warning
    notification:
      - slack: #portal-performance
    
  - name: AuthenticationSpike
    condition: rate(portal_auth_failures_total[1m]) > 20
    severity: critical
    notification:
      - pagerduty: portal-security
    
  - name: StorageQuotaExceeded
    condition: portal_storage_used_bytes / portal_storage_quota_bytes > 0.9
    severity: warning
    notification:
      - email: admin@example.com
```

## H. Security Considerations

### 1. Authentication & Authorization

- **Multi-factor Authentication**: TOTP-based 2FA for all accounts
- **OAuth 2.0 Integration**: Support for SSO via Google, Microsoft
- **Role-Based Access Control**: Granular permissions per client
- **Session Management**: Secure token rotation and timeout

### 2. Data Validation

```typescript
export class PortalInputValidator {
  validateInput<T>(data: T, schema: ValidationSchema): ValidationResult {
    const errors: ValidationError[] = [];
    
    // XSS prevention
    const sanitized = this.sanitizeInput(data);
    
    // SQL injection prevention
    const escaped = this.escapeSQL(sanitized);
    
    // Schema validation
    const valid = ajv.validate(schema, escaped);
    
    if (!valid) {
      errors.push(...ajv.errors);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      sanitizedData: escaped
    };
  }
}
```

### 3. Rate Limiting

```typescript
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: req.rateLimit.resetTime
    });
  }
});
```

### 4. Encryption

- **Data at Rest**: AES-256-GCM encryption for all sensitive data
- **Data in Transit**: TLS 1.3 for all communications
- **Key Management**: AWS KMS for encryption key rotation

### 5. Audit Trail

```typescript
export class PortalAuditLogger {
  async logSecurityEvent(event: SecurityAuditEvent): Promise<void> {
    await this.db.query(
      `INSERT INTO security_audit_log 
       (event_id, event_type, client_id, ip_address, 
        user_agent, action, result, timestamp, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        uuidv4(),
        event.type,
        event.clientId,
        event.ipAddress,
        event.userAgent,
        event.action,
        event.result,
        new Date(),
        JSON.stringify(event.metadata)
      ]
    );
  }
}
```

## I. Documentation

### 1. API Documentation

```yaml
openapi: 3.0.0
info:
  title: Client Portal API
  version: 1.0.0
  description: Secure API for client self-service portal
servers:
  - url: https://api.example.com/v1/portal
paths:
  /auth/login:
    post:
      summary: Authenticate client
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                mfaCode:
                  type: string
      responses:
        200:
          description: Authentication successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
```

### 2. Code Comments

```typescript
/**
 * Processes client dashboard request with caching and parallel data fetching
 * 
 * @param clientId - UUID of the client requesting dashboard
 * @param dateRange - Optional date range for metrics filtering
 * @returns Promise<DashboardData> Complete dashboard data including KPIs, charts, and notifications
 * @throws InvalidClientIdException if clientId format is invalid
 * @throws DashboardFetchException if data retrieval fails
 * 
 * @example
 * const dashboard = await service.getClientDashboard(
 *   'client-uuid-here',
 *   { start: new Date('2024-01-01'), end: new Date('2024-12-31') }
 * );
 */
```

### 3. README

```markdown
# Client Self-Service Portal

## Overview
Secure web portal for clients to access financial data, documents, and reports.

## Setup
1. Install dependencies: `npm install`
2. Configure environment: `cp .env.example .env`
3. Run migrations: `npm run migrate`
4. Start server: `npm start`

## Architecture
- Frontend: React 18 + TypeScript + Material-UI
- Backend: Node.js + Express + PostgreSQL
- Cache: Redis
- Storage: AWS S3
- Monitoring: DataDog + Sentry

## Development
```bash
npm run dev       # Start development server
npm run test      # Run tests
npm run lint      # Run linter
npm run build     # Build for production
```
```

## J. Deployment Considerations

### 1. Deployment Strategy

```yaml
deployment:
  strategy: blue-green
  stages:
    - name: build
      steps:
        - npm ci
        - npm run test
        - npm run build
    
    - name: deploy-staging
      environment: staging
      steps:
        - terraform plan
        - terraform apply
        - run integration tests
    
    - name: deploy-production
      environment: production
      approval: required
      steps:
        - backup database
        - deploy to blue environment
        - run smoke tests
        - switch traffic to blue
        - monitor for 30 minutes
        - decommission green
```

### 2. Resource Requirements

```yaml
resources:
  production:
    web:
      replicas: 3
      cpu: 2
      memory: 4Gi
      autoscaling:
        minReplicas: 3
        maxReplicas: 10
        targetCPU: 70%
    
    database:
      type: PostgreSQL
      version: 15
      instance: db.r6g.xlarge
      storage: 500Gi
      backups: daily
      replication: multi-az
    
    redis:
      type: Redis
      version: 7
      instance: cache.r6g.large
      replication: enabled
    
    storage:
      s3:
        versioning: enabled
        encryption: enabled
        lifecycle:
          - transition: GLACIER
            days: 90
```

### 3. Scaling Strategy

- **Horizontal Scaling**: Auto-scaling based on CPU/memory metrics
- **Database Read Replicas**: For read-heavy operations
- **CDN**: CloudFront for static assets and documents
- **Queue-based Processing**: SQS for async operations

### 4. Dependencies

- **Auth Service**: 99.9% uptime SLA required
- **CRM Service**: 99.5% uptime SLA required
- **Document Service**: 99.9% uptime SLA required
- **AWS S3**: 99.99% availability
- **PostgreSQL**: Primary with hot standby
- **Redis**: Cluster mode for high availability

---

This comprehensive specification provides a production-ready implementation of the Client Self-Service Portal module with robust security, scalability, and monitoring capabilities.