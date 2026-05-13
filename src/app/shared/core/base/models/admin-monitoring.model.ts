export type AdminMonitoringHealth = 'ok' | 'watch' | 'alert';
export type AdminMonitoringSource = 'demo' | 'http' | 'fallback';
export type AdminMonitoringTone = 'blue' | 'green' | 'gold' | 'red' | 'purple' | 'slate';
export type AdminMonitoringNodeKind =
  | 'source'
  | 'writeModel'
  | 'queue'
  | 'worker'
  | 'outbox'
  | 'external'
  | 'readModel'
  | 'storage';

export interface AdminMonitoringMetricDetailRowDto {
  key: string;
  labelKey: string;
  valueLabel: string;
  tone: AdminMonitoringTone;
}

export interface AdminMonitoringMetricDto {
  key: string;
  labelKey: string;
  value: number;
  valueLabel: string;
  tone: AdminMonitoringTone;
  status: AdminMonitoringHealth;
  detailRows: AdminMonitoringMetricDetailRowDto[];
}

export interface AdminMonitoringNodeDto {
  id: string;
  labelKey: string;
  icon: string;
  kind: AdminMonitoringNodeKind;
  tone: AdminMonitoringTone;
  metrics: AdminMonitoringMetricDto[];
}

export interface AdminMonitoringEdgeDto {
  from: string;
  to: string;
  labelKey: string;
  tone: AdminMonitoringTone;
  volume: number;
}

export interface AdminMonitoringCategoryDto {
  key: string;
  labelKey: string;
  summaryKey: string;
  icon: string;
  tone: AdminMonitoringTone;
  health: AdminMonitoringHealth;
  total: number;
  nodes: AdminMonitoringNodeDto[];
  edges: AdminMonitoringEdgeDto[];
}

export interface AdminMonitoringStateDto {
  generatedAtIso: string;
  source: AdminMonitoringSource;
  health: AdminMonitoringHealth;
  categories: AdminMonitoringCategoryDto[];
}
