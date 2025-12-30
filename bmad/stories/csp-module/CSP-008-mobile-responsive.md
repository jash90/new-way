# Story: CSP-008 - Mobile-Responsive UI

## Story Overview

| Field | Value |
|-------|-------|
| Story ID | CSP-008 |
| Epic | CSP-EPIC (Client Self-Service Portal) |
| Title | Mobile-Responsive UI |
| Priority | P2 |
| Story Points | 6 |
| Sprint | Sprint 3 (Week 31) |
| Status | Draft |
| Dependencies | All CSP stories (CSP-001 through CSP-007) |

## User Story

**As a** portal client using a mobile device,
**I want** the portal to be fully functional and easy to use on my smartphone or tablet,
**So that** I can access my financial information and perform tasks from anywhere, without needing a desktop computer.

## Acceptance Criteria

### AC1: Responsive Layout System

```gherkin
Feature: Responsive Layout Adaptation
  As a mobile user
  I want the portal layout to adapt to my screen size
  So that I can navigate comfortably on any device

  Scenario: Breakpoint-based layout changes
    Given I am viewing the portal on different screen sizes
    Then the layout should adapt according to breakpoints:
      | breakpoint | width | layout changes |
      | xs | 0-599px | Single column, bottom nav, hamburger menu |
      | sm | 600-899px | Single column, side drawer available |
      | md | 900-1199px | Two columns where appropriate |
      | lg | 1200-1535px | Full desktop layout |
      | xl | 1536px+ | Full desktop with extra margins |

  Scenario: Mobile navigation pattern
    Given I am on a mobile device (xs or sm breakpoint)
    When I view the portal
    Then I should see:
      | element | behavior |
      | Bottom navigation | Fixed at bottom with 5 main sections |
      | Hamburger menu | Top-left for additional options |
      | Header | Compact with logo and profile avatar |
      | Content area | Full-width with touch-optimized spacing |

  Scenario: Desktop navigation pattern
    Given I am on a desktop device (md+ breakpoint)
    When I view the portal
    Then I should see:
      | element | behavior |
      | Sidebar | Fixed left sidebar with navigation |
      | Header | Full header with search and notifications |
      | Content area | Centered with max-width constraint |
```

### AC2: Touch-Optimized Interactions

```gherkin
Feature: Touch-Friendly Interface
  As a mobile user
  I want touch-optimized controls
  So that I can easily interact with the portal using my fingers

  Scenario: Touch target sizing
    Given I am using a touch device
    When I interact with clickable elements
    Then all touch targets should be:
      | property | minimum |
      | Height | 44px |
      | Width | 44px |
      | Spacing between targets | 8px |

  Scenario: Gesture support
    Given I am on a mobile device
    When I use common gestures
    Then the portal should respond to:
      | gesture | action |
      | Swipe right | Open navigation drawer |
      | Swipe left | Close navigation drawer |
      | Pull down | Refresh current view |
      | Long press | Show context menu (where applicable) |
      | Pinch | Zoom documents/reports (in viewers) |

  Scenario: Form input optimization
    Given I am filling a form on mobile
    When I focus on an input field
    Then the keyboard should:
      | input type | keyboard type |
      | Email | Email keyboard with @ visible |
      | Phone | Numeric keypad |
      | Amount | Decimal number pad |
      | Search | Search keyboard with go button |
    And the form should scroll to keep the focused input visible
```

### AC3: Mobile Dashboard Optimization

```gherkin
Feature: Mobile Dashboard Experience
  As a mobile user viewing my dashboard
  I want a simplified, focused dashboard view
  So that I can quickly see the most important information

  Scenario: Dashboard card layout on mobile
    Given I am viewing the dashboard on mobile
    When the page loads
    Then I should see:
      | component | mobile behavior |
      | KPI cards | 2x2 grid, swipeable for more |
      | Revenue chart | Full-width, simplified (3 months) |
      | Recent activity | Collapsible list, last 5 items |
      | Tax calendar | Horizontal scroll, urgent first |
      | Tasks | Collapsible section, counts visible |

  Scenario: Chart interaction on mobile
    Given I am viewing a chart on mobile
    When I tap on a data point
    Then I should see a tooltip with full details
    And the tooltip should be positioned to avoid screen edges
    And I can dismiss it by tapping elsewhere

  Scenario: Quick actions on mobile dashboard
    Given I am on the mobile dashboard
    When I look for quick actions
    Then I should see a floating action button (FAB)
    With expandable options for:
      | action | icon |
      | Upload document | upload_file |
      | Send message | message |
      | View reports | assessment |
```

