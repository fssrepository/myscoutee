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
  { key: 'past-events', label: 'Past Events', icon: 'history' },
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
    contentHtml: htmlList(GDPR_CONTENT.contacts.map(contact => `<strong>${contact.label}:</strong> ${contact.value}`))
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
    contentHtml: '<ul><li><strong>Adatkezelő:</strong> MyScoutee</li><li><strong>Támogatási email:</strong> myscoutee1@gmail.com</li><li><strong>DPO kapcsolat:</strong> myscoutee1@gmail.com</li></ul>'
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
    contentHtml: '<ul><li>A fiók törlése a felhasználói beállítások menüben érhető el. A megerősítés után a fiók törlésre kerül ütemezésre, és a felhasználó kijelentkezik.</li><li>Ha a fiók törölt állapotban van, de még nem lett véglegesen törölve, az ismételt bejelentkezés újraaktiválási megerősítést jeleníthet meg a 30 napos törlési időszak lejárta előtt.</li><li>Ha a törlést Facebook-belépés után a Meta/Facebook fiókbeállításokból kérik, a Meta a MyScoutee backend callbacket hívja meg, és az egyező fiókok ugyanazt a törlési ütemezést követik.</li><li>Törlési kérés küldhető a myscoutee1@gmail.com címre is a MyScoutee fiókhoz kapcsolódó email címről.</li></ul>'
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
    title: 'Affinity slider',
    blurb: 'Choose how strong the card feels for you.',
    contentHtml: '<p>Tap or drag the Affinity slider from 1 to 10. The Go button saves the current visible value.</p>'
  },
  {
    id: 'affinity-network',
    icon: 'hub',
    title: 'Affinity and group chats',
    blurb: 'Your answer helps find a small group where conversation is easier to start.',
    contentHtml: '<p>When you choose 1-10, you are saying how much you would like to talk with this person. That number is not used alone: it matters more when interest is mutual, recent, and stronger than the usual background noise.</p><p>If several people seem likely to enjoy meeting each other, MyScoutee can place them into a random group chat of 6-12 people. It is still a fresh group, but it is nudged toward people who already have enough shared interest to make the first message feel less awkward.</p>'
  },
  {
    id: 'profile',
    icon: 'visibility',
    title: 'Profile and photos',
    blurb: 'Cards can contain more photos and a profile detail view.',
    contentHtml: '<p>Tap the left or right image columns to browse photos. Use the eye icon to open profile details.</p>'
  },
  {
    id: 'filters',
    icon: 'filter_alt',
    title: 'Filters and modes',
    blurb: 'Use the top bar to narrow who appears.',
    contentHtml: '<p>The filter button opens profile filters. The number shows how many results match the selected filter condition.</p><p><strong>Preferences</strong>: normal preference-based cards. <strong>Friends in Common</strong>: people connected through someone or an event. <strong>Inside Network</strong>: pairs from your existing network. <strong>Outside Network</strong>: pairs outside it.</p>'
  },
  {
    id: 'history',
    icon: 'history',
    title: 'History and edits',
    blurb: 'Your previous ratings stay available.',
    contentHtml: '<p>Open history from the header or menu. In Activity ratings, use the star icon to edit a value you already gave.</p>'
  }
];

const EXPLANATION_HOME_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'affinity',
    icon: 'tune',
    title: 'Szimpátia sáv',
    blurb: 'Állítsd be, mennyire szimpatikus a kártya.',
    contentHtml: '<p>Tapints vagy húzd a Szimpátia sávot 1 és 10 között. A Mehet gomb csak akkor jelenik meg, amikor már választottál értéket.</p>'
  },
  {
    id: 'affinity-network',
    icon: 'hub',
    title: 'Szimpátia és csoportchat',
    blurb: 'A válaszod segít olyan kis csoportot találni, ahol könnyebb elkezdeni beszélgetni.',
    contentHtml: '<p>Amikor 1 és 10 között választasz, azt jelzed, mennyire szívesen beszélgetnél ezzel az emberrel. Nem csak ez az egy szám dönt: többet ér, ha a szimpátia kölcsönös, friss, és a szokásos háttérzajhoz képest is erős.</p><p>Ha több embernél látszik, hogy jó eséllyel szívesen ismerkednének egymással, a MyScoutee kioszthat egy 6-12 fős véletlenszerű csoportos chatet. A csoport továbbra is új és laza, csak olyan irányba van terelve, ahol az első üzenet kevésbé kínos.</p>'
  },
  {
    id: 'profile',
    icon: 'visibility',
    title: 'Profil és képek',
    blurb: 'A kártya több képet és részletes profilt is rejthet.',
    contentHtml: '<p>Tapints a kép bal vagy jobb oszlopára a fotók lapozásához. A szem ikon megnyitja a profil részleteit.</p>'
  },
  {
    id: 'filters',
    icon: 'filter_alt',
    title: 'Szűrők és módok',
    blurb: 'A felső sávval szűkítheted, kik jelenjenek meg.',
    contentHtml: '<p>A tölcsér ikon nyitja a profilszűrőket. A szám azt mutatja, hogy az adott szűrőfeltétel mellett hány találat van.</p><p><strong>Preferenciák</strong>: normál, saját beállításaid szerinti kártyák. <strong>Közös ismerősök</strong>: valakin vagy eseményen keresztül kapcsolódó profilok. <strong>Hálózaton belül</strong>: párok a meglévő kapcsolati körből. <strong>Hálózaton kívül</strong>: párok azon kívül.</p>'
  },
  {
    id: 'history',
    icon: 'history',
    title: 'Előzmények',
    blurb: 'A korábbi értékelések később is elérhetők.',
    contentHtml: '<p>Az előzményeket a history gombbal vagy a menüből nyithatod meg. Az Activity értékeléseknél a csillag ikonon keresztül módosíthatod a saját értékedet.</p>'
  }
];

const EXPLANATION_ACTIVITY_RATES_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'activity-rate-filter',
    icon: 'north_east',
    title: 'What you are looking at',
    blurb: 'Pick which kind of rating cards should be shown.',
    contentHtml: '<p>Open the first menu to choose cards you rated, cards where someone rated you, mutual ratings, people you met, or suggestions.</p><p>The red number tells you how many cards are in that choice. The Social switch simply decides whether cards suggested through shared people or events are included.</p>'
  },
  {
    id: 'activity-header-controls',
    icon: 'route',
    title: 'Order and view',
    blurb: 'These buttons only change how the list is shown.',
    contentHtml: '<p><strong>Recent</strong>, <strong>Relevant</strong>, and <strong>Past</strong> decide what comes first. They do not change anyone&rsquo;s score.</p><p><strong>Month</strong>, <strong>Week</strong>, <strong>Day</strong>, and <strong>Distance</strong> decide how the same cards are grouped. A label like <strong>10 km</strong> is just a group title.</p>'
  },
  {
    id: 'activity-score-badge',
    icon: 'star',
    title: 'Rating one card',
    blurb: 'Tap a card, then use the 1-10 bar to change your rating.',
    contentHtml: '<p>The star badge shows your current rating for that card. After you select a card, the bar at the bottom changes only that selected card.</p><p>If a card is read-only, you may still see a received score, but the bottom bar will not change it.</p>'
  },
  {
    id: 'activity-fullscreen',
    icon: 'fullscreen',
    title: 'Rating one by one',
    blurb: 'Use fullscreen when you want to focus on a single card.',
    contentHtml: '<p>The fullscreen button opens a larger card. The small bars at the top of the image show when there are more photos.</p><p>The rating bar sits below the image and changes only the card you can see. When you exit fullscreen, you return to the same filtered list.</p>'
  }
];

const EXPLANATION_ACTIVITY_RATES_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'activity-rate-filter',
    icon: 'north_east',
    title: 'Mit nézel?',
    blurb: 'Itt választod ki, milyen értékeléskártyák látszanak.',
    contentHtml: '<p>Nyisd le az első menüt, és válassz: akiket te értékeltél, akik téged értékeltek, kölcsönös értékelések, akikkel találkoztál, vagy ajánlások.</p><p>A piros szám azt mutatja, hány kártya van abban a választásban. A Social kapcsoló csak azt dönti el, hogy bekerüljenek-e a közös emberek vagy események alapján ajánlott kártyák.</p>'
  },
  {
    id: 'activity-header-controls',
    icon: 'route',
    title: 'Sorrend és nézet',
    blurb: 'Ezek a gombok csak azt változtatják, hogyan látod a listát.',
    contentHtml: '<p>A <strong>Legutóbbi</strong>, <strong>Releváns</strong> és <strong>Korábbi</strong> azt dönti el, mi kerüljön előre. Ettől senkinek nem változik a pontja.</p><p>A <strong>Hónap</strong>, <strong>Hét</strong>, <strong>Nap</strong> és <strong>Távolság</strong> azt dönti el, milyen csoportokban látod ugyanazokat a kártyákat. A <strong>10 km</strong> felirat csak egy csoportcím.</p>'
  },
  {
    id: 'activity-score-badge',
    icon: 'star',
    title: 'Egy kártya pontozása',
    blurb: 'Koppints egy kártyára, majd az 1-10-es sávval módosítsd az értékelést.',
    contentHtml: '<p>A csillagos jelvény azt mutatja, most mennyire értékelted azt a kártyát. Ha kijelölsz egy kártyát, az alsó sáv csak azt az egy kártyát módosítja.</p><p>Ha egy kártya csak olvasható, láthatod rajta a kapott pontot, de az alsó sáv nem fogja átírni.</p>'
  },
  {
    id: 'activity-fullscreen',
    icon: 'fullscreen',
    title: 'Egyesével pontozás',
    blurb: 'A teljes képernyő akkor jó, ha csak egy kártyára szeretnél figyelni.',
    contentHtml: '<p>A teljes képernyő ikon nagyobb kártyát nyit. A kép tetején lévő kis sávok mutatják, ha több fotó van.</p><p>A pontozósáv közvetlenül a kép alatt van, és csak az éppen látható kártyát módosítja. Kilépés után ugyanabba a szűrt listába térsz vissza.</p>'
  }
];

