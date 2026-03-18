export interface DemoUser {
  id: string;
  name: string;
  age: number;
  birthday: string;
  city: string;
  height: string;
  physique: string;
  languages: string[];
  horoscope: string;
  initials: string;
  gender: 'woman' | 'man';
  statusText: string;
  hostTier: string;
  traitLabel: string;
  completion: number;
  headline: string;
  about: string;
  images?: string[];
  profileStatus: 'public' | 'friends only' | 'host only' | 'inactive';
  activities: {
    game: number;
    chat: number;
    invitations: number;
    events: number;
    hosting: number;
  };
}

export interface ChatMenuItem {
  id: string;
  avatar: string;
  title: string;
  lastMessage: string;
  lastSenderId: string;
  memberIds: string[];
  unread: number;
  channelType?: 'general' | 'mainEvent' | 'optionalSubEvent' | 'groupSubEvent';
  eventId?: string;
  subEventId?: string;
  groupId?: string;
}

export interface InvitationMenuItem {
  id: string;
  avatar: string;
  inviter: string;
  description: string;
  when: string;
  unread: number;
}

export interface EventMenuItem {
  id: string;
  avatar: string;
  title: string;
  shortDescription: string;
  timeframe: string;
  activity: number;
  isAdmin: boolean;
  creatorUserId?: string;
  startAt?: string;
  endAt?: string;
  distanceKm?: number;
  visibility?: 'Public' | 'Friends only' | 'Invitation only';
  blindMode?: 'Open Event' | 'Blind Event';
  imageUrl?: string;
  sourceLink?: string;
  location?: string;
  capacityMin?: number | null;
  capacityMax?: number | null;
  topics?: string[];
  rating?: number;
  relevance?: number;
  published?: boolean;
}

export interface HostingMenuItem {
  id: string;
  avatar: string;
  title: string;
  shortDescription: string;
  timeframe: string;
  activity: number;
  creatorUserId?: string;
  startAt?: string;
  endAt?: string;
  distanceKm?: number;
  visibility?: 'Public' | 'Friends only' | 'Invitation only';
  blindMode?: 'Open Event' | 'Blind Event';
  imageUrl?: string;
  sourceLink?: string;
  location?: string;
  capacityMin?: number | null;
  capacityMax?: number | null;
  topics?: string[];
  rating?: number;
  relevance?: number;
  published?: boolean;
}

export interface RateMenuItem {
  id: string;
  userId: string;
  secondaryUserId?: string;
  mode: 'individual' | 'pair';
  direction: 'given' | 'received' | 'mutual' | 'met';
  scoreGiven: number;
  scoreReceived: number;
  eventName: string;
  happenedAt: string;
  distanceKm: number;
  distanceMetersExact?: number;
}

export interface ProfileRow {
  label: string;
  value: string;
  privacy: 'Public' | 'Friends' | 'Hosts' | 'Private';
}

export interface ProfileGroup {
  title: string;
  rows: ProfileRow[];
}

export function buildDemoPortraitStack(
  gender: DemoUser['gender'],
  seedIndex: number,
  count = 3
): string[] {
  const normalizedCount = Math.max(1, Math.min(8, Math.trunc(count)));
  const folder = gender === 'woman' ? 'women' : 'men';
  const normalizedSeed = ((Math.trunc(seedIndex) % 100) + 100) % 100;
  const indexes: number[] = [];

  for (let offset = 0; offset < 8 && indexes.length < normalizedCount; offset += 1) {
    const candidate = (normalizedSeed + offset * 17) % 100;
    if (!indexes.includes(candidate)) {
      indexes.push(candidate);
    }
  }

  return indexes.map(index => `https://randomuser.me/api/portraits/${folder}/${index}.jpg`);
}