### AC4: Mobile Document Management

```gherkin
Feature: Mobile Document Management
  As a mobile user managing documents
  I want a streamlined document experience
  So that I can upload and view documents easily

  Scenario: Document upload on mobile
    Given I want to upload a document on mobile
    When I tap the upload button
    Then I should see options for:
      | source | description |
      | Camera | Take photo of document |
      | Photo library | Select from gallery |
      | Files | Browse device files |
    And the upload should show progress indicator
    And I can continue using the app during upload

  Scenario: Document list on mobile
    Given I am viewing my documents on mobile
    When the list loads
    Then documents should display as:
      | view option | description |
      | List view | Compact list with icons (default) |
      | Grid view | Thumbnails in 2-column grid |
    And I can switch between views
    And infinite scroll loads more documents

  Scenario: Document preview on mobile
    Given I tap on a document on mobile
    When the document opens
    Then it should open in a full-screen viewer
    With controls for:
      | control | position |
      | Close | Top-left |
      | Download | Top-right |
      | Share | Top-right |
      | Page navigation | Bottom (for multi-page) |
    And I can pinch to zoom
```

### AC5: Mobile Messaging Experience

```gherkin
Feature: Mobile Messaging
  As a mobile user
  I want a chat-like messaging experience
  So that communication feels natural on my phone

  Scenario: Message thread view on mobile
    Given I am viewing messages on mobile
    When I open a thread
    Then I should see:
      | element | behavior |
      | Messages | Full-screen chat-style view |
      | Input | Fixed at bottom with send button |
      | Attachments | Attachment button next to input |
      | Back button | Top-left to return to inbox |

  Scenario: Compose message on mobile
    Given I am composing a message on mobile
    When I type a message
    Then the keyboard should:
      - Not cover the message input
      - Allow easy access to attachments
      - Show send button clearly
    And the message input should expand as I type
    And max height should be 1/3 of screen

  Scenario: Message notifications on mobile
    Given I have the portal open on mobile
    When a new message arrives
    Then I should see:
      - In-app toast notification
      - Badge on messages tab
      - Sound/vibration (if enabled)
```

### AC6: Offline Capabilities

```gherkin
Feature: Offline Support
  As a mobile user with intermittent connectivity
  I want basic offline functionality
  So that I can still access key information without internet

  Scenario: Offline data caching
    Given I have previously loaded the portal
    When I lose internet connection
    Then I should still be able to:
      | feature | capability |
      | Dashboard | View cached KPIs and charts |
      | Documents | Browse list, view cached thumbnails |
      | Messages | Read previously loaded messages |
      | Profile | View profile information |

  Scenario: Offline indicator
    Given I am using the portal without internet
    When the connection is lost
    Then I should see:
      - Offline indicator banner at top
      - Disabled upload/send buttons
      - "Cached" badge on data
    And when connection returns:
      - Banner shows "Back online"
      - Pending actions sync automatically

  Scenario: Pending actions queue
    Given I am offline
    When I try to send a message or upload
    Then the action should be queued
    And I should see "Zostanie wysłane po połączeniu"
    And when online, the queue should process automatically
```

### AC7: Performance on Mobile

```gherkin
Feature: Mobile Performance
  As a mobile user
  I want fast load times and smooth interactions
  So that the portal feels responsive

  Scenario: Initial load performance
    Given I am loading the portal on a 4G connection
    When the page loads
    Then performance should meet:
      | metric | target |
      | First Contentful Paint | < 1.5s |
      | Largest Contentful Paint | < 2.5s |
      | Time to Interactive | < 3.5s |
      | Cumulative Layout Shift | < 0.1 |

  Scenario: Image optimization
    Given I am viewing the portal on mobile
    When images are loaded
    Then they should be:
      | optimization | description |
      | Responsive | Appropriate size for viewport |
      | Lazy loaded | Only load when near viewport |
      | WebP format | Modern format with fallback |
      | Compressed | Quality optimized for mobile |

  Scenario: Data efficiency
    Given I am on a mobile data connection
    When I use the portal
    Then data usage should be minimized by:
      | technique | description |
      | Pagination | 10 items per request on mobile |
      | Compressed API | gzip/brotli compression |
      | Cached assets | Long cache TTL for static assets |
      | Skeleton loaders | Show structure while loading |
```

## Technical Specification

### Responsive Design System