const EXPLANATION_EVENTS_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'activity-event-entry',
    icon: 'event',
    title: 'Event lists',
    blurb: 'Pick which pile of events you want to see.',
    contentHtml: '<p>Open <strong>Events</strong> when you want invitations, events you joined, events you host, drafts, or old/deleted items. The red bubbles are counts, so you know where something waits for you.</p><p><strong>Upcoming</strong>/<strong>Past</strong> and <strong>Month</strong>/<strong>Week</strong>/<strong>Day</strong>/<strong>Distance</strong> only change how the same cards are sorted. <strong>Explore</strong> finds public events. The plus button starts a new one.</p>'
  },
  {
    id: 'activity-event-card',
    icon: 'event_note',
    title: 'Reading a card',
    blurb: 'The card gives the basic story: picture, title, time, place, and seats.',
    contentHtml: '<p>The image is the event preview. The small avatar is the host or inviter. The title tells you the event name, the date line tells you when it happens, and the place line tells you where it is and how far away it is.</p><p>A badge like <strong>1 / 5</strong> means 1 accepted person out of 5 seats. A small red number on that badge means there are pending people, invitations, or requests to check.</p>'
  },
  {
    id: 'activity-event-actions',
    icon: 'more_vert',
    title: 'What you can tap',
    blurb: 'The seats badge opens people. The three dots open actions.',
    contentHtml: '<p>Tap the <strong>1 / 5</strong> seats badge to see who is in, who is waiting, and who needs approval. If you host the event, this is where you can manage people.</p><p>Tap the three-dot menu for your available actions: view, edit, publish a draft, accept or reject an invite, contact the organizer, notify participants, share, report, leave, delete, or restore.</p>'
  },
  {
    id: 'activity-event-join',
    icon: 'person_add',
    title: 'Joining an event',
    blurb: 'Some events are instant. Some ask for approval, tickets, or choices first.',
    contentHtml: '<p>If you were invited, the card can let you accept or reject the invite. If the event has approval, a waitlist, tickets, rules, or optional parts, the app asks for those details before your spot is final.</p><p>After the event, you may also see feedback screens. Those deeper screens can have their own explanation because checkout, members, resources, and feedback have more buttons.</p>'
  },
  {
    id: 'activity-event-hosting',
    icon: 'emoji_events',
    title: 'Making events',
    blurb: 'You can make a small meetup or a bigger tournament-style event.',
    contentHtml: '<p><strong>Create Event</strong> starts a normal event. From there you can keep it simple, or build a bigger setup with stages, groups, optional parts, resources, tickets, prices, and seat limits.</p><p>If you host, you can also use auto invite. It can pull from the priority/relevance list, so better matched people can be suggested or invited first instead of adding everyone by hand.</p>'
  }
];

const EXPLANATION_EVENTS_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'activity-event-entry',
    icon: 'event',
    title: 'Eseménylisták',
    blurb: 'Itt választod ki, melyik eseménykupacot nézed.',
    contentHtml: '<p>Az <strong>Események</strong> nézetben látod a meghívásokat, csatlakozott eseményeket, saját eseményeket, piszkozatokat és régi/törölt elemeket. A piros buborékok darabszámok, így látod, hol vár rád valami.</p><p>A <strong>Közelgő</strong>/<strong>Korábbi</strong> és a <strong>Hónap</strong>/<strong>Hét</strong>/<strong>Nap</strong>/<strong>Távolság</strong> csak ugyanazokat a kártyákat rendezi át. A <strong>Felfedezés</strong> nyilvános eseményeket keres. A plusz gomb új eseményt indít.</p>'
  },
  {
    id: 'activity-event-card',
    icon: 'event_note',
    title: 'Egy kártya olvasása',
    blurb: 'A kártya röviden megmutatja: kép, cím, idő, hely és férőhely.',
    contentHtml: '<p>A kép az esemény előnézete. A kis avatar a szervezőt vagy meghívót jelzi. A cím az esemény neve, a dátumsor az időpont, a helyszín sor pedig a helyet és távolságot mutatja.</p><p>Az <strong>1 / 5</strong> jelvény azt jelenti, hogy 1 ember bent van az 5 helyből. A kis piros szám függő embereket, meghívásokat vagy kéréseket jelez.</p>'
  },
  {
    id: 'activity-event-actions',
    icon: 'more_vert',
    title: 'Mire lehet koppintani',
    blurb: 'A férőhely jelvény embereket nyit. A három pont műveleteket nyit.',
    contentHtml: '<p>Az <strong>1 / 5</strong> jelvényre koppintva látod, kik vannak bent, kik várnak, és kit kell jóváhagyni. Ha te vagy a szervező, itt tudod kezelni az embereket.</p><p>A hárompontos menüben a szereped szerinti műveletek jelennek meg: megtekintés, szerkesztés, piszkozat publikálása, meghívás elfogadása vagy elutasítása, szervező megkeresése, résztvevők értesítése, megosztás, jelentés, kilépés, törlés vagy visszaállítás.</p>'
  },
  {
    id: 'activity-event-join',
    icon: 'person_add',
    title: 'Csatlakozás eseményhez',
    blurb: 'Van azonnali csatlakozás, és van ahol jóváhagyás, jegy vagy választás kell.',
    contentHtml: '<p>Ha meghívtak, a kártyáról elfogadhatod vagy elutasíthatod a meghívást. Ha az esemény jóváhagyást, várólistát, jegyet, szabályokat vagy opcionális részeket használ, az app előbb bekéri ezeket.</p><p>Esemény után visszajelző képernyők is jöhetnek. A mélyebb képernyők, például fizetés, tagok, erőforrások és visszajelzés, saját részletesebb magyarázatot is kaphatnak.</p>'
  },
  {
    id: 'activity-event-hosting',
    icon: 'emoji_events',
    title: 'Esemény készítése',
    blurb: 'Lehet egyszerű találkozó, vagy nagyobb bajnokság jellegű esemény.',
    contentHtml: '<p>Az <strong>Új esemény</strong> normál eseményt indít. Maradhat egyszerű, vagy építhetsz belőle nagyobb rendszert szakaszokkal, csoportokkal, opcionális részekkel, erőforrásokkal, jegyekkel, árakkal és férőhelylimitekkel.</p><p>Szervezőként automatikus meghívást is használhatsz. Ez a prioritási/relevancia listából dolgozhat, így a jobban illő emberek kerülhetnek előre, nem kell mindenkit kézzel felvenni.</p>'
  }
];

const EXPLANATION_CHATS_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'activity-chat-list',
    icon: 'forum',
    title: 'Chat lists',
    blurb: 'Pick which conversations you want to see.',
    contentHtml: '<p>Open <strong>Chats</strong> to see conversations connected to your events and groups. The second menu filters the list: All, Event, Sub event, Group, or Service.</p><p>Red bubbles mean unread or waiting items. Date bars group the conversations so you can quickly see what is new today and what is older.</p>'
  },
  {
    id: 'activity-chat-card',
    icon: 'chat_bubble',
    title: 'Reading a chat row',
    blurb: 'A row tells you who spoke, which channel it is, and how many people are inside.',
    contentHtml: '<p>The round avatar is the last sender or channel person. The bold name is who last wrote, and the line under it shows the channel name, for example <strong>Main Event</strong>, <strong>Group Channel</strong>, or <strong>Contact Organizer</strong>.</p><p>The dark pill like <strong>4 members</strong> shows how many people are in that chat. A small red number on it is unread messages or pending chat-related work.</p>'
  },
  {
    id: 'activity-chat-channels',
    icon: 'account_tree',
    title: 'Channel types',
    blurb: 'Different chats are for different jobs.',
    contentHtml: '<p><strong>Main event</strong> is the broad event chat. <strong>Sub event</strong> is for one stage or optional part. <strong>Group</strong> is for a smaller team inside the event. <strong>Service</strong> or <strong>Organizer</strong> is for questions, support, notifications, or admin handling.</p><p>This keeps planning tidy: you can ask a ticket question in organizer chat, arrange a stage in sub-event chat, and talk with only your group in group chat.</p>'
  },
  {
    id: 'activity-chat-message-window',
    icon: 'mark_chat_unread',
    title: 'Opening messages',
    blurb: 'Tap a row to open the conversation and the typing box.',
    contentHtml: '<p>The top bar shows the channel name. The member button opens people in the chat, the context button opens the related event or group area, and the pin icon opens messages marked as important.</p><p>Messages are bubbles: other people are on the left, your messages are on the right. A bubble can hold text, an image, a voice clip, a poll, a shared event, or a shared asset card.</p><p>Tap a message to select it. Floating buttons appear for reply, reaction, and more actions. The menu can show View, Reply, Edit, Unsend, Mark important/remove important, or Report depending on the message and your role.</p>'
  },
  {
    id: 'activity-chat-tools',
    icon: 'add_circle',
    title: 'Useful chat tools',
    blurb: 'Chats are for coordination, not only hello messages.',
    contentHtml: '<p>The plus button beside Write message opens the same tools you use in the real chat: upload image, send voice clip, create poll, share event, and share asset.</p><p>Polls and shared event or asset cards appear inside the message stream, so people can vote or open the shared item later. Use it for practical planning: meeting spot, who brings what, rides, tickets, approvals, or last-minute changes.</p>'
  }
];

