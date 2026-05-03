// ─── Outbound ─────────────────────────────────────────────────────────────────

export interface AiTemplateField {
  field_name: string;
  field_type: string;
  is_required: boolean;
  description?: string;
  validation_regex?: string;
  position_hint?: Record<string, number>;
}

export interface AiTemplate {
  slug: string;
  doc_type: string;
  name: string;
  layer: string;
  fields: AiTemplateField[];
}

export interface AiPipelineDoc {
  file_url: string;
  doc_type_hint: string;
}

// ─── Inbound ──────────────────────────────────────────────────────────────────

export interface AiLayerScore {
  layer: string;
  name: string;
  score: number;
  weight: number;
  documents_submitted: string[];
  documents_required: number;
  is_satisfied: boolean;
}

export interface AiScoringResult {
  /** 0–100 */
  score: number;
  /** 'approved' | 'review' | 'rejected' */
  decision: 'approved' | 'review' | 'rejected';
  layer_scores: Record<string, AiLayerScore>;
  blockers: string[];
  flags: Array<{ type: string; message: string }>;
  documents_coverage: {
    total_submitted: number;
    layers_covered: number;
    layers_total: number;
    /** AI service returns this as `missing_layers` */
    missing_layers: string[];
  };
}

export interface AiAuthenticityResult {
  /** 0–100 */
  authenticity_score: number;
  is_suspicious: boolean;
  checks: Array<{
    tool: string;
    passed: boolean;
    score: number;
    details: unknown;
  }>;
}

export interface AiExtractionResult {
  fields: Record<string, unknown>;
  confidence: number;
}

export interface AiReportResult {
  report_md: string;
}

export interface AiTraceEntry {
  timestamp: number;
  agent: string;
  tool: string;
  confidence: number;
  note?: string;
}

export interface AiPipelineResponse {
  verification_id: string;
  results: {
    scoring?: AiScoringResult;
    authenticity?: AiAuthenticityResult;
    extraction?: AiExtractionResult;
    report?: AiReportResult;
    [key: string]: unknown;
  };
  trace: AiTraceEntry[];
  processing_time_ms: number;
}
