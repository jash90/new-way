# Story AIM-006: Secure Logout

> **Story ID**: AIM-006
> **Epic**: [AIM-EPIC-001](./epic.md) - Authentication & Identity Management
> **Priority**: P0 (Critical)
> **Points**: 3
> **Status**: 📋 Ready for Development
> **Dependencies**: [AIM-005](./AIM-005-session-management.md)

---

## 📋 User Story

**As an** authenticated user
**I want** to securely log out of my account
**So that** my session is properly terminated and my account is protected

---

## ✅ Acceptance Criteria

### AC1: Standard Logout
```gherkin
Feature: Standard User Logout
  Background:
    Given I am a logged-in user

  Scenario: Successful logout
    Given I am on any page in the application
    When I click the logout button/link
    Then my current session is invalidated
    And my access token is blacklisted
    And my refresh token is revoked
    And the refresh token cookie is cleared
    And I am redirected to the login page
    And I see message "Zostałeś wylogowany pomyślnie"
    And an audit log entry is created

  Scenario: Logout clears local state
    Given I have data cached in local storage
    And I have data in session storage
    When I logout
    Then all authentication-related data is cleared
    And sensitive cached data is removed
    And application state is reset

  Scenario: After logout, accessing protected pages redirects
    Given I have logged out
    When I try to access any protected page directly
    Then I am redirected to the login page
    And I see message "Zaloguj się, aby kontynuować"
```

### AC2: Logout with Unsaved Changes
```gherkin
Feature: Logout with Unsaved Changes Warning
  Background:
    Given I am a logged-in user
    And I have unsaved changes in the current form

  Scenario: Warning shown for unsaved changes
    Given I have modified a form but not saved
    When I click the logout button
    Then I see a warning dialog "Masz niezapisane zmiany"
    And I see options "Wyloguj mimo to" and "Anuluj"

  Scenario: User confirms logout despite unsaved changes
    Given I see the unsaved changes warning
    When I click "Wyloguj mimo to"
    Then I am logged out
    And unsaved changes are discarded
    And I am redirected to login page

  Scenario: User cancels logout to save changes
    Given I see the unsaved changes warning
    When I click "Anuluj"
    Then the dialog closes
    And I remain logged in
    And I can save my changes
```

### AC3: Logout from All Devices
```gherkin
Feature: Logout from All Devices
  Background:
    Given I am logged in on multiple devices

  Scenario: Logout everywhere option
    Given I am on the logout confirmation
    When I select "Wyloguj ze wszystkich urządzeń"
    And I confirm with my password
    Then all my sessions are invalidated
    And all refresh tokens are revoked
    And security notification email is sent
    And I am logged out on current device
    And I see message "Wylogowano ze wszystkich urządzeń"

  Scenario: Other devices receive logout notification
    Given I have chosen to logout from all devices
    When the logout completes
    Then other logged-in devices receive real-time notification
    And they are redirected to login page
    And they see message "Sesja została zakończona na innym urządzeniu"
```

### AC4: Session Expiry Logout
```gherkin
Feature: Automatic Logout on Session Expiry
  Scenario: Automatic logout on token expiry
    Given my session has expired due to inactivity
    When I try to perform any action
    Then I see a modal "Twoja sesja wygasła"
    And the modal has options "Zaloguj ponownie" and "Zamknij"
    And clicking "Zaloguj ponownie" goes to login page
    And clicking "Zamknij" goes to home page

  Scenario: Automatic logout on refresh token expiry
    Given my refresh token has expired (after 7 days)
    When the system tries to refresh my access token
    Then I am automatically logged out
    And I see message "Sesja wygasła. Zaloguj się ponownie."
    And I am redirected to login page
```

### AC5: Error Handling During Logout
```gherkin
Feature: Logout Error Handling
  Scenario: Logout succeeds even if server unreachable
    Given the server is temporarily unreachable
    When I click logout
    Then local session data is cleared
    And I am redirected to login page
    And I see message "Wylogowano lokalnie"

  Scenario: Logout retries on temporary failure
    Given the logout API call fails temporarily
    When I click logout
    Then the system retries the logout request (up to 3 times)
    And if all retries fail, local logout occurs
    And a warning is logged for admin review
```