const EXPLANATION_CHATS_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'activity-chat-list',
    icon: 'forum',
    title: 'Chatlisták',
    blurb: 'Itt választod ki, melyik beszélgetéseket látod.',
    contentHtml: '<p>A <strong>Chatek</strong> nézetben az eseményekhez és csoportokhoz tartozó beszélgetéseket látod. A második menü szűr: Összes, Esemény, Alesemény, Csoport vagy Szerviz.</p><p>A piros buborék olvasatlant vagy várakozó tennivalót jelent. A dátumsávok csoportosítják a beszélgetéseket, így látod, mi friss és mi régebbi.</p>'
  },
  {
    id: 'activity-chat-card',
    icon: 'chat_bubble',
    title: 'Egy chat sor olvasása',
    blurb: 'A sor megmutatja, ki írt, melyik csatorna ez, és hányan vannak benne.',
    contentHtml: '<p>A kerek avatar az utolsó írót vagy a csatorna emberét jelzi. A vastag név mutatja, ki írt utoljára, az alatta lévő sor pedig a csatornát, például <strong>Main Event</strong>, <strong>Group Channel</strong> vagy <strong>Contact Organizer</strong>.</p><p>A sötét jelvény, például <strong>4 tag</strong>, azt mutatja, hányan vannak a chatben. A kis piros szám olvasatlan üzenetet vagy chathez tartozó tennivalót jelez.</p>'
  },
  {
    id: 'activity-chat-channels',
    icon: 'account_tree',
    title: 'Csatornatípusok',
    blurb: 'Más chat más feladatra való.',
    contentHtml: '<p>A <strong>Main event</strong> a fő esemény chatje. A <strong>Sub event</strong> egy szakaszhoz vagy opcionális részhez tartozik. A <strong>Group</strong> kisebb csapatnak szól. A <strong>Service</strong> vagy <strong>Organizer</strong> kérdéshez, támogatáshoz, értesítéshez vagy admin kezeléshez való.</p><p>Így nem keveredik minden: jegykérdést írhatsz a szervezőnek, szakaszról beszélhetsz az alesemény chatben, és csak a saját csoportoddal egyeztethetsz a group chatben.</p>'
  },
  {
    id: 'activity-chat-message-window',
    icon: 'mark_chat_unread',
    title: 'Üzenetek megnyitása',
    blurb: 'Koppints egy sorra: megnyílik a beszélgetés és az írómező.',
    contentHtml: '<p>Felül a csatorna neve látszik. Mellette a tagok gomb, a kapcsolódó esemény vagy csoport gomb és a gombostű ikon van. A gombostű a fontosnak jelölt üzenetek listáját nyitja, hogy később gyorsan visszatalálj.</p><p>Az üzenetek buborékokban vannak: bal oldalon mások, jobb oldalon a saját üzeneted. Egy buborékban lehet szöveg, kép, hang, szavazás, megosztott esemény vagy eszközkártya.</p><p>Koppints egy üzenetre a kijelöléshez. A lebegő gombokkal válaszolhatsz, reagálhatsz, vagy megnyithatod a menüt. A menüben szereptől és üzenettípustól függően Megnyitás, Válasz, Szerkesztés, Visszavonás, Fontosnak jelölés vagy Jelentés jelenhet meg.</p>'
  },
  {
    id: 'activity-chat-tools',
    icon: 'add_circle',
    title: 'Hasznos chat eszközök',
    blurb: 'A chat nem csak köszönésre van, hanem szervezésre is.',
    contentHtml: '<p>Az Üzenet írása mező melletti plusz gomb ugyanazokat az eszközöket nyitja, mint a valódi chatben: kép feltöltése, hangüzenet, szavazás, esemény megosztása és eszköz megosztása.</p><p>A szavazás és a megosztott esemény vagy eszköz kártya magában a beszélgetésben jelenik meg, így később is lehet rá szavazni vagy megnyitni. Használd gyakorlati dolgokra: találkozási pont, ki mit hoz, fuvar, jegyek, jóváhagyás vagy utolsó pillanatos változás.</p>'
  }
];

const EXPLANATION_CONTACTS_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'contacts-list',
    icon: 'contacts',
    title: 'Your contact list',
    blurb: 'This is your private quick-reach list.',
    contentHtml: '<p>Use the search field to filter saved contacts by name. <strong>Create contact</strong> lets you pick a member and add that person to your own list.</p><p>An empty list only means you have not saved anyone here yet. It does not remove people from events, chats, ratings, or profiles.</p>'
  },
  {
    id: 'contacts-card',
    icon: 'badge',
    title: 'Reading a contact card',
    blurb: 'Each row shows who the person is and the shortcuts you saved.',
    contentHtml: '<p>The avatar and name identify the person. The eye button opens the profile. The three-dot button opens the card actions: saved contact methods, Edit, and Delete.</p><p>The chips below the city are one-tap ways to reach that person, such as phone, email, WhatsApp, Telegram, Facebook, Instagram, LinkedIn, or a website, depending on what you saved.</p>'
  },
  {
    id: 'contacts-private-methods',
    icon: 'alternate_email',
    title: 'Private contact methods',
    blurb: 'Friends or trusted contacts can have richer reach details.',
    contentHtml: '<p>Public profile fields stay separate from this list. When you know someone well, for example after becoming friends, you can keep more private ways to reach them here: email, phone, social handle, website, or another useful link.</p><p>Use <strong>Edit</strong> to add, change, or remove methods. These are your quick shortcuts for that saved contact; deleting the contact only removes it from this list.</p>'
  }
];

const EXPLANATION_CONTACTS_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'contacts-list',
    icon: 'contacts',
    title: 'Kapcsolatlista',
    blurb: 'Ez a saját, gyorsan elérhető kapcsolatlistád.',
    contentHtml: '<p>A keresővel név alapján szűrheted a mentett kapcsolatokat. A <strong>Kapcsolat létrehozása</strong> gombbal kiválasztasz egy tagot, és hozzáadod a saját listádhoz.</p><p>Az üres lista csak azt jelenti, hogy ide még nem mentettél senkit. Ettől az eseményekben, chatekben, értékelésekben és profilokon semmi nem tűnik el.</p>'
  },
  {
    id: 'contacts-card',
    icon: 'badge',
    title: 'Egy kapcsolatkártya',
    blurb: 'A sor megmutatja, ki az ember, és milyen gyors eléréseket mentettél hozzá.',
    contentHtml: '<p>Az avatar és a név azonosítja az embert. A szem gomb megnyitja a profilt. A hárompontos gomb nyitja a kártyaműveleteket: mentett elérési módok, szerkesztés és törlés.</p><p>A város alatti chipek egyérintéses elérések, például telefon, email, WhatsApp, Telegram, Facebook, Instagram, LinkedIn vagy weboldal, attól függően, mit mentettél.</p>'
  },
  {
    id: 'contacts-private-methods',
    icon: 'alternate_email',
    title: 'Privátabb elérési módok',
    blurb: 'Barátokhoz vagy megbízható kapcsolatokhoz több praktikus adatot is menthetsz.',
    contentHtml: '<p>A nyilvános profilmezők ettől külön maradnak. Ha valakit jobban ismersz, például barátok vagytok, itt tarthatsz privátabb elérési módokat: emailt, telefonszámot, közösségi profilt, weboldalt vagy más hasznos linket.</p><p>A <strong>Szerkesztés</strong> alatt adhatsz hozzá, módosíthatsz vagy törölhetsz módszereket. Ezek a saját gyorsgombjaid ehhez a mentett kapcsolathoz; a kapcsolat törlése csak ebből a listából veszi ki.</p>'
  }
];

