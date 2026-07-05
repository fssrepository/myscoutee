// Entry
export const AUTH_MODES = ['selector', 'firebase'] as const;
export type AuthMode = typeof AUTH_MODES[number];

// Activity
export const ACTIVITY_MEMBER_STATUSES = ['pending', 'accepted', 'disqualified'] as const;
export type ActivityMemberStatus = typeof ACTIVITY_MEMBER_STATUSES[number];

export const ACTIVITY_PENDING_SOURCES = ['admin', 'member', null] as const;
export type ActivityPendingSource = typeof ACTIVITY_PENDING_SOURCES[number];

export const ACTIVITY_PENDING_REASONS = ['approval', 'waitlist', null] as const;
export type ActivityPendingReason = typeof ACTIVITY_PENDING_REASONS[number];

export const ACTIVITY_INVITE_SORTS = ['recent', 'relevant'] as const;
export type ActivityInviteSort = typeof ACTIVITY_INVITE_SORTS[number];

export const ACTIVITY_MEMBER_REQUEST_KINDS = ['invite', 'join', 'waitlist', 'waitlist-invite', null] as const;
export type ActivityMemberRequestKind = typeof ACTIVITY_MEMBER_REQUEST_KINDS[number];

export const ACTIVITY_MEMBER_ROLES = ['Admin', 'Member', 'Manager'] as const;
export type ActivityMemberRole = typeof ACTIVITY_MEMBER_ROLES[number];

export const ACTIVITY_MEMBER_OWNER_TYPES = ['event', 'subEvent', 'group', 'asset'] as const;
export type ActivityMemberOwnerType = typeof ACTIVITY_MEMBER_OWNER_TYPES[number];

// Asset
export const ASSET_TYPE_TRANSPORT = 'Transport' as const;
export const ASSET_TYPE_ACCOMMODATION = 'Accommodation' as const;
export const ASSET_TYPE_SUPPLIES = 'Supplies' as const;
export const ASSET_FILTER_TICKET = 'Ticket' as const;

export const ASSET_TYPES = [ASSET_TYPE_TRANSPORT, ASSET_TYPE_ACCOMMODATION, ASSET_TYPE_SUPPLIES] as const;
export type AssetType = typeof ASSET_TYPES[number];

export const ASSET_FILTER_TYPES = [...ASSET_TYPES, ASSET_FILTER_TICKET] as const;
export type AssetFilterType = typeof ASSET_FILTER_TYPES[number];

export const SUB_EVENT_RESOURCE_FILTERS = ['Members', ...ASSET_TYPES] as const;
export type SubEventResourceFilter = typeof SUB_EVENT_RESOURCE_FILTERS[number];

export const ASSET_REQUEST_ACTIONS = ['accept', 'remove', 'makeManager', 'manage'] as const;
export type AssetRequestAction = typeof ASSET_REQUEST_ACTIONS[number];

export const ASSET_REQUEST_STATUSES = ['pending', 'accepted'] as const;
export type AssetRequestStatus = typeof ASSET_REQUEST_STATUSES[number];

export const ASSET_TICKET_ORDERS = ['upcoming', 'past'] as const;
export type AssetTicketOrder = typeof ASSET_TICKET_ORDERS[number];

export const ASSET_REQUEST_KINDS = ['manual', 'borrow'] as const;
export type AssetRequestKind = typeof ASSET_REQUEST_KINDS[number];

export type AssetCategory = string;

export const TRANSPORT_CATEGORY_SEDAN = 'Sedan' as const;
export const TRANSPORT_CATEGORY_SUV = 'SUV' as const;
export const TRANSPORT_CATEGORY_VAN = 'Van' as const;
export const TRANSPORT_CATEGORY_BUS = 'Bus' as const;
export const TRANSPORT_CATEGORY_TRUCK = 'Truck' as const;
export const TRANSPORT_CATEGORY_MOTORCYCLE = 'Motorcycle' as const;
export const TRANSPORT_CATEGORY_BICYCLE = 'Bicycle' as const;
export const TRANSPORT_CATEGORY_BOAT = 'Boat' as const;
export const TRANSPORT_CATEGORY_FLIGHT = 'Flight' as const;
export const TRANSPORT_CATEGORY_SHUTTLE = 'Shuttle' as const;

export const ACCOMMODATION_CATEGORY_HOTEL = 'Hotel' as const;
export const ACCOMMODATION_CATEGORY_APARTMENT = 'Apartment' as const;
export const ACCOMMODATION_CATEGORY_HOUSE = 'House' as const;
export const ACCOMMODATION_CATEGORY_ROOM = 'Room' as const;
export const ACCOMMODATION_CATEGORY_VENUE = 'Venue' as const;
export const ACCOMMODATION_CATEGORY_CAMPSITE = 'Campsite' as const;
export const ACCOMMODATION_CATEGORY_STORAGE = 'Storage' as const;
export const ACCOMMODATION_CATEGORY_WORKSPACE = 'Workspace' as const;

export const SUPPLIES_CATEGORY_CAMPING = 'Camping' as const;
export const SUPPLIES_CATEGORY_COOKING = 'Cooking' as const;
export const SUPPLIES_CATEGORY_GAMES = 'Games' as const;
export const SUPPLIES_CATEGORY_AUDIO = 'Audio' as const;
export const SUPPLIES_CATEGORY_SPORTS = 'Sports' as const;
export const SUPPLIES_CATEGORY_SAFETY = 'Safety' as const;
export const SUPPLIES_CATEGORY_DECOR = 'Decor' as const;
export const SUPPLIES_CATEGORY_TECH = 'Tech' as const;

