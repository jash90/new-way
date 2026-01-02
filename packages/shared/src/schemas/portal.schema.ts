import { z } from 'zod';

// ===========================================================================
// PORTAL ACCESS STATUS
// ===========================================================================

export const portalAccessStatusSchema = z.enum([
  'active',
  'pending',
  'suspended',
  'revoked',
]);

export type PortalAccessStatus = z.infer<typeof portalAccessStatusSchema>;

// ===========================================================================
// PORTAL PERMISSION
// ===========================================================================

export const portalPermissionSchema = z.enum([
  'view_profile',
  'edit_profile',
  'view_documents',
  'upload_documents',
  'view_invoices',
  'view_timeline',
  'add_notes',
  'view_contacts',
  'manage_contacts',
]);

export type PortalPermission = z.infer<typeof portalPermissionSchema>;

// ===========================================================================
// CREATE PORTAL ACCESS
// ===========================================================================

export const createPortalAccessSchema = z.object({
  clientId: z.string().uuid(),
  email: z.string().email(),
  permissions: z.array(portalPermissionSchema).min(1),
  expiresAt: z.coerce.date().optional(),
  sendInvitation: z.boolean().default(true),
  customMessage: z.string().max(500).optional(),
});

export type CreatePortalAccessInput = z.infer<typeof createPortalAccessSchema>;

export interface PortalAccess {
  id: string;
  clientId: string;
  email: string;
  status: PortalAccessStatus;
  permissions: PortalPermission[];
  invitedAt: Date;
  activatedAt: Date | null;
  lastAccessAt: Date | null;
  expiresAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================================================
// GET PORTAL ACCESS
// ===========================================================================

export const getPortalAccessSchema = z.object({
  id: z.string().uuid(),
});

export type GetPortalAccessInput = z.infer<typeof getPortalAccessSchema>;

// ===========================================================================
// LIST PORTAL ACCESS
// ===========================================================================

export const listPortalAccessSchema = z.object({
  clientId: z.string().uuid().optional(),
  status: portalAccessStatusSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListPortalAccessInput = z.infer<typeof listPortalAccessSchema>;

export interface ListPortalAccessResult {
  items: PortalAccess[];
  total: number;
  limit: number;
  offset: number;
}

// ===========================================================================
// UPDATE PORTAL ACCESS
// ===========================================================================

export const updatePortalAccessSchema = z.object({
  id: z.string().uuid(),
  permissions: z.array(portalPermissionSchema).min(1).optional(),
  status: portalAccessStatusSchema.optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});

export type UpdatePortalAccessInput = z.infer<typeof updatePortalAccessSchema>;

// ===========================================================================
// REVOKE PORTAL ACCESS
// ===========================================================================

export const revokePortalAccessSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().max(500).optional(),
  notifyUser: z.boolean().default(true),
});

export type RevokePortalAccessInput = z.infer<typeof revokePortalAccessSchema>;

export interface RevokePortalAccessResult {
  revoked: boolean;
  revokedAt: Date;
  message: string;
}

// ===========================================================================
// RESEND INVITATION
// ===========================================================================

export const resendInvitationSchema = z.object({
  id: z.string().uuid(),
  customMessage: z.string().max(500).optional(),
});

export type ResendInvitationInput = z.infer<typeof resendInvitationSchema>;

export interface ResendInvitationResult {
  sent: boolean;
  sentAt: Date;
  message: string;
}

// ===========================================================================
// GET PORTAL ACCESS BY CLIENT
// ===========================================================================

export const getClientPortalAccessSchema = z.object({
  clientId: z.string().uuid(),
});

export type GetClientPortalAccessInput = z.infer<typeof getClientPortalAccessSchema>;

// ===========================================================================
// BULK OPERATIONS
// ===========================================================================

export const bulkRevokePortalAccessSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  reason: z.string().max(500).optional(),
  notifyUsers: z.boolean().default(true),
});

export type BulkRevokePortalAccessInput = z.infer<typeof bulkRevokePortalAccessSchema>;

export interface BulkRevokeResult {
  revoked: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export const bulkUpdatePermissionsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  permissions: z.array(portalPermissionSchema).min(1),
  operation: z.enum(['add', 'remove', 'replace']),
});

export type BulkUpdatePermissionsInput = z.infer<typeof bulkUpdatePermissionsSchema>;

export interface BulkUpdatePermissionsResult {
  updated: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

// ===========================================================================
// PORTAL ACCESS STATISTICS
// ===========================================================================

export const getPortalStatisticsSchema = z.object({
  clientId: z.string().uuid().optional(),
});

export type GetPortalStatisticsInput = z.infer<typeof getPortalStatisticsSchema>;

export interface PortalStatistics {
  totalAccess: number;
  byStatus: {
    active: number;
    pending: number;
    suspended: number;
    revoked: number;
  };
  recentActivity: number; // Users active in last 7 days
  expiringThisWeek: number;
  averagePermissions: number;
}

// ===========================================================================
// PORTAL ACTIVITY LOG
// ===========================================================================

export const getPortalActivitySchema = z.object({
  portalAccessId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type GetPortalActivityInput = z.infer<typeof getPortalActivitySchema>;

export interface PortalActivityItem {
  id: string;
  portalAccessId: string;
  action: string;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Date;
}

export interface PortalActivityResult {
  items: PortalActivityItem[];
  total: number;
  limit: number;
  offset: number;
}

// ===========================================================================
// VALIDATE PORTAL TOKEN
// ===========================================================================

export const validatePortalTokenSchema = z.object({
  token: z.string().min(1),
});

export type ValidatePortalTokenInput = z.infer<typeof validatePortalTokenSchema>;

export interface ValidatePortalTokenResult {
  valid: boolean;
  portalAccess: PortalAccess | null;
  error?: string;
}

// ===========================================================================
// ACTIVATE PORTAL ACCESS
// ===========================================================================

export const activatePortalAccessSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export type ActivatePortalAccessInput = z.infer<typeof activatePortalAccessSchema>;

export interface ActivatePortalAccessResult {
  activated: boolean;
  portalAccessId: string;
  message: string;
}