export const DEMO_USERS: DemoUser[] = [
  {
    id: 'u1',
    name: 'Farkas Anna',
    age: 28,
    birthday: '1997-05-12',
    city: 'Austin',
    height: '170 cm',
    physique: 'Athletic',
    languages: ['English', 'Spanish'],
    horoscope: 'Taurus',
    initials: 'FA',
    gender: 'woman',
    statusText: 'Recently Active',
    hostTier: 'Platinum Host',
    traitLabel: 'Empatikus',
    completion: 72,
    headline: 'Planning cozy chaos with structure.',
    about: 'I host events where social energy stays high, but logistics stay clean and predictable.',
    images: buildDemoPortraitStack('woman', 74),
    profileStatus: 'public',
    activities: { game: 9, chat: 8, invitations: 4, events: 6, hosting: 3 }
  },
  {
    id: 'u2',
    name: 'Kiss Balázs',
    age: 31,
    birthday: '1994-09-23',
    city: 'Chicago',
    height: '182 cm',
    physique: 'Lean',
    languages: ['English', 'Hungarian'],
    horoscope: 'Libra',
    initials: 'KB',
    gender: 'man',
    statusText: 'Recently Active',
    hostTier: 'Gold Host',
    traitLabel: 'Megbízható',
    completion: 64,
    headline: 'Reliable planning, zero drama.',
    about: 'I like compact events with clear timelines and simple role assignment.',
    images: buildDemoPortraitStack('man', 75),
    profileStatus: 'friends only',
    activities: { game: 4, chat: 3, invitations: 1, events: 2, hosting: 1 }
  },
  {
    id: 'u3',
    name: 'Nagy Eszter',
    age: 30,
    birthday: '1995-07-19',
    city: 'Seattle',
    height: '168 cm',
    physique: 'Fit',
    languages: ['English', 'Hungarian'],
    horoscope: 'Cancer',
    initials: 'NE',
    gender: 'woman',
    statusText: 'Recently Active',
    hostTier: 'Silver Host',
    traitLabel: 'Kreatív',
    completion: 58,
    headline: 'Art nights and adventure mornings.',
    about: 'I enjoy cultural events and activity-heavy weekends with small groups.',
    images: buildDemoPortraitStack('woman', 76),
    profileStatus: 'friends only',
    activities: { game: 6, chat: 7, invitations: 3, events: 4, hosting: 2 }
  },
  {
    id: 'u4',
    name: 'Maya Stone',
    age: 29,
    birthday: '1996-11-04',
    city: 'San Diego',
    height: '172 cm',
    physique: 'Athletic',
    languages: ['English'],
    horoscope: 'Scorpio',
    initials: 'MS',
    gender: 'woman',
    statusText: 'Recently Active',
    hostTier: 'Gold Host',
    traitLabel: 'Social Charmer',
    completion: 76,
    headline: 'Sunset rides and coffee circles.',
    about: 'I host social-first events where people who do not know each other can connect fast.',
    images: buildDemoPortraitStack('woman', 77),
    profileStatus: 'public',
    activities: { game: 7, chat: 5, invitations: 3, events: 5, hosting: 2 }
  },
  {
    id: 'u5',
    name: 'Lina Park',
    age: 27,
    birthday: '1998-02-21',
    city: 'Denver',
    height: '167 cm',
    physique: 'Slim',
    languages: ['English', 'Korean'],
    horoscope: 'Pisces',
    initials: 'LP',
    gender: 'woman',
    statusText: 'Recently Active',
    hostTier: 'Silver Host',
    traitLabel: 'Deep Thinker',
    completion: 68,
    headline: 'Thoughtful plans, minimal noise.',
    about: 'I prefer meaningful conversations and smaller events with quality curation.',
    images: buildDemoPortraitStack('woman', 78),
    profileStatus: 'host only',
    activities: { game: 5, chat: 6, invitations: 4, events: 4, hosting: 1 }
  },
  {
    id: 'u6',
    name: 'Iris Bloom',
    age: 26,
    birthday: '1999-08-14',
    city: 'Miami',
    height: '169 cm',
    physique: 'Curvy',
    languages: ['English', 'Portuguese'],
    horoscope: 'Leo',
    initials: 'IB',
    gender: 'woman',
    statusText: 'Recently Active',
    hostTier: 'Bronze Host',
    traitLabel: 'Adventurer',
    completion: 55,
    headline: 'Travel light, host well.',
    about: 'I organize active and travel-style events with flexible participant roles.',
    images: buildDemoPortraitStack('woman', 79),
    profileStatus: 'public',
    activities: { game: 3, chat: 4, invitations: 2, events: 3, hosting: 1 }
  },
  {
    id: 'u7',
    name: 'Noah Hart',
    age: 30,
    birthday: '1995-03-07',
    city: 'New York',
    height: '184 cm',
    physique: 'Athletic',
    languages: ['English'],
    horoscope: 'Pisces',
    initials: 'NH',
    gender: 'man',
    statusText: 'Recently Active',
    hostTier: 'Gold Host',
    traitLabel: 'Playful Spirit',
    completion: 70,
    headline: 'Fast pace, good vibes.',
    about: 'I host sports and game-heavy events with structured follow-ups.',
    images: buildDemoPortraitStack('man', 80),
    profileStatus: 'public',
    activities: { game: 8, chat: 9, invitations: 3, events: 5, hosting: 2 }
  },
  {
    id: 'u8',
    name: 'Evan Reed',
    age: 32,
    birthday: '1993-12-28',
    city: 'Boston',
    height: '180 cm',
    physique: 'Average',
    languages: ['English', 'French'],
    horoscope: 'Capricorn',
    initials: 'ER',
    gender: 'man',
    statusText: 'Recently Active',
    hostTier: 'Silver Host',
    traitLabel: 'Ambitious Go-Getter',
    completion: 61,
    headline: 'Metrics first, then movement.',
    about: 'I optimize event outcomes and participant quality through filtered invites.',
    images: buildDemoPortraitStack('man', 81),
    profileStatus: 'friends only',
    activities: { game: 4, chat: 4, invitations: 2, events: 3, hosting: 2 }
  },
  {
    id: 'u9',
    name: 'Kai Morgan',
    age: 25,
    birthday: '2000-04-18',
    city: 'Portland',
    height: '178 cm',
    physique: 'Slim',
    languages: ['English'],
    horoscope: 'Aries',
    initials: 'KM',
    gender: 'man',
    statusText: 'Recently Active',
    hostTier: 'Bronze Host',
    traitLabel: 'Creative Soul',
    completion: 53,
    headline: 'Design-led hangouts only.',
    about: 'I design event atmospheres first and build flow around people and space.',
    images: buildDemoPortraitStack('man', 82),
    profileStatus: 'host only',
    activities: { game: 2, chat: 5, invitations: 2, events: 2, hosting: 1 }
  },
  {
    id: 'u10',
    name: 'Luca Hale',
    age: 29,
    birthday: '1996-01-11',
    city: 'Los Angeles',
    height: '183 cm',
    physique: 'Fit',
    languages: ['English', 'Italian'],
    horoscope: 'Capricorn',
    initials: 'LH',
    gender: 'man',
    statusText: 'Recently Active',
    hostTier: 'Gold Host',
    traitLabel: 'Reliable One',
    completion: 74,
    headline: 'Always on time, always clear.',
    about: 'I keep the calendar strict and communication transparent for all members.',
    images: buildDemoPortraitStack('man', 10),
    profileStatus: 'public',
    activities: { game: 6, chat: 4, invitations: 2, events: 6, hosting: 3 }
  },
  {
    id: 'u11',
    name: 'Theo Lane',
    age: 33,
    birthday: '1992-10-02',
    city: 'Nashville',
    height: '186 cm',
    physique: 'Athletic',
    languages: ['English'],
    horoscope: 'Libra',
    initials: 'TL',
    gender: 'man',
    statusText: 'Recently Active',
    hostTier: 'Silver Host',
    traitLabel: 'Deep Thinker',
    completion: 60,
    headline: 'Calm planning for complex events.',
    about: 'I run long-format events with multiple sub-events and role-based access.',
    images: buildDemoPortraitStack('man', 11),
    profileStatus: 'friends only',
    activities: { game: 5, chat: 3, invitations: 2, events: 4, hosting: 2 }
  },
  {
    id: 'u12',
    name: 'Milo Grant',
    age: 27,
    birthday: '1998-06-27',
    city: 'Phoenix',
    height: '176 cm',
    physique: 'Average',
    languages: ['English', 'Spanish'],
    horoscope: 'Cancer',
    initials: 'MG',
    gender: 'man',
    statusText: 'Recently Active',
    hostTier: 'Bronze Host',
    traitLabel: 'Social Charmer',
    completion: 66,
    headline: 'Curated nights, meaningful circles.',
    about: 'I host quality-first social events with strong moderation and feedback loops.',
    images: buildDemoPortraitStack('man', 12),
    profileStatus: 'public',
    activities: { game: 4, chat: 5, invitations: 3, events: 3, hosting: 1 }
  }
];

