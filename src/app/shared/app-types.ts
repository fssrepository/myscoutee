import { EVENT_EDITOR_SAMPLE } from './demo-data';
import type { ChatMenuItem, EventMenuItem, HostingMenuItem, InvitationMenuItem, RateMenuItem } from './demo-data';

export type MenuSection = 'game' | 'chat' | 'invitations' | 'events' | 'hosting';

export type PopupType =
  | 'activities'
  | 'eventFeedback'
  | 'eventFeedbackNote'
  | 'tickets'
  | 'chat'
  | 'chatMembers'
  | 'assetsCar'
  | 'assetsAccommodation'
  | 'assetsSupplies'
  | 'assetsTickets'
  | 'invitations'
  | 'events'
  | 'hosting'
  | 'invitationActions'
  | 'eventEditor'
  | 'eventExplore'
  | 'subEventMembers'
  | 'subEventAssets'
  | 'profileEditor'
  | 'imageEditor'
  | 'imageUpload'
  | 'supplyDetail'
  | 'assetMembers'
  | 'subEventSupplyContributions'
  | 'ticketCode'
  | 'ticketScanner'
  | 'activityMembers'
  | 'valuesSelector'
  | 'interestSelector'
  | 'experienceSelector'
  | 'deleteAccountConfirm'
  | 'logoutConfirm'
  | null;

export type AuthMode = 'selector' | 'firebase';

export interface FirebaseAuthProfile {
  id: string;
  name: string;
  email: string;
  initials: string;
}

export interface EntryConsentState {
  version: string;
  accepted: boolean;
  acceptedAtIso: string;
}

export interface EntryConsentAuditRecord {
  tsIso: string;
  action: 'accepted' | 'rejected';
  version: string;
  source: 'entry';
  userAgent: string;
}

export interface SupplyContext {
  subEventId: string;
  subEventTitle: string;
  type: string;
}

export interface SubEventBadgeContext {
  subEvent: SubEventFormItem;
  type: 'Members' | 'Car' | 'Accommodation' | 'Supplies';
  groupId?: string;
  groupName?: string;
}

export interface EventFeedbackOption {
  value: string;
  label: string;
  icon: string;
  impressionTag?: string;
}

export interface EventFeedbackCard {
  id: string;
  eventId: string;
  kind: 'event' | 'attendee';
  attendeeUserId?: string;
  targetUserId?: string;
  targetRole?: 'Admin' | 'Manager' | 'Member';
  icon: string;
  imageUrl: string;
  toneClass: string;
  heading: string;
  subheading: string;
  identityTitle?: string;
  identitySubtitle?: string;
  identityStatusClass?: string;
  identityStatusIcon?: string;
  questionPrimary: string;
  questionSecondary: string;
  primaryOptions: EventFeedbackOption[];
  secondaryOptions: EventFeedbackOption[];
  answerPrimary: string;
  answerSecondary: string;
}

export interface SubmittedEventFeedbackAnswer {
  cardId: string;
  eventId: string;
  kind: 'event' | 'attendee';
  targetUserId: string | null;
  targetRole: 'Admin' | 'Manager' | 'Member';
  primaryValue: string;
  secondaryValue: string;
  tags: string[];
  submittedAtIso: string;
}

export type EventFeedbackListFilter = 'pending' | 'feedbacked' | 'removed';

export interface EventFeedbackEventCard {
  eventId: string;
  title: string;
  subtitle: string;
  timeframe: string;
  imageUrl: string;
  startAtMs: number;
  pendingCards: number;
  totalCards: number;
  isRemoved: boolean;
  isFeedbacked: boolean;
  feedbackedAtMs: number | null;
}

export interface HelpCenterSection {
  id: string;
  icon: string;
  title: string;
  blurb: string;
  details: string[];
  points: string[];
}

export interface ChatReadAvatar {
  id: string;
  initials: string;
  gender: 'woman' | 'man';
}

export interface ChatPopupMessage {
  id: string;
  sender: string;
  senderAvatar: ChatReadAvatar;
  text: string;
  time: string;
  sentAtIso: string;
  mine: boolean;
  readBy: ChatReadAvatar[];
}

export interface ChatPopupDayGroup {
  key: string;
  label: string;
  messages: ChatPopupMessage[];
}