---

## 🔧 Technical Specification

### API Endpoints

```typescript
// POST /api/v1/auth/logout
// Logout current session
interface LogoutRequest {
  // Access token in Authorization header
  // Refresh token in HTTP-only cookie
  logoutAllDevices?: boolean; // Default: false
  password?: string; // Required if logoutAllDevices = true
}

interface LogoutResponse {
  success: boolean;
  message: string;
  loggedOutDevices?: number; // If logoutAllDevices was used
}

// POST /api/v1/auth/logout/all
// Logout from all devices (requires password)
interface LogoutAllRequest {
  password: string;
}

interface LogoutAllResponse {
  success: boolean;
  message: string;
  revokedSessionsCount: number;
}
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

export const logoutRequestSchema = z.object({
  logoutAllDevices: z.boolean().default(false),
  password: z.string().optional(),
}).refine(
  (data) => !data.logoutAllDevices || data.password,
  {
    message: 'Hasło jest wymagane do wylogowania ze wszystkich urządzeń',
    path: ['password'],
  }
);

export const logoutAllRequestSchema = z.object({
  password: z.string().min(1, 'Hasło jest wymagane'),
});

export const logoutResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  loggedOutDevices: z.number().optional(),
});

export type LogoutRequest = z.infer<typeof logoutRequestSchema>;
export type LogoutAllRequest = z.infer<typeof logoutAllRequestSchema>;
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
```

### Service Implementation