export const DEMO_CHAT_BY_USER: Record<string, ChatMenuItem[]> = {
  u1: [
    {
      id: 'c1',
      avatar: 'MS',
      title: 'Driver Split - Alpine Weekend',
      lastMessage: 'I can take one extra seat from downtown pickup.',
      lastSenderId: 'u5',
      memberIds: ['u5', 'u4', 'u10', 'u7'],
      unread: 5
    },
    {
      id: 'c2',
      avatar: 'NH',
      title: 'Padel Night Pair Room',
      lastMessage: 'Pair mode starts in 20 mins.',
      lastSenderId: 'u7',
      memberIds: ['u7', 'u6', 'u10', 'u3', 'u11'],
      unread: 2
    },
    {
      id: 'c3',
      avatar: 'LH',
      title: 'Host Circle Ops',
      lastMessage: '2 invites timed out. Should we rerun now?',
      lastSenderId: 'u10',
      memberIds: ['u10', 'u12', 'u8'],
      unread: 1
    }
  ],
  u2: [
    {
      id: 'c4',
      avatar: 'IB',
      title: 'City Brunch - Main Room',
      lastMessage: 'Table booked for 12:30.',
      lastSenderId: 'u6',
      memberIds: ['u6', 'u4', 'u1'],
      unread: 2
    }
  ],
  u3: [
    {
      id: 'c5',
      avatar: 'LP',
      title: 'Trail Group - Transport',
      lastMessage: 'Need one more car seat.',
      lastSenderId: 'u5',
      memberIds: ['u5', 'u7', 'u10', 'u1'],
      unread: 4
    }
  ]
};

export const DEMO_INVITATIONS_BY_USER: Record<string, InvitationMenuItem[]> = {
  u1: [
    { id: 'i1', avatar: 'LP', inviter: 'Lina', description: 'Jazz Rooftop Session', when: 'Sat Feb 21, 8:00 PM', unread: 1 },
    { id: 'i2', avatar: 'NH', inviter: 'Noah', description: 'Open Padel Pairs', when: 'Sun Feb 22, 3:00 PM', unread: 1 },
    { id: 'i3', avatar: 'SY', inviter: 'System', description: 'Chat: Last-minute Ski Carpool', when: 'Sat Feb 21, 9:15 AM', unread: 2 }
  ],
  u2: [{ id: 'i4', avatar: 'MS', inviter: 'Maya', description: 'Foodie Crawl Team', when: 'Sun Feb 22, 6:30 PM', unread: 1 }],
  u3: [{ id: 'i5', avatar: 'LH', inviter: 'Luca', description: 'Urban Photo Sprint', when: 'Mon Feb 23, 6:00 PM', unread: 1 }]
};

