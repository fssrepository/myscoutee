import { type HelpCenterRevisionDto } from '../contracts/content/content.interface';
import { type HelpCenterSectionDto } from '../contracts/content/content.interface';
import catalog from './app-static-data.catalog.json';
import { AppUtils } from '../base/app-utils';
import { ASSET_TYPE_LABELS, ASSET_DEFAULT_CATEGORY_OPTIONS_BY_TYPE as ASSET_CATEGORY_OPTIONS_BY_TYPE, ACTIVITY_MEMBER_MET_PLACES, ACTIVITY_MEMBER_DEFAULTS } from './constants';
import { DEFAULT_HELP_CENTER_DESCRIPTION_HU, DEFAULT_TERMS_CENTER_DESCRIPTION_HU, DEFAULT_EXPLANATION_HOME_DESCRIPTION_HU } from './help-center-options';
import SUPPORTED_CONTENT_LANGUAGES from './content-languages.json';
import {
  CONTENT_LANGUAGES, HELP_CENTER_HEADER_COLORS, HELP_CENTER_HEADER_COLOR_OPTIONS,
  DOCUMENT_VIEWER_HEADER_PALETTES, EXPLAINABLE_SURFACES, DEFAULT_HELP_CENTER_DESCRIPTION,
  DEFAULT_PRIVACY_CENTER_DESCRIPTION, DEFAULT_TERMS_CENTER_DESCRIPTION,
  DEFAULT_EXPLANATION_HOME_DESCRIPTION
} from './help-center-options';
import {
  HOROSCOPE_META_BY_SIGN
} from '@fssrepository/myscoutee-components';
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
} from '../contracts';

import type {
  FeedbackOption,
  FeedbackTraitOption
} from '../../ui/converters/feedback/feedback.model';
import {
  ASSET_FILTER_TYPES,
  ASSET_FILTER_TICKET,
  ASSET_TYPE_ACCOMMODATION,
  ASSET_TYPE_SUPPLIES,
  ASSET_TYPE_TRANSPORT,
  ASSET_TYPES,
  FEEDBACK_LIST_FILTERS,
  EVENT_VISIBILITIES,
  SUB_EVENT_RESOURCE_FILTERS
} from './constants';
import type {
  AssetCategory,
  AssetFilterType,
  AssetType,
  DetailPrivacy,
  FeedbackListFilter,
  EventVisibility,
  ProfileStatus,
  SubEventResourceFilter
} from './constants';
import type { AdminNotificationScheduleFrequency } from '../contracts/administration/admin.interface';
import { GDPR_CONTENT } from './gdpr-data';
import type {
  ExperienceEntry,
  InterestOptionGroup,
  ValuesOptionGroup
} from '../contracts/accounts/profile.interface';

export type RateFilterEntry =
  | { kind: 'group'; label: string; labelKey: string }
  | { kind: 'item'; key: RateFilterKey; label: string };

