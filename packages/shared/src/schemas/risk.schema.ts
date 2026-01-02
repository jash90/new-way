import { z } from 'zod';

// ===========================================
// RISK ASSESSMENT ENUMS
// ===========================================

export const riskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const riskCategorySchema = z.enum([
  'financial',
  'compliance',
  'operational',
  'reputational',
  'legal',
]);
export type RiskCategory = z.infer<typeof riskCategorySchema>;

export const riskFactorTypeSchema = z.enum([
  'vat_status',
  'payment_history',
  'legal_status',
  'data_completeness',
  'activity_level',
  'document_compliance',
  'communication_pattern',
  'custom',
]);
export type RiskFactorType = z.infer<typeof riskFactorTypeSchema>;

// ===========================================
// RISK ASSESSMENT INPUT SCHEMAS
// ===========================================

export const assessClientRiskSchema = z.object({
  clientId: z.string().uuid(),
  includeHistory: z.boolean().default(false),
  recalculate: z.boolean().default(false),
});

export type AssessClientRiskInput = z.infer<typeof assessClientRiskSchema>;

export const getClientRiskHistorySchema = z.object({
  clientId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(10),
});

export type GetClientRiskHistoryInput = z.infer<typeof getClientRiskHistorySchema>;

export const updateRiskConfigSchema = z.object({
  factorWeights: z
    .record(riskFactorTypeSchema, z.number().min(0).max(100))
    .optional(),
  thresholds: z
    .object({
      low: z.number().min(0).max(100).default(25),
      medium: z.number().min(0).max(100).default(50),
      high: z.number().min(0).max(100).default(75),
    })
    .optional(),
  autoAssessInterval: z.number().int().min(1).max(365).optional(), // days
  enableAutoAssess: z.boolean().optional(),
});

export type UpdateRiskConfigInput = z.infer<typeof updateRiskConfigSchema>;

export const bulkAssessRiskSchema = z.object({
  clientIds: z.array(z.string().uuid()).min(1).max(50),
  recalculate: z.boolean().default(false),
});

export type BulkAssessRiskInput = z.infer<typeof bulkAssessRiskSchema>;

export const getHighRiskClientsSchema = z.object({
  minLevel: riskLevelSchema.default('high'),
  category: riskCategorySchema.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type GetHighRiskClientsInput = z.infer<typeof getHighRiskClientsSchema>;

// ===========================================
// RISK FACTOR OUTPUT
// ===========================================

export interface RiskFactor {
  type: RiskFactorType;
  name: string;
  description: string;
  score: number; // 0-100
  weight: number; // 0-100
  weightedScore: number;
  category: RiskCategory;
  details?: Record<string, unknown>;
  suggestions?: string[];
}

// ===========================================
// RISK ASSESSMENT OUTPUT
// ===========================================

export interface ClientRiskAssessment {
  clientId: string;
  overallScore: number; // 0-100
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  summary: string;
  recommendations: string[];
  assessedAt: Date;
  validUntil: Date | null;
  previousScore?: number;
  scoreTrend?: 'improving' | 'stable' | 'worsening';
}

export interface RiskAssessmentResult {
  success: boolean;
  assessment: ClientRiskAssessment;
  message: string;
}

export interface RiskHistoryEntry {
  id: string;
  score: number;
  riskLevel: RiskLevel;
  factorsSummary: Record<string, number>;
  assessedAt: Date;
  triggeredBy: 'manual' | 'auto' | 'bulk';
}

export interface RiskHistoryResult {
  clientId: string;
  history: RiskHistoryEntry[];
  total: number;
}

export interface BulkRiskAssessmentResult {
  success: boolean;
  assessed: number;
  failed: number;
  assessments: ClientRiskAssessment[];
  errors?: { clientId: string; error: string }[];
  message: string;
}

export interface HighRiskClientItem {
  clientId: string;
  displayName: string;
  type: 'individual' | 'company';
  overallScore: number;
  riskLevel: RiskLevel;
  topFactors: { type: string; score: number }[];
  assessedAt: Date;
}

export interface HighRiskClientsResult {
  clients: HighRiskClientItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface RiskConfig {
  factorWeights: Record<string, number>;
  thresholds: {
    low: number;
    medium: number;
    high: number;
  };
  autoAssessInterval: number;
  enableAutoAssess: boolean;
  updatedAt: Date;
}

export interface RiskConfigResult {
  success: boolean;
  config: RiskConfig;
  message: string;
}