export type ChatChannelType = 'general' | 'mainEvent' | 'optionalSubEvent' | 'groupSubEvent';
export type ActivitiesChatContextFilter = 'all' | 'event' | 'subEvent' | 'group';

export type ActivitiesPrimaryFilter = 'chats' | 'invitations' | 'events' | 'hosting' | 'rates';
export type ActivitiesEventScope = 'all' | 'active-events' | 'invitations' | 'my-events' | 'drafts' | 'trash';
export type ActivitiesSecondaryFilter = 'recent' | 'relevant' | 'past';
export type HostingPublicationFilter = 'all' | 'drafts';
export type ActivitiesView = 'month' | 'week' | 'day' | 'distance';
export type EventExploreView = 'day' | 'distance';
export type EventExploreOrder = 'upcoming' | 'past-events' | 'nearby' | 'most-relevant' | 'top-rated';
export type RateFilterKey =
  | 'individual-given'
  | 'individual-received'
  | 'individual-mutual'
  | 'individual-met'
  | 'pair-given'
  | 'pair-received';

export type RateFilterEntry =
  | { kind: 'group'; label: string }
  | { kind: 'item'; key: RateFilterKey; label: string };

export interface ActivityRateDisplayUser {
  id: string;
  name: string;
  age: number;
  city: string;
  gender: 'woman' | 'man';
}

export interface ActivityRateDisplaySlide {
  imageUrl: string;
  primaryLine?: string;
  secondaryLine?: string;
  placeholderLabel?: string;
}

export interface ActivityRateDisplaySlot {
  key: 'woman' | 'man';
  label: string;
  tone?: 'woman' | 'man';
  slides: ActivityRateDisplaySlide[];
}

export interface ActivityRateDisplay {
  primaryUser: ActivityRateDisplayUser | null;
  imageUrls: string[];
  happenedOnLabel: string;
  pairSlots: ActivityRateDisplaySlot[];
}

export interface ActivityListRow {
  id: string;
  type: ActivitiesPrimaryFilter;
  title: string;
  subtitle: string;
  detail: string;
  dateIso: string;
  distanceKm: number;
  distanceMetersExact?: number;
  unread: number;
  metricScore: number;
  isAdmin?: boolean;
  rateDisplay?: ActivityRateDisplay | null;
  source: ChatMenuItem | InvitationMenuItem | EventMenuItem | HostingMenuItem | RateMenuItem;
}

export interface ActivityGroup {
  label: string;
  rows: ActivityListRow[];
}

export interface TicketScanPayload {
  code: string;
  holderUserId: string;
  holderName: string;
  holderAge: number;
  holderCity: string;
  holderRole: ActivityMemberRole;
  eventId: string;
  eventTitle: string;
  eventSubtitle: string;
  eventTimeframe: string;
  eventDateLabel: string;
  issuedAtIso: string;
}

export interface BrowserBarcodeDetectorResult {
  rawValue?: string;
}

export interface BrowserBarcodeDetector {
  detect(image: ImageBitmapSource): Promise<BrowserBarcodeDetectorResult[]>;
}

export interface BrowserBarcodeDetectorConstructor {
  new(options?: { formats?: string[] }): BrowserBarcodeDetector;
}

export interface CalendarDayCell {
  key: string;
  date: Date;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  rows: ActivityListRow[];
}

export interface CalendarMonthPage {
  key: string;
  label: string;
  weeks: CalendarMonthWeek[];
}

export interface CalendarMonthWeek {
  start: Date;
  end: Date;
  days: CalendarDayCell[];
  spans: CalendarMonthSpan[];
}

export interface CalendarMonthSpan {
  key: string;
  row: ActivityListRow;
  startCol: number;
  endCol: number;
  lane: number;
}

export interface CalendarWeekPage {
  key: string;
  label: string;
  days: CalendarDayCell[];
}

export interface ActivityDateTimeRange {
  startIso: string;
  endIso: string;
}

export interface CalendarTimedBadge {
  row: ActivityListRow;
  topPct: number;
  heightPct: number;
}

export interface EventExploreCard {
  id: string;
  title: string;
  subtitle: string;
  timeframe: string;
  imageUrl: string;
  distanceKm: number;
  relevance: number;
  rating: number;
  startSort: number;
  isPast: boolean;
  sourceType: 'event' | 'hosting';
}

