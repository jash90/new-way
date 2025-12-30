# Epic: Monitoring & Analytics Module (MON)

## Epic Overview

| Field | Value |
|-------|-------|
| Epic ID | MON-EPIC |
| Module | Monitoring & Analytics |
| Priority | P3 |
| Total Story Points | 35 |
| Estimated Duration | 2 weeks |
| Dependencies | AIM, All application modules |

## Business Context

### Problem Statement
Modern accounting platforms require comprehensive observability to ensure system reliability, track performance, and provide insights for business decisions. Without proper monitoring, issues go undetected until they impact users, performance degradations are difficult to diagnose, and business metrics lack visibility.

### Solution
A centralized monitoring and analytics hub providing real-time system health tracking, comprehensive metrics collection, error tracking with alerting, performance monitoring (APM), and automated report generation for stakeholders.

### Business Value
- **99.9% uptime** through proactive monitoring and alerting
- **50% faster incident resolution** with detailed error context and traces
- **Real-time visibility** into system performance and business KPIs
- **Automated reporting** reducing manual effort by 80%
- **Compliance support** with audit trails and retention policies

## Technical Foundation

### Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| Backend | NestJS + TypeScript | Event-driven architecture, DI support |
| Time-Series DB | InfluxDB / TimescaleDB | Optimized for metrics storage |
| Analytics DB | PostgreSQL + ClickHouse | High-volume event analytics |
| Cache Layer | Redis 7 | Real-time metrics aggregation |
| Message Queue | BullMQ / Kafka | Reliable event streaming |
| Visualization | Grafana + Custom dashboards | Real-time visualization |
| Log Aggregation | Structured JSON logging | Centralized log analysis |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  Monitoring & Analytics Module                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │   Event     │  │    Metrics   │  │        Error            │ │
│  │  Tracking   │  │  Collection  │  │       Tracking          │ │
│  └──────┬──────┘  └──────┬───────┘  └───────────┬─────────────┘ │
│         │                │                       │               │
│  ┌──────┴──────┐  ┌──────┴───────┐  ┌───────────┴─────────────┐ │
│  │   Report    │  │    Alert     │  │      Performance        │ │
│  │ Generation  │  │   Manager    │  │       Monitoring        │ │
│  └──────┬──────┘  └──────┬───────┘  └───────────┬─────────────┘ │
├─────────┴────────────────┴───────────────────────┴───────────────┤
│                         API Gateway                               │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │   AIM    │ │   CRM    │ │   ACC    │ │   TAX    │ │  etc.  │ │
│  │ (Source) │ │ (Source) │ │ (Source) │ │ (Source) │ │(Source)│ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘ │
├──────────────────────────────────────────────────────────────────┤
│  PostgreSQL  │  InfluxDB/TimescaleDB  │  Redis  │  BullMQ       │
└──────────────────────────────────────────────────────────────────┘
```

### Core Database Tables

```sql
-- Analytics events
CREATE TABLE analytics_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type VARCHAR(50) NOT NULL,
  category VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  label VARCHAR(255),
  value NUMERIC,
  user_id UUID,
  session_id VARCHAR(64),
  properties JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metrics storage
