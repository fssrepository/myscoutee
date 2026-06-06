export interface AdminStatsMetricDto {
  key: string;
  labelKey: string;
  value: number;
  valueLabel?: string;
  captionKey?: string;
  caption?: string;
  icon: string;
  tone: 'blue' | 'green' | 'gold' | 'red' | 'purple' | 'slate';
  percent?: number | null;
}

export interface AdminStatsBreakdownItemDto {
  key: string;
  labelKey: string;
  label?: string;
  value: number;
  total?: number | null;
  icon?: string;
  tone?: AdminStatsMetricDto['tone'];
}

export interface AdminStatsSegmentDto {
  key: string;
  labelKey: string;
  icon: string;
  total: number;
  healthPercent: number;
  summaryKey: string;
  summary?: string;
  items: AdminStatsBreakdownItemDto[];
}

export interface AdminStatsTimelinePointDto {
  dateKey: string;
  label: string;
  registrations: number;
  activeUsers: number;
  ratings: number;
  events: number;
  assets: number;
  messages: number;
  moderation: number;
}

export interface AdminStatsGraphTimelinePointDto {
  dateKey: string;
  label: string;
  activeEdges: number;
  newEdges: number;
  recurringEdges: number;
  weakTies: number;
  bridgeUsers: number;
  communities: number;
  networkQuality: number;
  clusterQuality: number;
}

export interface AdminStatsGraphDto {
  healthScore: number;
  healthLabelKey: string;
  insightKey: string;
  metrics: AdminStatsMetricDto[];
  bridgeUsers: AdminStatsBreakdownItemDto[];
  communities: AdminStatsBreakdownItemDto[];
  signals: AdminStatsBreakdownItemDto[];
  timeline: AdminStatsGraphTimelinePointDto[];
}

export interface AdminStatsRevenueTimelinePointDto {
  dateKey: string;
  label: string;
  payableEvents: number;
  payableAssets: number;
  projectedEventCents: number;
  projectedAssetCents: number;
  actualPaymentCents: number;
  payingUsers: number;
}

export interface AdminStatsRevenueDto {
  metrics: AdminStatsMetricDto[];
  assetCategories: AdminStatsBreakdownItemDto[];
  timeline: AdminStatsRevenueTimelinePointDto[];
}

export interface AdminStatsDashboardDto {
  generatedAtIso: string;
  source: 'demo' | 'http';
  healthScore: number;
  healthLabelKey: string;
  healthSummaryKey: string;
  kpis: AdminStatsMetricDto[];
  segments: AdminStatsSegmentDto[];
  attention: AdminStatsBreakdownItemDto[];
  topCities: AdminStatsBreakdownItemDto[];
  topTopics: AdminStatsBreakdownItemDto[];
  timeline: AdminStatsTimelinePointDto[];
  eventTypes: AdminStatsBreakdownItemDto[];
  activityMix: AdminStatsBreakdownItemDto[];
  graph: AdminStatsGraphDto;
  revenue: AdminStatsRevenueDto;
}