const EXPLANATION_PROFILE_EDITOR_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'profile-editor-basics',
    icon: 'manage_accounts',
    title: 'Profile basics',
    blurb: 'This is where your public profile is maintained.',
    contentHtml: '<p>Edit the fields that describe who you are, what you are open to, and how others should understand your profile card. Keep the short fields scannable; the detail fields can carry the nuance.</p>'
  },
  {
    id: 'profile-editor-media',
    icon: 'add_photo_alternate',
    title: 'Photos and media',
    blurb: 'Profile images are edited separately from text.',
    contentHtml: '<p>Use the photo area to add, reorder, replace, or remove images. The same saved image state is what the home cards and profile view use after reload.</p>'
  },
  {
    id: 'profile-editor-details',
    icon: 'tune',
    title: 'Details, chips, and privacy',
    blurb: 'Structured fields make matching and filtering predictable.',
    contentHtml: '<p>Chips such as interests, languages, values, habits, and profile details are stored as structured choices. Privacy controls decide which details are visible broadly, only to trusted contexts, or only to hosts.</p>'
  },
  {
    id: 'profile-editor-save',
    icon: 'save',
    title: 'Save and verify',
    blurb: 'Saved profile data should survive reopening the editor.',
    contentHtml: '<p>After saving, reopen the editor or profile view to confirm that the same photos, chips, dropdowns, and text fields come back from the selected data source.</p>'
  }
];

const EXPLANATION_PROFILE_EDITOR_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'profile-editor-basics',
    icon: 'manage_accounts',
    title: 'Profil alapok',
    blurb: 'Itt tarthatod karban a nyilvános profilodat.',
    contentHtml: '<p>Szerkeszd azokat a mezőket, amelyek megmutatják, ki vagy, mire vagy nyitott, és hogyan lássák mások a profilkártyádat. A rövid mezők legyenek gyorsan olvashatók; a részletes mezők hordozzák az árnyalatokat.</p>'
  },
  {
    id: 'profile-editor-media',
    icon: 'add_photo_alternate',
    title: 'Fotók és média',
    blurb: 'A profilképek külön kezelődnek a szöveges mezőktől.',
    contentHtml: '<p>A fotó résznél adhatsz hozzá, rendezhetsz át, cserélhetsz vagy törölhetsz képeket. Mentés után ugyanezt a képállapotot használja a kezdőkártya és a profilnézet is.</p>'
  },
  {
    id: 'profile-editor-details',
    icon: 'tune',
    title: 'Részletek, chipek és adatvédelem',
    blurb: 'A strukturált mezők kiszámíthatóbbá teszik a szűrést és ajánlást.',
    contentHtml: '<p>Az érdeklődések, nyelvek, értékek, szokások és profilrészletek strukturált választásokként mentődnek. Az adatvédelmi beállítások döntik el, mi látható szélesen, csak megbízhatóbb környezetben vagy csak szervezőknek.</p>'
  },
  {
    id: 'profile-editor-save',
    icon: 'save',
    title: 'Mentés és ellenőrzés',
    blurb: 'A mentett profiladatnak újranyitás után is meg kell maradnia.',
    contentHtml: '<p>Mentés után nyisd újra a szerkesztőt vagy a profilnézetet, és ellenőrizd, hogy ugyanazok a fotók, chipek, legördülők és szövegmezők jönnek vissza a kiválasztott adatforrásból.</p>'
  }
];

const EXPLANATION_PROFILE_VIEW_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'profile-view-overview',
    icon: 'visibility',
    title: 'Profile view',
    blurb: 'This screen is the read-only version of a profile.',
    contentHtml: '<p>The profile view shows the saved photos, headline fields, details, and visible context that another user can inspect from cards, chats, contacts, or event member lists.</p>'
  },
  {
    id: 'profile-view-photos',
    icon: 'photo_library',
    title: 'Photos and sections',
    blurb: 'Use the media and detail blocks to understand the person quickly.',
    contentHtml: '<p>Images, chips, experiences, and profile sections are grouped so they can be scanned without entering edit mode. Empty or private fields should simply stay hidden.</p>'
  },
  {
    id: 'profile-view-actions',
    icon: 'more_horiz',
    title: 'Actions from a profile',
    blurb: 'Available actions depend on context and permissions.',
    contentHtml: '<p>Depending on where the profile was opened, actions can lead back to rating, contact, chat, report, event member handling, or admin moderation. The profile content itself should stay consistent across those entry points.</p>'
  }
];

const EXPLANATION_PROFILE_VIEW_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'profile-view-overview',
    icon: 'visibility',
    title: 'Profilnézet',
    blurb: 'Ez a profil csak olvasható változata.',
    contentHtml: '<p>A profilnézet a mentett fotókat, fő mezőket, részleteket és látható kontextust mutatja, amit más felhasználó kártyáról, chatből, kapcsolatból vagy eseménytag-listából megnyithat.</p>'
  },
  {
    id: 'profile-view-photos',
    icon: 'photo_library',
    title: 'Fotók és szekciók',
    blurb: 'A média és részletblokkok gyors megértésre valók.',
    contentHtml: '<p>A képek, chipek, tapasztalatok és profilszekciók úgy vannak csoportosítva, hogy szerkesztő mód nélkül is átnézhetők legyenek. Az üres vagy privát mezők maradjanak egyszerűen rejtve.</p>'
  },
  {
    id: 'profile-view-actions',
    icon: 'more_horiz',
    title: 'Profilműveletek',
    blurb: 'Az elérhető műveletek a kontextustól és jogosultságtól függnek.',
    contentHtml: '<p>Attól függően, honnan nyílt a profil, a műveletek értékeléshez, kapcsolathoz, chathez, jelentéshez, eseménytag-kezeléshez vagy admin moderációhoz vezethetnek. Maga a profiltartalom ezek között is maradjon konzisztens.</p>'
  }
];

const EXPLANATION_EVENT_FEEDBACK_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'event-feedback-entry',
    icon: 'rate_review',
    title: 'Event feedback',
    blurb: 'Feedback appears after an event or from activity history.',
    contentHtml: '<p>Use feedback to record how the event worked, how collaboration felt, and whether you would join similar events again. It is connected to real event participation, not a generic profile rating.</p>'
  },
  {
    id: 'event-feedback-categories',
    icon: 'checklist',
    title: 'Questions and categories',
    blurb: 'Different roles can see different feedback questions.',
    contentHtml: '<p>Hosts, attendees, and collaborators may answer different sections. Some answers improve future matching and event planning, while moderation-sensitive answers should remain scoped to the right workflow.</p>'
  },
  {
    id: 'event-feedback-save',
    icon: 'task_alt',
    title: 'Save once, reopen safely',
    blurb: 'Submitted feedback should not vanish or duplicate.',
    contentHtml: '<p>After saving, the event should move to the right feedback state in lists. Reopening should show the saved state or the next required action without creating duplicate feedback records.</p>'
  }
];

const EXPLANATION_EVENT_FEEDBACK_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'event-feedback-entry',
    icon: 'rate_review',
    title: 'Esemény-visszajelzés',
    blurb: 'Visszajelzés esemény után vagy aktivitás-előzményből jelenhet meg.',
    contentHtml: '<p>A visszajelzés arra való, hogy rögzítsd, hogyan működött az esemény, milyen volt az együttműködés, és csatlakoznál-e hasonló eseményhez újra. Valódi részvételhez kapcsolódik, nem általános profilértékelés.</p>'
  },
  {
    id: 'event-feedback-categories',
    icon: 'checklist',
    title: 'Kérdések és kategóriák',
    blurb: 'Különböző szerepek más visszajelzési kérdéseket láthatnak.',
    contentHtml: '<p>Szervezők, résztvevők és együttműködők más szekciókat kaphatnak. Egyes válaszok a későbbi ajánlást és eseménytervezést javítják, a moderáció-érzékeny válaszok pedig maradjanak a megfelelő folyamathoz kötve.</p>'
  },
  {
    id: 'event-feedback-save',
    icon: 'task_alt',
    title: 'Egyszeri mentés, biztonságos újranyitás',
    blurb: 'A beküldött visszajelzés ne tűnjön el és ne duplikálódjon.',
    contentHtml: '<p>Mentés után az eseménynek a megfelelő visszajelzési állapotba kell kerülnie a listákban. Újranyitáskor a mentett állapot vagy a következő szükséges művelet jelenjen meg, duplikált rekord nélkül.</p>'
  }
];