```typescript
// src/modules/auth/services/logout.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { Session, BlacklistedToken } from '../entities';
import { SessionService } from './session.service';
import { PasswordService } from './password.service';
import { AuditService } from '../../audit/audit.service';
import { EmailService } from '../../email/email.service';
import { WebSocketGateway } from '../../websocket/websocket.gateway';
import { AuditEventType } from '../../audit/types';
import { UnauthorizedException } from '../exceptions';

@Injectable()
export class LogoutService {
  private readonly logger = new Logger(LogoutService.name);

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(BlacklistedToken)
    private readonly blacklistRepository: Repository<BlacklistedToken>,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly sessionService: SessionService,
    private readonly passwordService: PasswordService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly wsGateway: WebSocketGateway,
  ) {}

  /**
   * Logout from current session
   */
  async logout(
    userId: string,
    sessionId: string,
    accessToken: string,
    refreshToken: string | null,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ success: boolean; message: string }> {
    const correlationId = crypto.randomUUID();
    this.logger.log('Logout initiated', { userId, sessionId, correlationId });

    try {
      // Get session details for audit
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId, userId },
      });

      // Blacklist access token
      await this.blacklistAccessToken(accessToken, sessionId, userId);

      // Revoke session (handles refresh token blacklisting)
      await this.sessionService.revokeSession(sessionId, userId, 'logout');

      // Clear refresh token cookie will be done by controller

      // Audit log
      await this.auditService.log({
        eventType: AuditEventType.LOGOUT,
        userId,
        sessionId,
        ipAddress,
        userAgent,
        result: 'success',
        metadata: {
          deviceType: session?.deviceType,
          correlationId,
        },
      });

      this.logger.log('Logout successful', { userId, sessionId, correlationId });

      return {
        success: true,
        message: 'Zostałeś wylogowany pomyślnie',
      };
    } catch (error) {
      this.logger.error('Logout failed', { error, userId, sessionId, correlationId });

      // Even if server-side logout fails, we return success
      // because client-side cleanup will happen regardless
      await this.auditService.log({
        eventType: AuditEventType.LOGOUT,
        userId,
        sessionId,
        ipAddress,
        userAgent,
        result: 'partial', // Indicates server-side issue
        metadata: {
          error: error.message,
          correlationId,
        },
      });

      return {
        success: true,
        message: 'Wylogowano lokalnie',
      };
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAllDevices(
    userId: string,
    currentSessionId: string,
    password: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ success: boolean; message: string; revokedSessionsCount: number }> {
    const correlationId = crypto.randomUUID();
    this.logger.log('Logout all devices initiated', { userId, correlationId });

    // Verify password
    const isPasswordValid = await this.passwordService.verifyPassword(userId, password);
    if (!isPasswordValid) {
      await this.auditService.log({
        eventType: AuditEventType.LOGOUT_ALL_FAILED,
        userId,
        sessionId: currentSessionId,
        ipAddress,
        userAgent,
        result: 'failure',
        metadata: {
          reason: 'invalid_password',
          correlationId,
        },
      });

      throw new UnauthorizedException('Nieprawidłowe hasło');
    }

    // Get all active sessions
    const sessions = await this.sessionRepository.find({
      where: { userId, isActive: true },
    });

    const sessionIds = sessions.map(s => s.id);
    let revokedCount = 0;

    // Revoke all sessions
    for (const session of sessions) {
      try {
        await this.sessionService.revokeSession(session.id, userId, 'logout_all');
        revokedCount++;

        // Notify other devices via WebSocket
        if (session.id !== currentSessionId) {
          await this.wsGateway.sendToSession(session.id, {
            type: 'SESSION_REVOKED',
            payload: {
              reason: 'logout_all',
              message: 'Sesja została zakończona na innym urządzeniu',
            },
          });
        }
      } catch (error) {
        this.logger.warn('Failed to revoke session', {
          sessionId: session.id,
          error: error.message,
        });
      }
    }

    // Send security notification email
    await this.emailService.sendSecurityAlert({
      userId,
      type: 'logout_all_devices',
      metadata: {
        revokedCount,
        ipAddress,
        userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    // Audit log
    await this.auditService.log({
      eventType: AuditEventType.LOGOUT_ALL,
      userId,
      sessionId: currentSessionId,
      ipAddress,
      userAgent,
      result: 'success',
      metadata: {
        revokedSessionsCount: revokedCount,
        sessionIds,
        correlationId,
      },
    });

    this.logger.log('Logout all devices successful', {
      userId,
      revokedCount,
      correlationId,
    });

    return {
      success: true,
      message: 'Wylogowano ze wszystkich urządzeń',
      revokedSessionsCount: revokedCount,
    };
  }

  /**
   * Force logout a user (admin action or security response)
   */
  async forceLogout(
    targetUserId: string,
    reason: string,
    performedBy: string,
  ): Promise<number> {
    this.logger.log('Force logout initiated', {
      targetUserId,
      reason,
      performedBy,
    });

    const sessions = await this.sessionRepository.find({
      where: { userId: targetUserId, isActive: true },
    });

    let revokedCount = 0;

    for (const session of sessions) {
      try {
        await this.sessionService.revokeSession(
          session.id,
          targetUserId,
          'admin_force_logout',
          performedBy,
        );
        revokedCount++;

        // Notify via WebSocket
        await this.wsGateway.sendToSession(session.id, {
          type: 'FORCE_LOGOUT',
          payload: {
            reason,
            message: 'Twoje konto zostało wylogowane przez administratora',
          },
        });
      } catch (error) {
        this.logger.warn('Failed to force revoke session', {
          sessionId: session.id,
          error: error.message,
        });
      }
    }

    // Audit log
    await this.auditService.log({
      eventType: AuditEventType.FORCE_LOGOUT,
      userId: performedBy,
      targetUserId,
      result: 'success',
      metadata: {
        revokedSessionsCount: revokedCount,
        reason,
      },
    });

    return revokedCount;
  }

  /**
   * Blacklist access token
   */
  private async blacklistAccessToken(
    accessToken: string,
    sessionId: string,
    userId: string,
  ): Promise<void> {
    const hash = this.hashToken(accessToken);

    // Get token expiry from JWT
    const payload = this.decodeToken(accessToken);
    const expiresAt = new Date(payload.exp * 1000);
    const ttl = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

    // Add to Redis blacklist
    const redisKey = `blacklist:${hash}`;
    await this.redis.setex(redisKey, ttl, '1');

    // Add to database for audit
    await this.blacklistRepository.save({
      tokenHash: hash,
      tokenType: 'access',
      sessionId,
      userId,
      blacklistedReason: 'logout',
      originalExpiresAt: expiresAt,
    });
  }

  private hashToken(token: string): string {
    return require('crypto').createHash('sha256').update(token).digest('hex');
  }

  private decodeToken(token: string): { exp: number; sub: string } {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  }
}
```

