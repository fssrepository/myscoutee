import type {
  AssetFilterType,
  AssetType,
  DetailPrivacy,
  EventBlindMode,
  EventFeedbackListFilter,
  EventFeedbackOption,
  EventVisibility,
  ExperienceEntry,
  HelpCenterSection,
  InterestOptionGroup,
  ProfileStatus,
  SubEventsDisplayMode,
  TournamentLeaderboardType,
  ValuesOptionGroup
} from './core/base/models';

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
const EXPERIENCE_FILTER_OPTIONS: Array<'All' | 'Workspace' | 'School'> = ['All', 'Workspace', 'School'];
const EXPERIENCE_TYPE_OPTIONS: Array<ExperienceEntry['type']> = ['Workspace', 'School', 'Online Session', 'Additional Project'];
const ASSET_TYPE_OPTIONS: AssetType[] = ['Car', 'Accommodation', 'Supplies'];
const ASSET_FILTER_OPTIONS: AssetFilterType[] = ['Car', 'Accommodation', 'Supplies', 'Ticket'];
const ACTIVITY_RATING_SCALE = Array.from({ length: 10 }, (_, index) => index + 1);
const CALENDAR_WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EVENT_VISIBILITY_OPTIONS: EventVisibility[] = ['Public', 'Friends only', 'Invitation only'];
const EVENT_BLIND_MODE_OPTIONS: EventBlindMode[] = ['Open Event', 'Blind Event'];
const SUB_EVENTS_DISPLAY_MODE_OPTIONS: SubEventsDisplayMode[] = ['Casual', 'Tournament'];
const TOURNAMENT_LEADERBOARD_TYPE_OPTIONS: TournamentLeaderboardType[] = ['Score', 'Fifa'];
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
  physiqueOptions: PHYSIQUE_OPTIONS,
  languageSuggestions: LANGUAGE_SUGGESTIONS,
  profileStatusOptions: PROFILE_STATUS_OPTIONS,
  profileDetailValueOptions: PROFILE_DETAIL_VALUE_OPTIONS,
  beliefsValuesOptionGroups: BELIEFS_VALUES_OPTION_GROUPS,
  interestOptionGroups: INTEREST_OPTION_GROUPS,
  detailPrivacyOptions: DETAIL_PRIVACY_OPTIONS,
  experienceFilterOptions: EXPERIENCE_FILTER_OPTIONS,
  experienceTypeOptions: EXPERIENCE_TYPE_OPTIONS,
  assetTypeOptions: ASSET_TYPE_OPTIONS,
  assetFilterOptions: ASSET_FILTER_OPTIONS,
  activityRatingScale: ACTIVITY_RATING_SCALE,
  calendarWeekdayLabels: CALENDAR_WEEKDAY_LABELS,
  eventVisibilityOptions: EVENT_VISIBILITY_OPTIONS,
  eventBlindModeOptions: EVENT_BLIND_MODE_OPTIONS,
  subEventsDisplayModeOptions: SUB_EVENTS_DISPLAY_MODE_OPTIONS,
  tournamentLeaderboardTypeOptions: TOURNAMENT_LEADERBOARD_TYPE_OPTIONS,
  reportUserReasons: REPORT_USER_REASONS,
  feedbackCategories: FEEDBACK_CATEGORIES,
  eventFeedbackEventOverallOptions: EVENT_FEEDBACK_EVENT_OVERALL_OPTIONS,
  eventFeedbackHostImproveOptions: EVENT_FEEDBACK_HOST_IMPROVE_OPTIONS,
  eventFeedbackAttendeeCollabOptions: EVENT_FEEDBACK_ATTENDEE_COLLAB_OPTIONS,
  eventFeedbackAttendeeRejoinOptions: EVENT_FEEDBACK_ATTENDEE_REJOIN_OPTIONS,
  eventFeedbackListFilters: EVENT_FEEDBACK_LIST_FILTERS,
  helpCenterSections: HELP_CENTER_SECTIONS
};