```typescript
// src/theme/breakpoints.ts
export const breakpoints = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536,
};

// src/theme/spacing.ts
export const mobileSpacing = {
  pagePadding: '16px',
  cardPadding: '12px',
  sectionGap: '16px',
  touchTargetMin: '44px',
  touchTargetSpacing: '8px',
};

// src/hooks/useBreakpoint.ts
import { useMediaQuery, useTheme } from '@mui/material';

export const useBreakpoint = () => {
  const theme = useTheme();

  return {
    isMobile: useMediaQuery(theme.breakpoints.down('sm')),
    isTablet: useMediaQuery(theme.breakpoints.between('sm', 'md')),
    isDesktop: useMediaQuery(theme.breakpoints.up('md')),
    isXs: useMediaQuery(theme.breakpoints.only('xs')),
    isSm: useMediaQuery(theme.breakpoints.only('sm')),
    isMd: useMediaQuery(theme.breakpoints.only('md')),
    isLg: useMediaQuery(theme.breakpoints.only('lg')),
    isXl: useMediaQuery(theme.breakpoints.only('xl')),
  };
};
```

### Mobile Navigation Component

```typescript
// src/components/layout/MobileNavigation.tsx
import React from 'react';
import { BottomNavigation, BottomNavigationAction, Badge, Paper } from '@mui/material';
import {
  DashboardOutlined,
  DescriptionOutlined,
  AssessmentOutlined,
  MailOutlined,
  PersonOutlined
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useUnreadCount } from '@/hooks/useUnreadCount';

export const MobileNavigation: React.FC = () => {
  const router = useRouter();
  const { unreadMessages } = useUnreadCount();

  const currentPath = router.pathname;
  const getValue = () => {
    if (currentPath.startsWith('/dashboard')) return 0;
    if (currentPath.startsWith('/documents')) return 1;
    if (currentPath.startsWith('/reports')) return 2;
    if (currentPath.startsWith('/messages')) return 3;
    if (currentPath.startsWith('/profile')) return 4;
    return 0;
  };

  const handleChange = (_: React.SyntheticEvent, newValue: number) => {
    const routes = ['/dashboard', '/documents', '/reports', '/messages', '/profile'];
    router.push(routes[newValue]);
  };

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        // iOS safe area
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      elevation={3}
    >
      <BottomNavigation
        value={getValue()}
        onChange={handleChange}
        showLabels
        sx={{
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            padding: '6px 0',
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.625rem',
            '&.Mui-selected': {
              fontSize: '0.75rem',
            },
          },
        }}
      >
        <BottomNavigationAction
          label="Pulpit"
          icon={<DashboardOutlined />}
        />
        <BottomNavigationAction
          label="Dokumenty"
          icon={<DescriptionOutlined />}
        />
        <BottomNavigationAction
          label="Raporty"
          icon={<AssessmentOutlined />}
        />
        <BottomNavigationAction
          label="Wiadomości"
          icon={
            <Badge badgeContent={unreadMessages} color="error" max={99}>
              <MailOutlined />
            </Badge>
          }
        />
        <BottomNavigationAction
          label="Profil"
          icon={<PersonOutlined />}
        />
      </BottomNavigation>
    </Paper>
  );
};
```

### Touch-Optimized Button Component

```typescript
// src/components/ui/TouchButton.tsx
import React from 'react';
import { Button, ButtonProps, styled } from '@mui/material';

const StyledTouchButton = styled(Button)(({ theme }) => ({
  minHeight: 44,
  minWidth: 44,
  padding: theme.spacing(1.5, 2),

  // Touch feedback
  '&:active': {
    transform: 'scale(0.98)',
  },

  // Ensure tap highlight
  WebkitTapHighlightColor: 'transparent',

  // Touch-friendly text
  [theme.breakpoints.down('sm')]: {
    fontSize: '1rem',
    fontWeight: 500,
  },
}));

export const TouchButton: React.FC<ButtonProps> = (props) => {
  return <StyledTouchButton {...props} />;
};
```

### Pull-to-Refresh Hook

```typescript
// src/hooks/usePullToRefresh.ts
import { useEffect, useRef, useState } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  disabled = false
}: PullToRefreshOptions) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

  useEffect(() => {
    if (disabled) return;

    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (container.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current) return;

      const currentY = e.touches[0].clientY;
      const distance = Math.min(currentY - startY.current, threshold * 1.5);

      if (distance > 0) {
        e.preventDefault();
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
        }
      }
      setPullDistance(0);
      isPulling.current = false;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [disabled, threshold, pullDistance, isRefreshing, onRefresh]);

  return {
    containerRef,
    isRefreshing,
    pullDistance,
    pullProgress: Math.min(pullDistance / threshold, 1),
  };
};
```

