import type * as AppConstants from '../common/constants';
import type * as UserContracts from './user.interface';

export interface AdminUserDto {
  id: string;
  name: string;
  initials: string;
  email: string;
  headline?: string | null;
  about?: string | null;
  images?: string[] | null;
}

export interface AdminChatMessageDto {
  id: string;
  sender: string;
  senderUserId?: string | null;
  senderInitials?: string | null;
  senderGender?: 'woman' | 'man' | string | null;
  text: string;
  time?: string | null;
  sentAtIso?: string | null;
}

export interface AdminReportDto {
  id: string;
  reporterUserId: string;
  reporterName: string;
  reporterImageUrl?: string | null;
  targetUserId: string;
  handle?: string | null;
  reason: string;
  details: string;
  eventId?: string | null;
  eventTitle?: string | null;
  eventStartAtIso?: string | null;
  memberEntryId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  sourceText?: string | null;
  chatId?: string | null;
  messageId?: string | null;
  assetId?: string | null;
  assetType?: string | null;
  chatTitle?: string | null;
  chatMessages?: AdminChatMessageDto[];
  createdDate: string;
}

export interface AdminReportedUserDto {
  userId: string;
  name: string;
  initials: string;
  gender: 'woman' | 'man' | string;
  city: string;
  imageUrl?: string | null;
  profileStatus: UserContracts.UserDto['profileStatus'] | string;
  reportCount: number;
  lastReportedAtIso?: string | null;
  blockedAtIso?: string | null;
  hasSupportChat?: boolean | null;
  supportChatUnread?: number | null;
  reports: AdminReportDto[];
}

export interface AdminFeedbackDto {
  id: string;
  userId: string;
  userName: string;
  userImageUrl?: string | null;
  category: string;
  subject: string;
  details: string;
  createdDate: string;
}

export interface AdminModerationStoreDto {
  seededAtIso: string;
  reports: AdminReportDto[];
  feedback: AdminFeedbackDto[];
}

export type AdminModerationStore = AdminModerationStoreDto;

export interface AdminDashboardDto {
  activeAdmin: AdminUserDto;
  activeAdminProfile?: UserContracts.UserDto | null;
  reportedUsers: AdminReportedUserDto[];
  blockedUsers: AdminReportedUserDto[];
  feedback: AdminFeedbackDto[];
}

export type AdminMonitoringHealth = 'ok' | 'watch' | 'alert';
export type AdminMonitoringSource = 'demo' | 'http';
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

export type AdminParamValueType = 'number' | 'text';

export interface AdminParamOptionDto {
  value: string;
  label: string;
  labelKey?: string | null;
}

export interface AdminParamFieldDto {
  key: string;
  label: string;
  labelKey?: string | null;
  group: string;
  groupKey?: string | null;
  valueType: AdminParamValueType;
  numberValue?: number | null;
  textValue?: string | null;
  unit?: string | null;
  options?: AdminParamOptionDto[] | null;
  strategy?: string | null;
  strategyKey?: string | null;
  readOnly?: boolean | null;
}

export interface AdminParamsSectionDto {
  key: string;
  label: string;
  labelKey?: string | null;
  version: number;
  changedDate: string;
  changedBy: string;
  summary: string;
  summaryKey?: string | null;
  fields: AdminParamFieldDto[];
}

export interface AdminParamsStateDto {
  sections: AdminParamsSectionDto[];
  updatedDate: string;
}

export interface AdminParamsHistoryItemDto {
  configId?: string | null;
  version: number;
  changedDate: string;
  changedBy: string;
  summary: string;
  summaryKey?: string | null;
  active: boolean;
  fields: AdminParamFieldDto[];
}

export interface AdminParamsHistoryDto {
  sectionKey: string;
  label: string;
  labelKey?: string | null;
  versions: AdminParamsHistoryItemDto[];
}

export interface AdminParamsDemoStoreDto extends AdminParamsStateDto {
  historyBySection: Record<string, AdminParamsHistoryItemDto[]>;
}

export type AdminParamsDemoStore = AdminParamsDemoStoreDto;

export interface AdminHelpTargetDto {
  key: string;
  messageId: string;
  attachmentId: string;
  attachmentType: 'link' | 'event' | 'asset';
  attachmentEntityId: string;
  assetType?: AppConstants.AssetType | null;
  title: string;
  subtitle: string;
  description: string;
  previewUrl?: string | null;
  text: string;
  targetUrl: string;
}

