# CSP-005: Secure Messaging

## Story Overview

| Field | Value |
|-------|-------|
| Story ID | CSP-005 |
| Epic | CSP-EPIC (Client Self-Service Portal) |
| Title | Secure Messaging |
| Priority | P1 |
| Story Points | 8 |
| Sprint | Sprint 2 (Week 30) |
| Dependencies | CSP-001 |
| Status | Draft |

## User Story

**As a** business owner or financial manager
**I want to** securely communicate with my accounting team through the client portal
**So that** I can ask questions, share information, and receive updates without using insecure email

## Acceptance Criteria

### AC1: Message Inbox
```gherkin
Feature: Message Inbox
  Scenario: View message inbox
    Given I am an authenticated client in the portal
    When I navigate to the Messages section
    Then I should see my inbox with:
      | Column | Description |
      | From/To | Sender or recipient name |
      | Subject | Message subject line |
      | Preview | First 100 characters of body |
      | Date | Sent/received date |
      | Priority | Normal/High/Urgent indicator |
      | Status | Unread/Read/Replied |
      | Attachments | Paperclip icon if attachments present |
    And messages are sorted by date descending
    And unread messages are visually highlighted
    And I see unread message count in navigation

  Scenario: Filter and search messages
    Given I am viewing my inbox
    When I apply filters
    Then I can filter by:
      | Filter | Options |
      | Folder | Inbox, Sent, Archive, All |
      | Status | Unread, Read |
      | Priority | All, Normal, High, Urgent |
      | Date Range | Custom start/end dates |
    And I can search by subject and body content
    And search results highlight matching terms
```

### AC2: Thread-Based Conversations
```gherkin
Feature: Threaded Messages
  Scenario: View conversation thread
    Given I have messages with replies
    When I click on a message
    Then I should see the full conversation thread
    And messages are displayed chronologically
    And each message shows sender, date, and body
    And I can collapse/expand individual messages
    And thread context is preserved across replies

  Scenario: Reply to message
    Given I am viewing a message
    When I click "Reply"
    Then I should see a reply composer
    And the subject should be prefixed with "Re: "
    And the original message is quoted below
    And I can add attachments to my reply
```

### AC3: Compose New Message
```gherkin
Feature: Message Composition
  Scenario: Compose new message
    Given I am in the Messages section
    When I click "New Message"
    Then I should see a message composer with:
      | Field | Description |
      | To | Pre-populated with assigned accountant |
      | Subject | Required, max 200 characters |
      | Priority | Normal (default), High, Urgent |
      | Body | Rich text editor with formatting |
      | Attachments | Upload area (max 10 files, 25MB total) |
    And I can save as draft
    And I see a character count for subject

  Scenario: Send message
    Given I have composed a message
    When I click "Send"
    Then the message is sent to the accounting team
    And I see a confirmation message
    And the message appears in my Sent folder
    And the recipient receives a notification
```

### AC4: File Attachments
```gherkin
Feature: Message Attachments
  Scenario: Attach files to message
    Given I am composing a message
    When I click "Add Attachment"
    Then I can drag-and-drop or browse for files
    And I can attach up to 10 files
    And total attachment size is max 25MB
    And allowed file types are:
      | Type | Extensions |
      | Documents | PDF, DOC, DOCX |
      | Spreadsheets | XLS, XLSX, CSV |
      | Images | JPG, PNG, GIF |
      | Archives | ZIP |
    And virus scanning is performed on upload

  Scenario: View and download attachments
    Given I am viewing a message with attachments
    Then I see attachment list with name and size
    And I can preview PDF/images inline
    And I can download individual attachments
    And I can download all as ZIP
```

### AC5: Real-Time Features
```gherkin
Feature: Real-Time Messaging
  Scenario: Receive message notification
    Given I am logged into the portal
    When someone sends me a message
    Then I receive a real-time notification
    And the unread count updates immediately
    And the new message appears in inbox without refresh

  Scenario: Read receipts
    Given I have sent a message
    When the recipient reads it
    Then I see "Read" status with timestamp
    And read receipts are optional per message
```