### tRPC Router

```typescript
// src/modules/auth/routers/logout.router.ts

import { router, protectedProcedure, publicProcedure } from '@/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { logoutRequestSchema, logoutAllRequestSchema } from '../schemas';

export const logoutRouter = router({
  /**
   * Standard logout
   */
  logout: protectedProcedure
    .input(logoutRequestSchema.optional())
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
      loggedOutDevices: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const accessToken = ctx.req.headers.authorization?.replace('Bearer ', '');
      const refreshToken = ctx.req.cookies['refresh_token'];

      // Standard logout
      if (!input?.logoutAllDevices) {
        const result = await ctx.logoutService.logout(
          ctx.user.id,
          ctx.session.id,
          accessToken || '',
          refreshToken,
          ctx.req.ip,
          ctx.req.headers['user-agent'] || '',
        );

        // Clear refresh token cookie
        ctx.res.clearCookie('refresh_token', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/api/v1/auth',
        });

        return result;
      }

      // Logout all devices
      if (!input.password) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Hasło jest wymagane do wylogowania ze wszystkich urządzeń',
        });
      }

      const result = await ctx.logoutService.logoutAllDevices(
        ctx.user.id,
        ctx.session.id,
        input.password,
        ctx.req.ip,
        ctx.req.headers['user-agent'] || '',
      );

      // Clear refresh token cookie
      ctx.res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/v1/auth',
      });

      return {
        success: result.success,
        message: result.message,
        loggedOutDevices: result.revokedSessionsCount,
      };
    }),

  /**
   * Logout from all devices (dedicated endpoint)
   */
  logoutAll: protectedProcedure
    .input(logoutAllRequestSchema)
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
      revokedSessionsCount: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.logoutService.logoutAllDevices(
        ctx.user.id,
        ctx.session.id,
        input.password,
        ctx.req.ip,
        ctx.req.headers['user-agent'] || '',
      );

      // Clear refresh token cookie
      ctx.res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/v1/auth',
      });

      return result;
    }),
});

export type LogoutRouter = typeof logoutRouter;
```

### Client-Side Logout Hook

```typescript
// src/hooks/useLogout.ts

import { useCallback, useState } from 'react';
import { useRouter } from 'next/router';
import { trpc } from '@/utils/trpc';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import { clearAuthStorage, clearSensitiveCache } from '@/utils/storage';

interface UseLogoutOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface LogoutOptions {
  logoutAllDevices?: boolean;
  password?: string;
  skipConfirmation?: boolean;
}

export function useLogout(options: UseLogoutOptions = {}) {
  const router = useRouter();
  const { clearAuth } = useAuth();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logoutMutation = trpc.auth.logout.logout.useMutation();

  const performLogout = useCallback(async (logoutOptions: LogoutOptions = {}) => {
    setIsLoggingOut(true);

    try {
      // Call server logout
      const result = await logoutMutation.mutateAsync({
        logoutAllDevices: logoutOptions.logoutAllDevices,
        password: logoutOptions.password,
      });

      // Clear local auth state
      clearAuth();

      // Clear sensitive cached data
      clearAuthStorage();
      clearSensitiveCache();

      // Clear any application state
      if (typeof window !== 'undefined') {
        // Clear session storage
        sessionStorage.clear();

        // Clear specific localStorage items (keep preferences)
        const keysToRemove = [
          'access_token',
          'user_data',
          'permissions',
          'cached_clients',
          'cached_documents',
        ];
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }

      // Show success message
      toast({
        title: 'Wylogowano',
        description: result.message,
        variant: 'success',
      });

      // Callback
      options.onSuccess?.();

      // Redirect to login
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);

      // Even on error, clear local state for security
      clearAuth();
      clearAuthStorage();

      toast({
        title: 'Wylogowano lokalnie',
        description: 'Wystąpił błąd podczas wylogowywania z serwera',
        variant: 'warning',
      });

      options.onError?.(error as Error);

      // Still redirect to login
      router.push('/auth/login');
    } finally {
      setIsLoggingOut(false);
    }
  }, [logoutMutation, clearAuth, toast, router, options]);

  const logout = useCallback(async (logoutOptions: LogoutOptions = {}) => {
    // Check for unsaved changes
    if (!logoutOptions.skipConfirmation && hasUnsavedChanges()) {
      const confirmed = await confirmLogout();
      if (!confirmed) {
        return;
      }
    }

    await performLogout(logoutOptions);
  }, [performLogout]);

  return {
    logout,
    isLoggingOut,
    logoutAllDevices: (password: string) => logout({
      logoutAllDevices: true,
      password,
    }),
  };
}

// Helper functions
function hasUnsavedChanges(): boolean {
  // Check for form dirty state
  if (typeof window !== 'undefined') {
    return window.document.querySelector('[data-dirty="true"]') !== null;
  }
  return false;
}

async function confirmLogout(): Promise<boolean> {
  return new Promise((resolve) => {
    // This would typically show a modal - simplified for example
    const confirmed = window.confirm('Masz niezapisane zmiany. Czy na pewno chcesz się wylogować?');
    resolve(confirmed);
  });
}
```

