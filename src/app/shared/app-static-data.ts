import type {
  ActivitiesChatContextFilter,
  ActivitiesPrimaryFilter,
  ActivitiesSecondaryFilter,
  ActivitiesView,
  AssetFilterType,
  AssetType,
  DetailPrivacy,
  EventBlindMode,
  EventFeedbackListFilter,
  EventFeedbackOption,
  EventFeedbackTraitOption,
  EventExploreOrder,
  EventVisibility,
  ExperienceEntry,
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
const PROFILE_STATUS_OPTIONS: Array<{ value: ProfileStatus; icon: string }> = [
  { value: 'public', icon: 'public' },
  { value: 'friends only', icon: 'groups' },
  { value: 'host only', icon: 'stadium' },
  { value: 'inactive', icon: 'visibility_off' }
];

const PROFILE_DETAIL_GROUP_TEMPLATES: Array<{
  title: string;
  rows: Array<{ label: string; privacy: DetailPrivacy }>;
}> = [
  {
    title: 'Basics',
    rows: [
      { label: 'Name', privacy: 'Public' },
      { label: 'City', privacy: 'Public' },
      { label: 'Birthday', privacy: 'Friends' },
      { label: 'Height', privacy: 'Friends' },
      { label: 'Physique', privacy: 'Friends' },
      { label: 'Languages', privacy: 'Public' },
      { label: 'Horoscope', privacy: 'Public' }
    ]
  },
  {
    title: 'Lifestyle',
    rows: [
      { label: 'Interest', privacy: 'Friends' },
      { label: 'Drinking', privacy: 'Friends' },
      { label: 'Smoking', privacy: 'Friends' },
      { label: 'Workout', privacy: 'Public' },
      { label: 'Pets', privacy: 'Public' }
    ]
  },
  {
    title: 'Relationships',
    rows: [
      { label: 'Family plans', privacy: 'Hosts' },
      { label: 'Children', privacy: 'Private' },
      { label: 'Love style', privacy: 'Hosts' },
      { label: 'Communication style', privacy: 'Friends' },
      { label: 'Sexual orientation', privacy: 'Hosts' },
      { label: 'Gender', privacy: 'Public' }
    ]
  },
  {
    title: 'Beliefs',
    rows: [
      { label: 'Religion', privacy: 'Private' },
      { label: 'Values', privacy: 'Friends' }
    ]
  }
];

const PROFILE_DETAIL_VALUE_OPTIONS: Record<string, string[]> = {
  Drinking: ['Never', 'Socially', 'Occasionally', 'Weekends only'],
  Smoking: ['Never', 'Socially', 'Occasionally', 'Trying to quit'],
  Workout: ['Daily', '4x / week', '2-3x / week', 'Rarely'],
  Pets: ['Dog-friendly', 'Cat-friendly', 'All pets welcome', 'No pets'],
  'Family plans': ['Wants children', 'Open to children', 'Not sure yet', 'Does not want children'],
  Children: ['No', 'Yes', 'Prefer not to say'],
  'Love style': ['Long-term partnership', 'Slow-burn connection', 'Open relationship', 'Exploring'],
  'Communication style': ['Direct + warm', 'Calm + reflective', 'Playful + light', 'Honest + concise'],
  'Sexual orientation': ['Straight', 'Bisexual', 'Gay', 'Lesbian', 'Pansexual', 'Asexual', 'Prefer not to say'],
  Gender: ['Woman', 'Man', 'Non-binary', 'Prefer not to say'],
  Religion: ['Spiritual but not religious', 'Christian', 'Muslim', 'Jewish', 'Buddhist', 'Hindu', 'Atheist', 'Prefer not to say'],
  Values: [
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
  { key: 'group', label: 'Group', icon: 'groups' }
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
  { kind: 'group', label: 'Single Rate' },
  { kind: 'item', key: 'individual-given', label: 'Given' },
  { kind: 'item', key: 'individual-received', label: 'Received' },
  { kind: 'item', key: 'individual-mutual', label: 'Mutual' },
  { kind: 'item', key: 'individual-met', label: 'Met' },
  { kind: 'group', label: 'Pair Rate' },
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
const EVENT_VISIBILITY_OPTIONS: EventVisibility[] = ['Public', 'Friends only', 'Invitation only'];
const EVENT_BLIND_MODE_OPTIONS: EventBlindMode[] = ['Open Event', 'Blind Event'];
const SUB_EVENT_RESOURCE_FILTER_OPTIONS: SubEventResourceFilter[] = ['Members', 'Car', 'Accommodation', 'Supplies'];
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
  { key: 'pending', label: 'Pending', icon: 'schedule' },
  { key: 'feedbacked', label: 'Feedbacked', icon: 'task_alt' },
  { key: 'removed', label: 'Removed', icon: 'delete_outline' }
];
const HELP_CENTER_SECTIONS: HelpCenterSection[] = [
  {
    id: 'events',
    icon: 'event_note',
    title: 'Events and Sub Events',
    blurb: 'Build the full event flow with stages or optional items.',
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
  activityRatingScale: ACTIVITY_RATING_SCALE,
  calendarWeekdayLabels: CALENDAR_WEEKDAY_LABELS,
  eventVisibilityOptions: EVENT_VISIBILITY_OPTIONS,
  eventBlindModeOptions: EVENT_BLIND_MODE_OPTIONS,
  subEventResourceFilterOptions: SUB_EVENT_RESOURCE_FILTER_OPTIONS,
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
  helpCenterSections: HELP_CENTER_SECTIONS
};