### Service Worker for Offline Support

```typescript
// public/sw.js
const CACHE_NAME = 'portal-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/documents',
  '/messages',
  '/profile',
  '/offline.html',
  '/manifest.json',
];

const API_CACHE_NAME = 'portal-api-cache-v1';
const CACHEABLE_API_ROUTES = [
  '/api/portal/dashboard',
  '/api/portal/documents',
  '/api/portal/messages',
  '/api/portal/profile',
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests - stale-while-revalidate
  if (url.pathname.startsWith('/api/')) {
    if (CACHEABLE_API_ROUTES.some(route => url.pathname.startsWith(route))) {
      event.respondWith(
        caches.open(API_CACHE_NAME).then(async (cache) => {
          const cachedResponse = await cache.match(request);

          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        })
      );
      return;
    }
  }

  // Static assets - cache first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).catch(() => {
        // Offline fallback for navigation
        if (request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        throw new Error('Network error');
      });
    })
  );
});

// Background sync for pending actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'pending-messages') {
    event.waitUntil(syncPendingMessages());
  }
  if (event.tag === 'pending-uploads') {
    event.waitUntil(syncPendingUploads());
  }
});

async function syncPendingMessages() {
  const db = await openDB('portal-offline', 1);
  const pendingMessages = await db.getAll('pending-messages');

  for (const message of pendingMessages) {
    try {
      await fetch('/api/portal/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message.data),
      });
      await db.delete('pending-messages', message.id);
    } catch (error) {
      console.error('Failed to sync message:', error);
    }
  }
}
```

### Responsive Dashboard Layout

```typescript
// src/components/dashboard/MobileDashboard.tsx
import React from 'react';
import { Box, Grid, SwipeableDrawer } from '@mui/material';
import { KPICardGrid } from './KPICardGrid';
import { MobileRevenueChart } from './MobileRevenueChart';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { TaxCalendarHorizontal } from './TaxCalendarHorizontal';
import { RecentActivityList } from './RecentActivityList';
import { FloatingActionButton } from '../ui/FloatingActionButton';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useDashboard } from '@/hooks/useDashboard';

export const MobileDashboard: React.FC = () => {
  const { data, refetch, isLoading } = useDashboard();
  const { containerRef, isRefreshing, pullProgress } = usePullToRefresh({
    onRefresh: refetch
  });

  return (
    <Box
      ref={containerRef}
      sx={{
        height: '100%',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
        pb: 10, // Space for bottom nav
      }}
    >
      {/* Pull-to-refresh indicator */}
      <Box
        sx={{
          height: 60 * pullProgress,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {isRefreshing ? (
          <CircularProgress size={24} />
        ) : (
          <ArrowDownwardIcon
            sx={{
              transform: `rotate(${180 * pullProgress}deg)`,
              opacity: pullProgress
            }}
          />
        )}
      </Box>

      <Box sx={{ p: 2 }}>
        {/* KPI Cards - 2x2 grid, swipeable */}
        <KPICardGrid
          kpis={data?.kpis || []}
          columns={2}
          swipeable
        />

        {/* Revenue Chart - simplified for mobile */}
        <Box sx={{ mt: 2 }}>
          <MobileRevenueChart
            data={data?.revenueData}
            months={3} // Show 3 months on mobile
          />
        </Box>

        {/* Tax Calendar - horizontal scroll */}
        <Box sx={{ mt: 2, mx: -2 }}>
          <TaxCalendarHorizontal
            events={data?.taxCalendar || []}
            urgentFirst
          />
        </Box>

        {/* Recent Activity - collapsible */}
        <CollapsibleSection
          title="Ostatnia aktywność"
          defaultExpanded={false}
          sx={{ mt: 2 }}
        >
          <RecentActivityList
            activities={data?.recentActivity?.slice(0, 5) || []}
          />
        </CollapsibleSection>

        {/* Pending Tasks - collapsible with count */}
        <CollapsibleSection
          title="Zadania do wykonania"
          badge={data?.pendingTasks?.length}
          defaultExpanded={false}
          sx={{ mt: 2 }}
        >
          <TaskList tasks={data?.pendingTasks || []} />
        </CollapsibleSection>
      </Box>

      {/* Floating Action Button for quick actions */}
      <FloatingActionButton
        actions={[
          { icon: <UploadFileIcon />, label: 'Prześlij dokument', onClick: handleUpload },
          { icon: <MessageIcon />, label: 'Wyślij wiadomość', onClick: handleMessage },
          { icon: <AssessmentIcon />, label: 'Zobacz raporty', onClick: handleReports },
        ]}
      />
    </Box>
  );
};
```

