import type {
  ActivitiesChatContextFilter,
  ActivitiesPrimaryFilter,
  ActivitiesSecondaryFilter,
  ActivitiesView,
  EventBlindMode,
  EventExploreOrder,
  RateFilterKey,
  EventMode,
  TournamentLeaderboardType
} from './core/contracts';
import type {
  ExplainableSurface,
  HelpCenterHeaderColor,
  HelpCenterRevisionDto,
  HelpCenterSectionDto
} from './core/contracts';
import type {
  EventFeedbackOption,
  EventFeedbackTraitOption
} from './ui/models';
import {
  ASSET_CATEGORY_OPTIONS_BY_TYPE as CORE_ASSET_CATEGORY_OPTIONS_BY_TYPE,
  ASSET_FILTER_TYPES,
  ASSET_FILTER_TICKET,
  ASSET_TYPE_ACCOMMODATION,
  ASSET_TYPE_SUPPLIES,
  ASSET_TYPE_TRANSPORT,
  ASSET_TYPES,
  EVENT_FEEDBACK_LIST_FILTERS,
  EVENT_VISIBILITIES,
  SUB_EVENT_RESOURCE_FILTERS
} from './core/common/constants';
import type {
  AssetCategory,
  AssetFilterType,
  AssetType,
  DetailPrivacy,
  EventFeedbackListFilter,
  EventVisibility,
  ProfileStatus,
  SubEventResourceFilter
} from './core/common/constants';
import type { AdminNotificationScheduleFrequency } from './core/contracts/admin.interface';
import { GDPR_CONTENT } from './gdpr-data';
import type {
  ExperienceEntry,
  InterestOptionGroup,
  ValuesOptionGroup
} from './core/contracts/profile.interface';

export type RateFilterEntry =
  | { kind: 'group'; label: string }
  | { kind: 'item'; key: RateFilterKey; label: string };

interface PersonalityTraitCatalogEntry {
  id: string;
  label: string;
  aliases: string[];
  icon: string;
  coreVibe: string;
  highlights: string[];
  toneClass: string;
}

type NavigatorMenuPalette =
  | 'blue'
  | 'brown'
  | 'gold'
  | 'green'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'sky'
  | 'slate'
  | 'teal'
  | 'violet';

interface NavigatorHostTierPresenterEntry {
  id: string;
  aliases: string[];
  icon: string;
  colorClass: string;
  toneClass: string;
  menuPalette: NavigatorMenuPalette;
}

interface NavigatorHostTierPresenterDefault {
  aliases: string[];
  icon: string;
  colorClass: string;
  toneClass: string;
  menuPalette: NavigatorMenuPalette;
}

interface NavigatorTraitPresenterEntry {
  id: string;
  aliases: string[];
  icon: string;
  colorClass: string;
  toneClass: string;
  menuPalette: NavigatorMenuPalette;
  memberTitle: string;
}

interface NavigatorTraitPresenterDefault {
  aliases: string[];
  icon: string;
  colorClass: string;
  toneClass: string;
  menuPalette: NavigatorMenuPalette;
  memberTitle: string;
}

const VIBE_CATEGORIES = ['Energetic', 'Social', 'Deep', 'Relaxed', 'Creative', 'Exclusive', 'Focused'];
const HOSTED_EVENT_TYPES = ['Road Trip', 'Game Night', 'Brunch', 'Hiking', 'Coffee Meetup', 'Sports'];
const VIBE_ICONS: Record<string, string> = {
  Energetic: '🔥',
  Social: '💬',
  Deep: '🧠',
  Relaxed: '🌿',
  Creative: '🎨',
  Exclusive: '🥂',
  Focused: '🎯'
};
const CATEGORY_ICONS: Record<string, string> = {
  Sports: '🏅',
  'Road Trip': '🛣️',
  Outdoors: '🌲',
  Games: '🎮',
  Culture: '🎭'
};
const MEMBER_TRAIT_ICONS: Record<string, string> = {
  Adventurer: '🔥',
  'Deep Thinker': '🧠',
  Empath: '💛'
};
const NAVIGATOR_HOST_TIER_PRESENTERS: NavigatorHostTierPresenterEntry[] = [
  {
    id: 'platinum',
    aliases: ['platinum'],
    icon: 'diamond',
    colorClass: 'icon-tier-platinum',
    toneClass: 'impression-shortcut-tone-platinum',
    menuPalette: 'sky'
  },
  {
    id: 'gold',
    aliases: ['gold'],
    icon: 'emoji_events',
    colorClass: 'icon-tier-gold',
    toneClass: 'impression-shortcut-tone-gold',
    menuPalette: 'gold'
  },
  {
    id: 'silver',
    aliases: ['silver'],
    icon: 'workspace_premium',
    colorClass: 'icon-tier-silver',
    toneClass: 'impression-shortcut-tone-silver',
    menuPalette: 'slate'
  },
  {
    id: 'bronze',
    aliases: ['bronze'],
    icon: 'military_tech',
    colorClass: 'icon-tier-bronze',
    toneClass: 'impression-shortcut-tone-bronze',
    menuPalette: 'brown'
  }
];
const NAVIGATOR_HOST_TIER_PRESENTER_DEFAULT: NavigatorHostTierPresenterDefault = {
  aliases: [],
  icon: 'workspace_premium',
  colorClass: 'icon-tier-default',
  toneClass: 'impression-shortcut-tone-platinum',
  menuPalette: 'blue'
};
const NAVIGATOR_TRAIT_PRESENTERS: NavigatorTraitPresenterEntry[] = [
  {
    id: 'creative',
    aliases: ['kreat', 'creative'],
    icon: 'palette',
    colorClass: 'icon-trait-creative',
    toneClass: 'impression-shortcut-tone-creative',
    menuPalette: 'violet',
    memberTitle: 'Creative Attendee'
  },
  {
    id: 'empath',
    aliases: ['empat', 'empath'],
    icon: 'favorite',
    colorClass: 'icon-trait-empath',
    toneClass: 'impression-shortcut-tone-empath',
    menuPalette: 'pink',
    memberTitle: 'Empathetic Attendee'
  },
  {
    id: 'reliable',
    aliases: ['megbizh', 'reliable'],
    icon: 'verified',
    colorClass: 'icon-trait-reliable',
    toneClass: 'impression-shortcut-tone-reliable',
    menuPalette: 'green',
    memberTitle: 'Reliable Attendee'
  },
  {
    id: 'adventurer',
    aliases: ['advent'],
    icon: 'hiking',
    colorClass: 'icon-trait-adventurer',
    toneClass: 'impression-shortcut-tone-adventurer',
    menuPalette: 'sky',
    memberTitle: 'Adventurous Attendee'
  },
  {
    id: 'thinker',
    aliases: ['think'],
    icon: 'psychology',
    colorClass: 'icon-trait-thinker',
    toneClass: 'impression-shortcut-tone-thinker',
    menuPalette: 'blue',
    memberTitle: 'Thoughtful Attendee'
  },
  {
    id: 'social',
    aliases: ['social'],
    icon: 'groups',
    colorClass: 'icon-trait-social',
    toneClass: 'impression-shortcut-tone-social',
    menuPalette: 'teal',
    memberTitle: 'Social Attendee'
  },
  {
    id: 'playful',
    aliases: ['playful'],
    icon: 'sports_esports',
    colorClass: 'icon-trait-playful',
    toneClass: 'impression-shortcut-tone-playful',
    menuPalette: 'orange',
    memberTitle: 'Playful Attendee'
  },
  {
    id: 'ambitious',
    aliases: ['ambitious', 'goal'],
    icon: 'trending_up',
    colorClass: 'icon-trait-ambitious',
    toneClass: 'impression-shortcut-tone-ambitious',
    menuPalette: 'purple',
    memberTitle: 'Ambitious Attendee'
  }
];
const NAVIGATOR_MEMBER_IMPRESSION_TITLE_PRESENTERS: NavigatorTraitPresenterEntry[] = [
  NAVIGATOR_TRAIT_PRESENTERS[1],
  NAVIGATOR_TRAIT_PRESENTERS[3],
  NAVIGATOR_TRAIT_PRESENTERS[0],
  NAVIGATOR_TRAIT_PRESENTERS[4],
  NAVIGATOR_TRAIT_PRESENTERS[5],
  NAVIGATOR_TRAIT_PRESENTERS[6],
  NAVIGATOR_TRAIT_PRESENTERS[7],
  NAVIGATOR_TRAIT_PRESENTERS[2]
].filter((entry): entry is NavigatorTraitPresenterEntry => Boolean(entry));
const NAVIGATOR_TRAIT_PRESENTER_DEFAULT: NavigatorTraitPresenterDefault = {
  aliases: [],
  icon: 'auto_awesome',
  colorClass: 'icon-trait-default',
  toneClass: 'impression-shortcut-tone-thinker',
  menuPalette: 'violet',
  memberTitle: 'Attendee'
};
const PERSONALITY_TRAIT_CATALOG: PersonalityTraitCatalogEntry[] = [
  {
    id: 'social-charmer',
    label: 'Social Charmer',
    aliases: ['The Social Charmer'],
    icon: 'group',
    coreVibe: 'Warm, magnetic, easy to talk to',
    highlights: ['Friendly', 'Outgoing', 'Funny'],
    toneClass: 'trait-tone-social'
  },
  {
    id: 'deep-thinker',
    label: 'Deep Thinker',
    aliases: ['The Deep Thinker'],
    icon: 'psychology',
    coreVibe: 'Reflective, intellectual, meaningful',
    highlights: ['Thoughtful', 'Curious', 'Insightful'],
    toneClass: 'trait-tone-deep'
  },
  {
    id: 'adventurer',
    label: 'Adventurer',
    aliases: ['The Adventurer'],
    icon: 'explore',
    coreVibe: 'Energetic, bold, spontaneous',
    highlights: ['Spontaneous', 'Brave', 'Active'],
    toneClass: 'trait-tone-adventure'
  },
  {
    id: 'reliable-one',
    label: 'Reliable One',
    aliases: ['The Reliable One', 'Megbizhato', 'Megbízható'],
    icon: 'verified_user',
    coreVibe: 'Stable, trustworthy, grounded',
    highlights: ['Loyal', 'Honest', 'Dependable'],
    toneClass: 'trait-tone-reliable'
  },
  {
    id: 'creative-soul',
    label: 'Creative Soul',
    aliases: ['The Creative Soul', 'Kreativ', 'Kreatív'],
    icon: 'palette',
    coreVibe: 'Expressive, imaginative, artistic',
    highlights: ['Artistic', 'Unique', 'Visionary'],
    toneClass: 'trait-tone-creative'
  },
  {
    id: 'empath',
    label: 'Empath',
    aliases: ['The Empath', 'Empatikus'],
    icon: 'favorite',
    coreVibe: 'Kind, emotionally safe, nurturing',
    highlights: ['Caring', 'Supportive', 'Patient'],
    toneClass: 'trait-tone-empath'
  },
  {
    id: 'ambitious-go-getter',
    label: 'Ambitious Go-Getter',
    aliases: ['The Ambitious Go-Getter'],
    icon: 'trending_up',
    coreVibe: 'Driven, goal-oriented, high standards',
    highlights: ['Motivated', 'Focused', 'Strategic thinker'],
    toneClass: 'trait-tone-ambitious'
  },
  {
    id: 'playful-spirit',
    label: 'Playful Spirit',
    aliases: ['The Playful Spirit'],
    icon: 'celebration',
    coreVibe: 'Lighthearted, fun, youthful',
    highlights: ['Silly', 'Optimistic', 'Witty'],
    toneClass: 'trait-tone-playful'
  }
];
const EVENT_FEEDBACK_PERSONALITY_TRAIT_OPTIONS: EventFeedbackTraitOption[] = PERSONALITY_TRAIT_CATALOG.map(trait => ({
  id: trait.id,
  label: trait.label,
  icon: trait.icon,
  coreVibe: trait.coreVibe
}));
const PHYSIQUE_OPTIONS = ['Slim', 'Lean', 'Athletic', 'Fit', 'Curvy', 'Average', 'Muscular'];
const LANGUAGE_SUGGESTIONS = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Hungarian',
  'Romanian',
  'Polish',
  'Dutch',
  'Turkish',
  'Arabic',
  'Hindi',
  'Japanese',
  'Korean',
  'Mandarin'
];
const CONTENT_LANGUAGES = [
  { lang: 'en', label: 'English' },
  { lang: 'hu', label: 'Magyar' }
];
const HELP_CENTER_HEADER_COLORS: readonly HelpCenterHeaderColor[] = [
  'amber',
  'blue',
  'green',
  'rose',
  'violet',
  'slate'
];
const HELP_CENTER_HEADER_COLOR_OPTIONS: Array<{ id: HelpCenterHeaderColor; label: string }> = [
  { id: 'amber', label: 'Amber' },
  { id: 'blue', label: 'Blue' },
  { id: 'green', label: 'Green' },
  { id: 'rose', label: 'Rose' },
  { id: 'violet', label: 'Violet' },
  { id: 'slate', label: 'Slate' }
];
const DOCUMENT_VIEWER_HEADER_PALETTES = [
  'amber',
  'blue',
  'green',
  'rose',
  'violet',
  'slate',
  'teal'
] as const;
const EXPLAINABLE_SURFACES: ExplainableSurface[] = [
  { key: 'home.game', label: 'Home cards', icon: 'style', owner: 'route', order: 10, enabled: true },
  { key: 'activities.rates', label: 'Activity ratings', icon: 'star', owner: 'popup', order: 20, enabled: true },
  { key: 'chats', label: 'Chats', icon: 'forum', owner: 'popup', order: 25, enabled: true },
  { key: 'profile.editor', label: 'Profile editor', icon: 'manage_accounts', owner: 'popup', order: 30, enabled: true },
  { key: 'profile.view', label: 'Profile details', icon: 'visibility', owner: 'popup', order: 40, enabled: true },
  { key: 'contacts', label: 'Contacts', icon: 'contacts', owner: 'popup', order: 45, enabled: true },
  { key: 'assets', label: 'Assets', icon: 'inventory_2', owner: 'popup', order: 50, enabled: true },
  { key: 'assets.transport', label: 'Assets · Transport', icon: 'directions_car', owner: 'popup', order: 51, enabled: true },
  { key: 'assets.accommodation', label: 'Assets · Accommodation', icon: 'apartment', owner: 'popup', order: 52, enabled: true },
  { key: 'assets.supplies', label: 'Assets · Supplies', icon: 'inventory_2', owner: 'popup', order: 53, enabled: true },
  { key: 'assets.tickets', label: 'Assets · Tickets', icon: 'qr_code_2', owner: 'popup', order: 54, enabled: true },
  { key: 'events', label: 'Events', icon: 'event_note', owner: 'popup', order: 60, enabled: true },
  { key: 'event.editor', label: 'Event editor', icon: 'edit_calendar', owner: 'popup', order: 65, enabled: true },
  { key: 'event.feedback', label: 'Event feedback', icon: 'rate_review', owner: 'popup', order: 70, enabled: true }
];
const PROFILE_STATUS_OPTIONS: Array<{ value: ProfileStatus; icon: string }> = [
  { value: 'public', icon: 'public' },
  { value: 'friends only', icon: 'groups' },
  { value: 'host only', icon: 'stadium' },
  { value: 'inactive', icon: 'visibility_off' }
];

const PROFILE_DETAIL_GROUP_TEMPLATES: Array<{
  title: string;
  rows: Array<{ labelKey: string; privacy: DetailPrivacy }>;
}> = [
  {
    title: 'Basics',
    rows: [
      { labelKey: 'profile.name', privacy: 'Public' },
      { labelKey: 'profile.city', privacy: 'Public' },
      { labelKey: 'profile.birthday', privacy: 'Friends' },
      { labelKey: 'profile.height', privacy: 'Friends' },
      { labelKey: 'profile.physique', privacy: 'Friends' },
      { labelKey: 'profile.languages', privacy: 'Public' },
      { labelKey: 'profile.horoscope', privacy: 'Public' }
    ]
  },
  {
    title: 'Lifestyle',
    rows: [
      { labelKey: 'profile.details.interest', privacy: 'Friends' },
      { labelKey: 'profile.details.drinking', privacy: 'Friends' },
      { labelKey: 'profile.details.smoking', privacy: 'Friends' },
      { labelKey: 'profile.details.workout', privacy: 'Public' },
      { labelKey: 'profile.details.pets', privacy: 'Public' }
    ]
  },
  {
    title: 'Relationships',
    rows: [
      { labelKey: 'profile.details.familyPlans', privacy: 'Hosts' },
      { labelKey: 'profile.details.children', privacy: 'Private' },
      { labelKey: 'profile.details.loveStyle', privacy: 'Hosts' },
      { labelKey: 'profile.details.communicationStyle', privacy: 'Friends' },
      { labelKey: 'profile.details.sexualOrientation', privacy: 'Hosts' },
      { labelKey: 'profile.gender', privacy: 'Public' }
    ]
  },
  {
    title: 'Beliefs',
    rows: [
      { labelKey: 'profile.details.religion', privacy: 'Private' },
      { labelKey: 'profile.details.values', privacy: 'Friends' }
    ]
  }
];