### Logout Button Component

```typescript
// src/components/auth/LogoutButton.tsx

import React, { useState } from 'react';
import { LogOut, Monitor, Smartphone, AlertTriangle } from 'lucide-react';
import { useLogout } from '@/hooks/useLogout';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LogoutButton() {
  const { logout, logoutAllDevices, isLoggingOut } = useLogout();
  const [showLogoutAllDialog, setShowLogoutAllDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogout = async () => {
    await logout();
  };

  const handleLogoutAll = async () => {
    if (!password) {
      setError('Wprowadź hasło');
      return;
    }

    try {
      await logoutAllDevices(password);
      setShowLogoutAllDialog(false);
    } catch (err) {
      setError('Nieprawidłowe hasło');
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={isLoggingOut}>
            <LogOut className="h-4 w-4 mr-2" />
            {isLoggingOut ? 'Wylogowywanie...' : 'Wyloguj'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={handleLogout}>
            <Monitor className="h-4 w-4 mr-2" />
            Wyloguj z tego urządzenia
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowLogoutAllDialog(true)}
            className="text-destructive"
          >
            <Smartphone className="h-4 w-4 mr-2" />
            Wyloguj ze wszystkich urządzeń
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showLogoutAllDialog} onOpenChange={setShowLogoutAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Wyloguj ze wszystkich urządzeń
            </DialogTitle>
            <DialogDescription>
              Ta akcja wyloguje Cię ze wszystkich urządzeń, w tym z tego.
              Wprowadź hasło, aby potwierdzić.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Hasło</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Wprowadź hasło"
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowLogoutAllDialog(false);
                setPassword('');
                setError('');
              }}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={handleLogoutAll}
              disabled={isLoggingOut || !password}
            >
              {isLoggingOut ? 'Wylogowywanie...' : 'Wyloguj wszystkie'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

---

## 🧪 Test Specifications

### Unit Tests

```typescript
// src/modules/auth/services/__tests__/logout.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import { LogoutService } from '../logout.service';
import { Session, BlacklistedToken } from '../../entities';
import { SessionService } from '../session.service';
import { PasswordService } from '../password.service';
import { AuditService } from '../../../audit/audit.service';
import { EmailService } from '../../../email/email.service';
import { WebSocketGateway } from '../../../websocket/websocket.gateway';