const EXPLANATION_ASSETS_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'assets-entry',
    icon: 'inventory_2',
    title: 'Your assets',
    blurb: 'This popup starts from your own things, not from one event.',
    contentHtml: '<p>The type menu switches between <strong>Transport</strong>, <strong>Accommodation</strong>, <strong>Supplies</strong>, and <strong>Ticket</strong>. The red number is the count for that type.</p><p><strong>Transport</strong>, <strong>Accommodation</strong>, and <strong>Supplies</strong> are editable assets you own. The plus button creates a new one. <strong>Ticket</strong> is different: it is for event entry codes and scanning, not for editing a physical asset.</p>'
  },
  {
    id: 'assets-card',
    icon: 'view_agenda',
    title: 'One asset card',
    blurb: 'This is the short version of one thing you own.',
    contentHtml: '<p>The picture is the asset photo; if there is no image, the card shows the built-in no-image placeholder. The small icon shows the asset type. The title is the name, the line under it shows type/category/city, and the text is your practical note.</p><p>The right badge is the useful number: seats, beds, quantity, or pending requests. The three-dot menu is for owner actions such as <strong>Share</strong>, <strong>Edit</strong>, and <strong>Delete</strong>. Accommodation can also show a location/map button.</p>'
  },
  {
    id: 'assets-editor',
    icon: 'edit',
    title: 'Common asset editor',
    blurb: 'Transport, accommodation, and supplies share this basic editor.',
    contentHtml: '<p>For every real asset you set the image/source link, type, title, category, capacity, quantity, details, visibility, optional pricing, and lending policies.</p><p><strong>Public</strong> can be found broadly in Asset Explorer. <strong>Friends only</strong> limits discovery to your friend/network context. <strong>Invitation only</strong> keeps it out of normal discovery, so it is used by direct sharing or assignment.</p>'
  },
  {
    id: 'assets-requests',
    icon: 'assignment',
    title: 'Requests and helpers',
    blurb: 'Open the badge when somebody wants to use what you own.',
    contentHtml: '<p>The requests popup can show all rows, active items, pending requests, and borrowed items. A row shows who asked, the related event or use context, the time window, and how much capacity is left.</p><p>You can approve or reject pending requests. For accepted people you may promote someone to <strong>Manager</strong> for that asset. Manager is only a helper role for that asset; it is not the same as app admin.</p>'
  },
  {
    id: 'assets-scope',
    icon: 'travel_explore',
    title: 'Where an asset can be used',
    blurb: 'Visibility controls discovery; event screens assign the asset.',
    contentHtml: '<p>Your own asset can appear in <strong>Asset Explorer</strong> when its visibility allows it. That is where other people can discover it and request it.</p><p>The same asset can also be assigned to an event or sub-event from the event resource screen. That assignment screen can have extra event-only states, but those are not the normal own-assets list.</p>'
  }
];

const EXPLANATION_ASSETS_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'assets-entry',
    icon: 'inventory_2',
    title: 'Saját eszközeid',
    blurb: 'Ez a popup a saját dolgaidból indul ki, nem egy konkrét eseményből.',
    contentHtml: '<p>A típusmenü vált: <strong>Transport</strong>, <strong>Accommodation</strong>, <strong>Kellékek</strong> és <strong>Jegy</strong>. A piros szám az adott típus darabszáma.</p><p>A <strong>Transport</strong>, <strong>Accommodation</strong> és <strong>Kellékek</strong> szerkeszthető saját eszközök. A plusz gomb újat hoz létre. A <strong>Jegy</strong> más: belépőkódokra és szkennelésre való, nem tárgyi eszköz szerkesztésére.</p>'
  },
  {
    id: 'assets-card',
    icon: 'view_agenda',
    title: 'Egy eszközkártya',
    blurb: 'Ez egy saját eszköz rövid, olvasható változata.',
    contentHtml: '<p>A kép az eszköz fotója; ha nincs kép, a kártya a beépített nincs-kép jelzést mutatja. A kis ikon a típust jelzi. A cím az eszköz neve, alatta típus/kategória/város, a szöveg pedig praktikus megjegyzés.</p><p>A jobb oldali jelvény a hasznos szám: férőhely, ágy, mennyiség vagy függő kérés. A hárompontos menüben tulajdonosi műveletek vannak: <strong>Megosztás</strong>, <strong>Szerkesztés</strong>, <strong>Törlés</strong>. Accommodation típusnál helyszín/térkép gomb is megjelenhet.</p>'
  },
  {
    id: 'assets-editor',
    icon: 'edit',
    title: 'Közös eszközszerkesztő',
    blurb: 'A Transport, Accommodation és kellék ugyanarra az alap szerkesztőre épül.',
    contentHtml: '<p>Minden valódi eszköznél képet/forráslinket, típust, címet, kategóriát, kapacitást, mennyiséget, leírást, láthatóságot, opcionális árat és kölcsönzési szabályokat adhatsz meg.</p><p>A <strong>Public</strong> szélesen megjelenhet az Eszköz Felfedezésben. A <strong>Friends only</strong> az ismerősi/hálózati körre szűkít. Az <strong>Invitation only</strong> nem normál felfedezésre való, hanem közvetlen megosztásra vagy hozzárendelésre.</p>'
  },
  {
    id: 'assets-requests',
    icon: 'assignment',
    title: 'Kérések és segítők',
    blurb: 'A jelvényt nyisd meg, ha valaki használni szeretné, ami a tied.',
    contentHtml: '<p>A kérések popupban válthatsz: összes sor, aktív elemek, függő kérések és kölcsönadott elemek. Egy sor megmutatja, ki kérte, milyen eseményhez vagy használati helyzethez kapcsolódik, milyen időablakra, és mennyi kapacitás marad.</p><p>Függő kérésnél jóváhagyhatsz vagy elutasíthatsz. Elfogadott emberből lehet <strong>Manager</strong> az adott eszközhöz. A Manager csak az adott eszköz segítő szerepe; nem ugyanaz, mint az app admin.</p>'
  },
  {
    id: 'assets-scope',
    icon: 'travel_explore',
    title: 'Hol használható egy eszköz',
    blurb: 'A láthatóság a felfedezést szabályozza; az eseményképernyők hozzárendelnek.',
    contentHtml: '<p>A saját eszközöd megjelenhet az <strong>Eszköz Felfedezésben</strong>, ha a láthatósága engedi. Ott mások megtalálhatják és kérhetik.</p><p>Ugyanezt az eszközt eseményhez vagy aleseményhez is hozzá lehet rendelni az esemény erőforrás képernyőjén. Ott lehetnek extra, csak eseményhez tartozó állapotok, de ezek nem a normál saját eszközlista jelentései.</p>'
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
    blurb: 'Transport uses the common editor, with travel details added.',
    contentHtml: '<p>The <strong>Transport</strong> tab lists vehicles and transfer options you own or manage as your own assets. Use plus to add transport, then describe seats, route, city, pickup notes, rules, price, and visibility.</p><p>Public or friends-only transport can be discovered in Asset Explorer and requested. The same transport asset can also be assigned to an event or sub-event from that event&rsquo;s resource screen.</p>'
  },
  'assets-card': {
    icon: 'directions_car',
    title: 'Reading a transport card',
    contentHtml: '<p>The photo shows the transport asset. The icon confirms it is transport, the title is the asset name, and the second line can show model, transmission, category, route, or city.</p><p>The right badge is seats or pending requests. The three-dot menu is where the owner shares, edits, or deletes the asset.</p>'
  },
  'assets-editor': {
    title: 'Transport-specific fields',
    contentHtml: '<p>Beyond the common fields, transport is mainly about <strong>seats</strong> and <strong>route</strong>. Use details for pickup window, luggage limits, fuel sharing, route stops, driver notes, and whether people can request it outside your own events.</p>'
  }
});

const EXPLANATION_ASSETS_ACCOMMODATION_SECTIONS: HelpCenterSectionDto[] = assetExplanationSections(EXPLANATION_ASSETS_SECTIONS, {
  'assets-entry': {
    icon: 'apartment',
    title: 'Your accommodation',
    blurb: 'Accommodation uses the common editor, with location as the important extra.',
    contentHtml: '<p>The <strong>Accommodation</strong> tab lists places, rooms, beds, venues, or storage you own or manage as your own assets. Add accommodation, then describe location, sleeping capacity, rules, price, and visibility.</p><p>Public or friends-only accommodation can be discovered in Asset Explorer and requested. It can also be assigned to an event or sub-event from that event&rsquo;s resource screen.</p>'
  },
  'assets-card': {
    icon: 'apartment',
    title: 'Reading an accommodation card',
    contentHtml: '<p>The photo shows the place. The icon confirms it is accommodation, the title is the place name, and the second line can show type, city, or category.</p><p>The right badge is the useful number: beds/rooms/capacity or pending requests. The location icon can open the map when the place has a location.</p>'
  },
  'assets-editor': {
    title: 'Accommodation-specific fields',
    contentHtml: '<p>Beyond the common fields, accommodation needs a <strong>location</strong>. The map/location button uses that place. Use details for check-in, sleeping setup, shared rooms, quiet hours, pets, parking, and what a guest must know before requesting it.</p>'
  }
});

const EXPLANATION_ASSETS_SUPPLIES_SECTIONS: HelpCenterSectionDto[] = assetExplanationSections(EXPLANATION_ASSETS_SECTIONS, {
  'assets-entry': {
    icon: 'inventory_2',
    title: 'Your supplies',
    blurb: 'Supplies use the common editor, with quantity as the important extra.',
    contentHtml: '<p>The <strong>Supplies</strong> tab lists gear, tools, kits, food packs, camping items, and other practical things you own. Add a supply item, then describe quantity, condition, rules, price, and visibility.</p><p>A public or friends-only supply can be discovered in Asset Explorer and requested. It can also be assigned to an event or sub-event from that event&rsquo;s resource screen.</p>'
  },
  'assets-card': {
    icon: 'inventory_2',
    title: 'Reading a supply card',
    contentHtml: '<p>The photo shows the item. The icon confirms it is a supply asset, the title is the item name, and the second line can show type, category, or city.</p><p>The right badge is usually quantity or pending requests. The three-dot menu is where the owner normally shares, edits, or deletes the item.</p>'
  },
  'assets-editor': {
    title: 'Supply-specific fields',
    contentHtml: '<p>Beyond the common fields, supplies are mainly about <strong>quantity</strong>. Use details for condition, pickup/return rules, what is included, missing parts, deposit, and whether several people can borrow parts of the quantity.</p>'
  }
});