### Image Optimization Component

```typescript
// src/components/ui/OptimizedImage.tsx
import React from 'react';
import Image from 'next/image';
import { Box, Skeleton } from '@mui/material';
import { useInView } from 'react-intersection-observer';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  objectFit?: 'cover' | 'contain' | 'fill';
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  priority = false,
  objectFit = 'cover',
}) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: '200px',
  });

  const [isLoaded, setIsLoaded] = React.useState(false);

  return (
    <Box
      ref={ref}
      sx={{
        position: 'relative',
        width: width || '100%',
        height: height || 'auto',
        overflow: 'hidden',
      }}
    >
      {!isLoaded && (
        <Skeleton
          variant="rectangular"
          width="100%"
          height="100%"
          animation="wave"
        />
      )}

      {(inView || priority) && (
        <Image
          src={src}
          alt={alt}
          fill={!width || !height}
          width={width}
          height={height}
          style={{ objectFit }}
          priority={priority}
          onLoad={() => setIsLoaded(true)}
          sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      )}
    </Box>
  );
};
```

### PWA Manifest

```json
// public/manifest.json
{
  "name": "Portal Klienta",
  "short_name": "Portal",
  "description": "Portal klienta biura rachunkowego",
  "start_url": "/dashboard",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#ffffff",
  "theme_color": "#1976d2",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/dashboard-mobile.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow"
    },
    {
      "src": "/screenshots/dashboard-desktop.png",
      "sizes": "1920x1080",
      "type": "image/png",
      "form_factor": "wide"
    }
  ],
  "shortcuts": [
    {
      "name": "Prześlij dokument",
      "short_name": "Prześlij",
      "description": "Szybkie przesyłanie dokumentu",
      "url": "/documents/upload",
      "icons": [{ "src": "/icons/upload-96.png", "sizes": "96x96" }]
    },
    {
      "name": "Wiadomości",
      "short_name": "Wiadomości",
      "description": "Sprawdź wiadomości",
      "url": "/messages",
      "icons": [{ "src": "/icons/message-96.png", "sizes": "96x96" }]
    }
  ],
  "categories": ["business", "finance"],
  "lang": "pl",
  "dir": "ltr"
}
```

## Test Specification

### Visual Regression Tests

```typescript
// cypress/e2e/mobile-responsive.cy.ts
describe('Mobile Responsive UI', () => {
  const mobileViewports = [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 12', width: 390, height: 844 },
    { name: 'Samsung Galaxy', width: 412, height: 915 },
    { name: 'iPad Mini', width: 768, height: 1024 },
  ];

  mobileViewports.forEach(({ name, width, height }) => {
    describe(`on ${name} (${width}x${height})`, () => {
      beforeEach(() => {
        cy.viewport(width, height);
        cy.login('client@example.com', 'password');
      });

      it('should display bottom navigation', () => {
        cy.visit('/dashboard');
        cy.get('[data-testid="mobile-nav"]').should('be.visible');
        cy.get('[data-testid="mobile-nav"] button').should('have.length', 5);
      });

      it('should have touch-friendly button sizes', () => {
        cy.visit('/dashboard');
        cy.get('button').each(($btn) => {
          const rect = $btn[0].getBoundingClientRect();
          expect(rect.height).to.be.at.least(44);
        });
      });

      it('should display dashboard in mobile layout', () => {
        cy.visit('/dashboard');
        cy.get('[data-testid="kpi-grid"]').should('have.css', 'grid-template-columns', '1fr 1fr');
      });

      it('should support pull-to-refresh', () => {
        cy.visit('/dashboard');
        cy.get('[data-testid="dashboard-content"]')
          .trigger('touchstart', { touches: [{ clientY: 100 }] })
          .trigger('touchmove', { touches: [{ clientY: 200 }] })
          .trigger('touchend');

        cy.get('[data-testid="refresh-indicator"]').should('be.visible');
      });
    });
  });
});
```

### Performance Tests