describe('LogoutService', () => {
  let service: LogoutService;
  let mockSessionRepository: jest.Mocked<any>;
  let mockBlacklistRepository: jest.Mocked<any>;
  let mockRedis: jest.Mocked<Redis>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockPasswordService: jest.Mocked<PasswordService>;
  let mockAuditService: jest.Mocked<AuditService>;
  let mockEmailService: jest.Mocked<EmailService>;
  let mockWsGateway: jest.Mocked<WebSocketGateway>;

  beforeEach(async () => {
    mockSessionRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    mockBlacklistRepository = {
      save: jest.fn(),
    };

    mockRedis = {
      setex: jest.fn(),
    } as any;

    mockSessionService = {
      revokeSession: jest.fn(),
    } as any;

    mockPasswordService = {
      verifyPassword: jest.fn(),
    } as any;

    mockAuditService = {
      log: jest.fn(),
    } as any;

    mockEmailService = {
      sendSecurityAlert: jest.fn(),
    } as any;

    mockWsGateway = {
      sendToSession: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogoutService,
        { provide: getRepositoryToken(Session), useValue: mockSessionRepository },
        { provide: getRepositoryToken(BlacklistedToken), useValue: mockBlacklistRepository },
        { provide: 'default_IORedisModuleConnectionToken', useValue: mockRedis },
        { provide: SessionService, useValue: mockSessionService },
        { provide: PasswordService, useValue: mockPasswordService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: WebSocketGateway, useValue: mockWsGateway },
      ],
    }).compile();

    service = module.get<LogoutService>(LogoutService);
  });

  describe('logout', () => {
    const validAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImV4cCI6OTk5OTk5OTk5OX0.signature';

    it('should logout successfully', async () => {
      mockSessionRepository.findOne.mockResolvedValue({
        id: 'session-123',
        deviceType: 'desktop',
      });
      mockSessionService.revokeSession.mockResolvedValue(undefined);

      const result = await service.logout(
        'user-123',
        'session-123',
        validAccessToken,
        'refresh-token',
        '192.168.1.1',
        'Chrome/120',
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Zostałeś wylogowany pomyślnie');
      expect(mockSessionService.revokeSession).toHaveBeenCalledWith(
        'session-123',
        'user-123',
        'logout',
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'LOGOUT' }),
      );
    });

    it('should blacklist access token', async () => {
      mockSessionRepository.findOne.mockResolvedValue({ id: 'session-123' });
      mockSessionService.revokeSession.mockResolvedValue(undefined);

      await service.logout(
        'user-123',
        'session-123',
        validAccessToken,
        null,
        '192.168.1.1',
        'Chrome/120',
      );

      expect(mockRedis.setex).toHaveBeenCalled();
      expect(mockBlacklistRepository.save).toHaveBeenCalled();
    });

    it('should return success even on server error', async () => {
      mockSessionService.revokeSession.mockRejectedValue(new Error('Server error'));

      const result = await service.logout(
        'user-123',
        'session-123',
        validAccessToken,
        null,
        '192.168.1.1',
        'Chrome/120',
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Wylogowano lokalnie');
    });
  });

  describe('logoutAllDevices', () => {
    it('should logout from all devices with valid password', async () => {
      mockPasswordService.verifyPassword.mockResolvedValue(true);
      mockSessionRepository.find.mockResolvedValue([
        { id: 'session-1', userId: 'user-123', isActive: true },
        { id: 'session-2', userId: 'user-123', isActive: true },
        { id: 'session-3', userId: 'user-123', isActive: true },
      ]);
      mockSessionService.revokeSession.mockResolvedValue(undefined);

      const result = await service.logoutAllDevices(
        'user-123',
        'session-1',
        'correct-password',
        '192.168.1.1',
        'Chrome/120',
      );

      expect(result.success).toBe(true);
      expect(result.revokedSessionsCount).toBe(3);
      expect(mockEmailService.sendSecurityAlert).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'LOGOUT_ALL' }),
      );
    });

    it('should reject with invalid password', async () => {
      mockPasswordService.verifyPassword.mockResolvedValue(false);

      await expect(
        service.logoutAllDevices(
          'user-123',
          'session-1',
          'wrong-password',
          '192.168.1.1',
          'Chrome/120',
        ),
      ).rejects.toThrow('Nieprawidłowe hasło');

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'LOGOUT_ALL_FAILED' }),
      );
    });

    it('should notify other devices via WebSocket', async () => {
      mockPasswordService.verifyPassword.mockResolvedValue(true);
      mockSessionRepository.find.mockResolvedValue([
        { id: 'current-session', userId: 'user-123', isActive: true },
        { id: 'other-session', userId: 'user-123', isActive: true },
      ]);
      mockSessionService.revokeSession.mockResolvedValue(undefined);

      await service.logoutAllDevices(
        'user-123',
        'current-session',
        'password',
        '192.168.1.1',
        'Chrome/120',
      );

      expect(mockWsGateway.sendToSession).toHaveBeenCalledWith(
        'other-session',
        expect.objectContaining({ type: 'SESSION_REVOKED' }),
      );
      // Should not notify current session
      expect(mockWsGateway.sendToSession).not.toHaveBeenCalledWith(
        'current-session',
        expect.anything(),
      );
    });
  });

  describe('forceLogout', () => {
    it('should force logout user by admin', async () => {
      mockSessionRepository.find.mockResolvedValue([
        { id: 'session-1', userId: 'target-user', isActive: true },
      ]);
      mockSessionService.revokeSession.mockResolvedValue(undefined);

      const revokedCount = await service.forceLogout(
        'target-user',
        'Security violation',
        'admin-user',
      );

      expect(revokedCount).toBe(1);
      expect(mockSessionService.revokeSession).toHaveBeenCalledWith(
        'session-1',
        'target-user',
        'admin_force_logout',
        'admin-user',
      );
      expect(mockWsGateway.sendToSession).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({ type: 'FORCE_LOGOUT' }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'FORCE_LOGOUT' }),
      );
    });
  });
});
```

### Integration Tests

```typescript
// src/modules/auth/__tests__/logout.integration.spec.ts

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, TestApp } from '@test/utils/test-app';
import { createTestUser, getAuthTokens } from '@test/utils/auth-helpers';