export type AdminHelpTarget = AdminHelpTargetDto;

export type AdminBootstrapProcessStage = 'selector' | 'indexedDb' | 'records' | 'affinityGraph' | 'profile' | 'ready';

export interface AdminBootstrapProcessStateDto {
  percent: number;
  label: string;
  stage: AdminBootstrapProcessStage;
}

export type AdminBootstrapProcessState = AdminBootstrapProcessStateDto;

export type AdminNotificationTriggerKind = 'action' | 'timed' | 'scheduled_process';
export type AdminNotificationTimingMode = 'immediate' | 'delay' | 'interval' | 'yearly' | 'manual';

export interface AdminNotificationChannelsDto {
  pushEnabled: boolean;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  supportChatEnabled: boolean;
}

export type AdminNotificationChannels = AdminNotificationChannelsDto;

export type AdminNotificationIntervalUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';

export interface AdminNotificationTimingDto {
  mode: AdminNotificationTimingMode;
  delayMinutes: number;
  intervalMinutes: number;
  intervalSeconds?: number | null;
  intervalAmount?: number | null;
  intervalUnit?: AdminNotificationIntervalUnit | null;
  month: number;
  dayOfMonth: number;
  time: string;
  timezone: string;
  cronExpression: string;
}

export type AdminNotificationTiming = AdminNotificationTimingDto;

export type AdminNotificationScheduleFrequency = 'one-time' | 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'yearly';

export interface AdminNotificationScheduleSlotDto {
  id: string;
  frequency: AdminNotificationScheduleFrequency;
  date: string;
  dayOfWeek: number;
  time: string;
  timezone: string;
  cronExpression: string;
  actionKey: string;
  enabled: boolean;
}

export type AdminNotificationScheduleSlot = AdminNotificationScheduleSlotDto;

export type AdminNotificationRuleParameterValueType = 'number' | 'text';

export interface AdminNotificationRuleParameterOptionDto {
  value: string;
  label: string;
  labelKey?: string | null;
}

export type AdminNotificationRuleParameterOption = AdminNotificationRuleParameterOptionDto;

export interface AdminNotificationRuleParameterDto {
  key: string;
  label: string;
  labelKey?: string | null;
  group: string;
  groupKey?: string | null;
  valueType: AdminNotificationRuleParameterValueType;
  numberValue?: number | null;
  textValue?: string | null;
  unit?: string | null;
  options?: AdminNotificationRuleParameterOptionDto[] | null;
  strategy?: string | null;
  strategyKey?: string | null;
  readOnly?: boolean | null;
}

export type AdminNotificationRuleParameter = AdminNotificationRuleParameterDto;

export interface AdminNotificationMessageDto {
  pushTitle: string;
  pushBody: string;
  emailTemplateKey: string;
  emailSubject: string;
  emailBody: string;
  ctaPath: string;
}

export type AdminNotificationMessage = AdminNotificationMessageDto;

export interface AdminNotificationRunStateDto {
  currentStatus: string;
  progressPercent: number;
  progressDetail: string;
  startedAtIso: string;
  finishedAtIso: string;
  durationMillis: number;
  lastRunAtIso: string;
  lastRunStatus: string;
  lastRunDetail: string;
  lastRunCount: number;
  lastRunUser: string;
}

export type AdminNotificationRunState = AdminNotificationRunStateDto;

export interface AdminNotificationRunHistoryEntryDto {
  id: string;
  trigger: string;
  runnerUser: string;
  startedAtIso: string;
  finishedAtIso: string;
  durationMillis: number;
  processedCount: number;
  status: string;
  detail: string;
}

export type AdminNotificationRunHistoryEntry = AdminNotificationRunHistoryEntryDto;

export interface AdminNotificationRuleDto {
  id?: string | null;
  ruleKey: string;
  label: string;
  category: string;
  description: string;
  actionKey: string;
  triggerKind: AdminNotificationTriggerKind;
  enabled: boolean;
  manualRunEnabled: boolean;
  adminManageable: boolean;
  priority: number;
  channels: AdminNotificationChannelsDto;
  timing: AdminNotificationTimingDto;
  scheduleSlots?: AdminNotificationScheduleSlotDto[];
  parameters?: AdminNotificationRuleParameterDto[];
  message: AdminNotificationMessageDto;
  runState: AdminNotificationRunStateDto;
  runHistory: AdminNotificationRunHistoryEntryDto[];
  updatedDate?: string | null;
  updatedUser?: string | null;
}