export interface EventExploreGroup {
  label: string;
  cards: EventExploreCard[];
}

export type SubEventCard = (typeof EVENT_EDITOR_SAMPLE.subEvents)[number];
export type ProfileStatus = 'public' | 'friends only' | 'host only' | 'inactive';
export type DetailPrivacy = 'Public' | 'Friends' | 'Hosts' | 'Private';

export interface ProfileDetailFormRow {
  label: string;
  value: string;
  privacy: DetailPrivacy;
  options: string[];
}

export interface ProfileDetailFormGroup {
  title: string;
  rows: ProfileDetailFormRow[];
}

export interface ValuesOptionGroup {
  title: string;
  shortTitle: string;
  icon: string;
  toneClass: string;
  options: string[];
}

export interface InterestOptionGroup {
  title: string;
  shortTitle: string;
  icon: string;
  toneClass: string;
  options: string[];
}

export interface ExperienceEntry {
  id: string;
  type: 'Workspace' | 'School' | 'Online Session' | 'Additional Project';
  title: string;
  org: string;
  city: string;
  dateFrom: string;
  dateTo: string;
  description: string;
}

export interface EventEditorForm {
  title: string;
  description: string;
  imageUrl: string;
  capacityMin: number | null;
  capacityMax: number | null;
  startAt: string;
  endAt: string;
  location: string;
  frequency: string;
  visibility: EventVisibility;
  blindMode: EventBlindMode;
  autoInviter: boolean;
  ticketing: boolean;
  topics: string[];
  subEvents: SubEventFormItem[];
}

export interface SubEventFormItem {
  id: string;
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  location?: string;
  createdByUserId?: string;
  groups?: SubEventGroupItem[];
  tournamentGroupCount?: number;
  tournamentGroupCapacityMin?: number;
  tournamentGroupCapacityMax?: number;
  tournamentLeaderboardType?: TournamentLeaderboardType;
  tournamentAdvancePerGroup?: number;
  optional: boolean;
  capacityMin: number;
  capacityMax: number;
  membersAccepted: number;
  membersPending: number;
  carsPending: number;
  accommodationPending: number;
  suppliesPending: number;
  carsAccepted?: number;
  accommodationAccepted?: number;
  suppliesAccepted?: number;
  carsCapacityMin?: number;
  carsCapacityMax?: number;
  accommodationCapacityMin?: number;
  accommodationCapacityMax?: number;
  suppliesCapacityMin?: number;
  suppliesCapacityMax?: number;
}

export interface SubEventGroupItem {
  id: string;
  name: string;
  capacityMin?: number;
  capacityMax?: number;
  source?: 'manual' | 'generated';
}

export interface SubEventGroupFormItem {
  id: string;
  stageId: string;
  stageTitle: string;
  name: string;
  capacityMin: number;
  capacityMax: number;
  source: 'manual' | 'generated';
}

export interface SubEventTournamentConfig {
  groupCount: number;
  groupCapacityMin: number;
  groupCapacityMax: number;
}

export interface SubEventTournamentGroup {
  key: string;
  id: string;
  groupNumber: number;
  groupLabel: string;
  source: 'manual' | 'generated';
  subEvent: SubEventFormItem;
}

export interface SubEventTournamentStage {
  key: string;
  stageNumber: number;
  title: string;
  subtitle: string;
  description: string;
  rangeLabel: string;
  subEvent: SubEventFormItem;
  groups: SubEventTournamentGroup[];
  isCurrent: boolean;
}

export interface SubEventLeaderboardMember {
  id: string;
  name: string;
}

export interface SubEventLeaderboardScoreEntry {
  id: string;
  stageId: string;
  groupId: string;
  memberId: string;
  value: number;
  note: string;
  createdAtMs: number;
}

export interface SubEventLeaderboardFifaMatch {
  id: string;
  stageId: string;
  groupId: string;
  homeMemberId: string;
  awayMemberId: string;
  homeScore: number;
  awayScore: number;
  note: string;
  createdAtMs: number;
}