describe('Logout Integration', () => {
  let app: TestApp;
  let testUser: { id: string; email: string; password: string };
  let authTokens: { accessToken: string; refreshToken: string };

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  beforeEach(async () => {
    testUser = await createTestUser(app.db);
    authTokens = await getAuthTokens(app, testUser.email, testUser.password);
  });

  describe('Standard Logout', () => {
    it('should logout successfully', async () => {
      const response = await app.trpc.auth.logout.logout.mutate(undefined, {
        headers: { authorization: `Bearer ${authTokens.accessToken}` },
        context: { cookies: { refresh_token: authTokens.refreshToken } },
      });

      expect(response.success).toBe(true);
      expect(response.message).toBe('Zostałeś wylogowany pomyślnie');
    });

    it('should invalidate access token after logout', async () => {
      await app.trpc.auth.logout.logout.mutate(undefined, {
        headers: { authorization: `Bearer ${authTokens.accessToken}` },
      });

      // Try to use the token again
      await expect(
        app.trpc.auth.session.list.query(undefined, {
          headers: { authorization: `Bearer ${authTokens.accessToken}` },
        }),
      ).rejects.toThrow();
    });

    it('should invalidate refresh token after logout', async () => {
      await app.trpc.auth.logout.logout.mutate(undefined, {
        headers: { authorization: `Bearer ${authTokens.accessToken}` },
        context: { cookies: { refresh_token: authTokens.refreshToken } },
      });

      // Try to refresh
      await expect(
        app.trpc.auth.session.refresh.mutate(undefined, {
          context: { cookies: { refresh_token: authTokens.refreshToken } },
        }),
      ).rejects.toThrow();
    });
  });

  describe('Logout All Devices', () => {
    it('should logout from all devices with valid password', async () => {
      // Create multiple sessions
      await getAuthTokens(app, testUser.email, testUser.password);
      await getAuthTokens(app, testUser.email, testUser.password);

      const response = await app.trpc.auth.logout.logoutAll.mutate(
        { password: testUser.password },
        { headers: { authorization: `Bearer ${authTokens.accessToken}` } },
      );

      expect(response.success).toBe(true);
      expect(response.revokedSessionsCount).toBe(3);
    });

    it('should reject logout all with wrong password', async () => {
      await expect(
        app.trpc.auth.logout.logoutAll.mutate(
          { password: 'wrong-password' },
          { headers: { authorization: `Bearer ${authTokens.accessToken}` } },
        ),
      ).rejects.toThrow('Nieprawidłowe hasło');
    });

    it('should send security alert email', async () => {
      await app.trpc.auth.logout.logoutAll.mutate(
        { password: testUser.password },
        { headers: { authorization: `Bearer ${authTokens.accessToken}` } },
      );

      // Check email was sent (mock verification)
      const sentEmails = await app.emailService.getSentEmails();
      expect(sentEmails).toContainEqual(
        expect.objectContaining({
          to: testUser.email,
          subject: expect.stringContaining('Wylogowano ze wszystkich urządzeń'),
        }),
      );
    });
  });
});
```

### E2E Tests

```typescript
// e2e/logout.spec.ts