export type AdminNotificationRule = AdminNotificationRuleDto;

export interface AdminNotificationTemplateOptionDto {
  templateKey: string;
  name: string;
  category: string;
  description: string;
}

export type AdminNotificationTemplateOption = AdminNotificationTemplateOptionDto;

export interface AdminNotificationCenterStateDto {
  rules: AdminNotificationRuleDto[];
  emailTemplates: AdminNotificationTemplateOptionDto[];
  updatedDate: string;
}

export type AdminNotificationCenterState = AdminNotificationCenterStateDto;

export interface AdminNotificationRunResultDto {
  ruleKey: string;
  label: string;
  affectedCount: number;
  status: string;
  detail: string;
  ranAtIso: string;
}

export type AdminNotificationRunResult = AdminNotificationRunResultDto;

export interface AdminNotificationRuleLiveEventDto {
  type: 'rule-runtime';
  ruleKey: string;
  runState: AdminNotificationRunStateDto;
  runHistory: AdminNotificationRunHistoryEntryDto[];
  updatedDate: string;
  updatedUser: string;
}

export type AdminNotificationRuleLiveEvent = AdminNotificationRuleLiveEventDto;

export interface AdminAffinityGraphNodeDto {
  id: string;
  name: string;
  initials: string;
  gender?: 'woman' | 'man' | string | null;
  city?: string | null;
  age?: number | null;
  headline?: string | null;
  traitLabel?: string | null;
  statusText?: string | null;
  profileStatus?: string | null;
  image?: string | null;
  images?: string[] | null;
  componentId?: string | null;
  x?: number | null;
  y?: number | null;
  z?: number | null;
  degree?: number | null;
  weightedDegree?: number | null;
  centrality?: number | null;
  forestMemberCount?: number | null;
  forestEdgeCount?: number | null;
}

export interface AdminAffinityGraphEdgeDto {
  id: string;
  source: string;
  target: string;
  weight: number;
  affinityScore?: number | null;
  updatedDate?: string | null;
}

export interface AdminAffinityGraphDto {
  generatedAtIso: string;
  source: 'demo' | 'http' | string;
  layoutVersion?: string | null;
  memberCount?: number | null;
  linkCount?: number | null;
  componentCount?: number | null;
  isolatedCount?: number | null;
  forestCount?: number | null;
  forestLevel?: number | null;
  maxForestLevel?: number | null;
  maxZoom?: number | null;
  labels?: Record<string, string> | null;
  nodes: AdminAffinityGraphNodeDto[];
  edges: AdminAffinityGraphEdgeDto[];
  forests?: AdminAffinityGraphForestDto[] | null;
}

export interface AdminAffinityGraphMetaDto {
  generatedAtIso: string;
  source: 'demo' | 'http' | string;
  layoutVersion?: string | null;
  memberCount: number;
  linkCount: number;
  componentCount: number;
  isolatedCount: number;
  maxZoom: number;
  tileSize: number;
  nodeRenderBudget: number;
  edgeRenderBudget: number;
  materialized: boolean;
}

export interface AdminAffinityGraphNeighborhoodDto extends AdminAffinityGraphDto {
  centerUserId: string;
  depth: number;
}

export interface AdminAffinityGraphForestDto {
  componentId: string;
  representativeUserId: string;
  representativeName: string;
  representativeInitials: string;
  gender?: 'woman' | 'man' | string | null;
  memberCount: number;
  edgeCount: number;
  weightedDegree: number;
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface AdminAffinityGraphForestsDto {
  generatedAtIso: string;
  source: 'demo' | 'http' | string;
  layoutVersion?: string | null;
  forestCount?: number | null;
  forestLevel?: number | null;
  maxForestLevel?: number | null;
  limit?: number | null;
  offset?: number | null;
  forests: AdminAffinityGraphForestDto[];
}

export interface AdminAffinityGraphTileDto {
  generatedAtIso: string;
  source: 'demo' | 'http' | string;
  layoutVersion?: string | null;
  z: number;
  x: number;
  y: number;
  nodeCount: number;
  edgeCount: number;
  truncated: boolean;
  nodes: AdminAffinityGraphNodeDto[];
  edges: AdminAffinityGraphEdgeDto[];
}