const EXPLANATION_ASSETS_TICKETS_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'assets-tickets',
    icon: 'qr_code_2',
    title: 'Your tickets',
    blurb: 'Tickets are event entry records, not editable owned assets.',
    contentHtml: '<p>The <strong>Ticket</strong> tab is separate from Transport, Accommodation, and Supplies. It lists ticketed events and entry codes connected to you.</p><p>Use <strong>Upcoming</strong> and <strong>Past</strong> to change the list. The <strong>Scan Ticket</strong> button opens scanner mode for reading another person&rsquo;s QR code at check-in.</p>'
  },
  {
    id: 'assets-ticket-card',
    icon: 'confirmation_number',
    title: 'Reading a ticket card',
    blurb: 'A ticket card points back to an event.',
    contentHtml: '<p>The card shows the event image, title, date, role, and ticket context. Tap the QR badge in the top-right corner to open your own code for that ticket.</p><p>You do not edit this like a transport asset or supply. Its data comes from the event, booking, member role, and ticketing/check-in setup.</p>'
  },
  {
    id: 'assets-ticket-scanner',
    icon: 'qr_code_scanner',
    title: 'Ticket scanner',
    blurb: 'Use it when you need to read somebody else&rsquo;s QR code.',
    contentHtml: '<p>The scanner opens a camera/check-in screen. After reading a QR code it shows the ticket holder, event, role, and time, so you can confirm whether the ticket belongs here.</p><p>This is a check-in tool. It does not create or edit tickets.</p>'
  }
];

const EXPLANATION_ASSETS_TRANSPORT_SECTIONS_HU: HelpCenterSectionDto[] = assetExplanationSections(EXPLANATION_ASSETS_SECTIONS_HU, {
  'assets-entry': {
    icon: 'directions_car',
    title: 'Saját transport eszközeid',
    blurb: 'A Transport a közös eszközszerkesztőt használja, utazási adatokkal kiegészítve.',
    contentHtml: '<p>Az <strong>Transport</strong> tab azokat a járműveket listázza, amelyeket saját eszközként birtokolsz vagy kezelsz. A plusz gombbal adhatsz hozzá transportot, majd megadhatod a férőhelyet, útvonalat, várost, indulási megjegyzést, szabályokat, árat és láthatóságot.</p><p>A nyilvános vagy ismerősöknek látható transport megjelenhet az Eszköz Felfedezésben, és kérhető. Ugyanez a transport eseményhez vagy aleseményhez is hozzárendelhető az esemény erőforrás képernyőjén.</p>'
  },
  'assets-card': {
    icon: 'directions_car',
    title: 'Egy transport kártya',
    contentHtml: '<p>A kép a transportot mutatja. Az ikon jelzi, hogy transportról van szó, a cím a transport neve, alatta modell, váltó, kategória, útvonal vagy város jelenhet meg.</p><p>A jobb oldali jelvény férőhelyet vagy függő kérést mutat. A hárompontos menüben a tulajdonos megoszt, szerkeszt vagy töröl.</p>'
  },
  'assets-editor': {
    title: 'Transportra jellemző mezők',
    contentHtml: '<p>A közös mezőkön túl a transport főleg <strong>férőhelyről</strong> és <strong>útvonalról</strong> szól. Írd a részletekhez az indulási ablakot, csomaglimitet, üzemanyag-megosztást, megállókat, sofőr megjegyzést, és hogy kérhető-e a saját eseményeiden kívül is.</p>'
  }
});

const EXPLANATION_ASSETS_ACCOMMODATION_SECTIONS_HU: HelpCenterSectionDto[] = assetExplanationSections(EXPLANATION_ASSETS_SECTIONS_HU, {
  'assets-entry': {
    icon: 'apartment',
    title: 'Saját szállások',
    blurb: 'Az Accommodation a közös eszközszerkesztőt használja, helyszínnel kiegészítve.',
    contentHtml: '<p>Az <strong>Accommodation</strong> tab szállást, szobát, ágyat vagy helyet listáz, amit saját eszközként birtokolsz vagy kezelsz. Adj hozzá helyet, majd írd le a lokációt, alvó kapacitást, szabályokat, árat és láthatóságot.</p><p>A nyilvános vagy ismerősöknek látható szállás megjelenhet az Eszköz Felfedezésben, és kérhető. Eseményhez vagy aleseményhez is hozzárendelhető az esemény erőforrás képernyőjén.</p>'
  },
  'assets-card': {
    icon: 'apartment',
    title: 'Egy szálláskártya',
    contentHtml: '<p>A kép a helyet mutatja. Az ikon jelzi, hogy Accommodation/szállás, a cím a hely neve, alatta típus, város vagy kategória jelenhet meg.</p><p>A jobb oldali jelvény ágyat, szobát, kapacitást vagy függő kérést mutathat. A hely ikon térképet nyithat, ha van helyszín.</p>'
  },
  'assets-editor': {
    title: 'Accommodation típusra jellemző mezők',
    contentHtml: '<p>A közös mezőkön túl az Accommodation típusnál a <strong>helyszín</strong> fontos. A térkép/helyszín gomb ezt használja. Írd a részletekhez a bejutást, alvási rendet, közös szobát, csendidőt, kisállatot, parkolást és amit kérés előtt tudni kell.</p>'
  }
});

const EXPLANATION_ASSETS_SUPPLIES_SECTIONS_HU: HelpCenterSectionDto[] = assetExplanationSections(EXPLANATION_ASSETS_SECTIONS_HU, {
  'assets-entry': {
    icon: 'inventory_2',
    title: 'Saját kellékek',
    blurb: 'A kellék a közös eszközszerkesztőt használja, mennyiséggel kiegészítve.',
    contentHtml: '<p>A <strong>Kellékek</strong> tab felszerelést, szerszámot, csomagot, ételt, kempingcuccot és más praktikus tárgyat listáz, amit te birtokolsz. Adj hozzá kelléket, majd írd le a mennyiséget, állapotot, szabályokat, árat és láthatóságot.</p><p>A nyilvános vagy ismerősöknek látható kellék megjelenhet az Eszköz Felfedezésben, és kérhető. Eseményhez vagy aleseményhez is hozzárendelhető az esemény erőforrás képernyőjén.</p>'
  },
  'assets-card': {
    icon: 'inventory_2',
    title: 'Egy kellékkártya',
    contentHtml: '<p>A kép a tárgyat mutatja. Az ikon jelzi, hogy kellék, a cím az eszköz neve, alatta típus, kategória vagy város jelenhet meg.</p><p>A jobb oldali jelvény általában mennyiséget vagy függő kérést mutat. A hárompontos menüben a tulajdonos jellemzően megoszt, szerkeszt vagy töröl.</p>'
  },
  'assets-editor': {
    title: 'Kellékre jellemző mezők',
    contentHtml: '<p>A közös mezőkön túl a kellék főleg <strong>mennyiségről</strong> szól. Írd a részletekhez az állapotot, átvétel/visszahozás módját, mit tartalmaz, mi hiányzik, van-e kaució, és osztható-e a mennyiség több ember között.</p>'
  }
});

const EXPLANATION_ASSETS_TICKETS_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'assets-tickets',
    icon: 'qr_code_2',
    title: 'Saját jegyek',
    blurb: 'A jegy belépési rekord, nem szerkeszthető saját tárgyi eszköz.',
    contentHtml: '<p>A <strong>Jegy</strong> tab külön van a Transport, Accommodation és Kellékek típusoktól. Jegyes eseményeket és hozzád kapcsolódó belépőkódokat listáz.</p><p>A <strong>Közelgő</strong> és <strong>Korábbi</strong> a listát váltja. A <strong>Scan Ticket</strong> gomb szkenner módot nyit, amikor más ember QR kódját kell beolvasni beléptetésnél.</p>'
  },
  {
    id: 'assets-ticket-card',
    icon: 'confirmation_number',
    title: 'Egy jegykártya',
    blurb: 'A jegykártya egy eseményre mutat vissza.',
    contentHtml: '<p>A kártya eseményképet, címet, dátumot, szerepet és jegykörnyezetet mutat. A jobb felső QR jelvényre koppintva a saját jegykódod nyílik meg.</p><p>Ezt nem úgy szerkeszted, mint egy transport eszközt vagy kelléket. Az adatai az eseményből, foglalásból, tagszerepből és ticketing/check-in beállításból jönnek.</p>'
  },
  {
    id: 'assets-ticket-scanner',
    icon: 'qr_code_scanner',
    title: 'Jegyszkenner',
    blurb: 'Akkor használod, amikor más QR kódját kell beolvasni.',
    contentHtml: '<p>A scanner kamerás/check-in képernyőt nyit. QR olvasás után megmutatja a jegy tulajdonosát, az eseményt, szerepet és időpontot, így ellenőrizhető, hogy ide tartozik-e.</p><p>Ez beléptető eszköz. Nem hoz létre és nem szerkeszt jegyet.</p>'
  }
];