export const TRANSPORT_ASSET_CATEGORIES = [
  TRANSPORT_CATEGORY_SEDAN,
  TRANSPORT_CATEGORY_SUV,
  TRANSPORT_CATEGORY_VAN,
  TRANSPORT_CATEGORY_BUS,
  TRANSPORT_CATEGORY_TRUCK,
  TRANSPORT_CATEGORY_MOTORCYCLE,
  TRANSPORT_CATEGORY_BICYCLE,
  TRANSPORT_CATEGORY_BOAT,
  TRANSPORT_CATEGORY_FLIGHT,
  TRANSPORT_CATEGORY_SHUTTLE
] as const;

export const ACCOMMODATION_ASSET_CATEGORIES = [
  ACCOMMODATION_CATEGORY_HOTEL,
  ACCOMMODATION_CATEGORY_APARTMENT,
  ACCOMMODATION_CATEGORY_HOUSE,
  ACCOMMODATION_CATEGORY_ROOM,
  ACCOMMODATION_CATEGORY_VENUE,
  ACCOMMODATION_CATEGORY_CAMPSITE,
  ACCOMMODATION_CATEGORY_STORAGE,
  ACCOMMODATION_CATEGORY_WORKSPACE
] as const;

export const SUPPLIES_ASSET_CATEGORIES = [
  SUPPLIES_CATEGORY_CAMPING,
  SUPPLIES_CATEGORY_COOKING,
  SUPPLIES_CATEGORY_GAMES,
  SUPPLIES_CATEGORY_AUDIO,
  SUPPLIES_CATEGORY_SPORTS,
  SUPPLIES_CATEGORY_SAFETY,
  SUPPLIES_CATEGORY_DECOR,
  SUPPLIES_CATEGORY_TECH
] as const;

export const ASSET_CATEGORY_OPTIONS_BY_TYPE = {
  [ASSET_TYPE_TRANSPORT]: TRANSPORT_ASSET_CATEGORIES,
  [ASSET_TYPE_ACCOMMODATION]: ACCOMMODATION_ASSET_CATEGORIES,
  [ASSET_TYPE_SUPPLIES]: SUPPLIES_ASSET_CATEGORIES
} as const satisfies Record<AssetType, readonly AssetCategory[]>;

export function isAssetType(value: unknown): value is AssetType {
  return ASSET_TYPES.includes(value as AssetType);
}

export function isAssetFilterType(value: unknown): value is AssetFilterType {
  return ASSET_FILTER_TYPES.includes(value as AssetFilterType);
}

export const ASSET_LIFECYCLE_STATUSES = [
  'A',
  'UR',
  'B',
  'D',
  'I',
  'T',
  'active',
  'under-review',
  'blocked',
  'deleted',
  'inactive',
  'trashed'
] as const;
export type AssetLifecycleStatus = typeof ASSET_LIFECYCLE_STATUSES[number];

// Event
export const EVENT_VISIBILITIES = ['Public', 'Friends only', 'Invitation only'] as const;
export type EventVisibility = typeof EVENT_VISIBILITIES[number];

export const EVENT_FEEDBACK_LIST_FILTERS = ['own-events', 'pending', 'feedbacked', 'removed'] as const;
export type EventFeedbackListFilter = typeof EVENT_FEEDBACK_LIST_FILTERS[number];

// Pricing
export const PRICING_MODES = ['fixed', 'demand-based', 'time-based', 'hybrid'] as const;
export type PricingMode = typeof PRICING_MODES[number];

export const PRICING_TAX_MODES = ['excluded', 'included'] as const;
export type PricingTaxMode = typeof PRICING_TAX_MODES[number];

export const PRICING_CHARGE_TYPES = ['per_attendee', 'per_booking', 'per_slot'] as const;
export type PricingChargeType = typeof PRICING_CHARGE_TYPES[number];

export const PRICING_ROUNDING_MODES = ['none', 'whole', 'half'] as const;
export type PricingRoundingMode = typeof PRICING_ROUNDING_MODES[number];

export const PRICING_RULE_ACTION_KINDS = ['increase_percent', 'decrease_percent', 'set_exact_price'] as const;
export type PricingRuleActionKind = typeof PRICING_RULE_ACTION_KINDS[number];

export const PRICING_RULE_SCOPES = ['all_slots', 'selected_slots'] as const;
export type PricingRuleScope = typeof PRICING_RULE_SCOPES[number];

export const PRICING_DEMAND_OPERATORS = ['gte', 'lte'] as const;
export type PricingDemandOperator = typeof PRICING_DEMAND_OPERATORS[number];

export const PRICING_TIME_RULE_TRIGGERS = ['days_before_start', 'hours_before_start', 'specific_date'] as const;
export type PricingTimeRuleTrigger = typeof PRICING_TIME_RULE_TRIGGERS[number];

export const PRICING_CANCELLATION_UNITS = ['hours', 'days', 'weeks', 'months'] as const;
export type PricingCancellationUnit = typeof PRICING_CANCELLATION_UNITS[number];

export const PRICING_CANCELLATION_REFUND_KINDS = ['percent', 'fixed_amount', 'full', 'none'] as const;
export type PricingCancellationRefundKind = typeof PRICING_CANCELLATION_REFUND_KINDS[number];

// Profile
export const CURRENT_PROFILE_FORM_VERSION = 2;

export const PROFILE_STATUSES = [
  'public',
  'friends only',
  'host only',
  'inactive',
  'blocked',
  'deleted',
  'onboarding'
] as const;
export type ProfileStatus = typeof PROFILE_STATUSES[number];

export const DETAIL_PRIVACIES = ['Public', 'Friends', 'Hosts', 'Private'] as const;
export type DetailPrivacy = typeof DETAIL_PRIVACIES[number];

// User
export const USER_GENDERS = ['woman', 'man'] as const;
export type UserGender = typeof USER_GENDERS[number];
