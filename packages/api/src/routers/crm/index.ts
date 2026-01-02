import { router } from '../../trpc';
import { clientRouter } from './client.router';
import { vatRouter } from './vat.router';
import { contactRouter } from './contact.router';
import { timelineRouter } from './timeline.router';
import { customFieldsRouter } from './customFields.router';
import { taggingRouter } from './tagging.router';
import { searchRouter } from './search.router';
import { riskRouter } from './risk.router';
import { bulkRouter } from './bulk.router';
import { statisticsRouter } from './statistics.router';
import { portalRouter } from './portal.router';

/**
 * CRM (Customer Relationship Management) Router
 * Combines all CRM-related routes
 */
export const crmRouter = router({
  client: clientRouter,     // CRM-001: Client Profile Management
  // CRM-002: Company Data Enrichment - integrated into client.router
  vat: vatRouter,           // CRM-003: VAT/VIES Validation
  contact: contactRouter,   // CRM-004: Contact Management
  timeline: timelineRouter, // CRM-005: Client Timeline
  customFields: customFieldsRouter, // CRM-006: Custom Fields System
  tagging: taggingRouter,   // CRM-007: Tagging System
  search: searchRouter,     // CRM-008: Advanced Search
  risk: riskRouter,         // CRM-009: AI Risk Assessment
  bulk: bulkRouter,         // CRM-010: Bulk Operations
  statistics: statisticsRouter, // CRM-011: Client Statistics
  portal: portalRouter,     // CRM-012: Portal Access Management
});

export type CrmRouter = typeof crmRouter;