export const DEMO_EVENTS_BY_USER: Record<string, EventMenuItem[]> = {
  u1: [
    {
      id: 'e1',
      avatar: 'SY',
      title: 'Alpine Weekend 2.0',
      shortDescription: 'Multi-day ski meetup with social dinner and pair game.',
      timeframe: 'Feb 27 - Mar 1',
      activity: 4,
      isAdmin: true
    },
    {
      id: 'e2',
      avatar: 'SY',
      title: 'Urban Photo Marathon',
      shortDescription: 'Creative city walk with checkpoints and mini challenges.',
      timeframe: 'Mar 8 · 10:00 AM - 7:00 PM',
      activity: 1,
      isAdmin: false,
      creatorUserId: 'u10'
    },
    {
      id: 'e3',
      avatar: 'SY',
      title: 'Night Food League',
      shortDescription: 'Three-spot tasting route with ranking and vibe voting.',
      timeframe: 'Mar 12 · 7:30 PM - 11:30 PM',
      activity: 3,
      isAdmin: false,
      creatorUserId: 'u3'
    },
    {
      id: 'e6',
      avatar: 'SY',
      title: 'Sunset Beach Volley',
      shortDescription: 'Casual teams, rotation rounds, and post-game snacks.',
      timeframe: 'Mar 14 · 5:00 PM - 8:30 PM',
      activity: 2,
      isAdmin: false,
      creatorUserId: 'u4'
    },
    {
      id: 'e7',
      avatar: 'SY',
      title: 'Coffee + Book Swap',
      shortDescription: 'Small-circle meetup with curated intro prompts.',
      timeframe: 'Mar 16 · 9:30 AM - 11:30 AM',
      activity: 1,
      isAdmin: true
    },
    {
      id: 'e8',
      avatar: 'SY',
      title: 'Lakeside Walk Lab',
      shortDescription: 'Guided walk with paired mini-conversations.',
      timeframe: 'Feb 27 · 11:15 AM - 1:00 PM',
      activity: 2,
      isAdmin: false,
      creatorUserId: 'u12'
    },
    {
      id: 'e9',
      avatar: 'SY',
      title: 'Brunch Rotation',
      shortDescription: 'Table rotations every 20 minutes for fresh intros.',
      timeframe: 'Feb 27 · 1:30 PM - 3:30 PM',
      activity: 3,
      isAdmin: false,
      creatorUserId: 'u2'
    },
    {
      id: 'e10',
      avatar: 'SY',
      title: 'Golden Hour Meetup',
      shortDescription: 'Sunset meetup with check-in games and soft networking.',
      timeframe: 'Mar 14 · 6:15 PM - 8:45 PM',
      activity: 2,
      isAdmin: true
    },
    {
      id: 'e11',
      avatar: 'SY',
      title: 'Cross-Month Community Relay',
      shortDescription: 'Long-format challenge with rotating teams across multiple weekends.',
      timeframe: 'Mar 28 - May 6',
      activity: 5,
      isAdmin: true
    },
    {
      id: 'e12',
      avatar: 'SY',
      title: 'Spring Cohort Journey',
      shortDescription: 'Multi-stage mentorship/event arc with check-ins and shared tasks.',
      timeframe: 'Apr 26 - Jun 2',
      activity: 4,
      isAdmin: false,
      creatorUserId: 'u6'
    }
  ],
  u2: [
    {
      id: 'e4',
      avatar: 'SY',
      title: 'Sunrise Run + Brunch',
      shortDescription: 'Easy pace run and social brunch with optional pair mode.',
      timeframe: 'Feb 28 · 8:00 AM - 12:00 PM',
      activity: 2,
      isAdmin: true
    }
  ],
  u3: [
    {
      id: 'e5',
      avatar: 'SY',
      title: 'Creative Studio Meetup',
      shortDescription: 'Hands-on session and portfolio exchange for creators.',
      timeframe: 'Mar 3 · 6:00 PM - 10:00 PM',
      activity: 2,
      isAdmin: false,
      creatorUserId: 'u11'
    }
  ]
};

export const DEMO_HOSTING_BY_USER: Record<string, HostingMenuItem[]> = {
  u1: [
    {
      id: 'h1',
      avatar: 'FA',
      title: 'Weekly Padel League',
      shortDescription: 'Own recurring event with two sub-events and tournament mode.',
      timeframe: 'Every Fri · 6:00 PM',
      activity: 3
    },
    {
      id: 'h2',
      avatar: 'FA',
      title: 'Spring City Festival Crew',
      shortDescription: 'Own hosted event, pending join requests and role assignments.',
      timeframe: 'Apr 4 · 4:00 PM - 11:00 PM',
      activity: 2
    }
  ],
  u2: [
    {
      id: 'h3',
      avatar: 'KB',
      title: 'Sunday Bike Social',
      shortDescription: 'Own hosted route event with optional accessories list.',
      timeframe: 'Every Sun · 9:30 AM',
      activity: 1
    }
  ],
  u3: [
    {
      id: 'h4',
      avatar: 'NE',
      title: 'Creative Nights Series',
      shortDescription: 'Own hosted monthly event, open applications pending.',
      timeframe: 'Monthly · First Thu',
      activity: 1
    }
  ]
};

export const PROFILE_PERSONALITY_TOP3 = [
  { icon: '🔥', label: 'Adventurer', percent: 60 },
  { icon: '🧠', label: 'Deep Thinker', percent: 30 },
  { icon: '💛', label: 'Empath', percent: 10 }
];

export const PROFILE_PRIORITY_TAGS = ['#Hiking', '#Music', '#Wellness', '#FamilyOriented', '#Entrepreneurship'];

export const PROFILE_PILLARS = [
  { title: 'Social & Lifestyle', tags: ['#GoingOut', '#Brunch', '#CoffeeDates', '#Nightlife'] },
  { title: 'Arts & Entertainment', tags: ['#Music', '#Movies', '#Photography', '#Books'] },
  { title: 'Food & Experiences', tags: ['#Foodie', '#FineDining', '#Travel', '#StreetFood'] },
  { title: 'Active & Adventure', tags: ['#Sports', '#Gym', '#Hiking', '#Outdoors'] },
  { title: 'Mind & Wellness', tags: ['#Wellness', '#Meditation', '#MentalHealth', '#SelfDevelopment'] },
  { title: 'Values & Identity', tags: ['#FamilyOriented', '#Entrepreneurship', '#Sustainability', '#Tech'] }
];

