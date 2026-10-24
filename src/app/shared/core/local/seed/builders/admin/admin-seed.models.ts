import { AdminReportDto } from '../../../../contracts/administration/admin.interface';
import { AdminChatMessageDto } from '../../../../contracts/administration/admin.interface';
import type { AssetType } from '../../../../common/constants';

export interface AdminSeedUserDto {
  id: string;
  name: string;
  initials: string;
  headline?: string | null;
  about?: string | null;
  images?: string[] | null;
}

export interface AdminSeedParamOptionDto {
  value: string;
  label: string;
  labelKey?: string | null;
}

export interface AdminSeedParamFieldDto {
  key: string;
  label: string;
  labelKey?: string | null;
  group: string;
  groupKey?: string | null;
  valueType: 'number' | 'text';
  numberValue?: number | null;
  textValue?: string | null;
  unit?: string | null;
  options?: AdminSeedParamOptionDto[] | null;
  strategy?: string | null;
  strategyKey?: string | null;
  readOnly?: boolean | null;
}

export interface AdminSeedParamsSectionDto {
  key: string;
  label: string;
  labelKey?: string | null;
  version: number;
  changedDate: string;
  changedBy: string;
  summary: string;
  summaryKey?: string | null;
  fields: AdminSeedParamFieldDto[];
}

export interface AdminSeedParamsHistoryItemDto {
  configId?: string | null;
  version: number;
  changedDate: string;
  changedBy: string;
  summary: string;
  summaryKey?: string | null;
  active: boolean;
  fields: AdminSeedParamFieldDto[];
}

export interface AdminSeedParamsStore {
  sections: AdminSeedParamsSectionDto[];
  updatedDate: string;
  historyBySection: Record<string, AdminSeedParamsHistoryItemDto[]>;
}

export interface AdminSeedHelpTarget {
  key: string;
  messageId: string;
  attachmentId: string;
  attachmentType: 'link' | 'event' | 'asset';
  attachmentEntityId: string;
  assetType?: AssetType | null;
  title: string;
  subtitle: string;
  description: string;
  previewUrl?: string | null;
  text: string;
  targetUrl: string;
}

export type AdminSeedChatMessageDto = Pick<AdminChatMessageDto, "id" | "sender" | "senderUserId" | "senderInitials" | "senderGender" | "text" | "time" | "sentAtIso">;

export type AdminSeedReportDto = Pick<AdminReportDto, "id" | "reporterUserId" | "reporterName" | "reporterImageUrl" | "targetUserId" | "handle" | "reason" | "details" | "eventId" | "eventTitle" | "eventStartAtIso" | "memberEntryId" | "sourceType" | "sourceId" | "sourceText" | "chatId" | "messageId" | "assetId" | "assetType" | "chatTitle" | "chatMessages" | "createdDate">;

export interface AdminSeedFeedbackDto {
  id: string;
  userId: string;
  userName: string;
  userImageUrl?: string | null;
  category: string;
  subject: string;
  details: string;
  createdDate: string;
}

export interface AdminSeedModerationStore {
  seededAtIso: string;
  reports: AdminSeedReportDto[];
  feedback: AdminSeedFeedbackDto[];
}

export interface AdminSeedStatsMetricDto {
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

export interface AdminSeedStatsBreakdownItemDto {
  key: string;
  labelKey: string;
  label?: string;
  value: number;
  total?: number | null;
  icon?: string;
  tone?: AdminSeedStatsMetricDto['tone'];
}

export interface AdminSeedStatsSegmentDto {
  key: string;
  labelKey: string;
  icon: string;
  total: number;
  healthPercent: number;
  summaryKey: string;
  summary?: string;
  items: AdminSeedStatsBreakdownItemDto[];
}

export interface AdminSeedStatsTimelinePointDto {
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

export interface AdminSeedStatsGraphTimelinePointDto {
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

export interface AdminSeedStatsGraphDto {
  healthScore: number;
  healthLabelKey: string;
  insightKey: string;
  metrics: AdminSeedStatsMetricDto[];
  bridgeUsers: AdminSeedStatsBreakdownItemDto[];
  communities: AdminSeedStatsBreakdownItemDto[];
  signals: AdminSeedStatsBreakdownItemDto[];
  timeline: AdminSeedStatsGraphTimelinePointDto[];
}

export interface AdminSeedStatsDashboardDto {
  generatedAtIso: string;
  source: 'demo' | 'http';
  healthScore: number;
  healthLabelKey: string;
  healthSummaryKey: string;
  kpis: AdminSeedStatsMetricDto[];
  segments: AdminSeedStatsSegmentDto[];
  attention: AdminSeedStatsBreakdownItemDto[];
  topCities: AdminSeedStatsBreakdownItemDto[];
  topTopics: AdminSeedStatsBreakdownItemDto[];
  timeline: AdminSeedStatsTimelinePointDto[];
  eventTypes: AdminSeedStatsBreakdownItemDto[];
  activityMix: AdminSeedStatsBreakdownItemDto[];
  graph: AdminSeedStatsGraphDto;
}