```typescript
// cypress/e2e/mobile-performance.cy.ts
describe('Mobile Performance', () => {
  beforeEach(() => {
    cy.viewport('iphone-x');
    // Simulate 4G connection
    cy.intercept('*', (req) => {
      req.on('response', (res) => {
        res.setDelay(100); // Simulate network latency
      });
    });
  });

  it('should load dashboard within performance budget', () => {
    cy.visit('/dashboard', {
      onBeforeLoad: (win) => {
        win.performance.mark('start');
      },
    });

    cy.get('[data-testid="dashboard-content"]').should('be.visible');

    cy.window().then((win) => {
      win.performance.mark('loaded');
      const [entry] = win.performance.getEntriesByName('dashboard-lcp');
      expect(entry.startTime).to.be.lessThan(2500); // LCP < 2.5s
    });
  });

  it('should lazy load images', () => {
    cy.visit('/documents');

    // Images below fold should not be loaded initially
    cy.get('[data-testid="document-thumbnail"]:last').then(($img) => {
      expect($img.attr('src')).to.include('placeholder');
    });

    // Scroll to bottom
    cy.scrollTo('bottom');

    // Now images should load
    cy.get('[data-testid="document-thumbnail"]:last').should('not.have.attr', 'src', /placeholder/);
  });
});
```

### Offline Tests

```typescript
describe('Offline Support', () => {
  it('should show cached data when offline', () => {
    cy.viewport('iphone-x');
    cy.login('client@example.com', 'password');
    cy.visit('/dashboard');

    // Wait for data to cache
    cy.get('[data-testid="kpi-card"]').should('be.visible');

    // Go offline
    cy.window().then((win) => {
      cy.stub(win.navigator, 'onLine').value(false);
      win.dispatchEvent(new Event('offline'));
    });

    // Reload page
    cy.reload();

    // Should show cached data with offline indicator
    cy.get('[data-testid="offline-banner"]').should('be.visible');
    cy.get('[data-testid="kpi-card"]').should('be.visible');
    cy.contains('Cached').should('be.visible');
  });

  it('should queue messages when offline', () => {
    cy.viewport('iphone-x');

    // Go offline
    cy.window().then((win) => {
      cy.stub(win.navigator, 'onLine').value(false);
    });

    cy.visit('/messages/new');
    cy.get('[data-testid="message-input"]').type('Test message');
    cy.get('[data-testid="send-button"]').click();

    cy.contains('Zostanie wysłane po połączeniu').should('be.visible');
  });
});
```

## Security Checklist

- [x] Touch targets meet minimum 44px requirement
- [x] Service worker serves only same-origin content
- [x] Offline cached data respects authentication
- [x] PWA manifest properly configured
- [x] No sensitive data cached offline long-term
- [x] Push notification permissions properly requested

## Accessibility Checklist

- [x] All interactive elements have focus states
- [x] Touch gestures have keyboard/button alternatives
- [x] Screen reader announces navigation changes
- [x] Reduced motion preference respected
- [x] Color contrast meets WCAG 2.1 AA on all viewports
- [x] Orientation changes handled gracefully
- [x] Zoom up to 200% supported without horizontal scroll

## Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint | < 1.5s | Lighthouse |
| Largest Contentful Paint | < 2.5s | Lighthouse |
| Time to Interactive | < 3.5s | Lighthouse |
| Cumulative Layout Shift | < 0.1 | Lighthouse |
| Total Blocking Time | < 300ms | Lighthouse |
| Speed Index | < 3.0s | Lighthouse |
| Bundle Size (mobile) | < 300KB gzipped | Build |

## Browser Support

| Browser | Minimum Version |
|---------|-----------------|
| Chrome (Android) | 90+ |
| Safari (iOS) | 14+ |
| Samsung Internet | 14+ |
| Firefox (Android) | 90+ |
| Edge (Android) | 90+ |

## Definition of Done

- [ ] All acceptance criteria verified on real devices
- [ ] Visual regression tests passing on all target viewports
- [ ] Lighthouse mobile score ≥ 90 for all pages
- [ ] Service worker caching working correctly
- [ ] Offline mode functional with queued actions
- [ ] Touch gestures working across all supported devices
- [ ] Pull-to-refresh implemented on all list views
- [ ] PWA installable on iOS and Android
- [ ] Accessibility audit passed (WCAG 2.1 AA)
- [ ] Cross-browser testing completed
- [ ] Polish translations complete for all mobile-specific text
- [ ] Documentation updated with mobile guidelines