const PROFILE_DETAIL_VALUE_OPTIONS: Record<string, string[]> = {
  'profile.details.drinking': ['Never', 'Socially', 'Occasionally', 'Weekends only'],
  'profile.details.smoking': ['Never', 'Socially', 'Occasionally', 'Trying to quit'],
  'profile.details.workout': ['Daily', '4x / week', '2-3x / week', 'Rarely'],
  'profile.details.pets': ['Dog-friendly', 'Cat-friendly', 'All pets welcome', 'No pets'],
  'profile.details.familyPlans': ['Wants children', 'Open to children', 'Not sure yet', 'Does not want children'],
  'profile.details.children': ['No', 'Yes', 'Prefer not to say'],
  'profile.details.loveStyle': ['Long-term partnership', 'Slow-burn connection', 'Open relationship', 'Exploring'],
  'profile.details.communicationStyle': ['Direct + warm', 'Calm + reflective', 'Playful + light', 'Honest + concise'],
  'profile.details.sexualOrientation': ['Straight', 'Bisexual', 'Gay', 'Lesbian', 'Pansexual', 'Asexual', 'Prefer not to say'],
  'profile.gender': ['Woman', 'Man', 'Non-binary', 'Prefer not to say'],
  'profile.details.religion': ['Spiritual but not religious', 'Christian', 'Muslim', 'Jewish', 'Buddhist', 'Hindu', 'Atheist', 'Prefer not to say'],
  'profile.details.values': [
    'Family-first, social impact, balanced life',
    'Career-driven, growth-oriented, adventurous',
    'Sustainability, empathy, community',
    'Creativity, freedom, authenticity'
  ]
};
const BELIEFS_VALUES_OPTION_GROUPS: ValuesOptionGroup[] = [
  {
    title: 'Relationship & Family',
    shortTitle: 'Family',
    icon: '👪',
    toneClass: 'section-family',
    options: [
      'Long-term partnership',
      'Marriage-oriented',
      'Casual dating',
      'Open / Exploring',
      'Family-first',
      'Wants children',
      'Independent lifestyle'
    ]
  },
  {
    title: 'Life Focus & Ambition',
    shortTitle: 'Ambition',
    icon: '🎯',
    toneClass: 'section-ambition',
    options: [
      'Career-focused',
      'Entrepreneurial',
      'Stability-focused',
      'Balanced work-life',
      'Freedom-oriented',
      'Goal-driven'
    ]
  },
  {
    title: 'Lifestyle Orientation',
    shortTitle: 'Lifestyle',
    icon: '🌿',
    toneClass: 'section-lifestyle',
    options: [
      'Health & wellness focused',
      'Fitness-driven',
      'Mindfulness-oriented',
      'Social / party lifestyle',
      'Calm / home-centered',
      'Adventure-driven',
      'Balanced lifestyle'
    ]
  },
  {
    title: 'Beliefs & Worldview',
    shortTitle: 'Beliefs',
    icon: '✨',
    toneClass: 'section-beliefs',
    options: [
      'Faith-oriented',
      'Spiritual but not religious',
      'Secular',
      'Traditional values',
      'Progressive values',
      'Community-driven',
      'Social impact oriented',
      'Environmentally conscious',
      'Politically engaged',
      'Apolitical'
    ]
  }
];
const INTEREST_OPTION_GROUPS: InterestOptionGroup[] = [
  {
    title: 'Social & Lifestyle',
    shortTitle: 'Social',
    icon: '🥂',
    toneClass: 'section-social',
    options: ['#GoingOut', '#Nightlife', '#StayingIn', '#Brunch', '#WineTasting', '#CoffeeDates', '#ContentCreation', '#InfluencerLife']
  },
  {
    title: 'Arts & Entertainment',
    shortTitle: 'Arts',
    icon: '🎭',
    toneClass: 'section-arts',
    options: ['#Music', '#Concerts', '#Festivals', '#Movies', '#TVShows', '#Theatre', '#Gaming', '#Anime', '#Books', '#Photography', '#Creativity']
  },
  {
    title: 'Food & Experiences',
    shortTitle: 'Food',
    icon: '🍽',
    toneClass: 'section-food',
    options: ['#Foodie', '#FineDining', '#StreetFood', '#Cooking', '#Cocktails', '#CraftBeer', '#Travel', '#LuxuryExperiences']
  },
  {
    title: 'Active & Adventure',
    shortTitle: 'Active',
    icon: '🏕',
    toneClass: 'section-active',
    options: ['#Sports', '#Gym', '#Running', '#Hiking', '#Outdoors', '#ExtremeSports', '#Yoga', '#Fitness']
  },
  {
    title: 'Mind & Wellness',
    shortTitle: 'Mind',
    icon: '🧘',
    toneClass: 'section-mind',
    options: ['#Wellness', '#Meditation', '#SelfDevelopment', '#MentalHealth', '#Spirituality', '#Biohacking', '#HealthyLifestyle']
  },
  {
    title: 'Values & Identity',
    shortTitle: 'Identity',
    icon: '🌍',
    toneClass: 'section-identity',
    options: ['#Sustainability', '#Entrepreneurship', '#CareerDriven', '#FamilyOriented', '#Activism', '#Tech', '#Minimalism']
  }
];
const DETAIL_PRIVACY_OPTIONS: DetailPrivacy[] = ['Public', 'Friends', 'Hosts', 'Private'];
const EXPERIENCE_FILTER_OPTIONS: Array<'All' | ExperienceEntry['type']> = [
  'All',
  'Workspace',
  'School',
  'Online Session',
  'Additional Project'
];
const EXPERIENCE_TYPE_OPTIONS: Array<ExperienceEntry['type']> = ['Workspace', 'School', 'Online Session', 'Additional Project'];

const PROFILE_SAMPLE_EXPERIENCE_ENTRIES: ExperienceEntry[] = [
  {
    id: 'exp-1',
    type: 'School',
    title: 'BSc Computer Science',
    org: 'State University',
    city: 'Austin',
    dateFrom: '2014-09',
    dateTo: '2018-06',
    description: 'Software engineering and distributed systems.'
  },
  {
    id: 'exp-2',
    type: 'Additional Project',
    title: 'Community Event Platform',
    org: 'Independent Project',
    city: 'Austin',
    dateFrom: '2018-09',
    dateTo: '2019-05',
    description: 'Built MVP with profile, event, and chat modules.'
  },
  {
    id: 'exp-3',
    type: 'Workspace',
    title: 'Community Lead',
    org: 'Studio Tide',
    city: 'Chicago',
    dateFrom: '2019-06',
    dateTo: '2021-08',
    description: 'Owned member engagement and host onboarding.'
  },
  {
    id: 'exp-4',
    type: 'Online Session',
    title: 'Remote Product Sprint',
    org: 'Northwind Labs',
    city: 'Online',
    dateFrom: '2021-10',
    dateTo: '2022-02',
    description: 'Cross-functional delivery for profile editor v2.'
  },
  {
    id: 'exp-5',
    type: 'Workspace',
    title: 'Product Manager',
    org: 'Northwind Labs',
    city: 'Austin',
    dateFrom: '2022-03',
    dateTo: 'Present',
    description: 'Leads social graph and trust product areas.'
  }
];

const ASSET_TYPE_OPTIONS: AssetType[] = [...ASSET_TYPES];
const ASSET_FILTER_OPTIONS: AssetFilterType[] = [...ASSET_FILTER_TYPES];
const ASSET_TYPE_LABELS: Record<AssetFilterType, string> = {
  [ASSET_TYPE_TRANSPORT]: ASSET_TYPE_TRANSPORT,
  [ASSET_TYPE_ACCOMMODATION]: ASSET_TYPE_ACCOMMODATION,
  [ASSET_TYPE_SUPPLIES]: ASSET_TYPE_SUPPLIES,
  [ASSET_FILTER_TICKET]: ASSET_FILTER_TICKET
};
const ASSET_CATEGORY_OPTIONS_BY_TYPE: Record<AssetType, AssetCategory[]> = {
  [ASSET_TYPE_TRANSPORT]: [...CORE_ASSET_CATEGORY_OPTIONS_BY_TYPE[ASSET_TYPE_TRANSPORT]],
  [ASSET_TYPE_ACCOMMODATION]: [...CORE_ASSET_CATEGORY_OPTIONS_BY_TYPE[ASSET_TYPE_ACCOMMODATION]],
  [ASSET_TYPE_SUPPLIES]: [...CORE_ASSET_CATEGORY_OPTIONS_BY_TYPE[ASSET_TYPE_SUPPLIES]]
};
const ACTIVITIES_PRIMARY_FILTERS: Array<{ key: ActivitiesPrimaryFilter; label: string; icon: string }> = [
  { key: 'rates', label: 'Rates', icon: 'star' },
  { key: 'chats', label: 'Chats', icon: 'chat' },
  { key: 'invitations', label: 'Invitations', icon: 'mail' },
  { key: 'events', label: 'Events', icon: 'event' },
  { key: 'hosting', label: 'Hosting', icon: 'stadium' }
];
const ACTIVITIES_SECONDARY_FILTERS: Array<{ key: ActivitiesSecondaryFilter; label: string; icon: string }> = [
  { key: 'recent', label: 'Upcoming', icon: 'schedule' },
  { key: 'relevant', label: 'Relevant', icon: 'auto_awesome' },
  { key: 'past', label: 'Past', icon: 'history' }
];
const ACTIVITIES_CHAT_CONTEXT_FILTERS: Array<{ key: ActivitiesChatContextFilter; label: string; icon: string }> = [
  { key: 'all', label: 'all', icon: 'forum' },
  { key: 'event', label: 'event', icon: 'event' },
  { key: 'subEvent', label: 'sub.event', icon: 'event_available' },
  { key: 'group', label: 'group', icon: 'groups' },
  { key: 'service', label: 'service', icon: 'support_agent' },
  { key: 'appSupport', label: 'app.support', icon: 'admin_panel_settings' }
];
const RATE_FILTERS: Array<{ key: RateFilterKey; label: string }> = [
  { key: 'individual-given', label: 'Given' },
  { key: 'individual-received', label: 'Received' },
  { key: 'individual-mutual', label: 'Mutual' },
  { key: 'individual-met', label: 'Met' },
  { key: 'pair-given', label: 'Given' },
  { key: 'pair-received', label: 'Received' }
];
const RATE_FILTER_ENTRIES: RateFilterEntry[] = [
  { kind: 'group', label: 'Preferences' },
  { kind: 'item', key: 'individual-given', label: 'Given' },
  { kind: 'item', key: 'individual-received', label: 'Received' },
  { kind: 'item', key: 'individual-mutual', label: 'Mutual' },
  { kind: 'item', key: 'individual-met', label: 'Met' },
  { kind: 'group', label: 'Suggestions' },
  { kind: 'item', key: 'pair-given', label: 'Given' },
  { kind: 'item', key: 'pair-received', label: 'Received' }
];
const ACTIVITIES_VIEW_OPTIONS: Array<{ key: ActivitiesView; label: string; icon: string }> = [
  { key: 'month', label: 'Month', icon: 'calendar_month' },
  { key: 'week', label: 'Week', icon: 'date_range' },
  { key: 'day', label: 'Day', icon: 'today' },
  { key: 'distance', label: 'Distance', icon: 'social_distance' }
];
const EVENT_EXPLORE_ORDER_OPTIONS: Array<{ key: EventExploreOrder; label: string; icon: string }> = [
  { key: 'upcoming', label: 'Upcoming', icon: 'event_upcoming' },
  { key: 'past-events', label: 'Korábbi', icon: 'history' },
  { key: 'nearby', label: 'Nearby', icon: 'near_me' },
  { key: 'most-relevant', label: 'Most Relevant', icon: 'auto_awesome' },
  { key: 'top-rated', label: 'Top Rated', icon: 'emoji_events' }
];
const HOME_GAME_FILTER_INTEREST_GROUPS: Array<{ title: string; icon: string; toneClass: string; options: string[] }> = [
    {
      title: 'Social',
      icon: 'celebration',
      toneClass: 'game-filter-group-tone-social',
      options: ['#GoingOut', '#Nightlife', '#StayingIn', '#Brunch', '#WineTasting', '#CoffeeDates', '#ContentCreation', '#InfluencerLife']
    },
    {
      title: 'Arts',
      icon: 'palette',
      toneClass: 'game-filter-group-tone-arts',
      options: ['#Music', '#Concerts', '#Festivals', '#Movies', '#TVShows', '#Theatre', '#Gaming', '#Anime', '#Books', '#Photography', '#Creativity']
    },
    {
      title: 'Food',
      icon: 'restaurant',
      toneClass: 'game-filter-group-tone-food',
      options: ['#Foodie', '#FineDining', '#StreetFood', '#Cooking', '#Cocktails', '#CraftBeer', '#Travel', '#LuxuryExperiences']
    },
    {
      title: 'Active',
      icon: 'hiking',
      toneClass: 'game-filter-group-tone-active',
      options: ['#Sports', '#Gym', '#Running', '#Hiking', '#Outdoors', '#ExtremeSports', '#Yoga', '#Fitness']
    },
    {
      title: 'Mind',
      icon: 'self_improvement',
      toneClass: 'game-filter-group-tone-mind',
      options: ['#Wellness', '#Meditation', '#SelfDevelopment', '#MentalHealth', '#Spirituality', '#Biohacking', '#HealthyLifestyle']
    },
    {
      title: 'Identity',
      icon: 'public',
      toneClass: 'game-filter-group-tone-identity',
      options: ['#Sustainability', '#Entrepreneurship', '#CareerDriven', '#FamilyOriented', '#Activism', '#Tech', '#Minimalism']
    }
  ];
const HOME_GAME_FILTER_VALUES_GROUPS: Array<{ title: string; icon: string; toneClass: string; options: string[] }> = [
    {
      title: 'Family',
      icon: 'family_restroom',
      toneClass: 'game-filter-group-tone-family',
      options: ['Long-term partnership', 'Marriage-oriented', 'Casual dating', 'Open / Exploring', 'Family-first', 'Wants children', 'Independent lifestyle']
    },
    {
      title: 'Ambition',
      icon: 'track_changes',
      toneClass: 'game-filter-group-tone-ambition',
      options: ['Career-focused', 'Entrepreneurial', 'Stability-focused', 'Balanced work-life', 'Freedom-oriented', 'Goal-driven']
    },
    {
      title: 'Lifestyle',
      icon: 'eco',
      toneClass: 'game-filter-group-tone-lifestyle',
      options: ['Health & wellness focused', 'Fitness-driven', 'Mindfulness-oriented', 'Social / party lifestyle', 'Calm / home-centered', 'Adventure-driven', 'Balanced lifestyle']
    },
    {
      title: 'Beliefs',
      icon: 'auto_awesome',
      toneClass: 'game-filter-group-tone-beliefs',
      options: ['Faith-oriented', 'Spiritual but not religious', 'Secular', 'Traditional values', 'Progressive values', 'Community-driven', 'Social impact oriented', 'Environmentally conscious', 'Politically engaged', 'Apolitical']
    }
  ];