const EXPLANATION_EVENT_EDITOR_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'event-editor-main',
    icon: 'edit_calendar',
    title: 'Main event form',
    blurb: 'Fill the card first: picture, name, seats, text, date, and place.',
    contentHtml: '<p>The big image box is the event photo. <strong>Name</strong>, <strong>Capacity</strong>, and <strong>Description</strong> are required; a red outline just means something is still missing.</p><p>The top <strong>Members</strong> button opens the people list. <strong>Public</strong>, <strong>Friends only</strong>, or <strong>Invitation only</strong> decides who can find the event. The red check saves; X closes.</p>'
  },
  {
    id: 'event-editor-switches',
    icon: 'tune',
    title: 'Finding, joining, preview',
    blurb: 'Visibility and Blind/Open are different things.',
    contentHtml: '<p><strong>Public</strong>, <strong>Friends only</strong>, and <strong>Invitation only</strong> decide who can discover or join. <strong>Open Event</strong> and <strong>Blind Event</strong> only decide whether normal attendees can preview each other before the event.</p><p><strong>Blind Event</strong> is not a secret event. It hides the attendee preview, while Admin and Manager can still manage members. <strong>Topics</strong> help matching, <strong>Auto Inviter</strong> can fill open seats from the priority plan, and <strong>Ticketing</strong> adds ticket/QR check-in.</p>'
  },
  {
    id: 'event-editor-schedule',
    icon: 'event_time',
    title: 'Time, price, rules',
    blurb: 'This part answers: when, price, rules, and place.',
    contentHtml: '<p><strong>Date</strong> can be one-time or repeating. If the event repeats, <strong>Slot Setup</strong> controls the normal time windows and any date-specific changes.</p><p><strong>Pricing</strong> can stay off or add a charge. <strong>Event Policies</strong> are rules people must accept before joining or booking. The location row and map button set where the event happens.</p>'
  },
  {
    id: 'event-editor-subevents',
    icon: 'account_tree',
    title: 'Parts and tournaments',
    blurb: 'Sub Events are smaller pieces under the main event.',
    contentHtml: '<p>Use <strong>Sub Events</strong> for stages, rounds, side plans, group blocks, or optional sessions. <strong>Mandatory</strong> means included in the main event. <strong>Optional</strong> means people can choose it separately, often with its own seats or price.</p><p><strong>Casual</strong> is a simple list. <strong>Tournament</strong> adds stages, groups, scores, status changes, and a leaderboard. The editor keeps sub-event times inside the main event; for repeating events, the same sub-event timing is repeated inside each slot.</p>'
  },
  {
    id: 'event-editor-members',
    icon: 'groups',
    title: 'Members and roles',
    blurb: 'This popup is where organizers handle people.',
    contentHtml: '<p><strong>Admin</strong> is the main organizer. <strong>Manager</strong> is a helper under Admin: managers can help with members and resources, and can also appear because someone manages an assigned transport, accommodation, or supply. <strong>Member</strong> is a normal attendee.</p><p><strong>Invite</strong> adds people. <strong>Pending only</strong> shows waiting requests/invites. The status chip shows Admin, Manager, Member, pending, invite, or disqualified. The eye opens a profile; the three-dot menu can approve, reject/delete, remove, disqualify, reinstate, or report depending on your role and the member state.</p>'
  },
  {
    id: 'event-editor-assets',
    icon: 'inventory_2',
    title: 'Resources',
    blurb: 'Resources are the people and things assigned to one part.',
    contentHtml: '<p>From a sub-event or group menu you can open <strong>Members</strong>, <strong>Transport</strong>, <strong>Accommodation</strong>, or <strong>Supplies</strong>. <strong>Assign</strong> attaches something you already control. <strong>Explore</strong> searches available assets and can start a request/booking flow.</p><p>Counts show accepted and pending assignments. Capacity tells you whether that part has enough people, transport seats, beds/rooms, or supplies. If a resource has its own manager, that person can become a Manager for the event context.</p>'
  }
];