export const PROFILE_DETAILS: ProfileGroup[] = [
  {
    title: 'Basics',
    rows: [
      { label: 'Name', value: 'Farkas Anna', privacy: 'Public' },
      { label: 'City', value: 'Austin', privacy: 'Public' },
      { label: 'Birthday', value: 'May 12, 1997', privacy: 'Friends' },
      { label: 'Height', value: '170 cm', privacy: 'Friends' },
      { label: 'Physique', value: 'Athletic', privacy: 'Friends' },
      { label: 'Languages', value: 'English, Spanish', privacy: 'Public' },
      { label: 'Horoscope', value: 'Taurus', privacy: 'Public' }
    ]
  },
  {
    title: 'Lifestyle',
    rows: [
      { label: 'Interest', value: '#GoingOut, #Music, #Sports', privacy: 'Friends' },
      { label: 'Drinking', value: 'Socially', privacy: 'Friends' },
      { label: 'Smoking', value: 'Never', privacy: 'Friends' },
      { label: 'Workout', value: '4x / week', privacy: 'Public' },
      { label: 'Pets', value: 'Dog-friendly', privacy: 'Public' }
    ]
  },
  {
    title: 'Relationships',
    rows: [
      { label: 'Family plans', value: 'Wants children', privacy: 'Hosts' },
      { label: 'Children', value: 'No', privacy: 'Private' },
      { label: 'Love style', value: 'Long-term partnership', privacy: 'Hosts' },
      { label: 'Communication style', value: 'Direct + warm', privacy: 'Friends' },
      { label: 'Sexual orientation', value: 'Straight', privacy: 'Hosts' },
      { label: 'Gender', value: 'Woman', privacy: 'Public' }
    ]
  },
  {
    title: 'Beliefs',
    rows: [
      { label: 'Religion', value: 'Spiritual but not religious', privacy: 'Private' },
      { label: 'Values', value: 'Family-first, Social impact oriented, Balanced lifestyle', privacy: 'Friends' }
    ]
  }
];

export const PROFILE_EXPERIENCE = [
  { place: 'Northwind Labs', role: 'Product Manager', years: '2021 - Present', city: 'Austin' },
  { place: 'State University', role: 'BSc Computer Science', years: '2014 - 2018', city: 'Austin', socialProof: '126 users studied here' },
  { place: 'Studio Tide', role: 'Community Lead', years: '2018 - 2021', city: 'Chicago' }
];

export const EVENT_EDITOR_SAMPLE = {
  mainEvent: {
    title: 'Alpine Weekend 2.0',
    visibility: 'Invitation only',
    frequency: 'One-time',
    mode: 'In person',
    ticket: 'Optional ticket',
    topics: ['#Sports', '#Outdoors', '#Travel'],
    capacity: 28,
    expense: '190 USD'
  },
  subEvents: [
    {
      id: 'se1',
      title: 'Arrival + Allocation',
      when: 'Feb 27 · 4:00 PM - 8:00 PM',
      phase: 'Preparation',
      requirements: {
        cars: '4 / 6',
        accommodation: '24 / 28',
        accessories: '11 / 14'
      }
    },
    {
      id: 'se2',
      title: 'Tournament Day',
      when: 'Feb 28 · 9:00 AM - 6:00 PM',
      phase: 'Tournament',
      requirements: {
        cars: '6 / 6',
        accommodation: '28 / 28',
        accessories: '14 / 14'
      }
    }
  ],
  cars: [
    { owner: 'Maya Stone', seats: '3 / 4', route: 'Austin center -> Lodge', contact: '+1 555-0104' },
    { owner: 'Noah Hart', seats: '2 / 4', route: 'Airport -> Lodge', contact: '+1 555-0148' }
  ],
  accommodations: [
    { name: 'Alpine View House', rooms: '5 rooms', people: '14 people', link: 'booking.com/alpine-view' },
    { name: 'Lake Cabin', rooms: '3 rooms', people: '10 people', link: 'booking.com/lake-cabin' }
  ],
  accessories: [
    { item: 'Food packs', required: 14, offered: 11 },
    { item: 'Medical kit', required: 3, offered: 2 },
    { item: 'Board games', required: 4, offered: 5 }
  ],
  members: [
    { name: 'Farkas Anna', role: 'Admin' },
    { name: 'Noah Hart', role: 'Member' },
    { name: 'Lina Park', role: 'Member' }
  ]
};

export const DEMO_ACTIVITIES_PRIMARY_FILTERS: Array<{
  key: 'rates' | 'chats' | 'invitations' | 'events' | 'hosting';
  label: string;
  icon: string;
}> = [
  { key: 'rates', label: 'Rates', icon: 'star' },
  { key: 'chats', label: 'Chats', icon: 'chat' },
  { key: 'invitations', label: 'Invitations', icon: 'mail' },
  { key: 'events', label: 'Events', icon: 'event' },
  { key: 'hosting', label: 'Hosting', icon: 'stadium' }
];

export const DEMO_ACTIVITIES_SECONDARY_FILTERS: Array<{
  key: 'recent' | 'relevant' | 'past';
  label: string;
  icon: string;
}> = [
  { key: 'recent', label: 'Upcoming', icon: 'schedule' },
  { key: 'relevant', label: 'Relevant', icon: 'auto_awesome' },
  { key: 'past', label: 'Past', icon: 'history' }
];