const HOME_USER_FACET_BY_ID: Record<string, {
  interests: string[];
  values: string[];
  smoking: string;
  drinking: string;
  workout: string;
  pets: string;
  familyPlans: string;
  children: string;
  loveStyle: string;
  communicationStyle: string;
  sexualOrientation: string;
  religion: string;
}> = {
    u1: {
      interests: ['#Outdoors', '#Travel', '#Brunch'],
      values: ['Family-first', 'Balanced lifestyle', 'Community-driven'],
      smoking: 'socially',
      drinking: 'socially',
      workout: 'daily',
      pets: 'all pets welcome',
      familyPlans: 'wants children',
      children: 'no',
      loveStyle: 'open relationship',
      communicationStyle: 'direct + warm',
      sexualOrientation: 'bisexual',
      religion: 'hindu'
    },
    u2: {
      interests: ['#Sports', '#Gaming', '#Tech'],
      values: ['Career-focused', 'Goal-driven', 'Stability-focused'],
      smoking: 'never',
      drinking: 'socially',
      workout: 'few times / week',
      pets: 'dog person',
      familyPlans: 'wants children',
      children: 'no',
      loveStyle: 'long-term partnership',
      communicationStyle: 'direct + warm',
      sexualOrientation: 'straight',
      religion: 'not religious'
    },
    u3: {
      interests: ['#Concerts', '#Photography', '#Outdoors'],
      values: ['Balanced lifestyle', 'Mindfulness-oriented', 'Community-driven'],
      smoking: 'never',
      drinking: 'occasionally',
      workout: 'few times / week',
      pets: 'cat person',
      familyPlans: 'open to both',
      children: 'no',
      loveStyle: 'slow-burn connection',
      communicationStyle: 'listener first',
      sexualOrientation: 'bisexual',
      religion: 'spiritual'
    },
    u4: {
      interests: ['#Outdoors', '#Sports', '#Travel'],
      values: ['Adventure-driven', 'Social / party lifestyle', 'Balanced lifestyle'],
      smoking: 'occasionally',
      drinking: 'socially',
      workout: 'daily',
      pets: 'all pets welcome',
      familyPlans: 'open to both',
      children: 'no',
      loveStyle: 'exploring',
      communicationStyle: 'energetic',
      sexualOrientation: 'straight',
      religion: 'christian'
    },
    u5: {
      interests: ['#Books', '#Wellness', '#Meditation'],
      values: ['Calm / home-centered', 'Mindfulness-oriented', 'Progressive values'],
      smoking: 'never',
      drinking: 'never',
      workout: 'few times / week',
      pets: 'pet free',
      familyPlans: 'undecided',
      children: 'no',
      loveStyle: 'slow-burn connection',
      communicationStyle: 'listener first',
      sexualOrientation: 'lesbian',
      religion: 'buddhist'
    },
    u6: {
      interests: ['#Travel', '#Outdoors', '#GoingOut'],
      values: ['Adventure-driven', 'Social / party lifestyle', 'Spiritual but not religious'],
      smoking: 'socially',
      drinking: 'socially',
      workout: 'weekly',
      pets: 'dog person',
      familyPlans: 'open to both',
      children: 'yes',
      loveStyle: 'open relationship',
      communicationStyle: 'direct + warm',
      sexualOrientation: 'bisexual',
      religion: 'spiritual'
    },
    u7: {
      interests: ['#Gaming', '#Tech', '#CoffeeDates'],
      values: ['Career-focused', 'Goal-driven', 'Secular'],
      smoking: 'never',
      drinking: 'occasionally',
      workout: 'weekly',
      pets: 'pet free',
      familyPlans: 'not planning',
      children: 'no',
      loveStyle: 'long-term partnership',
      communicationStyle: 'low-key',
      sexualOrientation: 'straight',
      religion: 'not religious'
    },
    u8: {
      interests: ['#Music', '#Movies', '#Foodie'],
      values: ['Balanced lifestyle', 'Community-driven', 'Family-first'],
      smoking: 'occasionally',
      drinking: 'socially',
      workout: 'weekly',
      pets: 'cat person',
      familyPlans: 'open to both',
      children: 'yes',
      loveStyle: 'slow-burn connection',
      communicationStyle: 'listener first',
      sexualOrientation: 'bisexual',
      religion: 'christian'
    },
    u9: {
      interests: ['#Sports', '#Outdoors', '#Travel'],
      values: ['Fitness-driven', 'Goal-driven', 'Stability-focused'],
      smoking: 'never',
      drinking: 'socially',
      workout: 'daily',
      pets: 'dog person',
      familyPlans: 'wants children',
      children: 'no',
      loveStyle: 'long-term partnership',
      communicationStyle: 'direct + warm',
      sexualOrientation: 'straight',
      religion: 'not religious'
    },
    u10: {
      interests: ['#Tech', '#Gaming', '#Movies'],
      values: ['Balanced work-life', 'Career-focused', 'Progressive values'],
      smoking: 'occasionally',
      drinking: 'occasionally',
      workout: 'weekly',
      pets: 'pet free',
      familyPlans: 'undecided',
      children: 'no',
      loveStyle: 'exploring',
      communicationStyle: 'low-key',
      sexualOrientation: 'straight',
      religion: 'not religious'
    },
    u11: {
      interests: ['#Wellness', '#Yoga', '#Books'],
      values: ['Family-first', 'Health & wellness focused', 'Faith-oriented'],
      smoking: 'never',
      drinking: 'never',
      workout: 'few times / week',
      pets: 'all pets welcome',
      familyPlans: 'wants children',
      children: 'yes',
      loveStyle: 'long-term partnership',
      communicationStyle: 'listener first',
      sexualOrientation: 'straight',
      religion: 'hindu'
    },
    u12: {
      interests: ['#Foodie', '#GoingOut', '#CoffeeDates'],
      values: ['Social impact oriented', 'Community-driven', 'Balanced lifestyle'],
      smoking: 'socially',
      drinking: 'socially',
      workout: 'weekly',
      pets: 'all pets welcome',
      familyPlans: 'open to both',
      children: 'no',
      loveStyle: 'open relationship',
      communicationStyle: 'energetic',
      sexualOrientation: 'bisexual',
      religion: 'spiritual'
    }
  };
const ACTIVITY_RATING_SCALE = Array.from({ length: 10 }, (_, index) => index + 1);
const CALENDAR_WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CALENDAR_WEEKDAY_OPTIONS = [
  { value: 1, labelKey: 'weekday.monday' },
  { value: 2, labelKey: 'weekday.tuesday' },
  { value: 3, labelKey: 'weekday.wednesday' },
  { value: 4, labelKey: 'weekday.thursday' },
  { value: 5, labelKey: 'weekday.friday' },
  { value: 6, labelKey: 'weekday.saturday' },
  { value: 7, labelKey: 'weekday.sunday' }
];
const SCHEDULE_FREQUENCY_OPTIONS: Array<{ value: AdminNotificationScheduleFrequency; labelKey: string }> = [
  { value: 'daily', labelKey: 'schedule.frequency.daily' },
  { value: 'weekly', labelKey: 'schedule.frequency.weekly' },
  { value: 'bi-weekly', labelKey: 'schedule.frequency.bi.weekly' },
  { value: 'monthly', labelKey: 'schedule.frequency.monthly' },
  { value: 'yearly', labelKey: 'schedule.frequency.yearly' },
  { value: 'one-time', labelKey: 'schedule.frequency.one.time' }
];
const EVENT_VISIBILITY_OPTIONS: EventVisibility[] = [...EVENT_VISIBILITIES];
const EVENT_BLIND_MODE_OPTIONS: EventBlindMode[] = ['Open Event', 'Blind Event'];
const SUB_EVENT_RESOURCE_FILTER_OPTIONS: SubEventResourceFilter[] = [...SUB_EVENT_RESOURCE_FILTERS];
const SUB_EVENT_RESOURCE_FILTER_LABELS: Record<SubEventResourceFilter, string> = {
  Members: 'Members',
  [ASSET_TYPE_TRANSPORT]: ASSET_TYPE_TRANSPORT,
  [ASSET_TYPE_ACCOMMODATION]: ASSET_TYPE_ACCOMMODATION,
  [ASSET_TYPE_SUPPLIES]: ASSET_TYPE_SUPPLIES
};
const EVENT_MODE_OPTIONS: EventMode[] = ['Casual', 'Tournament'];
const TOURNAMENT_LEADERBOARD_TYPE_OPTIONS: TournamentLeaderboardType[] = ['Score', 'Fifa'];
const ACTIVITY_GROUP_LABELS = {
  dateUnavailable: 'Date unavailable',
  weekPrefix: 'Week'
};
const ACTIVITY_MEMBER_MET_PLACES = [
  'City Center Meetup',
  'Board Game Night',
  'Coffee Social',
  'Hiking Group',
  'Music Event',
  'Brunch Table'
];
const ACTIVITY_MEMBER_DEFAULTS = {
  forcedMetWhere: 'Event Explore'
};
const REPORT_USER_REASONS = [
  'Harassment',
  'Spam',
  'Impersonation',
  'Hate speech',
  'Scam / Fraud',
  'Other'
];
const FEEDBACK_CATEGORIES = [
  'General',
  'Bug report',
  'Feature request',
  'UX improvement',
  'Performance'
];
const EVENT_FEEDBACK_EVENT_OVERALL_OPTIONS: EventFeedbackOption[] = [
  { value: 'excellent', label: 'Excellent', icon: 'sentiment_very_satisfied', impressionTag: 'Host vibe' },
  { value: 'good', label: 'Good', icon: 'sentiment_satisfied', impressionTag: 'Host reliability' },
  { value: 'mixed', label: 'Mixed', icon: 'sentiment_neutral', impressionTag: 'Host consistency' },
  { value: 'needs-work', label: 'Needs work', icon: 'sentiment_dissatisfied', impressionTag: 'Host quality' }
];
const EVENT_FEEDBACK_HOST_IMPROVE_OPTIONS: EventFeedbackOption[] = [
  { value: 'timing', label: 'Improve timing', icon: 'schedule', impressionTag: 'Host organization' },
  { value: 'communication', label: 'Improve communication', icon: 'campaign', impressionTag: 'Host communication' },
  { value: 'resources', label: 'Improve resources', icon: 'inventory_2', impressionTag: 'Host planning' },
  { value: 'none', label: 'No major change', icon: 'verified', impressionTag: 'Host consistency' }
];
const EVENT_FEEDBACK_ATTENDEE_COLLAB_OPTIONS: EventFeedbackOption[] = [
  { value: 'great', label: 'Great teamwork', icon: 'handshake', impressionTag: 'Attendee teamwork' },
  { value: 'reliable', label: 'Reliable', icon: 'verified_user', impressionTag: 'Attendee reliability' },
  { value: 'neutral', label: 'Neutral', icon: 'sentiment_neutral', impressionTag: 'Attendee neutrality' },
  { value: 'rough', label: 'Needs guidance', icon: 'warning_amber', impressionTag: 'Attendee fit' }
];
const EVENT_FEEDBACK_ATTENDEE_REJOIN_OPTIONS: EventFeedbackOption[] = [
  { value: 'yes', label: 'Would team up', icon: 'group', impressionTag: 'Attendee trust' },
  { value: 'maybe', label: 'Maybe', icon: 'hourglass_top', impressionTag: 'Attendee compatibility' },
  { value: 'no', label: 'Not now', icon: 'do_not_disturb_alt', impressionTag: 'Attendee risk' },
  { value: 'context', label: 'Depends on role', icon: 'tune', impressionTag: 'Attendee role-fit' }
];
const EVENT_FEEDBACK_LIST_FILTER_META: Record<EventFeedbackListFilter, { label: string; icon: string }> = {
  'own-events': { label: 'Own Events', icon: 'stadium' },
  pending: { label: 'Pending', icon: 'schedule' },
  feedbacked: { label: 'Feedbacked', icon: 'task_alt' },
  removed: { label: 'Removed', icon: 'delete_outline' }
};
const EVENT_FEEDBACK_LIST_FILTER_OPTIONS: Array<{ key: EventFeedbackListFilter; label: string; icon: string }> =
  EVENT_FEEDBACK_LIST_FILTERS.map(key => ({ key, ...EVENT_FEEDBACK_LIST_FILTER_META[key] }));
const DEFAULT_HELP_CENTER_DESCRIPTION = 'MyScoutee helps you plan events end-to-end: invite people, split into stages/groups, assign resources, and coordinate in context chats.';
const DEFAULT_PRIVACY_CENTER_DESCRIPTION = 'Before continuing, please review and accept how your data is used in MyScoutee.';
const HELP_CENTER_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'events',
    icon: 'event_note',
    title: 'Events and Sub Events',
    blurb: 'Build the full event flow with stages or optional items.',
    contentHtml: `
      <p><strong>Build the full event flow with stages or optional items.</strong></p>
      <p>Create a main event, then split execution into sub events for stages, side activities, or optional sessions.</p>
      <p>Each sub event carries its own date range, description, and status so planning stays clean and trackable.</p>
      <ul>
        <li>Supports casual and tournament structures</li>
        <li>Keeps stage context visible in related screens</li>
        <li>Lets hosts edit details without losing hierarchy</li>
      </ul>
    `,
    details: [
      'Create a main event, then split execution into sub events for stages, side activities, or optional sessions.',
      'Each sub event carries its own date range, description, and status so planning stays clean and trackable.'
    ],
    points: [
      'Supports casual and tournament structures',
      'Keeps stage context visible in related screens',
      'Lets hosts edit details without losing hierarchy'
    ]
  },
  {
    id: 'resources',
    icon: 'inventory_2',
    title: 'Resources and Capacity',
    blurb: 'Assign people, transport, accommodation, and supplies with limits.',
    contentHtml: `
      <p><strong>Assign people, transport, accommodation, and supplies with limits.</strong></p>
      <p>Use resource menus to assign assets into sub events and groups, then adjust capacity ranges directly where needed.</p>
      <p>Badges summarize pending requests and remaining capacity so action priorities are visible at a glance.</p>
      <ul>
        <li>Capacity min/max control per assignment</li>
        <li>Contextual badges for pending requests</li>
        <li>Route and location support for travel resources</li>
      </ul>
    `,
    details: [
      'Use resource menus to assign assets into sub events and groups, then adjust capacity ranges directly where needed.',
      'Badges summarize pending requests and remaining capacity so action priorities are visible at a glance.'
    ],
    points: [
      'Capacity min/max control per assignment',
      'Contextual badges for pending requests',
      'Route and location support for travel resources'
    ]
  },
  {
    id: 'activities',
    icon: 'forum',
    title: 'Activities and Chats',
    blurb: 'Coordinate with context-aware channels and filters.',
    contentHtml: `
      <p><strong>Coordinate with context-aware channels and filters.</strong></p>
      <p>Chat channels follow event scope: main event, optional sub event, and group channels can all coexist.</p>
      <p>Context actions in chat headers help jump directly to related event/sub-event views and resources.</p>
      <ul>
        <li>Fast channel filtering by context</li>
        <li>Unread counters scoped to relevant channels</li>
        <li>Works for both mobile and desktop flows</li>
      </ul>
    `,
    details: [
      'Chat channels follow event scope: main event, optional sub event, and group channels can all coexist.',
      'Context actions in chat headers help jump directly to related event/sub-event views and resources.'
    ],
    points: [
      'Fast channel filtering by context',
      'Unread counters scoped to relevant channels',
      'Works for both mobile and desktop flows'
    ]
  },
  {
    id: 'safety',
    icon: 'verified_user',
    title: 'Profiles and Safety',
    blurb: 'Improve trust with profile quality and moderation tools.',
    contentHtml: `
      <p><strong>Improve trust with profile quality and moderation tools.</strong></p>
      <p>Profile completion updates in real time as users fill key fields and detail sections.</p>
      <p>Safety controls include report tools, privacy visibility options, and clear moderation pathways.</p>
      <ul>
        <li>Live profile completion feedback</li>
        <li>Report user and feedback workflows</li>
        <li>Privacy and access visibility controls</li>
      </ul>
    `,
    details: [
      'Profile completion updates in real time as users fill key fields and detail sections.',
      'Safety controls include report tools, privacy visibility options, and clear moderation pathways.'
    ],
    points: [
      'Live profile completion feedback',
      'Report user and feedback workflows',
      'Privacy and access visibility controls'
    ]
  }
];