import { test, expect } from '@playwright/test';
import { createTestUser, loginAs } from './helpers/auth';

test.describe('Logout', () => {
  let testUser: { email: string; password: string };

  test.beforeEach(async () => {
    testUser = await createTestUser();
  });

  test('user can logout successfully', async ({ page }) => {
    await loginAs(page, testUser.email, testUser.password);

    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.locator('text=Zostałeś wylogowany pomyślnie')).toBeVisible();
  });

  test('logout clears local storage', async ({ page }) => {
    await loginAs(page, testUser.email, testUser.password);

    // Verify data exists before logout
    const hasTokenBefore = await page.evaluate(() => {
      return localStorage.getItem('access_token') !== null;
    });
    expect(hasTokenBefore).toBe(true);

    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');

    // Verify data cleared after logout
    const hasTokenAfter = await page.evaluate(() => {
      return localStorage.getItem('access_token') !== null;
    });
    expect(hasTokenAfter).toBe(false);
  });

  test('unsaved changes warning shown', async ({ page }) => {
    await loginAs(page, testUser.email, testUser.password);

    // Navigate to a form and make changes
    await page.goto('/clients/new');
    await page.fill('[data-testid="client-name-input"]', 'Test Company');

    // Try to logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');

    // Should show warning
    await expect(page.locator('text=Masz niezapisane zmiany')).toBeVisible();

    // Cancel logout
    await page.click('text=Anuluj');
    await expect(page).not.toHaveURL(/\/auth\/login/);
  });

  test('can logout from all devices', async ({ browser }) => {
    // Login from two contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await loginAs(page1, testUser.email, testUser.password);
    await loginAs(page2, testUser.email, testUser.password);

    // Logout all from page1
    await page1.click('[data-testid="user-menu"]');
    await page1.click('[data-testid="logout-menu-trigger"]');
    await page1.click('text=Wyloguj ze wszystkich urządzeń');

    // Enter password
    await page1.fill('[data-testid="password-input"]', testUser.password);
    await page1.click('[data-testid="confirm-logout-all"]');

    // Verify page1 is logged out
    await expect(page1).toHaveURL(/\/auth\/login/);

    // Verify page2 is also logged out
    await page2.reload();
    await expect(page2).toHaveURL(/\/auth\/login/);
  });

  test('protected pages redirect after logout', async ({ page }) => {
    await loginAs(page, testUser.email, testUser.password);
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');

    // Try to access protected page directly
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.locator('text=Zaloguj się, aby kontynuować')).toBeVisible();
  });
});
```

---

## 🔒 Security Checklist

| Requirement | Implementation | Status |
|------------|----------------|--------|
| Access token blacklisted on logout | Token hash added to Redis and DB | ✅ |
| Refresh token revoked | Session and token invalidated | ✅ |
| Cookie cleared | HTTP-only cookie removed | ✅ |
| Client state cleared | localStorage and sessionStorage cleaned | ✅ |
| Audit logging | All logout events logged | ✅ |
| Password required for logout all | Verification before bulk revocation | ✅ |
| WebSocket notification | Other devices notified in real-time | ✅ |
| Security email for logout all | User notified of bulk logout | ✅ |
| Graceful error handling | Local logout even on server failure | ✅ |

---

## 📊 Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `LOGOUT` | Standard logout | userId, sessionId, deviceType |
| `LOGOUT_ALL` | Logout from all devices | userId, revokedCount, sessionIds |
| `LOGOUT_ALL_FAILED` | Invalid password for logout all | userId, reason |
| `FORCE_LOGOUT` | Admin forced logout | targetUserId, performedBy, reason |

---

## 📝 Implementation Notes

1. **Graceful Degradation**: Logout always succeeds from client perspective, even if server fails
2. **Token Blacklisting**: Both access and refresh tokens are blacklisted to prevent reuse
3. **WebSocket Integration**: Real-time notification to other sessions for immediate UI update
4. **Unsaved Changes**: Client-side detection of dirty forms before logout
5. **Retry Logic**: Server-side logout retries up to 3 times on temporary failures

---

*Story last updated: December 2024*