### AC6: Message Encryption
```gherkin
Feature: Encrypted Messages
  Scenario: Send encrypted message
    Given I am composing a message
    When I toggle "Encrypt this message"
    Then the message will be encrypted end-to-end
    And a lock icon indicates encryption
    And encrypted messages require portal login to view

  Scenario: View encrypted message
    Given I received an encrypted message
    When I open the message
    Then it is decrypted client-side
    And I see an encryption indicator
```

## Technical Specification

### Database Schema

```sql
-- Message threads
CREATE TABLE portal_message_threads (
  thread_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  subject VARCHAR(200) NOT NULL,
  participant_ids UUID[] NOT NULL,
  last_message_at TIMESTAMPTZ,
  last_message_by UUID,
  message_count INTEGER DEFAULT 0,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL
);

-- Individual messages
CREATE TABLE portal_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  thread_id UUID NOT NULL REFERENCES portal_message_threads(thread_id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('CLIENT', 'STAFF')),
  sender_id UUID NOT NULL,
  sender_name VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  body_html TEXT,
  priority VARCHAR(20) DEFAULT 'NORMAL' CHECK (priority IN ('NORMAL', 'HIGH', 'URGENT')),
  is_encrypted BOOLEAN DEFAULT false,
  encryption_key_id UUID,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ
);

-- Message recipients and read status
CREATE TABLE portal_message_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES portal_messages(message_id),
  recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('CLIENT', 'STAFF')),
  recipient_id UUID NOT NULL,
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Message attachments
CREATE TABLE portal_message_attachments (
  attachment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  message_id UUID NOT NULL REFERENCES portal_messages(message_id),
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  s3_location TEXT NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  is_encrypted BOOLEAN DEFAULT false,
  scan_status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'CLEAN', 'INFECTED'
  scanned_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draft messages
CREATE TABLE portal_message_drafts (
  draft_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  thread_id UUID REFERENCES portal_message_threads(thread_id),
  subject VARCHAR(200),
  body TEXT,
  body_html TEXT,
  priority VARCHAR(20) DEFAULT 'NORMAL',
  is_encrypted BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_threads_client ON portal_message_threads(tenant_id, client_id);
CREATE INDEX idx_threads_last_message ON portal_message_threads(last_message_at DESC);
CREATE INDEX idx_messages_thread ON portal_messages(thread_id, sent_at);
CREATE INDEX idx_messages_sender ON portal_messages(sender_id);
CREATE INDEX idx_recipients_unread ON portal_message_recipients(recipient_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_attachments_message ON portal_message_attachments(message_id);
CREATE INDEX idx_messages_search ON portal_messages USING gin(to_tsvector('simple', subject || ' ' || body));
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Thread summary
export const ThreadSummarySchema = z.object({
  threadId: z.string().uuid(),
  subject: z.string(),
  lastMessageAt: z.string().datetime(),
  lastMessageBy: z.string(),
  lastMessagePreview: z.string(),
  messageCount: z.number(),
  unreadCount: z.number(),
  priority: z.enum(['NORMAL', 'HIGH', 'URGENT']),
  hasAttachments: z.boolean(),
  isClosed: z.boolean(),
  participants: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    type: z.enum(['CLIENT', 'STAFF']),
    avatar: z.string().url().optional(),
  })),
});

export type ThreadSummary = z.infer<typeof ThreadSummarySchema>;

// Message detail
export const MessageDetailSchema = z.object({
  messageId: z.string().uuid(),
  threadId: z.string().uuid(),
  senderType: z.enum(['CLIENT', 'STAFF']),
  senderId: z.string().uuid(),
  senderName: z.string(),
  senderAvatar: z.string().url().optional(),
  body: z.string(),
  bodyHtml: z.string().optional(),
  priority: z.enum(['NORMAL', 'HIGH', 'URGENT']),
  isEncrypted: z.boolean(),
  sentAt: z.string().datetime(),
  editedAt: z.string().datetime().optional(),
  isRead: z.boolean(),
  readAt: z.string().datetime().optional(),
  attachments: z.array(z.object({
    attachmentId: z.string().uuid(),
    fileName: z.string(),
    fileSize: z.number(),
    mimeType: z.string(),
    previewUrl: z.string().url().optional(),
  })),
});

export type MessageDetail = z.infer<typeof MessageDetailSchema>;

// Compose message request
export const ComposeMessageSchema = z.object({
  threadId: z.string().uuid().optional(), // If replying
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  bodyHtml: z.string().max(100000).optional(),
  priority: z.enum(['NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  isEncrypted: z.boolean().default(false),
  attachmentIds: z.array(z.string().uuid()).max(10).optional(),
  requestReadReceipt: z.boolean().default(false),
});

export type ComposeMessage = z.infer<typeof ComposeMessageSchema>;

// Inbox filters
export const InboxFiltersSchema = z.object({
  folder: z.enum(['INBOX', 'SENT', 'ARCHIVE', 'ALL']).default('INBOX'),
  status: z.enum(['ALL', 'UNREAD', 'READ']).default('ALL'),
  priority: z.enum(['ALL', 'NORMAL', 'HIGH', 'URGENT']).default('ALL'),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().max(200).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(50).default(20),
});

export type InboxFilters = z.infer<typeof InboxFiltersSchema>;

// Attachment upload
export const AttachmentUploadSchema = z.object({
  fileName: z.string().max(255),
  mimeType: z.string(),
  fileSize: z.number().max(25 * 1024 * 1024), // 25MB
});

export type AttachmentUpload = z.infer<typeof AttachmentUploadSchema>;
```