export const DEMO_ACTIVITIES_CHAT_CONTEXT_FILTERS: Array<{
  key: 'all' | 'event' | 'subEvent' | 'group';
  label: string;
  icon: string;
}> = [
  { key: 'all', label: 'All', icon: 'forum' },
  { key: 'event', label: 'Event', icon: 'event' },
  { key: 'subEvent', label: 'Sub event', icon: 'event_available' },
  { key: 'group', label: 'Group', icon: 'groups' }
];

export const DEMO_RATE_FILTERS: Array<{
  key: 'individual-given' | 'individual-received' | 'individual-mutual' | 'individual-met' | 'pair-given' | 'pair-received';
  label: string;
}> = [
  { key: 'individual-given', label: 'Given' },
  { key: 'individual-received', label: 'Received' },
  { key: 'individual-mutual', label: 'Mutual' },
  { key: 'individual-met', label: 'Met' },
  { key: 'pair-given', label: 'Given' },
  { key: 'pair-received', label: 'Received' }
];

export const DEMO_RATE_FILTER_ENTRIES: Array<
  | { kind: 'group'; label: string }
  | {
    kind: 'item';
    key: 'individual-given' | 'individual-received' | 'individual-mutual' | 'individual-met' | 'pair-given' | 'pair-received';
    label: string;
  }
> = [
  { kind: 'group', label: 'Single Rate' },
  { kind: 'item', key: 'individual-given', label: 'Given' },
  { kind: 'item', key: 'individual-received', label: 'Received' },
  { kind: 'item', key: 'individual-mutual', label: 'Mutual' },
  { kind: 'item', key: 'individual-met', label: 'Met' },
  { kind: 'group', label: 'Pair Rate' },
  { kind: 'item', key: 'pair-given', label: 'Given' },
  { kind: 'item', key: 'pair-received', label: 'Received' }
];

export const DEMO_ACTIVITIES_VIEW_OPTIONS: Array<{
  key: 'month' | 'week' | 'day' | 'distance';
  label: string;
  icon: string;
}> = [
  { key: 'month', label: 'Month', icon: 'calendar_month' },
  { key: 'week', label: 'Week', icon: 'date_range' },
  { key: 'day', label: 'Day', icon: 'today' },
  { key: 'distance', label: 'Distance', icon: 'social_distance' }
];

export const DEMO_EVENT_EXPLORE_ORDER_OPTIONS: Array<{
  key: 'upcoming' | 'past-events' | 'nearby' | 'most-relevant' | 'top-rated';
  label: string;
  icon: string;
}> = [
  { key: 'upcoming', label: 'Upcoming', icon: 'event_upcoming' },
  { key: 'past-events', label: 'Past Events', icon: 'history' },
  { key: 'nearby', label: 'Nearby', icon: 'near_me' },
  { key: 'most-relevant', label: 'Most Relevant', icon: 'auto_awesome' },
  { key: 'top-rated', label: 'Top Rated', icon: 'emoji_events' }
];

export const DEMO_EVENT_DATES_BY_ID: Record<string, string> = {
  e1: '2026-02-27T09:00:00',
  e2: '2026-03-08T10:00:00',
  e3: '2026-03-12T19:30:00',
  e6: '2026-03-14T17:00:00',
  e7: '2026-03-16T09:30:00',
  e8: '2026-02-27T11:15:00',
  e9: '2026-02-27T13:30:00',
  e10: '2026-03-14T18:15:00',
  e11: '2026-03-28T09:00:00',
  e12: '2026-04-26T10:00:00',
  e4: '2026-02-28T08:00:00',
  e5: '2026-03-03T18:00:00'
};

export const DEMO_HOSTING_DATES_BY_ID: Record<string, string> = {
  h1: '2026-02-27T18:00:00',
  h2: '2026-04-04T16:00:00',
  h3: '2026-03-01T09:30:00',
  h4: '2026-03-05T18:00:00'
};

export const DEMO_EVENT_VISIBILITY_BY_ID: Record<string, 'Public' | 'Friends only' | 'Invitation only'> = {
  e1: 'Invitation only',
  e2: 'Public',
  e3: 'Friends only',
  e4: 'Invitation only',
  e5: 'Friends only',
  e6: 'Public',
  e7: 'Invitation only',
  e8: 'Public',
  e9: 'Friends only',
  e10: 'Invitation only',
  e11: 'Friends only',
  e12: 'Public',
  h1: 'Invitation only',
  h2: 'Friends only',
  h3: 'Public',
  h4: 'Friends only'
};

export const DEMO_EVENT_BLIND_MODE_BY_ID: Record<string, 'Open Event' | 'Blind Event'> = {
  e1: 'Open Event',
  e2: 'Open Event',
  e3: 'Blind Event',
  e4: 'Open Event',
  e5: 'Open Event',
  e6: 'Blind Event',
  e7: 'Open Event',
  e8: 'Open Event',
  e9: 'Blind Event',
  e10: 'Open Event',
  e11: 'Open Event',
  e12: 'Blind Event',
  h1: 'Blind Event',
  h2: 'Open Event',
  h3: 'Open Event',
  h4: 'Blind Event'
};