const EXPLANATION_EVENT_EDITOR_SECTIONS_HU: HelpCenterSectionDto[] = [
  {
    id: 'event-editor-main',
    icon: 'edit_calendar',
    title: 'Fő esemény űrlap',
    blurb: 'Először ezt töltsd ki: kép, név, létszám, szöveg, dátum és hely.',
    contentHtml: '<p>A nagy képes mező lesz az esemény fotója. A <strong>Name</strong>, <strong>Capacity</strong> és <strong>Description</strong> kötelező; a piros keret csak azt jelzi, hogy ott még hiányzik valami.</p><p>Felül a <strong>Members</strong> gomb nyitja az embereket. A <strong>Public</strong>, <strong>Friends only</strong> vagy <strong>Invitation only</strong> azt dönti el, ki találhatja meg az eseményt. A piros pipa ment, az X bezár.</p>'
  },
  {
    id: 'event-editor-switches',
    icon: 'tune',
    title: 'Ki találja meg, ki kit lát?',
    blurb: 'A láthatóság és a Blind/Open két külön beállítás.',
    contentHtml: '<p>A <strong>Public</strong>, <strong>Friends only</strong> és <strong>Invitation only</strong> azt dönti el, ki találhatja meg vagy kérheti az eseményt. Az <strong>Open Event</strong> és <strong>Blind Event</strong> csak azt dönti el, hogy a sima résztvevők előre láthatják-e egymást.</p><p>A <strong>Blind Event</strong> tehát nem titkos esemény. Csak a résztvevői előnézetet rejti el; az Admin és Manager továbbra is kezeli az embereket. A <strong>Topics</strong> segít a keresésben/illesztésben, az <strong>Auto Inviter</strong> a prioritási tervből tud szabad helyekre meghívni, a <strong>Ticketing</strong> pedig jegy/QR beléptetést kapcsol.</p>'
  },
  {
    id: 'event-editor-schedule',
    icon: 'event_time',
    title: 'Idő, ár, szabályok',
    blurb: 'Itt állítod: mikor van, van-e ár, milyen szabály van, és hol lesz.',
    contentHtml: '<p>A <strong>Date</strong> lehet egyszeri vagy ismétlődő. Ismétlődő eseménynél a <strong>Slot Setup</strong> állítja a normál időablakokat és a külön dátumos kivételeket.</p><p>A <strong>Pricing</strong> maradhat OFF, vagy adhatsz árat. Az <strong>Event Policies</strong> olyan szabály, amit csatlakozás/foglalás előtt el kell fogadni. A helyszín sor és a térkép gomb állítja be a helyet.</p>'
  },
  {
    id: 'event-editor-subevents',
    icon: 'account_tree',
    title: 'Részek és bajnokság',
    blurb: 'A Sub Events kisebb részekre bontja a fő eseményt.',
    contentHtml: '<p>A <strong>Sub Events</strong> jó szakaszra, körre, mellékprogramra, csoportblokkra vagy opcionális részre. A <strong>Mandatory</strong> a fő esemény része. Az <strong>Optional</strong> külön választható, gyakran saját létszámmal vagy árral.</p><p>A <strong>Casual</strong> sima lista. A <strong>Tournament</strong> szakaszokat, csoportokat, pontokat, státuszváltásokat és ranglistát ad. A szerkesztő az időket a fő eseményen belül tartja; ismétlődő eseménynél ugyanaz az alesemény-idő minden slotban újra megjelenik.</p>'
  },
  {
    id: 'event-editor-members',
    icon: 'groups',
    title: 'Tagok és szerepek',
    blurb: 'Ez az a popup, ahol a szervező embereket kezel.',
    contentHtml: '<p>Az <strong>Admin</strong> a fő szervező. A <strong>Manager</strong> Admin alatti segítő: kezelhet tagokat és erőforrásokat, és akkor is megjelenhet, ha valaki egy hozzárendelt transport, szállás vagy kellék felelőse. A <strong>Member</strong> sima résztvevő.</p><p>A <strong>Invite</strong> meghív. A <strong>Pending only</strong> csak a várakozó kéréseket/meghívásokat mutatja. A jelvény mutatja: Admin, Manager, Member, függő kérés, kiküldött meghívó vagy kizárt. A szem profilra visz; a hárompontos menü szereptől és állapottól függően jóváhagyást, elutasítást/törlést, eltávolítást, kizárást, visszaállítást vagy jelentést ad.</p>'
  },
  {
    id: 'event-editor-assets',
    icon: 'inventory_2',
    title: 'Erőforrások',
    blurb: 'Erőforrás az ember vagy dolog, amit egy részhez hozzárendelsz.',
    contentHtml: '<p>Egy alesemény vagy csoport menüjéből nyitható: <strong>Members</strong>, <strong>Transport</strong>, <strong>Accommodation</strong> és <strong>Supplies</strong>. Az <strong>Assign</strong> olyat tesz hozzá, amit már kezelsz. Az <strong>Explore</strong> elérhető eszközt keres, és kérés/foglalás folyamatot indíthat.</p><p>A számok az elfogadott és függő hozzárendeléseket mutatják. A kapacitásból látod, elég ember, transport férőhely, szálláshely vagy kellék van-e ahhoz a részhez. Ha egy erőforrásnak saját felelőse van, ő Managerként is megjelenhet az esemény környezetében.</p>'
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
  title: 'Home explanation',
  summary: 'How the home screen works',
  description: 'Short in-app guidance for the selected screen.',
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
  title: 'Kezdőlap magyarázat',
  summary: 'Így működik a kezdőlap',
  description: 'Rövid alkalmazáson belüli útmutató a kiválasztott képernyőhöz.',
  sections: withSeededExplanationImages('home.game', EXPLANATION_HOME_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_ACTIVITY_RATES_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-activity-rates-default-v1',
  contextKey: 'activities.rates',
  title: 'Activity ratings explanation',
  summary: 'Filters, order, and scoring for rating cards',
  sections: withSeededExplanationImages('activities.rates', EXPLANATION_ACTIVITY_RATES_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_ACTIVITY_RATES_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ACTIVITY_RATES_REVISION,
  id: 'explanation-activity-rates-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Értékelések magyarázat',
  summary: 'Szűrés, sorrend és pontozás az értékeléskártyákon',
  sections: withSeededExplanationImages('activities.rates', EXPLANATION_ACTIVITY_RATES_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_EVENTS_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-events-default-v1',
  contextKey: 'events',
  title: 'Events explanation',
  summary: 'Event lists, cards, joining, and hosting',
  sections: withSeededExplanationImages('events', EXPLANATION_EVENTS_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_EVENTS_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_EVENTS_REVISION,
  id: 'explanation-events-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Események magyarázat',
  summary: 'Eseménylisták, kártyák, csatlakozás és szervezés',
  sections: withSeededExplanationImages('events', EXPLANATION_EVENTS_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_ASSETS_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-assets-default-v1',
  contextKey: 'assets',
  title: 'Assets explanation',
  summary: 'Own assets, requests, event resources, and tickets',
  sections: withSeededExplanationImages('assets', EXPLANATION_ASSETS_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_ASSETS_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_REVISION,
  id: 'explanation-assets-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Eszközök magyarázat',
  summary: 'Saját eszközök, kérések, esemény-erőforrások és jegyek',
  sections: withSeededExplanationImages('assets', EXPLANATION_ASSETS_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_ASSETS_TRANSPORT_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_REVISION,
  id: 'explanation-assets-transport-default-v1',
  contextKey: 'assets.transport',
  title: 'Transport assets explanation',
  summary: 'Own transport assets, transport cards, editor, and requests',
  sections: withSeededExplanationImages('assets.transport', EXPLANATION_ASSETS_TRANSPORT_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_ASSETS_TRANSPORT_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_TRANSPORT_REVISION,
  id: 'explanation-assets-transport-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Transport eszközök magyarázat',
  summary: 'Saját transport eszközök, kártyák, szerkesztés és kérések',
  sections: withSeededExplanationImages('assets.transport', EXPLANATION_ASSETS_TRANSPORT_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_ASSETS_ACCOMMODATION_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_REVISION,
  id: 'explanation-assets-accommodation-default-v1',
  contextKey: 'assets.accommodation',
  title: 'Accommodation assets explanation',
  summary: 'Own accommodation, location, editor, and requests',
  sections: withSeededExplanationImages('assets.accommodation', EXPLANATION_ASSETS_ACCOMMODATION_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_ASSETS_ACCOMMODATION_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_ACCOMMODATION_REVISION,
  id: 'explanation-assets-accommodation-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Accommodation eszközök magyarázata',
  summary: 'Saját szállások, helyszín, szerkesztés és kérések',
  sections: withSeededExplanationImages('assets.accommodation', EXPLANATION_ASSETS_ACCOMMODATION_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_ASSETS_SUPPLIES_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_REVISION,
  id: 'explanation-assets-supplies-default-v1',
  contextKey: 'assets.supplies',
  title: 'Supply assets explanation',
  summary: 'Own supplies, quantities, editor, and requests',
  sections: withSeededExplanationImages('assets.supplies', EXPLANATION_ASSETS_SUPPLIES_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_ASSETS_SUPPLIES_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_SUPPLIES_REVISION,
  id: 'explanation-assets-supplies-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Kellék eszközök magyarázat',
  summary: 'Saját kellékek, mennyiségek, szerkesztés és kérések',
  sections: withSeededExplanationImages('assets.supplies', EXPLANATION_ASSETS_SUPPLIES_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_ASSETS_TICKETS_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_REVISION,
  id: 'explanation-assets-tickets-default-v1',
  contextKey: 'assets.tickets',
  title: 'Ticket assets explanation',
  summary: 'Event tickets, QR codes, ordering, and scanning',
  sections: withSeededExplanationImages('assets.tickets', EXPLANATION_ASSETS_TICKETS_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_ASSETS_TICKETS_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_TICKETS_REVISION,
  id: 'explanation-assets-tickets-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Jegyek magyarázat',
  summary: 'Eseményjegyek, QR kódok, sorrend és szkennelés',
  sections: withSeededExplanationImages('assets.tickets', EXPLANATION_ASSETS_TICKETS_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_EVENT_EDITOR_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-event-editor-default-v1',
  contextKey: 'event.editor',
  title: 'Event editor guide',
  summary: 'Main event settings, roles, parts, resources, and tournament flow',
  sections: withSeededExplanationImages('event.editor', EXPLANATION_EVENT_EDITOR_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_EVENT_EDITOR_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_EVENT_EDITOR_REVISION,
  id: 'explanation-event-editor-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Eseményszerkesztő segítség',
  summary: 'Fő beállítások, szerepek, részek, erőforrások és bajnokság',
  sections: withSeededExplanationImages('event.editor', EXPLANATION_EVENT_EDITOR_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_CHATS_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-chats-default-v1',
  contextKey: 'chats',
  title: 'Chats explanation',
  summary: 'Chat lists, channel types, and the message window',
  sections: withSeededExplanationImages('chats', EXPLANATION_CHATS_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_CHATS_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_CHATS_REVISION,
  id: 'explanation-chats-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Chatek magyarázat',
  summary: 'Chatlisták, csatornatípusok és az üzenetablak',
  sections: withSeededExplanationImages('chats', EXPLANATION_CHATS_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_CONTACTS_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-contacts-default-v1',
  contextKey: 'contacts',
  title: 'Contacts explanation',
  summary: 'Saved contacts, cards, private reach methods, and editing',
  sections: withSeededExplanationImages('contacts', EXPLANATION_CONTACTS_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_CONTACTS_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_CONTACTS_REVISION,
  id: 'explanation-contacts-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Kapcsolatok magyarázat',
  summary: 'Mentett kapcsolatok, kártyák, privátabb elérések és szerkesztés',
  sections: withSeededExplanationImages('contacts', EXPLANATION_CONTACTS_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_PROFILE_EDITOR_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-profile-editor-default-v1',
  contextKey: 'profile.editor',
  title: 'Profile editor explanation',
  summary: 'Profile fields, photos, chips, privacy, and save checks',
  sections: withSeededExplanationImages('profile.editor', EXPLANATION_PROFILE_EDITOR_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_PROFILE_EDITOR_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_PROFILE_EDITOR_REVISION,
  id: 'explanation-profile-editor-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Profilszerkesztő magyarázat',
  summary: 'Profilmezők, fotók, chipek, adatvédelem és mentés ellenőrzése',
  sections: withSeededExplanationImages('profile.editor', EXPLANATION_PROFILE_EDITOR_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_PROFILE_VIEW_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-profile-view-default-v1',
  contextKey: 'profile.view',
  title: 'Profile view explanation',
  summary: 'Profile details, visible sections, and context actions',
  sections: withSeededExplanationImages('profile.view', EXPLANATION_PROFILE_VIEW_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_PROFILE_VIEW_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_PROFILE_VIEW_REVISION,
  id: 'explanation-profile-view-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Profilnézet magyarázat',
  summary: 'Profilrészletek, látható szekciók és kontextusműveletek',
  sections: withSeededExplanationImages('profile.view', EXPLANATION_PROFILE_VIEW_SECTIONS_HU, 'hu')
};

const DEFAULT_EXPLANATION_EVENT_FEEDBACK_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-event-feedback-default-v1',
  contextKey: 'event.feedback',
  title: 'Event feedback explanation',
  summary: 'Feedback questions, event context, and saved state',
  sections: withSeededExplanationImages('event.feedback', EXPLANATION_EVENT_FEEDBACK_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_EVENT_FEEDBACK_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_EVENT_FEEDBACK_REVISION,
  id: 'explanation-event-feedback-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Esemény-visszajelzés magyarázat',
  summary: 'Visszajelzési kérdések, eseménykontextus és mentett állapot',
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