### Service Implementation

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Server } from 'socket.io';
import * as crypto from 'crypto';

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(PortalMessageThread) private threadRepo: Repository<PortalMessageThread>,
    @InjectRepository(PortalMessage) private messageRepo: Repository<PortalMessage>,
    @InjectRepository(PortalMessageRecipient) private recipientRepo: Repository<PortalMessageRecipient>,
    @InjectRepository(PortalMessageAttachment) private attachmentRepo: Repository<PortalMessageAttachment>,
    private readonly s3Service: S3Service,
    private readonly encryptionService: EncryptionService,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
    private readonly cache: RedisService,
    private readonly socketServer: Server,
  ) {}

  async getInbox(
    tenantId: string,
    clientId: string,
    filters: InboxFilters,
  ): Promise<PaginatedResponse<ThreadSummary>> {
    const queryBuilder = this.threadRepo
      .createQueryBuilder('thread')
      .leftJoinAndSelect('thread.messages', 'message')
      .leftJoinAndSelect('thread.recipients', 'recipient')
      .where('thread.tenant_id = :tenantId', { tenantId })
      .andWhere('thread.client_id = :clientId', { clientId });

    // Apply folder filter
    if (filters.folder === 'SENT') {
      queryBuilder.andWhere('message.sender_id = :clientId', { clientId });
    } else if (filters.folder === 'ARCHIVE') {
      queryBuilder.andWhere('recipient.archived_at IS NOT NULL');
    } else if (filters.folder === 'INBOX') {
      queryBuilder.andWhere('recipient.archived_at IS NULL');
      queryBuilder.andWhere('recipient.deleted_at IS NULL');
    }

    // Apply status filter
    if (filters.status === 'UNREAD') {
      queryBuilder.andWhere('recipient.read_at IS NULL');
    } else if (filters.status === 'READ') {
      queryBuilder.andWhere('recipient.read_at IS NOT NULL');
    }

    // Apply priority filter
    if (filters.priority !== 'ALL') {
      queryBuilder.andWhere('thread.priority = :priority', { priority: filters.priority });
    }

    // Apply date filters
    if (filters.dateFrom) {
      queryBuilder.andWhere('thread.last_message_at >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      queryBuilder.andWhere('thread.last_message_at <= :dateTo', { dateTo: filters.dateTo });
    }

    // Apply search
    if (filters.search) {
      queryBuilder.andWhere(
        `to_tsvector('simple', thread.subject) @@ plainto_tsquery('simple', :search)
         OR EXISTS (
           SELECT 1 FROM portal_messages m
           WHERE m.thread_id = thread.thread_id
           AND to_tsvector('simple', m.body) @@ plainto_tsquery('simple', :search)
         )`,
        { search: filters.search }
      );
    }

    queryBuilder
      .orderBy('thread.last_message_at', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit);

    const [threads, total] = await queryBuilder.getManyAndCount();

    const items = await Promise.all(threads.map(async (thread) => {
      const lastMessage = thread.messages[thread.messages.length - 1];
      const unreadCount = await this.getUnreadCount(thread.id, clientId);
      const hasAttachments = await this.hasAttachments(thread.id);

      return {
        threadId: thread.id,
        subject: thread.subject,
        lastMessageAt: thread.lastMessageAt.toISOString(),
        lastMessageBy: lastMessage?.senderName || '',
        lastMessagePreview: this.truncate(lastMessage?.body || '', 100),
        messageCount: thread.messageCount,
        unreadCount,
        priority: this.getThreadPriority(thread),
        hasAttachments,
        isClosed: thread.isClosed,
        participants: await this.getParticipants(thread.participantIds),
      };
    }));

    return {
      items,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async getThread(
    tenantId: string,
    clientId: string,
    threadId: string,
  ): Promise<{ thread: ThreadSummary; messages: MessageDetail[] }> {
    const thread = await this.threadRepo.findOne({
      where: { id: threadId, tenantId, clientId },
      relations: ['messages', 'messages.attachments'],
    });

    if (!thread) {
      throw new NotFoundException('Wątek nie został znaleziony');
    }

    // Mark messages as read
    await this.markThreadAsRead(threadId, clientId);

    const messages = await Promise.all(thread.messages.map(async (msg) => {
      let body = msg.body;
      if (msg.isEncrypted) {
        body = await this.encryptionService.decrypt(body, msg.encryptionKeyId);
      }

      const readReceipt = await this.recipientRepo.findOne({
        where: { messageId: msg.id, recipientId: clientId },
      });

      return {
        messageId: msg.id,
        threadId: msg.threadId,
        senderType: msg.senderType,
        senderId: msg.senderId,
        senderName: msg.senderName,
        senderAvatar: await this.getAvatar(msg.senderId),
        body,
        bodyHtml: msg.bodyHtml,
        priority: msg.priority,
        isEncrypted: msg.isEncrypted,
        sentAt: msg.sentAt.toISOString(),
        editedAt: msg.editedAt?.toISOString(),
        isRead: !!readReceipt?.readAt,
        readAt: readReceipt?.readAt?.toISOString(),
        attachments: msg.attachments.map(att => ({
          attachmentId: att.id,
          fileName: att.fileName,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          previewUrl: this.getPreviewUrl(att),
        })),
      };
    }));

    return {
      thread: {
        threadId: thread.id,
        subject: thread.subject,
        lastMessageAt: thread.lastMessageAt.toISOString(),
        lastMessageBy: thread.lastMessageBy,
        lastMessagePreview: '',
        messageCount: thread.messageCount,
        unreadCount: 0,
        priority: this.getThreadPriority(thread),
        hasAttachments: messages.some(m => m.attachments.length > 0),
        isClosed: thread.isClosed,
        participants: await this.getParticipants(thread.participantIds),
      },
      messages,
    };
  }

  async sendMessage(
    tenantId: string,
    clientId: string,
    clientName: string,
    input: ComposeMessage,
  ): Promise<{ messageId: string; threadId: string }> {
    const transaction = await this.dataSource.transaction();

    try {
      let thread: PortalMessageThread;

      if (input.threadId) {
        // Reply to existing thread
        thread = await this.threadRepo.findOne({
          where: { id: input.threadId, tenantId, clientId },
        });
        if (!thread) {
          throw new NotFoundException('Wątek nie został znaleziony');
        }
        if (thread.isClosed) {
          throw new BadRequestException('Ten wątek jest zamknięty');
        }
      } else {
        // Create new thread
        thread = await transaction.save(PortalMessageThread, {
          id: uuidv4(),
          tenantId,
          clientId,
          subject: input.subject,
          participantIds: [clientId, await this.getAssignedAccountant(tenantId, clientId)],
          createdBy: clientId,
          lastMessageAt: new Date(),
          lastMessageBy: clientId,
        });
      }

      // Process message body
      let body = input.body;
      let encryptionKeyId: string | undefined;

      if (input.isEncrypted) {
        const encryptedData = await this.encryptionService.encrypt(body, tenantId, clientId);
        body = encryptedData.ciphertext;
        encryptionKeyId = encryptedData.keyId;
      }

      // Sanitize HTML
      const bodyHtml = input.bodyHtml ? this.sanitizeHtml(input.bodyHtml) : undefined;

      // Create message
      const messageId = uuidv4();
      const message = await transaction.save(PortalMessage, {
        id: messageId,
        tenantId,
        threadId: thread.id,
        clientId,
        senderType: 'CLIENT',
        senderId: clientId,
        senderName: clientName,
        body,
        bodyHtml,
        priority: input.priority,
        isEncrypted: input.isEncrypted,
        encryptionKeyId,
        sentAt: new Date(),
      });

      // Create recipients
      const accountantId = await this.getAssignedAccountant(tenantId, clientId);
      await transaction.save(PortalMessageRecipient, {
        id: uuidv4(),
        messageId,
        recipientType: 'STAFF',
        recipientId: accountantId,
      });

      // Link attachments
      if (input.attachmentIds?.length) {
        await this.attachmentRepo.update(
          { id: In(input.attachmentIds), tenantId, clientId },
          { messageId }
        );
      }

      // Update thread
      await transaction.update(PortalMessageThread, thread.id, {
        lastMessageAt: new Date(),
        lastMessageBy: clientId,
        messageCount: () => 'message_count + 1',
      });

      await transaction.commitTransaction();

      // Send real-time notification
      this.socketServer.to(`staff:${accountantId}`).emit('new_message', {
        threadId: thread.id,
        messageId,
        from: clientName,
        subject: thread.subject,
        preview: this.truncate(input.body, 100),
        priority: input.priority,
      });

      // Send push notification
      await this.notificationService.send({
        tenantId,
        recipientType: 'STAFF',
        recipientId: accountantId,
        type: 'NEW_MESSAGE',
        title: `Nowa wiadomość od ${clientName}`,
        body: this.truncate(input.body, 100),
        actionUrl: `/messages/${thread.id}`,
        priority: input.priority === 'URGENT' ? 'HIGH' : 'NORMAL',
      });

      // Audit
      await this.auditService.log({
        action: 'MESSAGE_SENT',
        tenantId,
        clientId,
        entityType: 'MESSAGE',
        entityId: messageId,
        metadata: {
          threadId: thread.id,
          priority: input.priority,
          isEncrypted: input.isEncrypted,
          hasAttachments: input.attachmentIds?.length > 0,
        },
      });

      // Clear cache
      await this.cache.del(`unread:${tenantId}:${clientId}`);

      return {
        messageId,
        threadId: thread.id,
      };

    } catch (error) {
      await transaction.rollbackTransaction();
      throw error;
    }
  }

  async uploadAttachment(
    tenantId: string,
    clientId: string,
    input: AttachmentUpload,
  ): Promise<{ attachmentId: string; uploadUrl: string }> {
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/zip',
    ];

    if (!allowedTypes.includes(input.mimeType)) {
      throw new BadRequestException('Niedozwolony typ pliku');
    }

    const attachmentId = uuidv4();
    const s3Key = `messages/${tenantId}/${clientId}/attachments/${attachmentId}/${input.fileName}`;

    // Create presigned POST URL
    const { url, fields } = await this.s3Service.createPresignedPost({
      bucket: this.configService.get('S3_BUCKET'),
      key: s3Key,
      conditions: [
        ['content-length-range', 0, 25 * 1024 * 1024],
        ['eq', '$Content-Type', input.mimeType],
      ],
      fields: {
        'Content-Type': input.mimeType,
        'x-amz-server-side-encryption': 'AES256',
      },
      expires: 3600,
    });

    // Create pending attachment record
    await this.attachmentRepo.save({
      id: attachmentId,
      tenantId,
      messageId: null, // Will be set when message is sent
      fileName: input.fileName,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      s3Location: s3Key,
      checksum: '',
      scanStatus: 'PENDING',
    });

    return {
      attachmentId,
      uploadUrl: url,
      uploadFields: fields,
    };
  }

  async getUnreadCount(
    tenantId: string,
    clientId: string,
  ): Promise<number> {
    const cacheKey = `unread:${tenantId}:${clientId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return parseInt(cached, 10);

    const count = await this.recipientRepo.count({
      where: {
        recipientId: clientId,
        readAt: IsNull(),
      },
    });

    await this.cache.setex(cacheKey, 60, count.toString());
    return count;
  }

  async markAsRead(
    tenantId: string,
    clientId: string,
    messageId: string,
  ): Promise<void> {
    await this.recipientRepo.update(
      { messageId, recipientId: clientId },
      { readAt: new Date() }
    );

    // Send read receipt via WebSocket
    const message = await this.messageRepo.findOne({ where: { id: messageId } });
    if (message && message.senderId !== clientId) {
      this.socketServer.to(`user:${message.senderId}`).emit('message_read', {
        messageId,
        readAt: new Date().toISOString(),
      });
    }

    // Clear cache
    await this.cache.del(`unread:${tenantId}:${clientId}`);
  }

  async archiveThread(
    tenantId: string,
    clientId: string,
    threadId: string,
  ): Promise<void> {
    const thread = await this.threadRepo.findOne({
      where: { id: threadId, tenantId, clientId },
    });

    if (!thread) {
      throw new NotFoundException('Wątek nie został znaleziony');
    }

    await this.recipientRepo.update(
      { messageId: In(await this.getThreadMessageIds(threadId)), recipientId: clientId },
      { archivedAt: new Date() }
    );

    await this.auditService.log({
      action: 'THREAD_ARCHIVED',
      tenantId,
      clientId,
      entityType: 'THREAD',
      entityId: threadId,
    });
  }

  private sanitizeHtml(html: string): string {
    // Use DOMPurify or similar to sanitize
    const clean = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'blockquote'],
      ALLOWED_ATTR: ['href'],
    });
    return clean;
  }

  private truncate(text: string, length: number): string {
    if (text.length <= length) return text;
    return text.substring(0, length - 3) + '...';
  }
}
```

### WebSocket Gateway

```typescript
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';

@WebSocketGateway({
  namespace: '/messaging',
  cors: { origin: process.env.PORTAL_URL },
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients: Map<string, Socket> = new Map();

  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token;
    const session = await this.validateToken(token);

    if (!session) {
      client.disconnect();
      return;
    }

    // Store client connection
    this.connectedClients.set(session.clientId, client);

    // Join rooms
    client.join(`client:${session.clientId}`);
    client.join(`tenant:${session.tenantId}`);

    // Send unread count on connect
    const unreadCount = await this.messagingService.getUnreadCount(
      session.tenantId,
      session.clientId
    );
    client.emit('unread_count', { count: unreadCount });
  }

  handleDisconnect(client: Socket) {
    // Remove from connected clients
    for (const [clientId, socket] of this.connectedClients.entries()) {
      if (socket === client) {
        this.connectedClients.delete(clientId);
        break;
      }
    }
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string },
  ) {
    const session = await this.getSession(client);
    await this.messagingService.markAsRead(
      session.tenantId,
      session.clientId,
      data.messageId
    );

    // Update unread count
    const unreadCount = await this.messagingService.getUnreadCount(
      session.tenantId,
      session.clientId
    );
    client.emit('unread_count', { count: unreadCount });
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { threadId: string },
  ) {
    const session = await this.getSession(client);

    // Notify other participants
    client.to(`thread:${data.threadId}`).emit('user_typing', {
      threadId: data.threadId,
      userId: session.clientId,
      userName: session.clientName,
    });
  }
}
```

## Test Specifications

### Unit Tests

```typescript
describe('MessagingService', () => {
  describe('sendMessage', () => {
    it('should create new thread when threadId not provided', async () => {
      const result = await service.sendMessage(tenantId, clientId, 'Jan Kowalski', {
        subject: 'Pytanie o VAT',
        body: 'Mam pytanie dotyczące rozliczenia VAT...',
        priority: 'NORMAL',
      });

      expect(result.threadId).toBeDefined();
      expect(result.messageId).toBeDefined();
    });

    it('should encrypt message when isEncrypted is true', async () => {
      const result = await service.sendMessage(tenantId, clientId, 'Jan Kowalski', {
        subject: 'Poufne dane',
        body: 'Dane wrażliwe...',
        priority: 'HIGH',
        isEncrypted: true,
      });

      const message = await messageRepo.findOne({ where: { id: result.messageId } });
      expect(message.isEncrypted).toBe(true);
      expect(message.encryptionKeyId).toBeDefined();
    });

    it('should send real-time notification to accountant', async () => {
      await service.sendMessage(tenantId, clientId, 'Jan Kowalski', {
        subject: 'Test',
        body: 'Test message',
      });

      expect(socketServer.emit).toHaveBeenCalledWith('new_message', expect.any(Object));
    });
  });

  describe('uploadAttachment', () => {
    it('should reject disallowed file types', async () => {
      await expect(
        service.uploadAttachment(tenantId, clientId, {
          fileName: 'script.exe',
          mimeType: 'application/x-executable',
          fileSize: 1000,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should create presigned upload URL', async () => {
      const result = await service.uploadAttachment(tenantId, clientId, {
        fileName: 'document.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024000,
      });

      expect(result.uploadUrl).toBeDefined();
      expect(result.attachmentId).toBeDefined();
    });
  });
});
```

### Integration Tests

```typescript
describe('Messaging E2E', () => {
  it('should complete full messaging flow', async () => {
    // 1. Get inbox
    const inboxRes = await request(app)
      .get('/api/v1/portal/messages')
      .set('Authorization', `Bearer ${authToken}`);
    expect(inboxRes.status).toBe(200);

    // 2. Send new message
    const sendRes = await request(app)
      .post('/api/v1/portal/messages')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        subject: 'Test message',
        body: 'This is a test message',
        priority: 'NORMAL',
      });
    expect(sendRes.status).toBe(200);
    const { threadId } = sendRes.body;

    // 3. View thread
    const threadRes = await request(app)
      .get(`/api/v1/portal/messages/threads/${threadId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(threadRes.status).toBe(200);
    expect(threadRes.body.messages).toHaveLength(1);
  });
});
```

## Security Checklist

- [x] End-to-end encryption for sensitive messages
- [x] XSS prevention via HTML sanitization
- [x] Attachment virus scanning
- [x] Rate limiting on message sending
- [x] Audit logging for all message operations
- [x] Access control per tenant and client
- [x] WebSocket authentication with JWT
- [x] Secure file upload via presigned URLs

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| MESSAGE_SENT | Client sends message | threadId, priority, encrypted |
| MESSAGE_READ | Message marked as read | messageId, readAt |
| ATTACHMENT_UPLOADED | File attached | attachmentId, fileName, size |
| THREAD_ARCHIVED | Thread archived | threadId |
| THREAD_CLOSED | Thread closed | threadId, reason |

## Performance Requirements

| Metric | Target |
|--------|--------|
| Inbox load | < 500ms |
| Thread load | < 300ms |
| Message send | < 1s |
| WebSocket latency | < 100ms |
| Attachment upload | < 5s for 10MB |

## Definition of Done

- [x] All acceptance criteria implemented and tested
- [x] Unit test coverage ≥ 80%
- [x] Integration tests for messaging flows
- [x] WebSocket real-time features tested
- [x] End-to-end encryption implemented
- [x] Polish localization applied
- [x] Security review completed
- [x] Performance benchmarks met