export const DEMO_EVENT_AUTO_INVITER_BY_ID: Record<string, boolean> = {
  e1: true,
  e2: true,
  e3: false,
  e4: true,
  e5: false,
  e6: true,
  e7: true,
  e8: false,
  e9: false,
  e10: true,
  e11: true,
  e12: false,
  h1: true,
  h2: false,
  h3: true,
  h4: false
};

export const DEMO_EVENT_TICKETING_BY_ID: Record<string, boolean> = {
  e1: true,
  e2: true,
  e3: false,
  e4: false,
  e5: false,
  e6: false,
  e7: false,
  e8: false,
  e9: false,
  e10: false,
  e11: false,
  e12: false,
  h1: true,
  h2: false,
  h3: false,
  h4: false
};

export const DEMO_HOSTING_PUBLISHED_BY_ID: Record<string, boolean> = {
  e1: true,
  e4: true,
  e5: true,
  e7: false,
  e10: true,
  e11: false,
  h1: true,
  h2: true,
  h3: false,
  h4: false
};

export const DEMO_INVITATION_DATES_BY_ID: Record<string, string> = {
  i1: '2026-02-21T20:00:00',
  i2: '2026-02-22T15:00:00',
  i3: '2026-02-21T09:15:00',
  i4: '2026-02-22T18:30:00',
  i5: '2026-02-23T18:00:00'
};

export const DEMO_CHAT_DATES_BY_ID: Record<string, string> = {
  c1: '2026-02-21T09:11:00',
  c2: '2026-02-22T18:40:00',
  c3: '2026-02-23T10:09:00',
  c4: '2026-02-22T12:30:00',
  c5: '2026-02-23T17:40:00'
};

export const DEMO_CHAT_DISTANCE_BY_ID: Record<string, number> = {
  c1: 5,
  c2: 10,
  c3: 15,
  c4: 8,
  c5: 12
};

export const DEMO_INVITATION_DISTANCE_BY_ID: Record<string, number> = {
  i1: 10,
  i2: 15,
  i3: 5,
  i4: 12,
  i5: 18
};

export const DEMO_EVENT_DISTANCE_BY_ID: Record<string, number> = {
  e1: 20,
  e2: 10,
  e3: 15,
  e6: 35,
  e7: 45,
  e8: 20,
  e9: 20,
  e10: 35,
  e11: 30,
  e12: 40,
  e4: 5,
  e5: 25
};

export const DEMO_ACTIVITY_DATE_TIME_RANGE_BY_ID: Record<string, { startIso: string; endIso: string }> = {
  e1: { startIso: '2026-02-27T09:00:00', endIso: '2026-03-01T12:00:00' },
  e2: { startIso: '2026-03-08T10:00:00', endIso: '2026-03-08T19:00:00' },
  e3: { startIso: '2026-03-12T19:30:00', endIso: '2026-03-12T23:00:00' },
  e6: { startIso: '2026-03-14T17:00:00', endIso: '2026-03-14T20:30:00' },
  e7: { startIso: '2026-03-16T09:30:00', endIso: '2026-03-16T11:30:00' },
  e8: { startIso: '2026-02-27T11:15:00', endIso: '2026-02-27T13:00:00' },
  e9: { startIso: '2026-02-27T13:30:00', endIso: '2026-02-27T15:30:00' },
  e10: { startIso: '2026-03-14T18:15:00', endIso: '2026-03-14T21:15:00' },
  e11: { startIso: '2026-03-28T09:00:00', endIso: '2026-05-06T21:00:00' },
  e12: { startIso: '2026-04-26T10:00:00', endIso: '2026-06-02T20:00:00' },
  h1: { startIso: '2026-02-27T18:00:00', endIso: '2026-02-27T21:00:00' },
  h2: { startIso: '2026-04-04T16:00:00', endIso: '2026-04-04T20:00:00' },
  h3: { startIso: '2026-03-01T09:30:00', endIso: '2026-03-01T12:00:00' },
  h4: { startIso: '2026-03-05T18:00:00', endIso: '2026-03-05T21:00:00' }
};

export const DEMO_HOSTING_DISTANCE_BY_ID: Record<string, number> = {
  h1: 5,
  h2: 20,
  h3: 10,
  h4: 15
};

export const DEMO_ACTIVITY_IMAGE_BY_ID: Record<string, string> = {
  e1: 'https://picsum.photos/seed/event-e1/1200/700',
  e2: 'https://picsum.photos/seed/event-e2/1200/700',
  e3: 'https://picsum.photos/seed/event-e3/1200/700',
  e6: 'https://picsum.photos/seed/event-e6/1200/700',
  e7: 'https://picsum.photos/seed/event-e7/1200/700',
  e8: 'https://picsum.photos/seed/event-e8/1200/700',
  e9: 'https://picsum.photos/seed/event-e9/1200/700',
  e10: 'https://picsum.photos/seed/event-e10/1200/700',
  e11: 'https://picsum.photos/seed/event-e11/1200/700',
  e12: 'https://picsum.photos/seed/event-e12/1200/700',
  e4: 'https://picsum.photos/seed/event-e4/1200/700',
  e5: 'https://picsum.photos/seed/event-e5/1200/700',
  h1: 'https://picsum.photos/seed/event-h1/1200/700',
  h2: 'https://picsum.photos/seed/event-h2/1200/700',
  h3: 'https://picsum.photos/seed/event-h3/1200/700',
  h4: 'https://picsum.photos/seed/event-h4/1200/700',
  i1: 'https://picsum.photos/seed/event-i1/1200/700',
  i2: 'https://picsum.photos/seed/event-i2/1200/700',
  i3: 'https://picsum.photos/seed/event-i3/1200/700',
  i4: 'https://picsum.photos/seed/event-i4/1200/700',
  i5: 'https://picsum.photos/seed/event-i5/1200/700'
};

