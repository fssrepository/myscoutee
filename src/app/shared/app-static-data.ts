import type {
  ActivitiesChatContextFilter,
  ActivitiesPrimaryFilter,
  ActivitiesSecondaryFilter,
  ActivitiesView,
  AdminNotificationScheduleFrequency,
  AssetFilterType,
  AssetCategory,
  AssetType,
  DetailPrivacy,
  EventBlindMode,
  EventFeedbackListFilter,
  EventFeedbackOption,
  EventFeedbackTraitOption,
  EventExploreOrder,
  EventVisibility,
  ExperienceEntry,
  ExplainableSurface,
  HelpCenterRevision,
  HelpCenterSection,
  InterestOptionGroup,
  ProfileStatus,
  RateFilterEntry,
  RateFilterKey,
  SubEventResourceFilter,
  SubEventsDisplayMode,
  TournamentLeaderboardType,
  ValuesOptionGroup
} from './core/base/models';
import { GDPR_CONTENT } from './gdpr-data';

interface PersonalityTraitCatalogEntry {
  id: string;
  label: string;
  aliases: string[];
  icon: string;
  coreVibe: string;
  highlights: string[];
  toneClass: string;
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
const EXPLAINABLE_SURFACES: ExplainableSurface[] = [
  { key: 'home.game', label: 'Home cards', icon: 'style', owner: 'route', order: 10, enabled: true },
  { key: 'activities.rates', label: 'Activity ratings', icon: 'star', owner: 'popup', order: 20, enabled: true },
  { key: 'profile.editor', label: 'Profile editor', icon: 'manage_accounts', owner: 'popup', order: 30, enabled: true },
  { key: 'profile.view', label: 'Profile details', icon: 'visibility', owner: 'popup', order: 40, enabled: true },
  { key: 'assets', label: 'Assets', icon: 'inventory_2', owner: 'popup', order: 50, enabled: true },
  { key: 'events', label: 'Events', icon: 'event_note', owner: 'popup', order: 60, enabled: true },
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

const ASSET_TYPE_OPTIONS: AssetType[] = ['Car', 'Accommodation', 'Supplies'];
const ASSET_FILTER_OPTIONS: AssetFilterType[] = ['Car', 'Accommodation', 'Supplies', 'Ticket'];
const ASSET_TYPE_LABELS: Record<AssetFilterType, string> = {
  Car: 'Car',
  Accommodation: 'Property',
  Supplies: 'Supplies',
  Ticket: 'Ticket'
};
const ASSET_CATEGORY_OPTIONS_BY_TYPE: Record<AssetType, AssetCategory[]> = {
  Car: ['Ride'],
  Accommodation: ['Stay'],
  Supplies: ['Camping', 'Cooking', 'Games', 'Audio', 'Sports', 'Safety', 'Decor', 'Tech']
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
  { key: 'all', label: 'All', icon: 'forum' },
  { key: 'event', label: 'Event', icon: 'event' },
  { key: 'subEvent', label: 'Sub event', icon: 'event_available' },
  { key: 'group', label: 'Group', icon: 'groups' },
  { key: 'service', label: 'Service', icon: 'support_agent' }
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
const EVENT_VISIBILITY_OPTIONS: EventVisibility[] = ['Public', 'Friends only', 'Invitation only'];
const EVENT_BLIND_MODE_OPTIONS: EventBlindMode[] = ['Open Event', 'Blind Event'];
const SUB_EVENT_RESOURCE_FILTER_OPTIONS: SubEventResourceFilter[] = ['Members', 'Car', 'Accommodation', 'Supplies'];
const SUB_EVENT_RESOURCE_FILTER_LABELS: Record<SubEventResourceFilter, string> = {
  Members: 'Members',
  Car: 'Car',
  Accommodation: 'Property',
  Supplies: 'Supplies'
};
const SUB_EVENTS_DISPLAY_MODE_OPTIONS: SubEventsDisplayMode[] = ['Casual', 'Tournament'];
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
const EVENT_FEEDBACK_LIST_FILTERS: Array<{ key: EventFeedbackListFilter; label: string; icon: string }> = [
  { key: 'own-events', label: 'Own Events', icon: 'stadium' },
  { key: 'pending', label: 'Pending', icon: 'schedule' },
  { key: 'feedbacked', label: 'Feedbacked', icon: 'task_alt' },
  { key: 'removed', label: 'Removed', icon: 'delete_outline' }
];
const DEFAULT_HELP_CENTER_DESCRIPTION = 'MyScoutee helps you plan events end-to-end: invite people, split into stages/groups, assign resources, and coordinate in context chats.';
const DEFAULT_PRIVACY_CENTER_DESCRIPTION = 'Before continuing, please review and accept how your data is used in MyScoutee.';
const HELP_CENTER_SECTIONS: HelpCenterSection[] = [
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
    blurb: 'Assign people, cars, accommodation, and supplies with limits.',
    contentHtml: `
      <p><strong>Assign people, cars, accommodation, and supplies with limits.</strong></p>
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
const PRIVACY_CENTER_SECTIONS: HelpCenterSection[] = [
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

const HELP_CENTER_SECTIONS_HU: HelpCenterSection[] = [
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
    blurb: 'Rendelj embereket, autókat, szállást és kellékeket limitekkel.',
    contentHtml: '<p><strong>Rendelj embereket, autókat, szállást és kellékeket limitekkel.</strong></p><p>Az erőforrásmenükben eszközöket rendelhetsz aleseményekhez és csoportokhoz, majd közvetlenül állíthatod a kapacitásokat.</p><ul><li>Minimum/maximum kapacitás feladatonként</li><li>Kontextusos jelvények függő kérésekhez</li><li>Útvonal- és helytámogatás utazási erőforrásokhoz</li></ul>'
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

const PRIVACY_CENTER_SECTIONS_HU: HelpCenterSection[] = [
  {
    id: 'privacy',
    icon: 'policy',
    title: 'Adatvédelem',
    blurb: 'Hogyan kezeli a MyScoutee a profilhoz, eseményekhez és közösségi aktivitáshoz kapcsolódó személyes adatokat.',
    contentHtml: '<p>Hogyan kezeli a MyScoutee a profilhoz, eseményekhez és közösségi aktivitáshoz kapcsolódó személyes adatokat.</p><p><strong>Utolsó frissítés:</strong> 2026. február 1.</p>'
  },
  {
    id: 'contact-details',
    icon: 'contact_mail',
    title: 'Kapcsolati adatok',
    blurb: 'Kihez fordulhatsz adatvédelemmel és adatkezeléssel kapcsolatban.',
    contentHtml: '<ul><li><strong>Adatkezelő:</strong> MyScoutee demo platform</li><li><strong>Támogatási email:</strong> privacy@myscoutee.app</li><li><strong>DPO kapcsolat:</strong> dpo@myscoutee.app</li></ul>'
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

const DEFAULT_HELP_CENTER_REVISION: HelpCenterRevision = {
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

const DEFAULT_HELP_CENTER_REVISION_HU: HelpCenterRevision = {
  ...DEFAULT_HELP_CENTER_REVISION,
  id: 'help-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'MyScoutee súgó',
  summary: 'Mit tehetsz a MyScoutee-ban',
  description: 'A MyScoutee segít az eseményeket elejétől végéig megtervezni: meghívások, szakaszok és csoportok, erőforrások, valamint kontextushoz kötött csevegések.',
  sections: HELP_CENTER_SECTIONS_HU
};

const DEFAULT_PRIVACY_CENTER_REVISION: HelpCenterRevision = {
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

const DEFAULT_PRIVACY_CENTER_REVISION_HU: HelpCenterRevision = {
  ...DEFAULT_PRIVACY_CENTER_REVISION,
  id: 'privacy-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Adatvédelem',
  summary: 'Adatvédelem elsőként',
  description: 'Folytatás előtt nézd át és fogadd el, hogyan használja a MyScoutee az adataidat.',
  sections: PRIVACY_CENTER_SECTIONS_HU
};

const EXPLANATION_HOME_SECTIONS: HelpCenterSection[] = [
  {
    id: 'affinity',
    icon: 'tune',
    title: 'Affinity slider',
    blurb: 'Choose how strong the card feels for you.',
    contentHtml: '<p>Tap or drag the Affinity slider from 1 to 10. The Go button appears only after you pick a value.</p>'
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

const EXPLANATION_HOME_SECTIONS_HU: HelpCenterSection[] = [
  {
    id: 'affinity',
    icon: 'tune',
    title: 'Szimpátia sáv',
    blurb: 'Állítsd be, mennyire szimpatikus a kártya.',
    contentHtml: '<p>Tapints vagy húzd a Szimpátia sávot 1 és 10 között. A Mehet gomb csak akkor jelenik meg, amikor már választottál értéket.</p>'
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

const EXPLANATION_ACTIVITY_RATES_SECTIONS: HelpCenterSection[] = [
  {
    id: 'activity-primary-menu',
    icon: 'star',
    title: 'Activity menu',
    blurb: 'The first toolbar menu switches the whole Activities panel.',
    contentHtml: '<p>Open it to move between <strong>Ratings</strong>, <strong>Chats</strong>, and <strong>Events</strong>. The badge on Ratings or Chats is that area&rsquo;s activity count, not the count from the rating-type filter.</p><p>When you leave Ratings, pending score direction changes are committed and fullscreen rating is closed.</p>'
  },
  {
    id: 'activity-rate-filter',
    icon: 'north_east',
    title: 'Rating type menu',
    blurb: 'The second toolbar menu decides which rating cards appear.',
    contentHtml: '<p><strong>Preferences</strong> contains individual Given, Received, Mutual, and Met ratings. <strong>Suggestions</strong> contains pair Given and Received ratings.</p><p>The badge on this button and on each option is the number of cards matching that exact rating filter. The Social toggle changes whether social-context cards are included for that group.</p>'
  },
  {
    id: 'activity-header-controls',
    icon: 'route',
    title: 'Header controls',
    blurb: 'The top-right buttons are separate menus and actions.',
    contentHtml: '<p><strong>Recent</strong> opens the secondary order menu: recent, relevant, or past ratings. <strong>Distance</strong> opens the view menu: month, week, day, or distance.</p><p>When Distance view is selected, markers such as <strong>10 km</strong> are group labels for the current list. The X closes the Activities panel.</p>'
  },
  {
    id: 'activity-card-media',
    icon: 'visibility',
    title: 'Photos and profile',
    blurb: 'The card itself has image navigation and profile access.',
    contentHtml: '<p>The small image bars show that the card has multiple photos. Click a bar or the image area to switch photos.</p><p>The eye button opens that person&rsquo;s profile. If a small avatar/counter badge appears on a card, it points to the connecting profile or shared social context.</p>'
  },
  {
    id: 'activity-score-badge',
    icon: 'star',
    title: 'Star rating badge',
    blurb: 'The star badge is the rating control, not a generic card score.',
    contentHtml: '<p>The badge shows your current rating value, or <strong>Rate</strong> when you have not rated yet. Click it to open the rating editor; click the same selected badge again to close it.</p><p>Use the 1-10 star dock to save a value. Pair Received cards can be read-only: their badge is disabled and may show the received pair average instead of your editable score.</p>'
  },
  {
    id: 'activity-fullscreen',
    icon: 'fullscreen',
    title: 'Fullscreen rating',
    blurb: 'The orange fullscreen icon changes the rating workflow.',
    contentHtml: '<p>In distance-based Ratings, the fullscreen button opens a focused card-by-card rating flow. The same button becomes fullscreen-exit and returns you to the normal list.</p><p>In editable fullscreen views, the bottom stars rate the current card. In read-only pair-received mode, fullscreen uses navigation instead of editing.</p>'
  }
];

const EXPLANATION_ACTIVITY_RATES_SECTIONS_HU: HelpCenterSection[] = [
  {
    id: 'activity-primary-menu',
    icon: 'star',
    title: 'Tevékenység menü',
    blurb: 'Az első eszköztári menü az egész Tevékenységek panelt váltja.',
    contentHtml: '<p>Itt válthatsz az <strong>Értékelések</strong>, <strong>Chatek</strong> és <strong>Események</strong> között. Az Értékelések vagy Chatek jelvénye az adott terület aktivitásszáma, nem az értékelési szűrő találatszáma.</p><p>Ha kilépsz az Értékelések nézetből, a függő értékelési irányváltások mentődnek, és a teljes képernyős értékelés bezár.</p>'
  },
  {
    id: 'activity-rate-filter',
    icon: 'north_east',
    title: 'Értékeléstípus menü',
    blurb: 'A második eszköztári menü dönti el, mely értékeléskártyák látszanak.',
    contentHtml: '<p>A <strong>Preferenciák</strong> alatt az egyéni Adott, Kapott, Kölcsönös és Találkozott értékelések vannak. A <strong>Javaslatok</strong> alatt a páros Adott és Kapott értékelések vannak.</p><p>A gombon és az egyes opciókon látható jelvény az adott értékelési szűrő pontos találatszáma. A Social kapcsoló azt állítja, hogy az adott csoportban bekerüljenek-e a közösségi kontextusú kártyák.</p>'
  },
  {
    id: 'activity-header-controls',
    icon: 'route',
    title: 'Fejléc gombok',
    blurb: 'A jobb felső gombok külön menük és műveletek.',
    contentHtml: '<p>A <strong>Legutóbbi</strong> a másodlagos rendezési menüt nyitja: friss, releváns vagy korábbi értékelések. A <strong>Távolság</strong> a nézetmenüt nyitja: hónap, hét, nap vagy távolság.</p><p>Távolság nézetben a <strong>10 km</strong> jellegű sávok csoportcímkék az aktuális listához. Az X bezárja a Tevékenységek panelt.</p>'
  },
  {
    id: 'activity-card-media',
    icon: 'visibility',
    title: 'Fotók és profil',
    blurb: 'A kártyán képváltás és profilnyitás is van.',
    contentHtml: '<p>A felső kis képsávok jelzik, hogy több fotó van a kártyán. Kattints egy sávra vagy a kép megfelelő részére a fotóváltáshoz.</p><p>A szem gomb megnyitja az adott profilt. Ha kis avatar/számláló jelvény jelenik meg a kártyán, az a kapcsolódó profilra vagy közösségi kontextusra mutat.</p>'
  },
  {
    id: 'activity-score-badge',
    icon: 'star',
    title: 'Csillagos értékelő jelvény',
    blurb: 'A csillagos jelvény az értékelés vezérlője, nem általános kártyapont.',
    contentHtml: '<p>A jelvény a saját aktuális értékedet mutatja, vagy <strong>Értékelés</strong> feliratot, ha még nincs érték. Kattintásra megnyitja az értékelő szerkesztőt; ugyanarra a kijelölt jelvényre kattintva bezárja.</p><p>Az 1-10-es alsó csillagsávval mentheted az értéket. A Páros Kapott kártyák lehetnek csak olvashatók: ilyenkor a jelvény tiltott, és a kapott páros átlagot mutathatja a saját szerkeszthető érték helyett.</p>'
  },
  {
    id: 'activity-fullscreen',
    icon: 'fullscreen',
    title: 'Teljes képernyős értékelés',
    blurb: 'A narancs teljes képernyő ikon az értékelési folyamatot váltja.',
    contentHtml: '<p>Távolság alapú Értékelések nézetben a teljes képernyő gomb fókuszált, kártyánkénti értékelésre vált. Ugyanez a gomb kilépés ikonra vált, és visszavisz a normál listához.</p><p>Szerkeszthető teljes képernyős nézetben az alsó csillagok az aktuális kártyát értékelik. Csak olvasható Páros Kapott módban a teljes képernyő navigálásra szolgál, nem szerkesztésre.</p>'
  }
];

const DEFAULT_EXPLANATION_HOME_REVISION: HelpCenterRevision = {
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
  sections: EXPLANATION_HOME_SECTIONS,
  active: true,
  createdAtIso: '2026-05-22T00:00:00.000Z',
  createdByUserId: 'system',
  updatedAtIso: '2026-05-22T00:00:00.000Z',
  updatedByUserId: 'system'
};

const DEFAULT_EXPLANATION_HOME_REVISION_HU: HelpCenterRevision = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-home-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Kezdőlap magyarázat',
  summary: 'Így működik a kezdőlap',
  description: 'Rövid alkalmazáson belüli útmutató a kiválasztott képernyőhöz.',
  sections: EXPLANATION_HOME_SECTIONS_HU
};

const DEFAULT_EXPLANATION_ACTIVITY_RATES_REVISION: HelpCenterRevision = {
  ...DEFAULT_EXPLANATION_HOME_REVISION,
  id: 'explanation-activity-rates-default-v1',
  contextKey: 'activities.rates',
  title: 'Activity ratings explanation',
  summary: 'How the activity ratings panel works',
  sections: EXPLANATION_ACTIVITY_RATES_SECTIONS
};

const DEFAULT_EXPLANATION_ACTIVITY_RATES_REVISION_HU: HelpCenterRevision = {
  ...DEFAULT_EXPLANATION_ACTIVITY_RATES_REVISION,
  id: 'explanation-activity-rates-default-hu-v1',
  lang: 'hu',
  languageLabel: 'Magyar',
  title: 'Tevékenységek magyarázat',
  summary: 'Így működik az értékelési panel',
  sections: EXPLANATION_ACTIVITY_RATES_SECTIONS_HU
};

export const APP_STATIC_DATA = {
  vibeCategories: VIBE_CATEGORIES,
  hostedEventTypes: HOSTED_EVENT_TYPES,
  vibeIcons: VIBE_ICONS,
  categoryIcons: CATEGORY_ICONS,
  memberTraitIcons: MEMBER_TRAIT_ICONS,
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
  subEventsDisplayModeOptions: SUB_EVENTS_DISPLAY_MODE_OPTIONS,
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
  eventFeedbackListFilters: EVENT_FEEDBACK_LIST_FILTERS,
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
  defaultHelpCenterDescription: DEFAULT_HELP_CENTER_DESCRIPTION,
  defaultPrivacyCenterDescription: DEFAULT_PRIVACY_CENTER_DESCRIPTION,
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
    }
  }
};