interface PersonalityTraitCatalogEntry {
  id: string;
  label: string;
  labelKey: string;
  aliases: string[];
  icon: string;
  coreVibe: string;
  coreVibeKey: string;
  highlights: string[];
  highlightKeys: string[];
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
const NAVIGATOR_TRAIT_PRESENTERS: NavigatorTraitPresenterEntry[] = catalog.NAVIGATOR_TRAIT_PRESENTERS as NavigatorTraitPresenterEntry[];
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
const PERSONALITY_TRAIT_CATALOG: PersonalityTraitCatalogEntry[] = catalog.PERSONALITY_TRAIT_CATALOG as PersonalityTraitCatalogEntry[];
const FEEDBACK_PERSONALITY_TRAIT_OPTIONS: FeedbackTraitOption[] = PERSONALITY_TRAIT_CATALOG.map(trait => ({
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





const PROFILE_STATUS_OPTIONS: Array<{ value: ProfileStatus; icon: string }> = [
  { value: 'public', icon: 'public' },
  { value: 'friends only', icon: 'groups' },
  { value: 'host only', icon: 'stadium' },
  { value: 'inactive', icon: 'visibility_off' }
];

const PROFILE_DETAIL_GROUP_TEMPLATES: Array<{
  title: string;
  titleKey: string;
  rows: Array<{ labelKey: string; privacy: DetailPrivacy }>;
}> = catalog.PROFILE_DETAIL_GROUP_TEMPLATES as Array<{
  title: string;
  titleKey: string;
  rows: Array<{ labelKey: string; privacy: DetailPrivacy }>;
}>;

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
// Display keys for canonical profile choices. Stored values, matching and sorting use the original choices.
const PROFILE_OPTION_LABEL_KEYS: Readonly<Record<string, string>> = {
  "Slim": "slim",
  "Lean": "lean",
  "Athletic": "athletic",
  "Fit": "fit",
  "Curvy": "curvy",
  "Average": "average",
  "Muscular": "muscular",
  "English": "english",
  "Spanish": "spanish",
  "French": "french",
  "German": "german",
  "Italian": "italian",
  "Portuguese": "portuguese",
  "Hungarian": "hungarian",
  "Korean": "korean",
  "Never": "never",
  "Socially": "socially",
  "Occasionally": "occasionally",
  "Weekends only": "weekends.only",
  "Trying to quit": "trying.to.quit",
  "Daily": "daily",
  "Dog-friendly": "dog.friendly",
  "Cat-friendly": "cat.friendly",
  "All pets welcome": "all.pets.welcome",
  "Wants children": "wants.children",
  "Open to children": "open.to.children",
  "Not sure yet": "profile.children.preference.undecided",
  "Does not want children": "profile.children.preference.none",
  "No": "no",
  "Yes": "yes",
  "Prefer not to say": "profile.preference.unspecified",
  "Long-term partnership": "long.term.partnership",
  "Slow-burn connection": "slow.burn.connection",
  "Open relationship": "open.relationship",
  "Exploring": "profile.relationship.exploring",
  "Direct + warm": "direct.warm",
  "Calm + reflective": "calm.reflective",
  "Playful + light": "playful.light",
  "Honest + concise": "honest.concise",
  "Straight": "straight",
  "Bisexual": "bisexual",
  "Gay": "gay",
  "Lesbian": "lesbian",
  "Pansexual": "pansexual",
  "Asexual": "asexual",
  "Woman": "gender.woman",
  "Man": "gender.man",
  "Non-binary": "non.binary",
  "Spiritual but not religious": "profile.religion.spiritual.label",
  "Christian": "christian",
  "Muslim": "muslim",
  "Jewish": "jewish",
  "Buddhist": "buddhist",
  "Hindu": "hindu",
  "Atheist": "atheist",
  "Relationship & Family": "relationship.family",
  "Family": "family",
  "Marriage-oriented": "marriage.oriented",
  "Casual dating": "casual.dating",
  "Open / Exploring": "open.exploring",
  "Family-first": "family.first",
  "Independent lifestyle": "independent.lifestyle",
  "Life Focus & Ambition": "life.focus.ambition",
  "Ambition": "ambition",
  "Career-focused": "career.focused",
  "Entrepreneurial": "entrepreneurial",
  "Stability-focused": "stability.focused",
  "Balanced work-life": "balanced.work.life",
  "Freedom-oriented": "freedom.oriented",
  "Goal-driven": "goal.driven",
  "Lifestyle Orientation": "lifestyle.orientation",
  "Lifestyle": "lifestyle",
  "Health & wellness focused": "health.wellness.focused",
  "Fitness-driven": "fitness.driven",
  "Mindfulness-oriented": "mindfulness.oriented",
  "Social / party lifestyle": "social.party.lifestyle",
  "Calm / home-centered": "calm.home.centered",
  "Adventure-driven": "adventure.driven",
  "Balanced lifestyle": "balanced.lifestyle",
  "Beliefs & Worldview": "beliefs.worldview",
  "Beliefs": "beliefs",
  "Faith-oriented": "faith.oriented",
  "Secular": "secular",
  "Traditional values": "traditional.values",
  "Progressive values": "progressive.values",
  "Community-driven": "community.driven",
  "Social impact oriented": "social.impact.oriented",
  "Environmentally conscious": "environmentally.conscious",
  "Politically engaged": "politically.engaged",
  "Apolitical": "apolitical",
  "Social & Lifestyle": "social.lifestyle",
  "Social": "social",
  "Arts & Entertainment": "arts.entertainment",
  "Arts": "arts",
  "Food & Experiences": "food.experiences",
  "Food": "food",
  "Active & Adventure": "active.adventure",
  "Active": "active",
  "Mind & Wellness": "mind.wellness",
  "Mind": "mind",
  "Values & Identity": "values.identity",
  "Identity": "identity",
  "Public": "public",
  "Friends": "friends",
  "Private": "private"
};
const BELIEFS_VALUES_OPTION_GROUPS: ValuesOptionGroup[] = catalog.BELIEFS_VALUES_OPTION_GROUPS as ValuesOptionGroup[];
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
const DETAIL_PRIVACY_OPTIONS: DetailPrivacy[] = ['Public', 'Friends', 'Private'];
const EXPERIENCE_FILTER_OPTIONS: Array<'All' | ExperienceEntry['type']> = [
  'All',
  'Workspace',
  'School',
  'Online Session',
  'Additional Project'
];
const EXPERIENCE_TYPE_OPTIONS: Array<ExperienceEntry['type']> = ['Workspace', 'School', 'Online Session', 'Additional Project'];

const PROFILE_SAMPLE_EXPERIENCE_ENTRIES: ExperienceEntry[] = catalog.PROFILE_SAMPLE_EXPERIENCE_ENTRIES as ExperienceEntry[];

const ASSET_TYPE_OPTIONS: AssetType[] = [...ASSET_TYPES];
const ASSET_FILTER_OPTIONS: AssetFilterType[] = [...ASSET_FILTER_TYPES];


const ACTIVITIES_PRIMARY_FILTERS: Array<{ key: ActivitiesPrimaryFilter; label: string; icon: string }> = [
  { key: 'rates', label: 'rates', icon: 'star' },
  { key: 'chats', label: 'chats', icon: 'chat' },
  { key: 'invitations', label: 'invitations', icon: 'mail' },
  { key: 'events', label: 'events', icon: 'event' },
  { key: 'hosting', label: 'hosting', icon: 'stadium' }
];
const ACTIVITIES_SECONDARY_FILTERS: Array<{ key: ActivitiesSecondaryFilter; label: string; icon: string }> = [
  { key: 'recent', label: 'upcoming', icon: 'schedule' },
  { key: 'relevant', label: 'relevant', icon: 'auto_awesome' },
  { key: 'past', label: 'past', icon: 'history' }
];
const ACTIVITIES_CHAT_CONTEXT_FILTERS: Array<{ key: ActivitiesChatContextFilter; label: string; icon: string }> = [
  { key: 'all', label: 'all', icon: 'forum' },
  { key: 'event', label: 'event', icon: 'event' },
  { key: 'subEvent', label: 'sub.event', icon: 'event_available' },
  { key: 'group', label: 'group', icon: 'groups' },
  { key: 'service', label: 'service', icon: 'support_agent' },
  { key: 'contacts', label: 'chat.contacts', icon: 'contacts' },
  { key: 'campaign', label: 'campaign.title', icon: 'campaign' },
  { key: 'cases', label: 'case.title', icon: 'home_repair_service' },
  { key: 'groupSupport', label: 'group.support', icon: 'forum' },
  { key: 'appSupport', label: 'app.support', icon: 'admin_panel_settings' }
];
const RATE_FILTERS: Array<{ key: RateFilterKey; label: string }> = [
  { key: 'individual-given', label: 'given' },
  { key: 'individual-received', label: 'received' },
  { key: 'individual-mutual', label: 'mutual' },
  { key: 'individual-met', label: 'met' },
  { key: 'pair-given', label: 'given' },
  { key: 'pair-received', label: 'received' }
];
const RATE_FILTER_ENTRIES: RateFilterEntry[] = [
  { kind: 'group', label: 'Preferences', labelKey: 'activity.rates.group.preferences' },
  { kind: 'item', key: 'individual-given', label: 'Given' },
  { kind: 'item', key: 'individual-received', label: 'Received' },
  { kind: 'item', key: 'individual-mutual', label: 'Mutual' },
  { kind: 'item', key: 'individual-met', label: 'Met' },
  { kind: 'group', label: 'Suggestions', labelKey: 'activity.rates.group.suggestions' },
  { kind: 'item', key: 'pair-given', label: 'Given' },
  { kind: 'item', key: 'pair-received', label: 'Received' }
];
const ACTIVITIES_VIEW_OPTIONS: Array<{ key: ActivitiesView; label: string; icon: string }> = [
  { key: 'month', label: 'month', icon: 'calendar_month' },
  { key: 'week', label: 'week', icon: 'date_range' },
  { key: 'day', label: 'day', icon: 'today' },
  { key: 'distance', label: 'distance', icon: 'social_distance' }
];
const EVENT_EXPLORE_ORDER_OPTIONS: Array<{ key: EventExploreOrder; label: string; icon: string }> = [
  { key: 'upcoming', label: 'upcoming', icon: 'event_upcoming' },
  { key: 'past-events', label: 'event.explore.order.past', icon: 'history' },
  { key: 'nearby', label: 'nearby', icon: 'near_me' },
  { key: 'most-relevant', label: 'most.relevant', icon: 'auto_awesome' },
  { key: 'top-rated', label: 'top.rated', icon: 'emoji_events' }
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
const EVENT_MODE_OPTIONS: EventMode[] = ['Casual', 'Tournament', 'Mingle'];
const TOURNAMENT_LEADERBOARD_TYPE_OPTIONS: TournamentLeaderboardType[] = ['Score', 'Fifa'];
const ACTIVITY_GROUP_LABELS = {
  dateUnavailable: 'Date unavailable',
  weekPrefix: 'Week'
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
const FEEDBACK_EVENT_OVERALL_OPTIONS: FeedbackOption[] = [
  { value: 'excellent', label: 'Excellent', icon: 'sentiment_very_satisfied', impressionTag: 'Host vibe' },
  { value: 'good', label: 'Good', icon: 'sentiment_satisfied', impressionTag: 'Host reliability' },
  { value: 'mixed', label: 'Mixed', icon: 'sentiment_neutral', impressionTag: 'Host consistency' },
  { value: 'needs-work', label: 'Needs work', icon: 'sentiment_dissatisfied', impressionTag: 'Host quality' }
];
const FEEDBACK_HOST_IMPROVE_OPTIONS: FeedbackOption[] = [
  { value: 'timing', label: 'Improve timing', icon: 'schedule', impressionTag: 'Host organization' },
  { value: 'communication', label: 'Improve communication', icon: 'campaign', impressionTag: 'Host communication' },
  { value: 'resources', label: 'Improve resources', icon: 'inventory_2', impressionTag: 'Host planning' },
  { value: 'none', label: 'No major change', icon: 'verified', impressionTag: 'Host consistency' }
];
const FEEDBACK_ATTENDEE_COLLAB_OPTIONS: FeedbackOption[] = [
  { value: 'great', label: 'Great teamwork', icon: 'handshake', impressionTag: 'Attendee teamwork' },
  { value: 'reliable', label: 'Reliable', icon: 'verified_user', impressionTag: 'Attendee reliability' },
  { value: 'neutral', label: 'Neutral', icon: 'sentiment_neutral', impressionTag: 'Attendee neutrality' },
  { value: 'rough', label: 'Needs guidance', icon: 'warning_amber', impressionTag: 'Attendee fit' }
];
const FEEDBACK_ATTENDEE_REJOIN_OPTIONS: FeedbackOption[] = [
  { value: 'yes', label: 'Would team up', icon: 'group', impressionTag: 'Attendee trust' },
  { value: 'maybe', label: 'Maybe', icon: 'hourglass_top', impressionTag: 'Attendee compatibility' },
  { value: 'no', label: 'Not now', icon: 'do_not_disturb_alt', impressionTag: 'Attendee risk' },
  { value: 'context', label: 'Depends on role', icon: 'tune', impressionTag: 'Attendee role-fit' }
];
const FEEDBACK_LIST_FILTER_META: Record<FeedbackListFilter, { label: string; icon: string }> = {
  'own-events': { label: 'feedback.own', icon: 'stadium' },
  pending: { label: 'pending', icon: 'schedule' },
  feedbacked: { label: 'feedbacked', icon: 'task_alt' },
  removed: { label: 'feedback.evaluation.removed', icon: 'delete_outline' }
};
const FEEDBACK_LIST_FILTER_OPTIONS: Array<{ key: FeedbackListFilter; label: string; icon: string }> =
  FEEDBACK_LIST_FILTERS.map(key => ({ key, ...FEEDBACK_LIST_FILTER_META[key] }));


const HELP_CENTER_SECTIONS: HelpCenterSectionDto[] = catalog.HELP_CENTER_SECTIONS as HelpCenterSectionDto[];

const htmlList = (items: readonly string[]): string => `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;



const TERMS_CENTER_SECTIONS: HelpCenterSectionDto[] = catalog.TERMS_CENTER_SECTIONS as HelpCenterSectionDto[];

const PRIVACY_CENTER_SECTIONS: HelpCenterSectionDto[] = [
  {
    id: 'privacy',
    icon: 'policy',
    title: GDPR_CONTENT.title,
    blurb: GDPR_CONTENT.subtitle,
    contentHtml: `
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

const HELP_CENTER_SECTIONS_HU: HelpCenterSectionDto[] = catalog.HELP_CENTER_SECTIONS_HU as HelpCenterSectionDto[];

const PRIVACY_CENTER_SECTIONS_HU: HelpCenterSectionDto[] = catalog.PRIVACY_CENTER_SECTIONS_HU as HelpCenterSectionDto[];

const TERMS_CENTER_SECTIONS_HU: HelpCenterSectionDto[] = catalog.TERMS_CENTER_SECTIONS_HU as HelpCenterSectionDto[];

const DEFAULT_HELP_CENTER_REVISION: HelpCenterRevisionDto = {
  "lang": "en",
  "languageLabel": "English",
  "version": 5,
  "title": "MyScoutee help",
  "summary": "A practical guide by topic",
  "description": "Profiles, communities, events, chats and tools: find the relevant topic and follow the steps.",
  "headerColor": "amber",
  "active": true,
  "id": "help-default-v5",
  "documentKind": "help",
  "createdAtIso": "2026-09-26T00:00:00.000Z",
  "createdByUserId": "system",
  "updatedAtIso": "2026-10-07T00:00:00.000Z",
  "updatedByUserId": "system",
  sections: HELP_CENTER_SECTIONS
};

const DEFAULT_HELP_CENTER_REVISION_HU: HelpCenterRevisionDto = {
  "lang": "hu",
  "languageLabel": "Magyar",
  "version": 5,
  "title": "MyScoutee súgó",
  "summary": "Gyakorlati útmutató témánként",
  "description": DEFAULT_HELP_CENTER_DESCRIPTION_HU,
  "headerColor": "amber",
  "active": true,
  "id": "help-default-hu-v5",
  "documentKind": "help",
  "createdAtIso": "2026-09-26T00:00:00.000Z",
  "createdByUserId": "system",
  "updatedAtIso": "2026-10-07T00:00:00.000Z",
  "updatedByUserId": "system",
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
  description: DEFAULT_TERMS_CENTER_DESCRIPTION_HU,
  sections: TERMS_CENTER_SECTIONS_HU
};

const EXPLANATION_HOME_SECTIONS: HelpCenterSectionDto[] = catalog.EXPLANATION_HOME_SECTIONS as HelpCenterSectionDto[];

const EXPLANATION_HOME_SECTIONS_HU: HelpCenterSectionDto[] = catalog.EXPLANATION_HOME_SECTIONS_HU as HelpCenterSectionDto[];

const EXPLANATION_ACTIVITY_RATES_SECTIONS: HelpCenterSectionDto[] = catalog.EXPLANATION_ACTIVITY_RATES_SECTIONS as HelpCenterSectionDto[];

const EXPLANATION_ACTIVITY_RATES_SECTIONS_HU: HelpCenterSectionDto[] = catalog.EXPLANATION_ACTIVITY_RATES_SECTIONS_HU as HelpCenterSectionDto[];

const EXPLANATION_EVENTS_SECTIONS: HelpCenterSectionDto[] = catalog.EXPLANATION_EVENTS_SECTIONS as HelpCenterSectionDto[];

const EXPLANATION_EVENTS_SECTIONS_HU: HelpCenterSectionDto[] = catalog.EXPLANATION_EVENTS_SECTIONS_HU as HelpCenterSectionDto[];

const EXPLANATION_CHATS_SECTIONS: HelpCenterSectionDto[] = catalog.EXPLANATION_CHATS_SECTIONS as HelpCenterSectionDto[];

const EXPLANATION_CHATS_SECTIONS_HU: HelpCenterSectionDto[] = catalog.EXPLANATION_CHATS_SECTIONS_HU as HelpCenterSectionDto[];

const EXPLANATION_CONTACTS_SECTIONS: HelpCenterSectionDto[] = catalog.EXPLANATION_CONTACTS_SECTIONS as HelpCenterSectionDto[];

const EXPLANATION_CONTACTS_SECTIONS_HU: HelpCenterSectionDto[] = catalog.EXPLANATION_CONTACTS_SECTIONS_HU as HelpCenterSectionDto[];

const EXPLANATION_PROFILE_EDITOR_SECTIONS: HelpCenterSectionDto[] = catalog.EXPLANATION_PROFILE_EDITOR_SECTIONS as HelpCenterSectionDto[];

const EXPLANATION_PROFILE_EDITOR_SECTIONS_HU: HelpCenterSectionDto[] = catalog.EXPLANATION_PROFILE_EDITOR_SECTIONS_HU as HelpCenterSectionDto[];

const EXPLANATION_PROFILE_VIEW_SECTIONS: HelpCenterSectionDto[] = catalog.EXPLANATION_PROFILE_VIEW_SECTIONS as HelpCenterSectionDto[];

const EXPLANATION_PROFILE_VIEW_SECTIONS_HU: HelpCenterSectionDto[] = catalog.EXPLANATION_PROFILE_VIEW_SECTIONS_HU as HelpCenterSectionDto[];

const EXPLANATION_FEEDBACK_SECTIONS: HelpCenterSectionDto[] = catalog.EXPLANATION_FEEDBACK_SECTIONS as HelpCenterSectionDto[];

const EXPLANATION_FEEDBACK_SECTIONS_HU: HelpCenterSectionDto[] = catalog.EXPLANATION_FEEDBACK_SECTIONS_HU as HelpCenterSectionDto[];

const EXPLANATION_ASSETS_SECTIONS: HelpCenterSectionDto[] = catalog.EXPLANATION_ASSETS_SECTIONS as HelpCenterSectionDto[];

const EXPLANATION_ASSETS_SECTIONS_HU: HelpCenterSectionDto[] = catalog.EXPLANATION_ASSETS_SECTIONS_HU as HelpCenterSectionDto[];

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

const EXPLANATION_ASSETS_TICKETS_SECTIONS: HelpCenterSectionDto[] = catalog.EXPLANATION_ASSETS_TICKETS_SECTIONS as HelpCenterSectionDto[];

const EXPLANATION_ASSETS_TRANSPORT_SECTIONS_HU: HelpCenterSectionDto[] = assetExplanationSections(EXPLANATION_ASSETS_SECTIONS_HU, {
  'assets-entry': {
    icon: 'directions_car',
    title: 'Saját járművek',
    blurb: 'Adj hozzá és kezelj járművet vagy más szállítási eszközt.',
    contentHtml: '<p>A <strong>Közlekedés</strong> fül a tulajdonodban vagy kezelésedben lévő szállítási eszközöket mutatja. A plusz gombbal újat hozhatsz létre, majd megadhatod a címét, kapacitását, mennyiségét, részleteit, láthatóságát, valamint az opcionális árat és szabályokat.</p>'
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
    contentHtml: '<p>A <strong>Szállás</strong> fül a tulajdonodban vagy kezelésedben lévő helyeket mutatja. A plusz gombbal újat hozhatsz létre, majd megadhatod a címét, helyszínét, kapacitását, mennyiségét, részleteit, láthatóságát, valamint az opcionális árat és szabályokat.</p>'
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

const EXPLANATION_ASSETS_TICKETS_SECTIONS_HU: HelpCenterSectionDto[] = catalog.EXPLANATION_ASSETS_TICKETS_SECTIONS_HU as HelpCenterSectionDto[];

const EXPLANATION_EVENT_EDITOR_SECTIONS: HelpCenterSectionDto[] = catalog.EXPLANATION_EVENT_EDITOR_SECTIONS as HelpCenterSectionDto[];

const EXPLANATION_EVENT_EDITOR_SECTIONS_HU: HelpCenterSectionDto[] = catalog.EXPLANATION_EVENT_EDITOR_SECTIONS_HU as HelpCenterSectionDto[];

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
  // Each reference must have an SVG in assets/help-center/explanations (EN and HU).
  return `${SEEDED_EXPLANATION_IMAGE_REF_PREFIX}${contentLangForSeed(lang)}/${seededExplanationPathSegment(contextKey)}/${seededExplanationPathSegment(sectionId)}`;
}

function withSeededExplanationImageHtml(contentHtml: string | null | undefined, imageUrl: string, title: string | null | undefined): string {
  const html = `${contentHtml ?? ''}`.trim();
  const nextFigure = `<figure class="explanation-seeded-visual lazy-image-frame-loading"><img class="lazy-image-loading" src="${escapeHtmlAttribute(lazyImagePlaceholderSrc(imageUrl))}" alt="${escapeHtmlAttribute(title ?? '')}"></figure>`;
  const withoutExistingSeededFigure = html.replace(/<figure\b[^>]*\bexplanation-seeded-visual\b[^>]*>[\s\S]*?<\/figure>/gi, '').trim();
  if (/<img[\s>]/i.test(withoutExistingSeededFigure)) {
    return withoutExistingSeededFigure;
  }
  return `${withoutExistingSeededFigure}${nextFigure}`;
}

function lazyImagePlaceholderSrc(imageUrl: string): string {
  return `${LAZY_IMAGE_PLACEHOLDER_URL}#lazy-src=${encodeURIComponent(imageUrl)}`;
}

function seededExplanationPathSegment(value: string | null | undefined): string {
  return AppUtils.trimCharacters(`${value ?? ''}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-'), "-") || 'default';
}

function contentLangForSeed(lang: string | null | undefined): string {
  const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0];
    return SUPPORTED_CONTENT_LANGUAGES.some(item => item.lang === normalized) ? normalized : 'en';
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
  description: DEFAULT_EXPLANATION_HOME_DESCRIPTION,
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
  description: DEFAULT_EXPLANATION_HOME_DESCRIPTION_HU,
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
  summary: 'Open your ticket or check in an attendee.',
  description: 'See how ticket QR codes, one-time check-in, and used-ticket status work.',
  sections: withSeededExplanationImages('assets.tickets', EXPLANATION_ASSETS_TICKETS_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_ASSETS_TICKETS_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_ASSETS_TICKETS_REVISION,
  id: 'explanation-assets-tickets-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Eseményjegyek',
  summary: 'Nyisd meg a jegyedet, vagy léptess be egy résztvevőt.',
  description: 'Itt megtudhatod, hogyan működik a QR-kód, az egyszeri beléptetés és a felhasznált jegy jelzése.',
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

const DEFAULT_EXPLANATION_FEEDBACK_REVISION: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-feedback-default-v1',
  contextKey: 'feedback',
  title: 'Event feedback',
  summary: 'Submit feedback and review event results.',
  description: 'Learn how feedback lists, answer cards, and organizer results work.',
  sections: withSeededExplanationImages('feedback', EXPLANATION_FEEDBACK_SECTIONS, 'en')
};

const DEFAULT_EXPLANATION_FEEDBACK_REVISION_HU: HelpCenterRevisionDto = {
  ...DEFAULT_EXPLANATION_FEEDBACK_REVISION,
  id: 'explanation-feedback-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Esemény-visszajelzés',
  summary: 'Visszajelzés beküldése és az eredmények áttekintése.',
  description: 'Itt megismerheted a visszajelzési listákat, a válaszkártyákat és a szervezői eredményeket.',
  sections: withSeededExplanationImages('feedback', EXPLANATION_FEEDBACK_SECTIONS_HU, 'hu')
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
  profileHoroscopeMetaBySign: HOROSCOPE_META_BY_SIGN,
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
  profileOptionLabelKeys: PROFILE_OPTION_LABEL_KEYS,
  childrenValueLabels: { no: 'profile.children.none', yes: 'profile.children.has' } as Readonly<Record<string, string>>,
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
  feedbackCategoryLabelKeys: {
    'Bug report': 'bug.report', 'Feature request': 'feature.request', 'UX improvement': 'ux.improvement',
    'Performance': 'performance', 'General': 'general'
  } as Readonly<Record<string, string>>,
  feedbackEventOverallOptions: FEEDBACK_EVENT_OVERALL_OPTIONS,
  feedbackHostImproveOptions: FEEDBACK_HOST_IMPROVE_OPTIONS,
  feedbackAttendeeCollabOptions: FEEDBACK_ATTENDEE_COLLAB_OPTIONS,
  feedbackAttendeeRejoinOptions: FEEDBACK_ATTENDEE_REJOIN_OPTIONS,
  feedbackPersonalityTraitOptions: FEEDBACK_PERSONALITY_TRAIT_OPTIONS,
  feedbackListFilters: FEEDBACK_LIST_FILTER_OPTIONS,
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
  legacyActivityRatesRevisionsByLang: {
    en: DEFAULT_EXPLANATION_ACTIVITY_RATES_REVISION,
    hu: DEFAULT_EXPLANATION_ACTIVITY_RATES_REVISION_HU
  },
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
    'feedback': {
      en: DEFAULT_EXPLANATION_FEEDBACK_REVISION,
      hu: DEFAULT_EXPLANATION_FEEDBACK_REVISION_HU
    }
  },
  seededExplanationImageRefPrefix: SEEDED_EXPLANATION_IMAGE_REF_PREFIX,
  seededExplanationImageAssetRoot: SEEDED_EXPLANATION_IMAGE_ASSET_ROOT
};