export const DEMO_ACTIVITY_SOURCE_LINK_BY_ID: Record<string, string> = {
  e1: 'https://example.com/events/e1',
  e2: 'https://example.com/events/e2',
  e3: 'https://example.com/events/e3',
  e6: 'https://example.com/events/e6',
  e7: 'https://example.com/events/e7',
  e8: 'https://example.com/events/e8',
  e9: 'https://example.com/events/e9',
  e10: 'https://example.com/events/e10',
  e11: 'https://example.com/events/e11',
  e12: 'https://example.com/events/e12',
  e4: 'https://example.com/events/e4',
  e5: 'https://example.com/events/e5',
  h1: 'https://example.com/hosting/h1',
  h2: 'https://example.com/hosting/h2',
  h3: 'https://example.com/hosting/h3',
  h4: 'https://example.com/hosting/h4',
  i1: 'https://example.com/invitations/i1',
  i2: 'https://example.com/invitations/i2',
  i3: 'https://example.com/invitations/i3',
  i4: 'https://example.com/invitations/i4',
  i5: 'https://example.com/invitations/i5'
};

export const DEMO_ACTIVITY_CAPACITY_BY_ID: Record<string, string> = {
  e1: '24 / 28',
  e2: '13 / 16',
  e3: '18 / 20',
  e6: '20 / 24',
  e7: '9 / 12',
  e8: '20 / 20',
  e9: '18 / 22',
  e10: '19 / 24',
  e11: '41 / 60',
  e12: '28 / 40',
  e4: '10 / 12',
  e5: '14 / 18',
  h1: '20 / 24',
  h2: '16 / 22',
  h3: '9 / 12',
  h4: '11 / 15',
  i1: '2 / 4',
  i2: '1 / 2',
  i3: '3 / 4',
  i4: '1 / 3',
  i5: '2 / 3'
};

export const DEMO_SUB_EVENT_RESOURCE_FILTER_OPTIONS: Array<'Members' | 'Car' | 'Accommodation' | 'Supplies'> = [
  'Members',
  'Car',
  'Accommodation',
  'Supplies'
];

export const DEMO_ACTIVITY_GROUP_LABELS = {
  dateUnavailable: 'Date unavailable',
  weekPrefix: 'Week'
};

export const DEMO_ACTIVITY_MEMBER_MET_PLACES = [
  'City Center Meetup',
  'Board Game Night',
  'Coffee Social',
  'Hiking Group',
  'Music Event',
  'Brunch Table'
];

export const DEMO_ACTIVITY_MEMBER_DEFAULTS = {
  forcedMetWhere: 'Event Explore'
};

export const APP_DEMO_DATA = {
  activitiesPrimaryFilters: DEMO_ACTIVITIES_PRIMARY_FILTERS,
  activitiesSecondaryFilters: DEMO_ACTIVITIES_SECONDARY_FILTERS,
  activitiesChatContextFilters: DEMO_ACTIVITIES_CHAT_CONTEXT_FILTERS,
  rateFilters: DEMO_RATE_FILTERS,
  rateFilterEntries: DEMO_RATE_FILTER_ENTRIES,
  activitiesViewOptions: DEMO_ACTIVITIES_VIEW_OPTIONS,
  eventExploreOrderOptions: DEMO_EVENT_EXPLORE_ORDER_OPTIONS,
  eventDatesById: DEMO_EVENT_DATES_BY_ID,
  hostingDatesById: DEMO_HOSTING_DATES_BY_ID,
  eventVisibilityById: DEMO_EVENT_VISIBILITY_BY_ID,
  eventBlindModeById: DEMO_EVENT_BLIND_MODE_BY_ID,
  eventAutoInviterById: DEMO_EVENT_AUTO_INVITER_BY_ID,
  eventTicketingById: DEMO_EVENT_TICKETING_BY_ID,
  hostingPublishedById: DEMO_HOSTING_PUBLISHED_BY_ID,
  invitationDatesById: DEMO_INVITATION_DATES_BY_ID,
  chatDatesById: DEMO_CHAT_DATES_BY_ID,
  chatDistanceById: DEMO_CHAT_DISTANCE_BY_ID,
  invitationDistanceById: DEMO_INVITATION_DISTANCE_BY_ID,
  eventDistanceById: DEMO_EVENT_DISTANCE_BY_ID,
  activityDateTimeRangeById: DEMO_ACTIVITY_DATE_TIME_RANGE_BY_ID,
  hostingDistanceById: DEMO_HOSTING_DISTANCE_BY_ID,
  activityImageById: DEMO_ACTIVITY_IMAGE_BY_ID,
  activitySourceLinkById: DEMO_ACTIVITY_SOURCE_LINK_BY_ID,
  activityCapacityById: DEMO_ACTIVITY_CAPACITY_BY_ID,
  subEventResourceFilterOptions: DEMO_SUB_EVENT_RESOURCE_FILTER_OPTIONS,
  activityGroupLabels: DEMO_ACTIVITY_GROUP_LABELS,
  activityMemberMetPlaces: DEMO_ACTIVITY_MEMBER_MET_PLACES,
  activityMemberDefaults: DEMO_ACTIVITY_MEMBER_DEFAULTS
};