const htmlList = (items: readonly string[]): string => `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;

const DEFAULT_TERMS_CENTER_DESCRIPTION = 'Review the terms that apply when you use MyScoutee features, accounts, events, chats, and community tools.';

const TERMS_CENTER_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'terms',
    icon: 'rule',
    title: 'Terms of service',
    blurb: 'The baseline rules for using MyScoutee.',
    contentHtml: '<p>These terms describe the rules for using MyScoutee accounts, profiles, events, chats, moderation tools, and related services.</p><p><strong>Last updated:</strong> February 1, 2026</p>'
  },
  {
    id: 'account-access',
    icon: 'manage_accounts',
    title: 'Account access',
    blurb: 'You are responsible for the account and sign-in method you use.',
    contentHtml: '<ul><li>Use accurate account information and keep your sign-in method secure.</li><li>Do not impersonate another person or create accounts intended to mislead other members.</li><li>OAuth sign-in is also subject to the relevant provider terms.</li></ul>'
  },
  {
    id: 'community-conduct',
    icon: 'groups',
    title: 'Community conduct',
    blurb: 'Respectful behavior keeps events and chats usable for everyone.',
    contentHtml: '<ul><li>Do not harass, threaten, spam, scam, or intentionally mislead other members.</li><li>Do not post illegal, hateful, exploitative, or unsafe content.</li><li>Hosts and admins may moderate, limit, or remove content and accounts that violate these terms.</li></ul>'
  },
  {
    id: 'events-and-content',
    icon: 'event_note',
    title: 'Events and content',
    blurb: 'Hosts and members are responsible for the events and content they create.',
    contentHtml: '<ul><li>Only create events, invitations, chats, resources, and posts that you are allowed to share.</li><li>Respect other people&apos;s privacy, images, and intellectual property.</li><li>Event details, availability, and attendee behavior are managed by the relevant hosts and participants.</li></ul>'
  },
  {
    id: 'safety-and-moderation',
    icon: 'verified_user',
    title: 'Safety and moderation',
    blurb: 'MyScoutee may act when platform safety or policy compliance requires it.',
    contentHtml: '<ul><li>Reports, support cases, and automated signals may be reviewed for safety and abuse prevention.</li><li>Accounts may be warned, restricted, blocked, reactivated, or deleted according to platform policy and applicable law.</li><li>Critical operational and security actions may be logged for audit purposes.</li></ul>'
  },
  {
    id: 'changes',
    icon: 'history',
    title: 'Changes to terms',
    blurb: 'Published revisions define the active terms.',
    contentHtml: '<ul><li>MyScoutee may update these terms as features, legal requirements, or safety needs change.</li><li>The active published version is shown with the terms page and can be reviewed before continuing where required.</li></ul>'
  }
];

const PRIVACY_CENTER_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'privacy',
    icon: 'policy',
    title: GDPR_CONTENT.title,
    blurb: GDPR_CONTENT.subtitle,
    contentHtml: `
      <p>${GDPR_CONTENT.subtitle}</p>
      <p><strong>Last updated:</strong> February 1, 2026</p>
    `
  },
  {
    id: 'contact-details',
    icon: 'contact_mail',
    title: 'Contact details',
    blurb: 'Who to contact about privacy and data protection.',
    contentHtml: GDPR_CONTENT.contactDetailsHtml
  },
  {
    id: 'legal-basis',
    icon: 'gavel',
    title: 'Legal basis',
    blurb: 'Why MyScoutee processes data for product and safety workflows.',
    contentHtml: htmlList(GDPR_CONTENT.legalBases)
  },
  {
    id: 'your-rights',
    icon: 'fact_check',
    title: 'Your rights',
    blurb: 'Rights available for your account and personal data.',
    contentHtml: GDPR_CONTENT.rights
      .map(section => `<h4>${section.title}</h4>${htmlList(section.items)}`)
      .join('\n')
  },
  {
    id: 'data-categories',
    icon: 'category',
    title: 'Data categories',
    blurb: 'Types of data MyScoutee may process.',
    contentHtml: GDPR_CONTENT.dataCategories
      .map(section => `<h4>${section.category}</h4>${htmlList(section.items)}`)
      .join('\n')
  },
  {
    id: 'purposes',
    icon: 'tips_and_updates',
    title: 'Purposes',
    blurb: 'How data supports profile, event, chat, and trust features.',
    contentHtml: htmlList(GDPR_CONTENT.purposes)
  },
  {
    id: 'retention',
    icon: 'schedule',
    title: 'Retention',
    blurb: 'How long data is kept.',
    contentHtml: htmlList(GDPR_CONTENT.retention)
  },
  {
    id: 'account-data-deletion',
    icon: 'manage_accounts',
    title: 'Account and data deletion',
    blurb: 'How account deletion, reactivation, and Meta/Facebook deletion requests are handled.',
    contentHtml: htmlList(GDPR_CONTENT.accountControls)
      + '{{deployment.privacy.deletionEmailRoute}}'
  },
  {
    id: 'sharing',
    icon: 'share',
    title: 'Third-party sharing',
    blurb: 'When data may be shared outside MyScoutee.',
    contentHtml: htmlList(GDPR_CONTENT.sharing)
  },
  {
    id: 'security',
    icon: 'security',
    title: 'Security',
    blurb: 'Controls used to protect data.',
    contentHtml: htmlList(GDPR_CONTENT.security)
  }
];

const HELP_CENTER_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'events',
    icon: 'event_note',
    title: 'Események és alesemények',
    blurb: 'Építsd fel a teljes eseményfolyamatot szakaszokkal vagy opcionális elemekkel.',
    contentHtml: '<p><strong>Építsd fel a teljes eseményfolyamatot szakaszokkal vagy opcionális elemekkel.</strong></p><p>Hozz létre fő eseményt, majd bontsd aleseményekre szakaszokhoz, mellékprogramokhoz vagy opcionális alkalmakhoz.</p><ul><li>Alkalmi és verseny jellegű struktúrák támogatása</li><li>A szakaszkontextus látható marad a kapcsolódó képernyőkön</li><li>A szervezők a hierarchia elvesztése nélkül szerkeszthetnek</li></ul>'
  },
  {
    id: 'resources',
    icon: 'inventory_2',
    title: 'Erőforrások és kapacitás',
    blurb: 'Rendelj embereket, transportkat, szállást és kellékeket limitekkel.',
    contentHtml: '<p><strong>Rendelj embereket, transportkat, szállást és kellékeket limitekkel.</strong></p><p>Az erőforrásmenükben eszközöket rendelhetsz aleseményekhez és csoportokhoz, majd közvetlenül állíthatod a kapacitásokat.</p><ul><li>Minimum/maximum kapacitás feladatonként</li><li>Kontextusos jelvények függő kérésekhez</li><li>Útvonal- és helytámogatás utazási erőforrásokhoz</li></ul>'
  },
  {
    id: 'activities',
    icon: 'forum',
    title: 'Tevékenységek és csevegések',
    blurb: 'Koordinálj kontextustudatos csatornákkal és szűrőkkel.',
    contentHtml: '<p><strong>Koordinálj kontextustudatos csatornákkal és szűrőkkel.</strong></p><p>A csevegőcsatornák követik az esemény hatókörét: fő esemény, opcionális alesemény és csoportcsatorna is együtt létezhet.</p><ul><li>Gyors csatornaszűrés kontextus szerint</li><li>Olvasatlan számlálók releváns csatornákra szűkítve</li><li>Mobilon és asztali nézetben is működik</li></ul>'
  },
  {
    id: 'safety',
    icon: 'verified_user',
    title: 'Profilok és biztonság',
    blurb: 'Erősítsd a bizalmat profilminőséggel és moderációs eszközökkel.',
    contentHtml: '<p><strong>Erősítsd a bizalmat profilminőséggel és moderációs eszközökkel.</strong></p><p>A profilkészültség valós időben frissül, ahogy a felhasználók kitöltik a fontos mezőket.</p><ul><li>Élő profilkészültségi visszajelzés</li><li>Felhasználójelentési és visszajelzési folyamatok</li><li>Adatvédelmi és hozzáférési láthatósági kontrollok</li></ul>'
  }
];

const PRIVACY_CENTER_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'privacy',
    icon: 'policy',
    title: 'Adatvédelem',
    blurb: 'Hogyan kezeli a MyScoutee a profilhoz, eseményekhez és közösségi aktivitáshoz kapcsolódó személyes adatokat.',
    contentHtml: '<p><strong>Utolsó frissítés:</strong> 2026. február 1.</p>'
  },
  {
    id: 'contact-details',
    icon: 'contact_mail',
    title: 'Kapcsolati adatok',
    blurb: 'Kihez fordulhatsz adatvédelemmel és adatkezeléssel kapcsolatban.',
    contentHtml: '{{deployment.privacy.contactDetails}}'
  },
  {
    id: 'legal-basis',
    icon: 'gavel',
    title: 'Jogalap',
    blurb: 'Miért kezel adatokat a MyScoutee a termék- és biztonsági folyamatokhoz.',
    contentHtml: '<ul><li>Szerződés teljesítése a fiók- és eseményfunkciókhoz.</li><li>Jogos érdek a platform biztonsága és a visszaélések megelőzése érdekében.</li><li>Hozzájárulás opcionális profiladatokhoz, pontos helykoordinátákhoz és marketingkommunikációhoz.</li><li>Jogi kötelezettség biztonsági naplókhoz és megfelelőségi nyilvántartásokhoz.</li></ul>'
  },
  {
    id: 'your-rights',
    icon: 'fact_check',
    title: 'Jogaid',
    blurb: 'A fiókoddal és személyes adataiddal kapcsolatos jogaid.',
    contentHtml: '<h4>Hozzáférés</h4><ul><li>Kérhetsz másolatot a tárolt személyes adataidról.</li></ul><h4>Helyesbítés</h4><ul><li>Javíthatod a pontatlan profil- vagy fiókadatokat.</li></ul><h4>Törlés</h4><ul><li>Kérheted a fiók és a személyes adatok törlését, ahol ezt jogszabály lehetővé teszi.</li></ul><h4>Adathordozhatóság</h4><ul><li>Exportálhatod az adataidat általánosan használt, géppel olvasható formátumban.</li></ul><h4>Korlátozás / tiltakozás</h4><ul><li>Korlátozhatod vagy kifogásolhatod egyes adatkezelési tevékenységeket.</li></ul>'
  },
  {
    id: 'data-categories',
    icon: 'category',
    title: 'Adatkategóriák',
    blurb: 'Milyen típusú adatokat kezelhet a MyScoutee.',
    contentHtml: '<h4>Fiók és azonosítás</h4><ul><li>Név</li><li>Születésnap</li><li>Lakóhely városa</li><li>Nem</li><li>Profilképek</li></ul><h4>Hely és koordináták</h4><ul><li>Hozzávetőleges hely (város/régió)</li><li>Pontos GPS-koordináták (szélesség/hosszúság), ha kéred</li><li>Helyfrissítési időbélyegek eseménylogisztikához</li></ul><h4>Aktivitási adatok</h4><ul><li>Csevegések</li><li>Meghívások</li><li>Események</li><li>Szervezési interakciók</li><li>Értékelések</li></ul><h4>Preferenciaadatok</h4><ul><li>Érdeklődési körök</li><li>Értékek</li><li>Láthatósági beállítások</li><li>Nyelvi preferenciák</li></ul><h4>Technikai adatok</h4><ul><li>Eszköz- és böngészőmetaadatok</li><li>IP- és naplórekordok</li><li>Munkamenetesemények</li></ul>'
  },
  {
    id: 'purposes',
    icon: 'tips_and_updates',
    title: 'Célok',
    blurb: 'Hogyan támogatják az adatok a profil-, esemény-, chat- és bizalmi funkciókat.',
    contentHtml: '<ul><li>Profil-, chat-, esemény- és szervezési funkciók működtetése.</li><li>Releváns tagok ajánlása és a felfedezés minőségének javítása.</li><li>Helyalapú párosítás és távolságtudatos eseménykoordináció támogatása.</li><li>Visszaélések, spam és gyanús platformaktivitás észlelése.</li><li>Fiókkérések és megfelelőségi folyamatok támogatása.</li></ul>'
  },
  {
    id: 'retention',
    icon: 'schedule',
    title: 'Megőrzés',
    blurb: 'Mennyi ideig őrizzük meg az adatokat.',
    contentHtml: '<ul><li>Fiókprofil-adatok: amíg a fiók aktív.</li><li>Pontos helykoordináták: csak az aktív helyalapú funkciókhoz szükséges ideig.</li><li>Biztonsági és auditnaplók: jogi vagy megfelelőségi igény szerint.</li><li>Törölt fiókok: az adatok a megőrzési idő után törlődnek vagy anonimizálódnak.</li></ul>'
  },
  {
    id: 'account-data-deletion',
    icon: 'manage_accounts',
    title: 'Fiók és adatok törlése',
    blurb: 'Hogyan működik a fióktörlés, az újraaktiválás és a Meta/Facebook törlési kérés.',
    contentHtml: '<ul><li>A fiók törlése a felhasználói beállítások menüben érhető el. A megerősítés után a fiók törlésre kerül ütemezésre, és a felhasználó kijelentkezik.</li><li>Ha a fiók törölt állapotban van, de még nem lett véglegesen törölve, az ismételt bejelentkezés újraaktiválási megerősítést jeleníthet meg a 30 napos törlési időszak lejárta előtt.</li><li>Ha a törlést Facebook-belépés után a Meta/Facebook fiókbeállításokból kérik, a Meta a MyScoutee backend callbacket hívja meg, és az egyező fiókok ugyanazt a törlési ütemezést követik.</li></ul>{{deployment.privacy.deletionEmailRoute}}'
  },
  {
    id: 'sharing',
    icon: 'share',
    title: 'Harmadik felekkel megosztás',
    blurb: 'Mikor kerülhetnek adatok a MyScoutee-n kívülre.',
    contentHtml: '<ul><li>Szolgáltatókkal tárhely, analitika és támogatási működés céljából.</li><li>Hatóságokkal csak akkor, ha alkalmazandó jog előírja.</li><li>Személyes adatot nem értékesítünk.</li></ul>'
  },
  {
    id: 'security',
    icon: 'security',
    title: 'Biztonság',
    blurb: 'Az adatok védelmét szolgáló kontrollok.',
    contentHtml: '<ul><li>Szerepköralapú hozzáférés belső eszközökhöz.</li><li>Titkosított adatátvitel.</li><li>Üzemeltetési monitorozás és incidenskezelési folyamatok.</li></ul>'
  }
];

const TERMS_CENTER_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'terms',
    icon: 'rule',
    title: 'Felhasználási feltételek',
    blurb: 'A MyScoutee használatának alapvető szabályai.',
    contentHtml: '<p>Ezek a feltételek írják le a MyScoutee fiókok, profilok, események, csevegések, moderációs eszközök és kapcsolódó szolgáltatások használatának szabályait.</p><p><strong>Utolsó frissítés:</strong> 2026. február 1.</p>'
  },
  {
    id: 'account-access',
    icon: 'manage_accounts',
    title: 'Fiókhozzáférés',
    blurb: 'Te felelsz a használt fiókért és belépési módért.',
    contentHtml: '<ul><li>Használj pontos fiókadatokat, és tartsd biztonságban a belépési módodat.</li><li>Ne add ki magad más személynek, és ne hozz létre megtévesztő fiókot.</li><li>Az OAuth-belépésre az adott szolgáltató feltételei is vonatkoznak.</li></ul>'
  },
  {
    id: 'community-conduct',
    icon: 'groups',
    title: 'Közösségi viselkedés',
    blurb: 'A tiszteletteljes működés tartja használhatóan az eseményeket és csevegéseket.',
    contentHtml: '<ul><li>Ne zaklass, fenyegetőzz, spammelj, csalj, és ne vezesd félre szándékosan a tagokat.</li><li>Ne tegyél közzé jogellenes, gyűlöletkeltő, kizsákmányoló vagy veszélyes tartalmat.</li><li>A szervezők és adminok moderálhatják, korlátozhatják vagy eltávolíthatják a feltételeket sértő tartalmakat és fiókokat.</li></ul>'
  },
  {
    id: 'events-and-content',
    icon: 'event_note',
    title: 'Események és tartalom',
    blurb: 'A szervezők és tagok felelnek az általuk létrehozott eseményekért és tartalmakért.',
    contentHtml: '<ul><li>Csak olyan eseményt, meghívást, csevegést, erőforrást és bejegyzést hozz létre, amelyet jogosult vagy megosztani.</li><li>Tartsd tiszteletben mások magánszféráját, képeit és szellemi tulajdonát.</li><li>Az eseményrészleteket, elérhetőséget és résztvevői viselkedést az érintett szervezők és résztvevők kezelik.</li></ul>'
  },
  {
    id: 'safety-and-moderation',
    icon: 'verified_user',
    title: 'Biztonság és moderáció',
    blurb: 'A MyScoutee léphet, ha a platform biztonsága vagy a szabályok betartása ezt igényli.',
    contentHtml: '<ul><li>A jelentéseket, support ügyeket és automatikus jelzéseket biztonsági és visszaélés-megelőzési célból át lehet tekinteni.</li><li>A fiókok figyelmeztethetők, korlátozhatók, blokkolhatók, újraaktiválhatók vagy törölhetők a platformszabályok és az alkalmazandó jog szerint.</li><li>A kritikus működési és biztonsági műveletek audit célból naplózhatók.</li></ul>'
  },
  {
    id: 'changes',
    icon: 'history',
    title: 'A feltételek változása',
    blurb: 'A közzétett verziók határozzák meg az aktív feltételeket.',
    contentHtml: '<ul><li>A MyScoutee frissítheti ezeket a feltételeket, ha a funkciók, jogi követelmények vagy biztonsági igények változnak.</li><li>Az aktív közzétett verzió megjelenik a feltételek oldalon, és szükség esetén folytatás előtt áttekinthető.</li></ul>'
  }
];

const DEFAULT_HELP_CENTER_REVISION: HelpCenterRevisionDto = {
  id: 'help-default-v1',
  documentKind: 'help',
  lang: 'en',
  languageLabel: 'English',
  version: 1,
  title: 'MyScoutee help',
  summary: 'What you can do in MyScoutee',
  description: DEFAULT_HELP_CENTER_DESCRIPTION,
  headerColor: 'amber',
  sections: HELP_CENTER_SECTIONS,
  active: true,
  createdAtIso: '2026-05-01T00:00:00.000Z',
  createdByUserId: 'system',
  updatedAtIso: '2026-05-01T00:00:00.000Z',
  updatedByUserId: 'system'
};

const DEFAULT_HELP_CENTER_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_HELP_CENTER_REVISION,
  id: 'help-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'MyScoutee súgó',
  summary: 'Mit tehetsz a MyScoutee-ban',
  description: 'A MyScoutee segít az eseményeket elejétől végéig megtervezni: meghívások, szakaszok és csoportok, erőforrások, valamint kontextushoz kötött csevegések.',
  sections: HELP_CENTER_SECTIONS_HU
};

const DEFAULT_PRIVACY_CENTER_REVISION: HelpCenterRevisionDto = {
  id: 'privacy-default-v1',
  documentKind: 'privacy',
  lang: 'en',
  languageLabel: 'English',
  version: 1,
  title: 'Data privacy',
  summary: 'Privacy first',
  description: DEFAULT_PRIVACY_CENTER_DESCRIPTION,
  headerColor: 'amber',
  sections: PRIVACY_CENTER_SECTIONS,
  active: true,
  createdAtIso: '2026-02-01T00:00:00.000Z',
  createdByUserId: 'system',
  updatedAtIso: '2026-02-01T00:00:00.000Z',
  updatedByUserId: 'system'
};

const DEFAULT_PRIVACY_CENTER_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_PRIVACY_CENTER_REVISION,
  id: 'privacy-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Adatvédelem',
  summary: 'Adatvédelem elsőként',
  description: 'Folytatás előtt nézd át és fogadd el, hogyan használja a MyScoutee az adataidat.',
  sections: PRIVACY_CENTER_SECTIONS_HU
};

const DEFAULT_TERMS_CENTER_REVISION: HelpCenterRevisionDto = {
  id: 'terms-default-v1',
  documentKind: 'terms',
  lang: 'en',
  languageLabel: 'English',
  version: 1,
  title: 'Terms of service',
  summary: 'Usage terms',
  description: DEFAULT_TERMS_CENTER_DESCRIPTION,
  headerColor: 'slate',
  sections: TERMS_CENTER_SECTIONS,
  active: true,
  createdAtIso: '2026-02-01T00:00:00.000Z',
  createdByUserId: 'system',
  updatedAtIso: '2026-02-01T00:00:00.000Z',
  updatedByUserId: 'system'
};

const DEFAULT_TERMS_CENTER_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_TERMS_CENTER_REVISION,
  id: 'terms-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Felhasználási feltételek',
  summary: 'Használati feltételek',
  description: 'Tekintsd át a MyScoutee funkcióira, fiókjaira, eseményeire, csevegéseire és közösségi eszközeire vonatkozó feltételeket.',
  sections: TERMS_CENTER_SECTIONS_HU
};

const EXPLANATION_HOME_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'affinity',
    icon: 'tune',
    title: 'Rate a card',
    blurb: 'Choose a score from 1 to 10.',
    contentHtml: '<p>Tap or drag the <strong>Affinity</strong> bar. Your choice is saved immediately, then the next card appears.</p>'
  },
  {
    id: 'affinity-network',
    icon: 'hub',
    title: 'Why ratings matter',
    blurb: 'Ratings help improve later suggestions.',
    contentHtml: '<p>Your score shows how interested you are in the person or pair on the card. MyScoutee can use it with other signals to make future suggestions more relevant.</p>'
  },
  {
    id: 'profile',
    icon: 'visibility',
    title: 'Photos and profile',
    blurb: 'See more before you rate.',
    contentHtml: '<p>Tap the left or right side of the image to browse photos. Use the eye icon to open the full profile.</p>'
  },
  {
    id: 'filters',
    icon: 'filter_alt',
    title: 'Filters and modes',
    blurb: 'Choose which cards you want to see.',
    contentHtml: '<p>The filter button narrows the results, and its number shows how many matches remain. Use <strong>Preferences</strong>, <strong>Friends in Common</strong>, <strong>Inside Network</strong>, or <strong>Outside Network</strong> to switch card groups.</p>'
  },
  {
    id: 'history',
    icon: 'history',
    title: 'Rating history',
    blurb: 'Review or change an earlier rating.',
    contentHtml: '<p>Open history from the header. To change a rating later, open <strong>Activity ratings</strong> and select its star action.</p>'
  }
];

const EXPLANATION_HOME_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'affinity',
    icon: 'tune',
    title: 'Kártya értékelése',
    blurb: 'Válassz egy értéket 1 és 10 között.',
    contentHtml: '<p>Koppints vagy húzd a <strong>Szimpátia</strong> sávot. A választás azonnal mentődik, majd megjelenik a következő kártya.</p>'
  },
  {
    id: 'affinity-network',
    icon: 'hub',
    title: 'Miért számít?',
    blurb: 'Az értékelés javítja a későbbi ajánlásokat.',
    contentHtml: '<p>A pontszám megmutatja, mennyire érdekel a kártyán látható ember vagy páros. A MyScoutee ezt más adatokkal együtt használhatja, hogy később jobb ajánlásokat adjon.</p>'
  },
  {
    id: 'profile',
    icon: 'visibility',
    title: 'Képek és profil',
    blurb: 'Értékelés előtt többet is megnézhetsz.',
    contentHtml: '<p>A kép bal vagy jobb oldalára koppintva lapozhatsz a fotók között. A szem ikon megnyitja a teljes profilt.</p>'
  },
  {
    id: 'filters',
    icon: 'filter_alt',
    title: 'Szűrők és módok',
    blurb: 'Válaszd ki, milyen kártyákat szeretnél látni.',
    contentHtml: '<p>A szűrőgomb szűkíti a találatokat, a rajta lévő szám pedig a megmaradt találatokat mutatja. A <strong>Preferenciák</strong>, <strong>Közös ismerősök</strong>, <strong>Hálózaton belül</strong> és <strong>Hálózaton kívül</strong> módok más-más kártyacsoportot nyitnak meg.</p>'
  },
  {
    id: 'history',
    icon: 'history',
    title: 'Értékelési előzmények',
    blurb: 'Nézd meg vagy módosítsd egy korábbi értékelésedet.',
    contentHtml: '<p>Az előzményeket a fejlécből nyithatod meg. Későbbi módosításhoz keresd meg a kártyát az <strong>Értékelések</strong> között, majd válaszd a csillagos műveletet.</p>'
  }
];

const EXPLANATION_ACTIVITY_RATES_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'activity-rate-filter',
    icon: 'north_east',
    title: 'Choose ratings',
    blurb: 'Select which rating cards are shown.',
    contentHtml: '<p>The first menu switches between ratings you gave or received, mutual ratings, people you met, and suggestions. <strong>Social</strong> shows the social subset for the selected group; turning it off returns to the regular subset.</p>'
  },
  {
    id: 'activity-header-controls',
    icon: 'route',
    title: 'Order and view',
    blurb: 'Change how the same cards are arranged.',
    contentHtml: '<p><strong>Recent</strong>, <strong>Relevant</strong>, and <strong>Past</strong> change the order. <strong>Month</strong>, <strong>Week</strong>, <strong>Day</strong>, and <strong>Distance</strong> change the grouping without changing any score.</p>'
  },
  {
    id: 'activity-score-badge',
    icon: 'star',
    title: 'Change a rating',
    blurb: 'Select a card, then choose 1 to 10.',
    contentHtml: '<p>The star shows the current score. The bottom bar changes only the selected card; a received, read-only rating can be viewed but not edited.</p>'
  },
  {
    id: 'activity-fullscreen',
    icon: 'fullscreen',
    title: 'Fullscreen rating',
    blurb: 'Focus on one card at a time.',
    contentHtml: '<p>Fullscreen enlarges the selected card and keeps its rating bar below the image. Close it to return to the same filtered list.</p>'
  }
];

const EXPLANATION_ACTIVITY_RATES_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'activity-rate-filter',
    icon: 'north_east',
    title: 'Értékelések kiválasztása',
    blurb: 'Válaszd ki, melyik értékeléskártyák látszanak.',
    contentHtml: '<p>Az első menüben válthatsz az adott, kapott és kölcsönös értékelések, a találkozások és az ajánlások között. A <strong>Közösségi</strong> kapcsoló az adott csoport közösségi ajánlásait mutatja; kikapcsolva a normál kártyák térnek vissza.</p>'
  },
  {
    id: 'activity-header-controls',
    icon: 'route',
    title: 'Sorrend és nézet',
    blurb: 'Rendezd át ugyanazokat a kártyákat.',
    contentHtml: '<p>A <strong>Legutóbbi</strong>, <strong>Releváns</strong> és <strong>Korábbi</strong> a sorrendet, a <strong>Hónap</strong>, <strong>Hét</strong>, <strong>Nap</strong> és <strong>Távolság</strong> pedig a csoportosítást változtatja. Ettől egyetlen pontszám sem módosul.</p>'
  },
  {
    id: 'activity-score-badge',
    icon: 'star',
    title: 'Értékelés módosítása',
    blurb: 'Jelölj ki egy kártyát, majd válassz 1 és 10 között.',
    contentHtml: '<p>A csillag az aktuális pontszámot mutatja. Az alsó sáv csak a kijelölt kártyát módosítja; a kapott, csak olvasható értékelést megnézheted, de nem írhatod át.</p>'
  },
  {
    id: 'activity-fullscreen',
    icon: 'fullscreen',
    title: 'Teljes képernyős értékelés',
    blurb: 'Egyszerre egy kártyára figyelj.',
    contentHtml: '<p>A teljes képernyő felnagyítja a kijelölt kártyát, az értékelősáv pedig a kép alatt marad. Bezáráskor ugyanabba a szűrt listába térsz vissza.</p>'
  }
];

const EXPLANATION_EVENTS_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'activity-event-entry',
    icon: 'event',
    title: 'Choose an event list',
    blurb: 'Open the group you need.',
    contentHtml: '<p>Switch between all or active events, pending items, invitations, your events, drafts, and trash. Use <strong>Explore</strong> for public events or the plus button to create one.</p>'
  },
  {
    id: 'activity-event-card',
    icon: 'event_note',
    title: 'Read an event card',
    blurb: 'See the key details at a glance.',
    contentHtml: '<p>The card shows the event image, title, time, place, and organizer. A badge such as <strong>1 / 5</strong> shows accepted people against capacity, while a red number marks pending items.</p>'
  },
  {
    id: 'activity-event-actions',
    icon: 'more_vert',
    title: 'People and actions',
    blurb: 'Open members or the actions available to you.',
    contentHtml: '<p>Tap the capacity badge to see participants and pending people. The three-dot menu changes with your role and the event state, so it may offer viewing, editing, publishing, invitation handling, sharing, leaving, deleting, or restoring.</p>'
  },
  {
    id: 'activity-event-join',
    icon: 'person_add',
    title: 'Join an event',
    blurb: 'The steps depend on the event settings.',
    contentHtml: '<p>You can accept or reject an invitation from its card. Some events confirm you immediately; others require approval, a ticket, accepted rules, payment, or choices before your place is final.</p>'
  },
  {
    id: 'activity-event-hosting',
    icon: 'emoji_events',
    title: 'Create or host',
    blurb: 'Start simple and add details when needed.',
    contentHtml: '<p>The plus button opens the event editor. You can create a basic meetup or add sub-events, groups, resources, tickets, pricing, and capacity rules.</p>'
  }
];

const EXPLANATION_EVENTS_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'activity-event-entry',
    icon: 'event',
    title: 'Eseménylista választása',
    blurb: 'Nyisd meg azt a csoportot, amelyikre szükséged van.',
    contentHtml: '<p>Válthatsz az összes vagy aktív esemény, a függő elemek, meghívások, saját események, piszkozatok és a kuka között. A <strong>Felfedezés</strong> nyilvános eseményeket keres, a plusz gomb pedig újat hoz létre.</p>'
  },
  {
    id: 'activity-event-card',
    icon: 'event_note',
    title: 'Eseménykártya',
    blurb: 'A legfontosabb adatokat egy helyen látod.',
    contentHtml: '<p>A kártyán az esemény képe, címe, ideje, helye és szervezője látszik. Az <strong>1 / 5</strong> jellegű jelvény az elfogadott résztvevőket és a férőhelyet, a piros szám pedig a függő elemeket mutatja.</p>'
  },
  {
    id: 'activity-event-actions',
    icon: 'more_vert',
    title: 'Résztvevők és műveletek',
    blurb: 'Nyisd meg a tagokat vagy a számodra elérhető műveleteket.',
    contentHtml: '<p>A férőhelyjelvény megnyitja a résztvevőket és a függő jelentkezőket. A hárompontos menü a szerepedhez és az esemény állapotához igazodik, ezért megtekintést, szerkesztést, közzétételt, meghíváskezelést, megosztást, kilépést, törlést vagy visszaállítást kínálhat.</p>'
  },
  {
    id: 'activity-event-join',
    icon: 'person_add',
    title: 'Csatlakozás',
    blurb: 'A lépések az esemény beállításaitól függenek.',
    contentHtml: '<p>A meghívást a kártyáról fogadhatod el vagy utasíthatod vissza. Egyes események azonnal visszaigazolnak, másoknál jóváhagyás, jegy, szabályelfogadás, fizetés vagy további választás kell a végleges helyhez.</p>'
  },
  {
    id: 'activity-event-hosting',
    icon: 'emoji_events',
    title: 'Létrehozás és szervezés',
    blurb: 'Indulj egyszerűen, és csak azt add hozzá, amire szükség van.',
    contentHtml: '<p>A plusz gomb megnyitja az eseményszerkesztőt. Készíthetsz egyszerű találkozót, vagy hozzáadhatsz aleseményeket, csoportokat, erőforrásokat, jegyeket, árazást és férőhelyszabályokat.</p>'
  }
];

const EXPLANATION_CHATS_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'activity-chat-list',
    icon: 'forum',
    title: 'Choose a chat list',
    blurb: 'Filter conversations by their purpose.',
    contentHtml: '<p>Show all chats or filter by <strong>Event</strong>, <strong>Sub-event</strong>, <strong>Group</strong>, <strong>Service</strong>, or <strong>App Support</strong>. Red counters mark unread or pending items.</p>'
  },
  {
    id: 'activity-chat-card',
    icon: 'chat_bubble',
    title: 'Read a chat row',
    blurb: 'See the latest activity before opening it.',
    contentHtml: '<p>A row shows the latest sender, channel, recent message, time, member count, and unread count. Tap it to open the conversation.</p>'
  },
  {
    id: 'activity-chat-channels',
    icon: 'account_tree',
    title: 'Channel types',
    blurb: 'Keep each conversation in the right place.',
    contentHtml: '<p>Event chats cover the whole event, sub-event chats cover one part, and group chats cover a smaller team. Service and App Support chats handle their own help or system-related topics.</p>'
  },
  {
    id: 'activity-chat-message-window',
    icon: 'mark_chat_unread',
    title: 'Open a conversation',
    blurb: 'Read messages and use the available actions.',
    contentHtml: '<p>The header opens members, the related event or group, and pinned messages. Message actions depend on ownership and content: you may reply, react, edit or unsend your own message, pin it, open an attachment, or report it.</p>'
  },
  {
    id: 'activity-chat-tools',
    icon: 'add_circle',
    title: 'Send more than text',
    blurb: 'Use chat tools for practical planning.',
    contentHtml: '<p>The plus button lets you add an image, voice clip, poll, event, or asset. Shared items stay in the conversation so participants can open them later.</p>'
  }
];

const EXPLANATION_CHATS_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'activity-chat-list',
    icon: 'forum',
    title: 'Beszélgetések kiválasztása',
    blurb: 'Szűrd a beszélgetéseket a céljuk szerint.',
    contentHtml: '<p>Megnézheted az összes beszélgetést, vagy szűrhetsz <strong>Esemény</strong>, <strong>Alesemény</strong>, <strong>Csoport</strong>, <strong>Szolgáltatás</strong> és <strong>Alkalmazástámogatás</strong> szerint. A piros számláló olvasatlan vagy függő elemet jelez.</p>'
  },
  {
    id: 'activity-chat-card',
    icon: 'chat_bubble',
    title: 'Beszélgetéssor',
    blurb: 'Megnyitás előtt lásd a legutóbbi aktivitást.',
    contentHtml: '<p>A sor megmutatja az utolsó írót, a csatornát, a legutóbbi üzenetet, az időpontot, a tagok és az olvasatlan üzenetek számát. Koppints rá a beszélgetés megnyitásához.</p>'
  },
  {
    id: 'activity-chat-channels',
    icon: 'account_tree',
    title: 'Csatornatípusok',
    blurb: 'Minden beszélgetés maradjon a megfelelő helyen.',
    contentHtml: '<p>Az eseménybeszélgetés az egész eseményhez, az alesemény-beszélgetés egy részhez, a csoportbeszélgetés pedig egy kisebb csapathoz tartozik. A szolgáltatási és alkalmazástámogatási csatornák a saját ügyintézési témáikat kezelik.</p>'
  },
  {
    id: 'activity-chat-message-window',
    icon: 'mark_chat_unread',
    title: 'Beszélgetés megnyitása',
    blurb: 'Olvasd el az üzeneteket, és használd az elérhető műveleteket.',
    contentHtml: '<p>A fejlécből megnyithatod a tagokat, a kapcsolódó eseményt vagy csoportot és a kitűzött üzeneteket. Az üzenet tulajdonától és tartalmától függően válaszolhatsz, reagálhatsz, saját üzenetet szerkeszthetsz vagy visszavonhatsz, kitűzhetsz, mellékletet nyithatsz meg vagy jelenthetsz.</p>'
  },
  {
    id: 'activity-chat-tools',
    icon: 'add_circle',
    title: 'Több mint szöveg',
    blurb: 'A beszélgetés eszközeivel könnyebb a szervezés.',
    contentHtml: '<p>A plusz gombbal képet, hangüzenetet, szavazást, eseményt vagy eszközt küldhetsz. A megosztott elemek a beszélgetésben maradnak, így később is megnyithatók.</p>'
  }
];

const EXPLANATION_CONTACTS_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'contacts-list',
    icon: 'contacts',
    title: 'Saved contacts',
    blurb: 'Keep useful people easy to find.',
    contentHtml: '<p>Search your saved contacts by name. <strong>Create Contact</strong> lets you choose a member and add that person to this list.</p>'
  },
  {
    id: 'contacts-card',
    icon: 'badge',
    title: 'Contact card',
    blurb: 'Open a profile or use a saved shortcut.',
    contentHtml: '<p>The card shows the person, city, and saved contact methods. The eye opens the profile; the chips and three-dot menu open phone, message, email, social, website, edit, or delete actions when available.</p>'
  },
  {
    id: 'contacts-private-methods',
    icon: 'alternate_email',
    title: 'Edit contact methods',
    blurb: 'Change only the shortcuts saved in your contact list.',
    contentHtml: '<p><strong>Edit</strong> adds, changes, or removes phone, email, messaging, social, and web links. It does not edit the person&rsquo;s profile, and deleting the contact only removes the entry from your list.</p>'
  }
];

const EXPLANATION_CONTACTS_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'contacts-list',
    icon: 'contacts',
    title: 'Mentett kapcsolatok',
    blurb: 'Tartsd könnyen elérhető helyen a fontos embereket.',
    contentHtml: '<p>A mentett kapcsolatok között név alapján kereshetsz. A <strong>Kapcsolat létrehozása</strong> gombbal kiválaszthatsz egy tagot, és hozzáadhatod ehhez a listához.</p>'
  },
  {
    id: 'contacts-card',
    icon: 'badge',
    title: 'Kapcsolatkártya',
    blurb: 'Nyisd meg a profilt, vagy használd a mentett gyorsgombokat.',
    contentHtml: '<p>A kártya az embert, a várost és a mentett elérési módokat mutatja. A szem megnyitja a profilt; a címkék és a hárompontos menü telefonos, üzenetküldési, e-mailes, közösségi, webes, szerkesztési vagy törlési műveletet nyithat.</p>'
  },
  {
    id: 'contacts-private-methods',
    icon: 'alternate_email',
    title: 'Elérési módok szerkesztése',
    blurb: 'Csak a kapcsolatlistában mentett gyorsgombokat módosítod.',
    contentHtml: '<p>A <strong>Szerkesztés</strong> alatt telefonos, e-mailes, üzenetküldési, közösségi és webes elérést adhatsz hozzá, módosíthatsz vagy törölhetsz. Ettől az illető profilja nem változik, a kapcsolat törlése pedig csak a saját listádból távolítja el.</p>'
  }
];

const EXPLANATION_PROFILE_EDITOR_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'profile-editor-basics',
    icon: 'manage_accounts',
    title: 'Basic details',
    blurb: 'Complete the information used on your profile.',
    contentHtml: '<p>For a regular profile, name, birthday, city, height, physique, gender, and languages are required. The short About text, work, and school entries add useful context.</p>'
  },
  {
    id: 'profile-editor-media',
    icon: 'add_photo_alternate',
    title: 'Profile photos',
    blurb: 'Manage images in a separate panel.',
    contentHtml: '<p>Use the edit action on the profile card to open <strong>Images</strong>. Add, reorder, replace, or remove photos, then return to the main panel before saving.</p>'
  },
  {
    id: 'profile-editor-details',
    icon: 'tune',
    title: 'Details and visibility',
    blurb: 'Add optional details and choose who can see them.',
    contentHtml: '<p>Add experience, lifestyle, values, and interests as needed. The header controls the overall profile status, while visibility icons beside supported details choose <strong>Public</strong>, <strong>Friends</strong>, <strong>Hosts</strong>, or <strong>Private</strong>.</p>'
  },
  {
    id: 'profile-editor-save',
    icon: 'save',
    title: 'Save your profile',
    blurb: 'Use the checkmark when you are finished.',
    contentHtml: '<p>The checkmark saves your changes and closes the editor. Closing the main panel without saving does not submit the changes.</p>'
  }
];

const EXPLANATION_PROFILE_EDITOR_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'profile-editor-basics',
    icon: 'manage_accounts',
    title: 'Alapadatok',
    blurb: 'Töltsd ki a profilodon használt adatokat.',
    contentHtml: '<p>Normál profilnál a név, születési dátum, város, magasság, testalkat, nem és nyelvek kötelezők. A rövid bemutatkozás, a munkahely és az iskola további hasznos információt ad.</p>'
  },
  {
    id: 'profile-editor-media',
    icon: 'add_photo_alternate',
    title: 'Profilképek',
    blurb: 'A képeket külön panelen kezelheted.',
    contentHtml: '<p>A profilkártya szerkesztési műveletével nyisd meg a <strong>Képek</strong> panelt. Itt hozzáadhatsz, átrendezhetsz, cserélhetsz vagy törölhetsz fotókat; mentés előtt térj vissza a fő panelre.</p>'
  },
  {
    id: 'profile-editor-details',
    icon: 'tune',
    title: 'Részletek és láthatóság',
    blurb: 'Adj meg opcionális részleteket, és válaszd ki, ki láthatja őket.',
    contentHtml: '<p>Szükség szerint adj meg tapasztalatokat, életmódot, értékeket és érdeklődési köröket. A fejléc a teljes profil állapotát szabályozza, a támogatott részletek melletti ikonokkal pedig <strong>Nyilvános</strong>, <strong>Ismerősök</strong>, <strong>Szervezők</strong> vagy <strong>Privát</strong> láthatóságot választhatsz.</p>'
  },
  {
    id: 'profile-editor-save',
    icon: 'save',
    title: 'Profil mentése',
    blurb: 'Ha elkészültél, használd a pipát.',
    contentHtml: '<p>A pipa menti a módosításokat, majd bezárja a szerkesztőt. Ha mentés nélkül zárod be a fő panelt, a változtatások nem kerülnek beküldésre.</p>'
  }
];

const EXPLANATION_PROFILE_VIEW_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'profile-view-overview',
    icon: 'visibility',
    title: 'Profile overview',
    blurb: 'This screen shows a profile without editing it.',
    contentHtml: '<p>The top card shows the selected photo, name, age, city, and headline. The Basics section lists key profile details and marks missing values as not set.</p>'
  },
  {
    id: 'profile-view-photos',
    icon: 'photo_library',
    title: 'Photos and details',
    blurb: 'Browse the information available on this profile.',
    contentHtml: '<p>Select another photo on the profile card when more are available. Below it, the About area, non-empty detail groups, and experience entries are shown in separate sections.</p>'
  },
  {
    id: 'profile-view-actions',
    icon: 'more_horiz',
    title: 'Read-only view',
    blurb: 'This popup does not change the profile.',
    contentHtml: '<p>There are no edit or contact actions on this screen. Close the popup to return to the card, chat, contact, or member list where you opened it.</p>'
  }
];

const EXPLANATION_PROFILE_VIEW_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'profile-view-overview',
    icon: 'visibility',
    title: 'Profil áttekintése',
    blurb: 'Ezen a képernyőn szerkesztés nélkül nézheted meg a profilt.',
    contentHtml: '<p>A felső kártyán a kiválasztott kép, név, életkor, város és rövid leírás látszik. Az Alapadatok rész felsorolja a fontos profiladatokat, a hiányzó értékeket pedig nincs megadva jelzéssel mutatja.</p>'
  },
  {
    id: 'profile-view-photos',
    icon: 'photo_library',
    title: 'Képek és részletek',
    blurb: 'Nézd át a profilon elérhető információkat.',
    contentHtml: '<p>Ha több kép van, a profilkártyán másik fotót választhatsz. Alatta külön részben jelenik meg a bemutatkozás, a kitöltött részletcsoportok és a tapasztalatok.</p>'
  },
  {
    id: 'profile-view-actions',
    icon: 'more_horiz',
    title: 'Csak olvasható nézet',
    blurb: 'Ez az ablak nem módosítja a profilt.',
    contentHtml: '<p>Ezen a képernyőn nincs szerkesztési vagy kapcsolatfelvételi művelet. Zárd be az ablakot, hogy visszatérj ahhoz a kártyához, beszélgetéshez, kapcsolathoz vagy taglistához, ahonnan megnyitottad.</p>'
  }
];

const EXPLANATION_EVENT_FEEDBACK_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'event-feedback-entry',
    icon: 'rate_review',
    title: 'Feedback lists',
    blurb: 'Choose the feedback state you want to see.',
    contentHtml: '<p><strong>Pending</strong> holds events waiting for your feedback, <strong>Feedbacked</strong> holds submitted items, and <strong>Removed</strong> holds skipped items that can be restored. <strong>Own Events</strong> shows feedback received for events you organized.</p>'
  },
  {
    id: 'event-feedback-categories',
    icon: 'checklist',
    title: 'Answer the cards',
    blurb: 'Complete each card, then review your answers.',
    contentHtml: '<p>On every event or participant card, answer the two questions and choose up to three traits. Review the summary, then use <strong>Submit feedback</strong> to send all answers.</p>'
  },
  {
    id: 'event-feedback-save',
    icon: 'task_alt',
    title: 'After feedback',
    blurb: 'Review submitted or received results.',
    contentHtml: '<p>Submitted feedback moves to <strong>Feedbacked</strong> and can be opened again. Organizers can view summaries and named responses for their own events; a separate organizer note needs at least eight characters.</p>'
  }
];

const EXPLANATION_EVENT_FEEDBACK_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'event-feedback-entry',
    icon: 'rate_review',
    title: 'Visszajelzési listák',
    blurb: 'Válaszd ki, melyik állapotot szeretnéd látni.',
    contentHtml: '<p>A <strong>Függőben</strong> listában a kitöltésre váró, a <strong>Kitöltve</strong> listában a beküldött, az <strong>Eltávolítva</strong> listában pedig a kihagyott és visszaállítható események vannak. A <strong>Saját események</strong> a szervezőként kapott visszajelzéseket mutatja.</p>'
  },
  {
    id: 'event-feedback-categories',
    icon: 'checklist',
    title: 'Kártyák kitöltése',
    blurb: 'Tölts ki minden kártyát, majd ellenőrizd a válaszaidat.',
    contentHtml: '<p>Minden esemény- vagy résztvevőkártyán válaszolj a két kérdésre, és válassz legfeljebb három jellemzőt. Az összegzés után a <strong>Visszajelzés beküldése</strong> gomb elküldi az összes választ.</p>'
  },
  {
    id: 'event-feedback-save',
    icon: 'task_alt',
    title: 'Beküldés után',
    blurb: 'Nézd meg az elküldött vagy kapott eredményeket.',
    contentHtml: '<p>A beküldött válasz a <strong>Kitöltve</strong> listába kerül, és később újra megnyitható. A szervezők a saját eseményeik összesítését és névvel jelölt válaszait látják; a külön szervezői megjegyzés legalább nyolc karakteres lehet.</p>'
  }
];

const EXPLANATION_ASSETS_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'assets-entry',
    icon: 'inventory_2',
    title: 'Choose an asset type',
    blurb: 'Switch between your assets and tickets.',
    contentHtml: '<p>Use the top menu for <strong>Transport</strong>, <strong>Accommodation</strong>, <strong>Supplies</strong>, or <strong>Tickets</strong>. The first three are assets you can add and edit; tickets are event entry records.</p>'
  },
  {
    id: 'assets-card',
    icon: 'view_agenda',
    title: 'Asset card',
    blurb: 'See the item and its current availability.',
    contentHtml: '<p>The card shows the image, title, subtitle, and an availability or request count. Use the location icon when shown, or the three-dot menu for actions such as sharing, requests, editing, and deleting.</p>'
  },
  {
    id: 'assets-editor',
    icon: 'edit',
    title: 'Edit an asset',
    blurb: 'Transport, accommodation, and supplies use the same form.',
    contentHtml: '<p>Title, total capacity, and quantity are required. You can also add one image, a subtitle, source link, category, details, visibility, pricing, and lending rules; accommodation also requires a location.</p>'
  },
  {
    id: 'assets-requests',
    icon: 'assignment',
    title: 'Requests',
    blurb: 'Review who wants to use the asset.',
    contentHtml: '<p>Filter all, active, pending, or borrowed requests. You can accept or reject a pending request, and make an accepted user a <strong>Manager</strong> for this asset.</p>'
  },
  {
    id: 'assets-scope',
    icon: 'travel_explore',
    title: 'Visibility and events',
    blurb: 'Control discovery and assign assets separately.',
    contentHtml: '<p>Visibility controls who may find the asset in <strong>Asset Explorer</strong>. To use it in an event or sub-event, assign it from that event&rsquo;s resource screen.</p>'
  }
];

const EXPLANATION_ASSETS_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'assets-entry',
    icon: 'inventory_2',
    title: 'Eszköztípus választása',
    blurb: 'Válts a saját eszközök és a jegyek között.',
    contentHtml: '<p>A felső menüben a <strong>Járművek</strong>, <strong>Szállások</strong>, <strong>Kellékek</strong> és <strong>Jegyek</strong> között válthatsz. Az első három hozzáadható és szerkeszthető eszköz, a jegy pedig eseményhez tartozó belépési adat.</p>'
  },
  {
    id: 'assets-card',
    icon: 'view_agenda',
    title: 'Eszközkártya',
    blurb: 'Lásd az eszközt és az aktuális elérhetőségét.',
    contentHtml: '<p>A kártyán a kép, cím, alcím és az elérhető mennyiség vagy kérések száma látszik. Ha van helyikon, az megnyitja a térképet; a hárompontos menüben többek között megosztás, kéréskezelés, szerkesztés és törlés lehet.</p>'
  },
  {
    id: 'assets-editor',
    icon: 'edit',
    title: 'Eszköz szerkesztése',
    blurb: 'A járművek, szállások és kellékek ugyanazt az űrlapot használják.',
    contentHtml: '<p>A cím, a teljes kapacitás és a mennyiség kötelező. Megadhatsz még egy képet, alcímet, forráslinket, kategóriát, részleteket, láthatóságot, árat és kölcsönzési szabályokat; szállásnál a helyszín is kötelező.</p>'
  },
  {
    id: 'assets-requests',
    icon: 'assignment',
    title: 'Kérések',
    blurb: 'Nézd meg, ki szeretné használni az eszközt.',
    contentHtml: '<p>Szűrhetsz az összes, aktív, függő vagy kölcsönadott kérésre. A függő kérést elfogadhatod vagy elutasíthatod, az elfogadott felhasználót pedig az eszköz <strong>Kezelőjévé</strong> teheted.</p>'
  },
  {
    id: 'assets-scope',
    icon: 'travel_explore',
    title: 'Láthatóság és események',
    blurb: 'A felfedezést és az eseményhez rendelést külön állítod.',
    contentHtml: '<p>A láthatóság szabályozza, ki találhatja meg az eszközt az <strong>Eszközkeresőben</strong>. Eseményhez vagy aleseményhez az adott esemény erőforrás-képernyőjén rendelheted hozzá.</p>'
  }
];

function assetExplanationSections(
  baseSections: HelpCenterSectionDto[],
  overrides: Record<string, Partial<HelpCenterSectionDto>>
): HelpCenterSectionDto[] {
  return baseSections.map(section => ({
    ...section,
    ...(overrides[section.id] ?? {})
  }));
}

const EXPLANATION_ASSETS_TRANSPORT_SECTIONS: HelpCenterSectionDto[] = assetExplanationSections(EXPLANATION_ASSETS_SECTIONS, {
  'assets-entry': {
    icon: 'directions_car',
    title: 'Your transport',
    blurb: 'Add and manage vehicles or other transport.',
    contentHtml: '<p>The <strong>Transport</strong> tab lists transport assets you own or manage. Use the plus button to create one, then set its title, capacity, quantity, details, visibility, and any optional price or rules.</p>'
  },
  'assets-card': {
    icon: 'directions_car',
    title: 'Transport card',
    contentHtml: '<p>The card shows the image, name, subtitle, and available capacity or requests. Open the three-dot menu to see the actions available for that transport.</p>'
  },
  'assets-editor': {
    title: 'Transport details',
    contentHtml: '<p>Use total capacity for the available seats and quantity for the units offered. Put pickup, route, luggage, fuel, or driver information in <strong>Details</strong>; a separate route control appears only for a related event assignment.</p>'
  }
});

const EXPLANATION_ASSETS_ACCOMMODATION_SECTIONS: HelpCenterSectionDto[] = assetExplanationSections(EXPLANATION_ASSETS_SECTIONS, {
  'assets-entry': {
    icon: 'apartment',
    title: 'Your accommodation',
    blurb: 'Add and manage places you can offer.',
    contentHtml: '<p>The <strong>Accommodation</strong> tab lists places you own or manage. Use the plus button to create one, then set its title, location, capacity, quantity, details, visibility, and any optional price or rules.</p>'
  },
  'assets-card': {
    icon: 'apartment',
    title: 'Accommodation card',
    contentHtml: '<p>The card shows the image, name, subtitle, and available capacity or requests. Use the location icon to open the saved place on a map.</p>'
  },
  'assets-editor': {
    title: 'Accommodation details',
    contentHtml: '<p>A <strong>location</strong> is required for accommodation. Use capacity and quantity for the space offered, and Details for check-in, sleeping, parking, or house rules.</p>'
  }
});

const EXPLANATION_ASSETS_SUPPLIES_SECTIONS: HelpCenterSectionDto[] = assetExplanationSections(EXPLANATION_ASSETS_SECTIONS, {
  'assets-entry': {
    icon: 'inventory_2',
    title: 'Your supplies',
    blurb: 'Add and manage equipment or other useful items.',
    contentHtml: '<p>The <strong>Supplies</strong> tab lists items you own or manage. Use the plus button to create one, then set its title, capacity, quantity, details, visibility, and any optional price or rules.</p>'
  },
  'assets-card': {
    icon: 'inventory_2',
    title: 'Supply card',
    contentHtml: '<p>The card shows the image, name, subtitle, and available quantity or requests. Open the three-dot menu to see the actions available for that item.</p>'
  },
  'assets-editor': {
    title: 'Supply details',
    contentHtml: '<p>Set the total capacity and the quantity offered. Use <strong>Details</strong> for condition, included parts, pickup, return, or deposit information.</p>'
  }
});

const EXPLANATION_ASSETS_TICKETS_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'assets-tickets',
    icon: 'qr_code_2',
    title: 'Your tickets',
    blurb: 'View entry records linked to events.',
    contentHtml: '<p>Switch between <strong>Upcoming</strong> and <strong>Past</strong> tickets. <strong>Scan Ticket</strong> opens the check-in scanner for another person&rsquo;s QR code.</p>'
  },
  {
    id: 'assets-ticket-card',
    icon: 'confirmation_number',
    title: 'Ticket card',
    blurb: 'See the event and open your entry code.',
    contentHtml: '<p>The card shows the event, date, and your ticket context. Tap its QR badge to open your own code; ticket details come from the event and cannot be edited here.</p>'
  },
  {
    id: 'assets-ticket-scanner',
    icon: 'qr_code_scanner',
    title: 'Scan a ticket',
    blurb: 'Check another person in when camera scanning is supported.',
    contentHtml: '<p>After reading a QR code, the scanner shows the ticket holder and related event details for checking. It verifies entry information; it does not create or edit tickets.</p>'
  }
];

const EXPLANATION_ASSETS_TRANSPORT_SECTIONS_HU: HelpCenterSectionDto[] = assetExplanationSections(EXPLANATION_ASSETS_SECTIONS_HU, {
  'assets-entry': {
    icon: 'directions_car',
    title: 'Saját járművek',
    blurb: 'Adj hozzá és kezelj járművet vagy más szállítási eszközt.',
    contentHtml: '<p>A <strong>Járművek</strong> fül a tulajdonodban vagy kezelésedben lévő szállítási eszközöket mutatja. A plusz gombbal újat hozhatsz létre, majd megadhatod a címét, kapacitását, mennyiségét, részleteit, láthatóságát, valamint az opcionális árat és szabályokat.</p>'
  },
  'assets-card': {
    icon: 'directions_car',
    title: 'Járműkártya',
    contentHtml: '<p>A kártyán a kép, név, alcím és az elérhető kapacitás vagy kérések száma látszik. A hárompontos menü megnyitja az adott járműhöz elérhető műveleteket.</p>'
  },
  'assets-editor': {
    title: 'Jármű adatai',
    contentHtml: '<p>A teljes kapacitásnál add meg a férőhelyeket, a mennyiségnél pedig a felajánlott egységeket. Az indulási helyet, útvonalat, csomagot, üzemanyagot vagy sofőrt a <strong>Részletek</strong> mezőben írd le; külön útvonalbeállítás csak eseményhez kapcsolt hozzárendelésnél jelenik meg.</p>'
  }
});

const EXPLANATION_ASSETS_ACCOMMODATION_SECTIONS_HU: HelpCenterSectionDto[] = assetExplanationSections(EXPLANATION_ASSETS_SECTIONS_HU, {
  'assets-entry': {
    icon: 'apartment',
    title: 'Saját szállások',
    blurb: 'Adj hozzá és kezelj felajánlható helyeket.',
    contentHtml: '<p>A <strong>Szállások</strong> fül a tulajdonodban vagy kezelésedben lévő helyeket mutatja. A plusz gombbal újat hozhatsz létre, majd megadhatod a címét, helyszínét, kapacitását, mennyiségét, részleteit, láthatóságát, valamint az opcionális árat és szabályokat.</p>'
  },
  'assets-card': {
    icon: 'apartment',
    title: 'Szálláskártya',
    contentHtml: '<p>A kártyán a kép, név, alcím és az elérhető kapacitás vagy kérések száma látszik. A helyikonnal megnyithatod a mentett helyszínt a térképen.</p>'
  },
  'assets-editor': {
    title: 'Szállás adatai',
    contentHtml: '<p>Szállásnál a <strong>helyszín</strong> kötelező. A kapacitással és mennyiséggel add meg a felajánlott helyet, a Részletek mezőben pedig írd le a bejutást, alvást, parkolást vagy házirendet.</p>'
  }
});

const EXPLANATION_ASSETS_SUPPLIES_SECTIONS_HU: HelpCenterSectionDto[] = assetExplanationSections(EXPLANATION_ASSETS_SECTIONS_HU, {
  'assets-entry': {
    icon: 'inventory_2',
    title: 'Saját kellékek',
    blurb: 'Adj hozzá és kezelj felszerelést vagy más hasznos tárgyat.',
    contentHtml: '<p>A <strong>Kellékek</strong> fül a tulajdonodban vagy kezelésedben lévő tárgyakat mutatja. A plusz gombbal újat hozhatsz létre, majd megadhatod a címét, kapacitását, mennyiségét, részleteit, láthatóságát, valamint az opcionális árat és szabályokat.</p>'
  },
  'assets-card': {
    icon: 'inventory_2',
    title: 'Kellékkártya',
    contentHtml: '<p>A kártyán a kép, név, alcím és az elérhető mennyiség vagy kérések száma látszik. A hárompontos menü megnyitja az adott tárgyhoz elérhető műveleteket.</p>'
  },
  'assets-editor': {
    title: 'Kellék adatai',
    contentHtml: '<p>Add meg a teljes kapacitást és a felajánlott mennyiséget. A <strong>Részletek</strong> mezőben írd le az állapotot, a tartozékokat, az átvételt, a visszaadást vagy a kauciót.</p>'
  }
});

const EXPLANATION_ASSETS_TICKETS_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'assets-tickets',
    icon: 'qr_code_2',
    title: 'Saját jegyek',
    blurb: 'Nézd meg az eseményekhez tartozó belépési adatokat.',
    contentHtml: '<p>Válts a <strong>Közelgő</strong> és <strong>Korábbi</strong> jegyek között. A <strong>Jegy beolvasása</strong> gomb megnyitja a beléptető leolvasót egy másik ember QR-kódjához.</p>'
  },
  {
    id: 'assets-ticket-card',
    icon: 'confirmation_number',
    title: 'Jegykártya',
    blurb: 'Nézd meg az eseményt, és nyisd meg a belépőkódodat.',
    contentHtml: '<p>A kártya az eseményt, a dátumot és a jegyed adatait mutatja. A QR-jelvény megnyitja a saját kódodat; a jegy adatai az eseményből származnak, és itt nem szerkeszthetők.</p>'
  },
  {
    id: 'assets-ticket-scanner',
    icon: 'qr_code_scanner',
    title: 'Jegy beolvasása',
    blurb: 'Támogatott kamerás eszközön olvasd be más jegyét.',
    contentHtml: '<p>A QR-kód beolvasása után megjelenik a jegy tulajdonosa és a kapcsolódó esemény adatai. Ez a belépési adatokat ellenőrzi; jegyet nem hoz létre és nem szerkeszt.</p>'
  }
];

const EXPLANATION_EVENT_EDITOR_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'event-editor-main',
    icon: 'edit_calendar',
    title: 'Required event details',
    blurb: 'Complete the fields needed for saving.',
    contentHtml: '<p>Name, description, minimum and maximum capacity, start time, and end time are required. The image and location are optional; use the header checkmark to save.</p>'
  },
  {
    id: 'event-editor-switches',
    icon: 'tune',
    title: 'Visibility and joining',
    blurb: 'Choose who can find the event and what joining requires.',
    contentHtml: '<p><strong>Public</strong>, <strong>Friends only</strong>, and <strong>Invitation only</strong> control discovery. Open or Blind controls attendee previews; you can also choose up to five topics and enable automatic invitations, ticketing, or approval.</p>'
  },
  {
    id: 'event-editor-schedule',
    icon: 'event_time',
    title: 'Schedule, price, and rules',
    blurb: 'Set when the event runs and any joining conditions.',
    contentHtml: '<p>Choose a one-time or repeating schedule and adjust its time slots when needed. Pricing and event policies are optional, and the location field sets the place shown for the event.</p>'
  },
  {
    id: 'event-editor-subevents',
    icon: 'account_tree',
    title: 'Sub-events',
    blurb: 'Split a larger event into smaller parts.',
    contentHtml: '<p>Sub-events can be mandatory parts or optional choices with their own capacity and price. <strong>Casual</strong> keeps a simple structure, while <strong>Tournament</strong> adds stages, groups, scores, and standings.</p>'
  },
  {
    id: 'event-editor-members',
    icon: 'groups',
    title: 'Members and roles',
    blurb: 'Manage participants in a separate member window.',
    contentHtml: '<p>Open <strong>Members</strong> to invite people and review accepted or pending participants. Available role and status actions depend on whether you are an organizer, manager, or member.</p>'
  },
  {
    id: 'event-editor-assets',
    icon: 'inventory_2',
    title: 'Resources',
    blurb: 'Assign people and assets to an event part.',
    contentHtml: '<p>From a sub-event or group, open members, transport, accommodation, or supplies. <strong>Assign</strong> uses an asset you already manage, while <strong>Explore</strong> finds one you can request.</p>'
  }
];

const EXPLANATION_EVENT_EDITOR_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'event-editor-main',
    icon: 'edit_calendar',
    title: 'Kötelező eseményadatok',
    blurb: 'Töltsd ki a mentéshez szükséges mezőket.',
    contentHtml: '<p>A név, leírás, legkisebb és legnagyobb létszám, kezdési idő és befejezési idő kötelező. A kép és a helyszín opcionális; a fejléc pipája menti az eseményt.</p>'
  },
  {
    id: 'event-editor-switches',
    icon: 'tune',
    title: 'Láthatóság és csatlakozás',
    blurb: 'Állítsd be, ki találhatja meg az eseményt, és mi kell a belépéshez.',
    contentHtml: '<p>A <strong>Nyilvános</strong>, <strong>Csak ismerősök</strong> és <strong>Csak meghívással</strong> a megtalálhatóságot szabályozza. A nyitott vagy vak mód a résztvevők előnézetét kezeli; emellett legfeljebb öt témát választhatsz, és bekapcsolhatod az automatikus meghívást, a jegykezelést vagy a jóváhagyást.</p>'
  },
  {
    id: 'event-editor-schedule',
    icon: 'event_time',
    title: 'Idő, ár és szabályok',
    blurb: 'Állítsd be az időbeosztást és a csatlakozás feltételeit.',
    contentHtml: '<p>Válassz egyszeri vagy ismétlődő időbeosztást, és szükség esetén módosítsd az idősávokat. Az árazás és az eseményszabályok opcionálisak, a helyszínmező pedig az eseménynél megjelenő helyet adja meg.</p>'
  },
  {
    id: 'event-editor-subevents',
    icon: 'account_tree',
    title: 'Alesemények',
    blurb: 'Bontsd kisebb részekre a nagyobb eseményt.',
    contentHtml: '<p>Az alesemény lehet kötelező rész vagy külön választható program saját létszámmal és árral. A <strong>Kötetlen</strong> mód egyszerű felépítést, a <strong>Bajnokság</strong> pedig szakaszokat, csoportokat, pontokat és rangsort ad.</p>'
  },
  {
    id: 'event-editor-members',
    icon: 'groups',
    title: 'Tagok és szerepek',
    blurb: 'A résztvevőket külön tagablakban kezelheted.',
    contentHtml: '<p>A <strong>Tagok</strong> ablakban embereket hívhatsz meg, valamint megnézheted az elfogadott és függő résztvevőket. A szerep- és állapotműveletek attól függenek, hogy szervező, kezelő vagy résztvevő vagy.</p>'
  },
  {
    id: 'event-editor-assets',
    icon: 'inventory_2',
    title: 'Erőforrások',
    blurb: 'Rendelj embereket és eszközöket az esemény egy részéhez.',
    contentHtml: '<p>Egy aleseményből vagy csoportból nyithatod meg a tagokat, járműveket, szállásokat és kellékeket. A <strong>Hozzárendelés</strong> egy már kezelt eszközt használ, a <strong>Felfedezés</strong> pedig kérhető eszközt keres.</p>'
  }
];

const EXPLANATION_IMAGE_SLOT_LIMIT = 8;
const SEEDED_EXPLANATION_IMAGE_REF_PREFIX = 'help-seeded-image:';
const SEEDED_EXPLANATION_IMAGE_ASSET_ROOT = 'assets/help-center/explanations';
const LAZY_IMAGE_PLACEHOLDER_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const EXPLANATION_SECTION_SPANS: Record<string, HelpCenterSectionDto['panelSpan']> = {
  'affinity-network': 'span-2',
  'activity-chat-message-window': 'span-2',
  'contacts-list': 'span-2',
  'contacts-card': 'span-2',
  'contacts-private-methods': 'span-2',
  'assets-entry': 'span-2',
  'assets-card': 'span-2',
  'assets-editor': 'span-2',
  'assets-requests': 'span-2',
  'assets-scope': 'span-2'
};
const SPAN_1_EXPLANATION_CONTEXTS = new Set(['events', 'event.editor']);

function withSeededExplanationImages(contextKey: string, sections: HelpCenterSectionDto[], lang: string): HelpCenterSectionDto[] {
  return sections.map(section => {
    const seededImageUrl = seededExplanationImageRef(contextKey, lang, section.id);
    return {
      ...section,
      panelSpan: SPAN_1_EXPLANATION_CONTEXTS.has(contextKey)
        ? 'span-1'
        : section.panelSpan ?? EXPLANATION_SECTION_SPANS[section.id],
      contentHtml: withSeededExplanationImageHtml(section.contentHtml, seededImageUrl, section.title),
      imageUrls: uniqueHelpImageUrls([seededImageUrl, ...(section.imageUrls ?? [])])
    };
  });
}

function uniqueHelpImageUrls(imageUrls: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const imageUrl of imageUrls) {
    const normalized = `${imageUrl ?? ''}`.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= EXPLANATION_IMAGE_SLOT_LIMIT) {
      break;
    }
  }
  return result;
}

function seededExplanationImageRef(contextKey: string, lang: string, sectionId: string): string {
  return `${SEEDED_EXPLANATION_IMAGE_REF_PREFIX}${contentLangForSeed(lang)}/${seededExplanationPathSegment(contextKey)}/${seededExplanationPathSegment(sectionId)}`;
}

function withSeededExplanationImageHtml(contentHtml: string | null | undefined, imageUrl: string, title: string | null | undefined): string {
  const html = `${contentHtml ?? ''}`.trim();
  const nextFigure = `<figure class="explanation-seeded-visual lazy-image-frame-loading"><img class="lazy-image-loading" src="${escapeHtmlAttribute(lazyImagePlaceholderSrc(imageUrl))}" alt="${escapeHtmlAttribute(title ?? '')}"></figure>`;
  const withoutExistingSeededFigure = html.replace(/<figure\b[^>]*\bexplanation-seeded-visual\b[^>]*>[\s\S]*?<\/figure>/gi, '').trim();
  if (/<img[\s>]/i.test(withoutExistingSeededFigure)) {
    return withoutExistingSeededFigure;
  }
  return `${withoutExistingSeededFigure}${withoutExistingSeededFigure ? '' : ''}${nextFigure}`;
}

function lazyImagePlaceholderSrc(imageUrl: string): string {
  return `${LAZY_IMAGE_PLACEHOLDER_URL}#lazy-src=${encodeURIComponent(imageUrl)}`;
}