export interface SubEventLeaderboardFormItem {
  groupId: string;
  memberId: string;
  scoreValue: number | null;
  note: string;
  homeMemberId: string;
  awayMemberId: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface SubEventLeaderboardScoreStandingRow {
  memberId: string;
  memberName: string;
  total: number;
  updates: number;
  isPlaceholder?: boolean;
}

export interface SubEventLeaderboardFifaStandingRow {
  memberId: string;
  memberName: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  isPlaceholder?: boolean;
}

export interface EventCapacityRange {
  min: number | null;
  max: number | null;
}

export interface MobileProfileSelectorOption {
  value: string;
  label: string;
  icon: string;
  toneClass?: string;
  badge?: number;
  disabled?: boolean;
}

export interface MobileProfileSelectorSheet {
  title: string;
  selected: string;
  options: MobileProfileSelectorOption[];
  context:
    | { kind: 'profileStatus' }
    | { kind: 'physique' }
    | { kind: 'language' }
    | { kind: 'detailPrivacy'; groupIndex: number; rowIndex: number }
    | { kind: 'experiencePrivacy'; type: 'workspace' | 'school' }
    | { kind: 'detailValue'; groupIndex: number; rowIndex: number }
    | { kind: 'experienceType' }
    | { kind: 'assetFilter' }
    | { kind: 'subEventResourceFilter' }
    | { kind: 'eventFrequency' };
}

export type AssetType = 'Car' | 'Accommodation' | 'Supplies';
export type AssetFilterType = AssetType | 'Ticket';
export type SubEventResourceFilter = 'Members' | AssetType;
export type SubEventsDisplayMode = 'Casual' | 'Tournament';
export type TournamentLeaderboardType = 'Score' | 'Fifa';
export type AssetRequestAction = 'accept' | 'remove';
export type EventEditorMode = 'edit' | 'create';
export type EventEditorTarget = 'events' | 'hosting';
export type EventVisibility = 'Public' | 'Friends only' | 'Invitation only';
export type EventBlindMode = 'Open Event' | 'Blind Event';
export type AssetRequestStatus = 'pending' | 'accepted';
export type ActivityMemberStatus = 'pending' | 'accepted';
export type ActivityPendingSource = 'admin' | 'member' | null;
export type ActivityInviteSort = 'recent' | 'relevant';
export type ActivityMemberRequestKind = 'invite' | 'join' | null;
export type ActivityMemberRole = 'Admin' | 'Member' | 'Manager';

export interface AssetMemberRequest {
  id: string;
  userId?: string;
  name: string;
  initials: string;
  gender: 'woman' | 'man';
  status: AssetRequestStatus;
  note: string;
}

export interface AssetCard {
  id: string;
  type: AssetType;
  title: string;
  subtitle: string;
  city: string;
  capacityTotal: number;
  details: string;
  imageUrl: string;
  sourceLink: string;
  routes?: string[];
  requests: AssetMemberRequest[];
}

export interface SubEventResourceCard {
  id: string;
  type: SubEventResourceFilter;
  sourceAssetId: string | null;
  title: string;
  subtitle: string;
  city: string;
  details: string;
  imageUrl: string;
  sourceLink: string;
  routes: string[];
  capacityTotal: number;
  accepted: number;
  pending: number;
  isMembers: boolean;
}

export interface SubEventAssignedAssetSettings {
  capacityMin: number;
  capacityMax: number;
  addedByUserId: string;
  routes: string[];
}

export interface SubEventAssetMembersContext {
  subEventId: string;
  assetId: string;
  type: 'Car' | 'Accommodation';
  ownerUserId: string | null;
}

export interface SubEventSupplyContributionEntry {
  id: string;
  userId: string;
  quantity: number;
  addedAtIso: string;
}

export interface SubEventSupplyContributionRow {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: 'woman' | 'man';
  age: number;
  city: string;
  addedAtIso: string;
  quantity: number;
}

export interface ActivityMemberEntry {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: 'woman' | 'man';
  city: string;
  statusText: string;
  role: ActivityMemberRole;
  status: ActivityMemberStatus;
  pendingSource: ActivityPendingSource;
  requestKind: ActivityMemberRequestKind;
  invitedByActiveUser: boolean;
  metAtIso: string;
  actionAtIso: string;
  metWhere: string;
  relevance: number;
  avatarUrl: string;
}