CREATE TABLE metrics (
  metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  metric_name VARCHAR(255) NOT NULL,
  metric_value DOUBLE PRECISION NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  tags JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL,
  unit VARCHAR(50),
  aggregation_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Error tracking
CREATE TABLE error_events (
  error_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  error_hash VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  error_name VARCHAR(255),
  severity VARCHAR(20) NOT NULL,
  context JSONB DEFAULT '{}',
  user_id UUID,
  session_id VARCHAR(64),
  request_id VARCHAR(64),
  occurrences INTEGER DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'OPEN',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  affected_users INTEGER DEFAULT 0,
  tags JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert rules
CREATE TABLE alert_rules (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rule_type VARCHAR(50) NOT NULL,
  condition JSONB NOT NULL,
  threshold_value DOUBLE PRECISION,
  threshold_operator VARCHAR(20),
  time_window_minutes INTEGER,
  severity VARCHAR(20) NOT NULL,
  notification_channels JSONB DEFAULT '[]',
  cooldown_minutes INTEGER DEFAULT 5,
  enabled BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert history
CREATE TABLE alert_history (
  alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  rule_id UUID NOT NULL REFERENCES alert_rules(rule_id),
  triggered_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id),
  severity VARCHAR(20) NOT NULL,
  message TEXT,
  context JSONB DEFAULT '{}',
  notification_sent BOOLEAN DEFAULT false,
  notification_results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports
CREATE TABLE monitoring_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  report_type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  generated_at TIMESTAMPTZ NOT NULL,
  generated_by UUID NOT NULL REFERENCES users(id),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  data JSONB NOT NULL,
  format VARCHAR(20) NOT NULL,
  file_path VARCHAR(500),
  file_size BIGINT,
  metadata JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'COMPLETED',
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report schedules
CREATE TABLE report_schedules (
  schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  report_type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  schedule_expression VARCHAR(255) NOT NULL,
  parameters JSONB NOT NULL,
  recipients JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service health
CREATE TABLE service_health (
  health_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  service_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  response_time_ms INTEGER,
  cpu_usage FLOAT,
  memory_usage FLOAT,
  disk_usage FLOAT,
  active_connections INTEGER,
  error_rate FLOAT,
  dependencies JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  checked_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_events_tenant_timestamp ON analytics_events(tenant_id, timestamp DESC);
CREATE INDEX idx_events_user_action ON analytics_events(tenant_id, user_id, action);
CREATE INDEX idx_events_type_category ON analytics_events(tenant_id, event_type, category);

CREATE INDEX idx_metrics_name_timestamp ON metrics(metric_name, timestamp DESC);
CREATE INDEX idx_metrics_tenant_timestamp ON metrics(tenant_id, timestamp DESC);
CREATE INDEX idx_metrics_tags ON metrics USING GIN(tags);

CREATE INDEX idx_errors_hash ON error_events(error_hash);
CREATE INDEX idx_errors_status_severity ON error_events(tenant_id, status, severity);
CREATE INDEX idx_errors_last_seen ON error_events(tenant_id, last_seen DESC);

CREATE INDEX idx_alert_rules_enabled ON alert_rules(tenant_id, enabled) WHERE enabled = true;
CREATE INDEX idx_alert_history_rule_triggered ON alert_history(rule_id, triggered_at DESC);

CREATE INDEX idx_service_health_checked ON service_health(tenant_id, service_name, checked_at DESC);
```

## Story Map

### Sprint 1: Core Monitoring (Week 32)

| Story ID | Story Name | Points | Priority | Dependencies |
|----------|------------|--------|----------|--------------|
| MON-001 | Event Tracking & Analytics | 8 | P0 | AIM |
| MON-002 | Metrics Collection & Aggregation | 8 | P0 | - |

### Sprint 2: Alerting & Reporting (Week 33)

| Story ID | Story Name | Points | Priority | Dependencies |
|----------|------------|--------|----------|--------------|
| MON-003 | Error Tracking & Exception Capture | 6 | P1 | MON-001 |
| MON-004 | Real-Time Dashboards & Health Monitoring | 5 | P1 | MON-002 |
| MON-005 | Alerting System | 5 | P1 | MON-002, MON-003 |
| MON-006 | Report Generation & Scheduling | 3 | P2 | MON-001, MON-002 |

## Story Dependency Graph

```
                    ┌─────────────────┐
                    │    AIM Auth     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌──────────┐   ┌──────────┐   ┌──────────┐
       │ MON-001  │   │ MON-002  │   │ MON-003  │
       │  Events  │   │ Metrics  │   │  Errors  │
       └────┬─────┘   └────┬─────┘   └────┬─────┘
            │              │              │
            │    ┌─────────┼──────────────┘
            │    │         │
            ▼    ▼         ▼
       ┌──────────┐   ┌──────────┐
       │ MON-006  │   │ MON-005  │
       │ Reports  │   │ Alerting │
       └────┬─────┘   └────┬─────┘
            │              │
            └──────┬───────┘
                   ▼
            ┌──────────┐
            │ MON-004  │
            │Dashboards│
            └──────────┘
```

## User Personas

### Primary: System Administrator
- **Needs**: Real-time system health, alert management, performance insights
- **Pain Points**: Late incident detection, manual log searching, unclear root causes
- **Goals**: Proactive monitoring, fast incident response, system stability

### Secondary: Business Manager
- **Needs**: Business KPIs, usage analytics, trend reports
- **Pain Points**: Lack of visibility into platform usage, manual reporting
- **Goals**: Data-driven decisions, automated insights

### Tertiary: Developer
- **Needs**: Error tracking, performance profiling, debugging tools
- **Pain Points**: Difficulty reproducing issues, missing context
- **Goals**: Quick bug resolution, performance optimization

## Acceptance Criteria Summary

### Functional Requirements

1. **Event Tracking**
   - Track user actions, system events, business events
   - Batch event processing for high throughput
   - Event filtering and querying
   - Custom event properties support

2. **Metrics Collection**
   - Counter, gauge, histogram, summary metric types
   - Tag-based metrics organization
   - Configurable aggregation windows
   - Real-time metric streaming

3. **Error Tracking**
   - Automatic exception capture with context
   - Error grouping by stack trace hash
   - Affected users tracking
   - Resolution workflow

4. **Alerting**
   - Threshold-based and anomaly-based alerts
   - Multiple notification channels
   - Alert cooldown and escalation
   - On-call schedule integration

5. **Reporting**
   - Performance, analytics, error summary reports
   - PDF, Excel, CSV export formats
   - Scheduled report delivery
   - Custom report templates

### Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Event Ingestion Rate | 10,000 events/second |
| Metrics Query Response | < 500ms (P95) |
| Alert Latency | < 60 seconds |
| Data Retention (events) | 90 days |
| Data Retention (metrics) | 365 days |
| Uptime | 99.9% |

### Security Requirements

- Tenant isolation at all levels
- PII masking in logs and events
- Audit trail for all configuration changes
- Role-based access to monitoring data
- Encrypted storage for sensitive metrics

## API Design

### tRPC Router Structure

```typescript
export const monitoringRouter = router({
  events: eventRouter,
  metrics: metricsRouter,
  errors: errorRouter,
  alerts: alertRouter,
  reports: reportRouter,
  health: healthRouter,
});

// Admin-scoped procedures
const adminProcedure = protectedProcedure
  .use(tenantMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.user.roles.includes('ADMIN')) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next({ ctx });
  });
```

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/monitoring/events` | POST | Track analytics event |
| `/monitoring/events/batch` | POST | Batch track events |
| `/monitoring/events` | GET | Query events |
| `/monitoring/metrics` | POST | Record metric |
| `/monitoring/metrics` | GET | Query metrics |
| `/monitoring/metrics/aggregate` | GET | Aggregated metrics |
| `/monitoring/errors` | POST | Report error |
| `/monitoring/errors` | GET | List errors |
| `/monitoring/errors/:id/resolve` | PUT | Resolve error |
| `/monitoring/alerts/rules` | CRUD | Alert rule management |
| `/monitoring/alerts` | GET | List active alerts |
| `/monitoring/alerts/:id/acknowledge` | PUT | Acknowledge alert |
| `/monitoring/reports/generate` | POST | Generate report |
| `/monitoring/reports` | GET | List reports |
| `/monitoring/reports/schedules` | CRUD | Schedule management |
| `/monitoring/health` | GET | System health |
| `/monitoring/health/:service` | GET | Service-specific health |

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| High event volume overwhelms system | Medium | High | Event sampling, buffering, horizontal scaling |
| Time-series DB storage costs | Medium | Medium | Data retention policies, rollup aggregation |
| Alert fatigue from too many alerts | Medium | High | Smart alert grouping, cooldown periods |
| Dashboard performance with large datasets | Medium | Medium | Pre-aggregation, caching, pagination |
| Data loss during system failures | Low | High | Write-ahead logging, replication |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Event Processing Latency | < 100ms P95 | End-to-end tracking |
| Alert Detection Time | < 60s | Time from condition to alert |
| Dashboard Load Time | < 2s | Performance monitoring |
| Report Generation Time | < 30s | For standard reports |
| Error Detection Rate | 100% | All uncaught exceptions captured |
| System Availability | 99.9% | Uptime monitoring |

## Implementation Notes

### Multi-tenancy Strategy
- All tables include `tenant_id` column
- Row-Level Security (RLS) policies enforced
- Separate metric namespaces per tenant
- Redis key namespacing: `mon:{tenant_id}:*`

### Data Retention Strategy
- Events: 90 days active, archive to cold storage
- Metrics: 365 days at full resolution, then rollup
- Errors: 180 days, resolved errors after 30 days
- Reports: 90 days, then archive
- Alert history: 365 days

### Performance Optimization
- Event buffering with batch writes (1000 events or 10s)
- Metrics pre-aggregation at 1m, 5m, 1h intervals
- Dashboard caching with 60s TTL
- Query result caching for repeated requests

### Polish Localization
- All alert messages in Polish
- Report templates with Polish formatting
- Date/time in Polish timezone (Europe/Warsaw)
- Currency formatting for business metrics

## Definition of Done

- [ ] All acceptance criteria met and verified
- [ ] Unit test coverage ≥ 80%
- [ ] Integration tests for all API endpoints
- [ ] Performance tests for high-volume scenarios
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Grafana dashboards configured
- [ ] Alert rules tested and validated
- [ ] Code reviewed and approved
- [ ] Deployed to staging and verified