function seededExplanationPathSegment(value: string | null | undefined): string {
  return `${value ?? ''}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'default';
}

function contentLangForSeed(lang: string | null | undefined): string {
  return `${lang ?? ''}`.trim().toLowerCase().split('-')[0] === 'hu' ? 'hu' : 'en';
}

function escapeHtmlAttribute(value: string): string {
  return `${value ?? ''}`
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const DEFAULT_EXPLANATION_HOME_REVISION: HelpCenterRevisionDto = {
  id: 'explanation-home-default-v1',
  documentKind: 'explanation',
  contextKey: 'home.game',
  lang: 'en',
  languageLabel: 'English',
  version: 1,
  title: 'Home cards',
  summary: 'Rate cards, switch groups, and revisit ratings.',
  description: 'Learn how to rate a card and control which suggestions appear.',
  headerColor: 'violet',
  sections: withSeededExplanationImages('home.game', EXPLANATION_HOME_SECTIONS, 'en'),
  active: true,
  createdAtIso: '2026-05-22T00:00:00.000Z',
  createdByUserId: 'system',
  updatedAtIso: '2026-05-22T00:00:00.000Z',
  updatedByUserId: 'system'
};

const DEFAULT_EXPLANATION_HOME_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-home-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Kezdőlap kártyái',
  summary: 'Értékelés, kártyacsoportok és előzmények.',
  description: 'Itt megtudhatod, hogyan értékelj, és hogyan válaszd ki a megjelenő ajánlásokat.',
  sections: withSeededExplanationImages('home.game', EXPLANATION_HOME_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_ACTIVITY_RATES_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-activity-rates-default-v1',
  contextKey: 'activities.rates',
  title: 'Activity ratings',
  summary: 'Filter, arrange, and update rating cards.',
  description: 'See which ratings can be changed and how each view works.',
  sections: withSeededExplanationImages('activities.rates', EXPLANATION_ACTIVITY_RATES_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_ACTIVITY_RATES_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ACTIVITY_RATES_REVISION,
  id: 'explanation-activity-rates-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Aktivitási értékelések',
  summary: 'Értékeléskártyák szűrése, rendezése és módosítása.',
  description: 'Itt láthatod, mely értékelések módosíthatók, és mire valók a nézetek.',
  sections: withSeededExplanationImages('activities.rates', EXPLANATION_ACTIVITY_RATES_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_EVENTS_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-events-default-v1',
  contextKey: 'events',
  title: 'Events',
  summary: 'Find, join, create, and manage events.',
  description: 'Learn what event cards show and which actions are available.',
  sections: withSeededExplanationImages('events', EXPLANATION_EVENTS_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_EVENTS_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_EVENTS_REVISION,
  id: 'explanation-events-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Események',
  summary: 'Események keresése, csatlakozás, létrehozás és kezelés.',
  description: 'Itt megtudhatod, mit mutat egy eseménykártya, és milyen műveletek érhetők el.',
  sections: withSeededExplanationImages('events', EXPLANATION_EVENTS_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_ASSETS_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-assets-default-v1',
  contextKey: 'assets',
  title: 'Assets',
  summary: 'Manage assets, requests, assignments, and tickets.',
  description: 'Learn how asset cards, editing, requests, and visibility work.',
  sections: withSeededExplanationImages('assets', EXPLANATION_ASSETS_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_ASSETS_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_REVISION,
  id: 'explanation-assets-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Eszközök',
  summary: 'Eszközök, kérések, hozzárendelések és jegyek kezelése.',
  description: 'Itt megismerheted az eszközkártyákat, a szerkesztést, a kéréseket és a láthatóságot.',
  sections: withSeededExplanationImages('assets', EXPLANATION_ASSETS_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_ASSETS_TRANSPORT_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_REVISION,
  id: 'explanation-assets-transport-default-v1',
  contextKey: 'assets.transport',
  title: 'Transport assets',
  summary: 'Manage transport details, capacity, and requests.',
  description: 'Learn how to add, edit, share, and assign transport assets.',
  sections: withSeededExplanationImages('assets.transport', EXPLANATION_ASSETS_TRANSPORT_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_ASSETS_TRANSPORT_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_TRANSPORT_REVISION,
  id: 'explanation-assets-transport-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Járművek',
  summary: 'Járműadatok, kapacitás és kérések kezelése.',
  description: 'Itt megtudhatod, hogyan adj hozzá, szerkessz, ossz meg és rendelj eseményhez járművet.',
  sections: withSeededExplanationImages('assets.transport', EXPLANATION_ASSETS_TRANSPORT_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_ASSETS_ACCOMMODATION_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_REVISION,
  id: 'explanation-assets-accommodation-default-v1',
  contextKey: 'assets.accommodation',
  title: 'Accommodation assets',
  summary: 'Manage places, capacity, location, and requests.',
  description: 'Learn how to add, edit, share, and assign accommodation.',
  sections: withSeededExplanationImages('assets.accommodation', EXPLANATION_ASSETS_ACCOMMODATION_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_ASSETS_ACCOMMODATION_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_ACCOMMODATION_REVISION,
  id: 'explanation-assets-accommodation-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Szállások',
  summary: 'Helyszín, kapacitás és kérések kezelése.',
  description: 'Itt megtudhatod, hogyan adj hozzá, szerkessz, ossz meg és rendelj eseményhez szállást.',
  sections: withSeededExplanationImages('assets.accommodation', EXPLANATION_ASSETS_ACCOMMODATION_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_ASSETS_SUPPLIES_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_REVISION,
  id: 'explanation-assets-supplies-default-v1',
  contextKey: 'assets.supplies',
  title: 'Supply assets',
  summary: 'Manage supplies, quantities, and requests.',
  description: 'Learn how to add, edit, share, and assign supplies.',
  sections: withSeededExplanationImages('assets.supplies', EXPLANATION_ASSETS_SUPPLIES_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_ASSETS_SUPPLIES_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_SUPPLIES_REVISION,
  id: 'explanation-assets-supplies-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Kellékek',
  summary: 'Kellékek, mennyiségek és kérések kezelése.',
  description: 'Itt megtudhatod, hogyan adj hozzá, szerkessz, ossz meg és rendelj eseményhez kelléket.',
  sections: withSeededExplanationImages('assets.supplies', EXPLANATION_ASSETS_SUPPLIES_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_ASSETS_TICKETS_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_REVISION,
  id: 'explanation-assets-tickets-default-v1',
  contextKey: 'assets.tickets',
  title: 'Event tickets',
  summary: 'View ticket cards, QR codes, and scanning.',
  description: 'Learn how to open your code and check another ticket.',
  sections: withSeededExplanationImages('assets.tickets', EXPLANATION_ASSETS_TICKETS_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_ASSETS_TICKETS_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_TICKETS_REVISION,
  id: 'explanation-assets-tickets-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Eseményjegyek',
  summary: 'Jegykártyák, QR-kódok és beolvasás.',
  description: 'Itt megtudhatod, hogyan nyisd meg a saját kódodat, és hogyan ellenőrizz egy másik jegyet.',
  sections: withSeededExplanationImages('assets.tickets', EXPLANATION_ASSETS_TICKETS_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_EVENT_EDITOR_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-event-editor-default-v1',
  contextKey: 'event.editor',
  title: 'Event editor',
  summary: 'Set event details, schedule, members, and resources.',
  description: 'Learn which fields are required and where advanced options belong.',
  sections: withSeededExplanationImages('event.editor', EXPLANATION_EVENT_EDITOR_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_EVENT_EDITOR_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_EVENT_EDITOR_REVISION,
  id: 'explanation-event-editor-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Eseményszerkesztő',
  summary: 'Eseményadatok, időpontok, tagok és erőforrások beállítása.',
  description: 'Itt megtudhatod, mely mezők kötelezők, és hol találod a további beállításokat.',
  sections: withSeededExplanationImages('event.editor', EXPLANATION_EVENT_EDITOR_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_CHATS_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-chats-default-v1',
  contextKey: 'chats',
  title: 'Chats',
  summary: 'Find conversations, send messages, and use chat tools.',
  description: 'Learn what each channel is for and which message actions are available.',
  sections: withSeededExplanationImages('chats', EXPLANATION_CHATS_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_CHATS_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_CHATS_REVISION,
  id: 'explanation-chats-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Beszélgetések',
  summary: 'Beszélgetések keresése, üzenetküldés és további eszközök.',
  description: 'Itt megtudhatod, mire valók a csatornák, és milyen üzenetműveletek érhetők el.',
  sections: withSeededExplanationImages('chats', EXPLANATION_CHATS_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_CONTACTS_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-contacts-default-v1',
  contextKey: 'contacts',
  title: 'Contacts',
  summary: 'Save people and manage contact shortcuts.',
  description: 'Learn how contact cards and saved contact methods work.',
  sections: withSeededExplanationImages('contacts', EXPLANATION_CONTACTS_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_CONTACTS_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_CONTACTS_REVISION,
  id: 'explanation-contacts-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Kapcsolatok',
  summary: 'Emberek mentése és elérési gyorsgombok kezelése.',
  description: 'Itt megtudhatod, hogyan működnek a kapcsolatkártyák és a mentett elérési módok.',
  sections: withSeededExplanationImages('contacts', EXPLANATION_CONTACTS_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_PROFILE_EDITOR_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-profile-editor-default-v1',
  contextKey: 'profile.editor',
  title: 'Profile editor',
  summary: 'Edit profile details, photos, visibility, and experience.',
  description: 'Learn which details are required and how to save your profile.',
  sections: withSeededExplanationImages('profile.editor', EXPLANATION_PROFILE_EDITOR_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_PROFILE_EDITOR_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_PROFILE_EDITOR_REVISION,
  id: 'explanation-profile-editor-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Profilszerkesztő',
  summary: 'Profiladatok, képek, láthatóság és tapasztalatok szerkesztése.',
  description: 'Itt megtudhatod, mely adatok kötelezők, és hogyan mentsd el a profilodat.',
  sections: withSeededExplanationImages('profile.editor', EXPLANATION_PROFILE_EDITOR_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_PROFILE_VIEW_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-profile-view-default-v1',
  contextKey: 'profile.view',
  title: 'Profile view',
  summary: 'Browse photos, profile details, and experience.',
  description: 'Learn what this read-only profile screen shows.',
  sections: withSeededExplanationImages('profile.view', EXPLANATION_PROFILE_VIEW_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_PROFILE_VIEW_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_PROFILE_VIEW_REVISION,
  id: 'explanation-profile-view-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Profilnézet',
  summary: 'Képek, profiladatok és tapasztalatok megtekintése.',
  description: 'Itt megtudhatod, mit mutat ez a csak olvasható profilképernyő.',
  sections: withSeededExplanationImages('profile.view', EXPLANATION_PROFILE_VIEW_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_EVENT_FEEDBACK_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-event-feedback-default-v1',
  contextKey: 'event.feedback',
  title: 'Event feedback',
  summary: 'Submit feedback and review event results.',
  description: 'Learn how feedback lists, answer cards, and organizer results work.',
  sections: withSeededExplanationImages('event.feedback', EXPLANATION_EVENT_FEEDBACK_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_EVENT_FEEDBACK_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_EVENT_FEEDBACK_REVISION,
  id: 'explanation-event-feedback-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Esemény-visszajelzés',
  summary: 'Visszajelzés beküldése és az eredmények áttekintése.',
  description: 'Itt megismerheted a visszajelzési listákat, a válaszkártyákat és a szervezői eredményeket.',
  sections: withSeededExplanationImages('event.feedback', EXPLANATION_EVENT_FEEDBACK_SECTIONS_HU, 'hu')
};

export const APP_STATIC_DATA = {
  vibeCategories: VIBE_CATEGORIES,
  hostedEventTypes: HOSTED_EVENT_TYPES,
  vibeIcons: VIBE_ICONS,
  categoryIcons: CATEGORY_ICONS,
  memberTraitIcons: MEMBER_TRAIT_ICONS,
  navigatorHostTierPresenters: NAVIGATOR_HOST_TIER_PRESENTERS,
  navigatorHostTierPresenterDefault: NAVIGATOR_HOST_TIER_PRESENTER_DEFAULT,
  navigatorTraitPresenters: NAVIGATOR_TRAIT_PRESENTERS,
  navigatorMemberImpressionTitlePresenters: NAVIGATOR_MEMBER_IMPRESSION_TITLE_PRESENTERS,
  navigatorTraitPresenterDefault: NAVIGATOR_TRAIT_PRESENTER_DEFAULT,
  personalityTraitCatalog: PERSONALITY_TRAIT_CATALOG,
  physiqueOptions: PHYSIQUE_OPTIONS,
  languageSuggestions: LANGUAGE_SUGGESTIONS,
  activitiesPrimaryFilters: ACTIVITIES_PRIMARY_FILTERS,
  activitiesSecondaryFilters: ACTIVITIES_SECONDARY_FILTERS,
  activitiesChatContextFilters: ACTIVITIES_CHAT_CONTEXT_FILTERS,
  rateFilters: RATE_FILTERS,
  rateFilterEntries: RATE_FILTER_ENTRIES,
  activitiesViewOptions: ACTIVITIES_VIEW_OPTIONS,
  eventExploreOrderOptions: EVENT_EXPLORE_ORDER_OPTIONS,
  homeGameFilterInterestGroups: HOME_GAME_FILTER_INTEREST_GROUPS,
  homeGameFilterValuesGroups: HOME_GAME_FILTER_VALUES_GROUPS,
  homeUserFacetById: HOME_USER_FACET_BY_ID,
  profileStatusOptions: PROFILE_STATUS_OPTIONS,
  contentLanguages: CONTENT_LANGUAGES,
  helpCenterHeaderColors: HELP_CENTER_HEADER_COLORS,
  helpCenterHeaderColorOptions: HELP_CENTER_HEADER_COLOR_OPTIONS,
  documentViewerHeaderPalettes: DOCUMENT_VIEWER_HEADER_PALETTES,
  explainableSurfaces: EXPLAINABLE_SURFACES,
  profileDetailValueOptions: PROFILE_DETAIL_VALUE_OPTIONS,
  profileDetailGroupTemplates: PROFILE_DETAIL_GROUP_TEMPLATES,
  beliefsValuesOptionGroups: BELIEFS_VALUES_OPTION_GROUPS,
  interestOptionGroups: INTEREST_OPTION_GROUPS,
  detailPrivacyOptions: DETAIL_PRIVACY_OPTIONS,
  experienceFilterOptions: EXPERIENCE_FILTER_OPTIONS,
  experienceTypeOptions: EXPERIENCE_TYPE_OPTIONS,
  profileSampleExperienceEntries: PROFILE_SAMPLE_EXPERIENCE_ENTRIES,
  assetTypeOptions: ASSET_TYPE_OPTIONS,
  assetFilterOptions: ASSET_FILTER_OPTIONS,
  assetTypeLabels: ASSET_TYPE_LABELS,
  assetCategoryOptionsByType: ASSET_CATEGORY_OPTIONS_BY_TYPE,
  activityRatingScale: ACTIVITY_RATING_SCALE,
  calendarWeekdayLabels: CALENDAR_WEEKDAY_LABELS,
  calendarWeekdayOptions: CALENDAR_WEEKDAY_OPTIONS,
  scheduleFrequencyOptions: SCHEDULE_FREQUENCY_OPTIONS,
  eventVisibilityOptions: EVENT_VISIBILITY_OPTIONS,
  eventBlindModeOptions: EVENT_BLIND_MODE_OPTIONS,
  subEventResourceFilterOptions: SUB_EVENT_RESOURCE_FILTER_OPTIONS,
  subEventResourceFilterLabels: SUB_EVENT_RESOURCE_FILTER_LABELS,
  modeOptions: EVENT_MODE_OPTIONS,
  tournamentLeaderboardTypeOptions: TOURNAMENT_LEADERBOARD_TYPE_OPTIONS,
  activityGroupLabels: ACTIVITY_GROUP_LABELS,
  activityMemberMetPlaces: ACTIVITY_MEMBER_MET_PLACES,
  activityMemberDefaults: ACTIVITY_MEMBER_DEFAULTS,
  reportUserReasons: REPORT_USER_REASONS,
  feedbackCategories: FEEDBACK_CATEGORIES,
  eventFeedbackEventOverallOptions: EVENT_FEEDBACK_EVENT_OVERALL_OPTIONS,
  eventFeedbackHostImproveOptions: EVENT_FEEDBACK_HOST_IMPROVE_OPTIONS,
  eventFeedbackAttendeeCollabOptions: EVENT_FEEDBACK_ATTENDEE_COLLAB_OPTIONS,
  eventFeedbackAttendeeRejoinOptions: EVENT_FEEDBACK_ATTENDEE_REJOIN_OPTIONS,
  eventFeedbackPersonalityTraitOptions: EVENT_FEEDBACK_PERSONALITY_TRAIT_OPTIONS,
  eventFeedbackListFilters: EVENT_FEEDBACK_LIST_FILTER_OPTIONS,
  helpCenterSections: HELP_CENTER_SECTIONS,
  helpCenterSectionsByLang: {
    en: HELP_CENTER_SECTIONS,
    hu: HELP_CENTER_SECTIONS_HU
  },
  privacyCenterSections: PRIVACY_CENTER_SECTIONS,
  privacyCenterSectionsByLang: {
    en: PRIVACY_CENTER_SECTIONS,
    hu: PRIVACY_CENTER_SECTIONS_HU
  },
  termsCenterSections: TERMS_CENTER_SECTIONS,
  termsCenterSectionsByLang: {
    en: TERMS_CENTER_SECTIONS,
    hu: TERMS_CENTER_SECTIONS_HU
  },
  defaultHelpCenterDescription: DEFAULT_HELP_CENTER_DESCRIPTION,
  defaultPrivacyCenterDescription: DEFAULT_PRIVACY_CENTER_DESCRIPTION,
  defaultTermsCenterDescription: DEFAULT_TERMS_CENTER_DESCRIPTION,
  defaultHelpCenterRevision: DEFAULT_HELP_CENTER_REVISION,
  defaultHelpCenterRevisionsByLang: {
    en: DEFAULT_HELP_CENTER_REVISION,
    hu: DEFAULT_HELP_CENTER_REVISION_HU
  },
  defaultPrivacyCenterRevision: DEFAULT_PRIVACY_CENTER_REVISION,
  defaultPrivacyCenterRevisionsByLang: {
    en: DEFAULT_PRIVACY_CENTER_REVISION,
    hu: DEFAULT_PRIVACY_CENTER_REVISION_HU
  },
  defaultTermsCenterRevision: DEFAULT_TERMS_CENTER_REVISION,
  defaultTermsCenterRevisionsByLang: {
    en: DEFAULT_TERMS_CENTER_REVISION,
    hu: DEFAULT_TERMS_CENTER_REVISION_HU
  },
  defaultExplanationHomeRevision: DEFAULT_EXPLANATION_HOME_REVISION,
  defaultExplanationHomeRevisionsByLang: {
    en: DEFAULT_EXPLANATION_HOME_REVISION,
    hu: DEFAULT_EXPLANATION_HOME_REVISION_HU
  },
  defaultExplanationRevisionsByContext: {
    'home.game': {
      en: DEFAULT_EXPLANATION_HOME_REVISION,
      hu: DEFAULT_EXPLANATION_HOME_REVISION_HU
    },
    'activities.rates': {
      en: DEFAULT_EXPLANATION_ACTIVITY_RATES_REVISION,
      hu: DEFAULT_EXPLANATION_ACTIVITY_RATES_REVISION_HU
    },
    chats: {
      en: DEFAULT_EXPLANATION_CHATS_REVISION,
      hu: DEFAULT_EXPLANATION_CHATS_REVISION_HU
    },
    'profile.editor': {
      en: DEFAULT_EXPLANATION_PROFILE_EDITOR_REVISION,
      hu: DEFAULT_EXPLANATION_PROFILE_EDITOR_REVISION_HU
    },
    'profile.view': {
      en: DEFAULT_EXPLANATION_PROFILE_VIEW_REVISION,
      hu: DEFAULT_EXPLANATION_PROFILE_VIEW_REVISION_HU
    },
    contacts: {
      en: DEFAULT_EXPLANATION_CONTACTS_REVISION,
      hu: DEFAULT_EXPLANATION_CONTACTS_REVISION_HU
    },
    assets: {
      en: DEFAULT_EXPLANATION_ASSETS_REVISION,
      hu: DEFAULT_EXPLANATION_ASSETS_REVISION_HU
    },
    'assets.transport': {
      en: DEFAULT_EXPLANATION_ASSETS_TRANSPORT_REVISION,
      hu: DEFAULT_EXPLANATION_ASSETS_TRANSPORT_REVISION_HU
    },
    'assets.accommodation': {
      en: DEFAULT_EXPLANATION_ASSETS_ACCOMMODATION_REVISION,
      hu: DEFAULT_EXPLANATION_ASSETS_ACCOMMODATION_REVISION_HU
    },
    'assets.supplies': {
      en: DEFAULT_EXPLANATION_ASSETS_SUPPLIES_REVISION,
      hu: DEFAULT_EXPLANATION_ASSETS_SUPPLIES_REVISION_HU
    },
    'assets.tickets': {
      en: DEFAULT_EXPLANATION_ASSETS_TICKETS_REVISION,
      hu: DEFAULT_EXPLANATION_ASSETS_TICKETS_REVISION_HU
    },
    events: {
      en: DEFAULT_EXPLANATION_EVENTS_REVISION,
      hu: DEFAULT_EXPLANATION_EVENTS_REVISION_HU
    },
    'event.editor': {
      en: DEFAULT_EXPLANATION_EVENT_EDITOR_REVISION,
      hu: DEFAULT_EXPLANATION_EVENT_EDITOR_REVISION_HU
    },
    'event.feedback': {
      en: DEFAULT_EXPLANATION_EVENT_FEEDBACK_REVISION,
      hu: DEFAULT_EXPLANATION_EVENT_FEEDBACK_REVISION_HU
    }
  },
  seededExplanationImageRefPrefix: SEEDED_EXPLANATION_IMAGE_REF_PREFIX,
  seededExplanationImageAssetRoot: SEEDED_EXPLANATION_IMAGE_ASSET_ROOT
};
