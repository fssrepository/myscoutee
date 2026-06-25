import type { ActivityEventRecordCollection } from '../../source/entity/event.entity';
import { APP_STATIC_DATA } from '../../../../app-static-data';
import { PricingBuilder } from '../../../base/builders/pricing.builder';
import { SeedEventBuilder } from './event-seed.builder';
import { SeedScheduleBuilder } from './seed-schedule.builder';
import { SeedUserBuilder } from './user-seed.builder';
import type * as AppTypes from '../../../base/models';
import type * as ContractTypes from '../../../contracts';
import { AppUtils } from '../../../../app-utils';
import type { UserDto } from '../../../contracts/user.interface';
import type { ActivityEventSeedItem, ActivityHostingSeedItem, ActivityInvitationSeedItem } from '../entity';
import type { LocationCoordinates } from '../../../contracts/user.interface';
import {
  ActivityEventDetailDTO,
  type ActivityEventRecord,
  type ActivityEventRepositoryItemType
} from '../../../contracts/activity.interface';

const DEMO_EVENT_MEMBER_USERS = SeedUserBuilder.buildExpandedDemoUsers(50)
  .filter(user => !SeedUserBuilder.isEmptyOnboardingProfileUserId(user.id));

function buildCheckoutDemoPolicies(): ContractTypes.EventPolicyDTO[] {
  return [
    {
      id: 'policy-checkin-window',
      title: 'Check-in window',
      description: 'Arrive within the first 15 minutes of the selected slot so the organizer can release late spots.',
      required: true
    },
    {
      id: 'policy-cancellation',
      title: 'Cancellation',
      description: 'Paid extras are refundable only until 24 hours before the selected slot starts.',
      required: true
    },
    {
      id: 'policy-media',
      title: 'Photos & recap',
      description: 'A private recap may be shared with attendees after the event.',
      required: false
    }
  ];
}

function buildCheckoutDemoPricing(
  basePrice: number,
  slotTemplates: readonly ContractTypes.EventSlotTemplateDTO[] = []
): ContractTypes.PricingConfig {
  const pricing = PricingBuilder.createSamplePricingConfig(slotTemplates.length > 0 ? 'hybrid' : 'fixed');
  pricing.enabled = true;
  pricing.basePrice = basePrice;
  pricing.minPrice = Math.max(0, basePrice - 12);
  pricing.maxPrice = basePrice + 48;
  pricing.currency = 'USD';
  pricing.chargeType = 'per_attendee';
  pricing.audience.enabled = false;
  pricing.audience.promoCodes = [];
  if (slotTemplates.length > 0) {
    pricing.slotPricingEnabled = true;
    pricing.slotOverrides = slotTemplates.map((slot, index) => ({
      id: `${slot.id}-override`,
      slotId: slot.id,
      label: `Slot ${index + 1}`,
      startAt: slot.startAt,
      endAt: null,
      price: basePrice + (index * 6),
      currency: 'USD'
    }));
  } else {
    pricing.slotPricingEnabled = false;
    pricing.slotOverrides = [];
  }
  return pricing;
}

function buildCheckoutDemoSubEventDefinitions(options: {
  sourceId: string;
  includePaidOptional: boolean;
}): ContractTypes.SubEventDefinitionDTO[] {
  const includedPricing = PricingBuilder.createDefaultPricingConfig('subevent');
  const paidAddOnPricing = PricingBuilder.createDefaultPricingConfig('subevent');
  paidAddOnPricing.enabled = options.includePaidOptional;
  paidAddOnPricing.basePrice = options.includePaidOptional ? 16 : 0;
  paidAddOnPricing.currency = 'USD';
  paidAddOnPricing.chargeType = 'per_booking';
  paidAddOnPricing.minPrice = options.includePaidOptional ? 12 : 0;
  paidAddOnPricing.maxPrice = options.includePaidOptional ? 24 : 0;

  const transportPricing = PricingBuilder.createDefaultPricingConfig('subevent');
  transportPricing.enabled = options.includePaidOptional;
  transportPricing.basePrice = options.includePaidOptional ? 8 : 0;
  transportPricing.currency = 'USD';
  transportPricing.chargeType = 'per_attendee';
  transportPricing.minPrice = options.includePaidOptional ? 6 : 0;
  transportPricing.maxPrice = options.includePaidOptional ? 12 : 0;

  return [
    {
      id: `${options.sourceId}-main-session`,
      name: 'Main Session',
      description: 'Included in the base event price and aligned to the selected slot.',
      timing: 'During',
      offsetMinutes: 0,
      durationMinutes: 75,
      optional: false,
      capacityMin: 0,
      capacityMax: 24,
      pricing: includedPricing
    },
    {
      id: `${options.sourceId}-vip-lounge`,
      name: options.includePaidOptional ? 'VIP Lounge Access' : 'Community Lounge Access',
      description: options.includePaidOptional
        ? 'Optional add-on with a separate basket line and accommodation request support.'
        : 'Optional free add-on for the slot-based join flow.',
      timing: 'During',
      offsetMinutes: 20,
      durationMinutes: 45,
      optional: true,
      capacityMin: 0,
      capacityMax: 10,
      pricing: paidAddOnPricing
    },
    {
      id: `${options.sourceId}-ride-share`,
      name: 'Ride-share Pickup',
      description: 'Optional transport-style add-on so checkout can show an asset request path too.',
      timing: 'During',
      offsetMinutes: 0,
      durationMinutes: 20,
      optional: true,
      capacityMin: 0,
      capacityMax: 12,
      pricing: transportPricing
    }
  ];
}

const SEED_INVITATIONS_BY_USER: Record<string, ActivityInvitationSeedItem[]> = {
  u1: [
    {
      id: 'i1',
      avatar: 'LP',
      inviter: 'Lina',
      description: 'Jazz Rooftop Session',
      when: 'Sat Feb 21, 8:00 PM',
      unread: 1,
      acceptedMemberUserIds: ['u5', 'u18', 'u19'],
      pendingMemberUserIds: ['u1', 'u20'],
      capacityTotal: 6,
      startAt: '2026-03-10T20:00:00',
      endAt: '2026-03-10T22:00:00'
    },
    {
      id: 'i2',
      avatar: 'NH',
      inviter: 'Noah',
      description: 'Open Padel Pairs',
      when: 'Sun Feb 22, 3:00 PM',
      unread: 1,
      acceptedMemberUserIds: ['u7', 'u21', 'u22'],
      pendingMemberUserIds: ['u1', 'u23'],
      capacityTotal: 6,
      startAt: '2026-03-11T15:00:00',
      endAt: '2026-03-11T17:30:00'
    },
    {
      id: 'i3',
      avatar: 'SY',
      inviter: 'System',
      description: 'Chat: Last-minute Ski Carpool',
      when: 'Sat Feb 21, 9:15 AM',
      unread: 2,
      acceptedMemberUserIds: ['u11', 'u24'],
      pendingMemberUserIds: ['u1', 'u25'],
      capacityTotal: 5,
      startAt: '2026-03-12T09:15:00',
      endAt: '2026-03-12T11:15:00'
    }
  ],
  u2: [{
    id: 'i4',
    avatar: 'MS',
    inviter: 'Maya',
    description: 'Foodie Crawl Team',
    when: 'Sun Feb 22, 6:30 PM',
    unread: 1,
    acceptedMemberUserIds: ['u4', 'u26', 'u27'],
    pendingMemberUserIds: ['u2', 'u28'],
    capacityTotal: 6,
    startAt: '2026-03-13T18:30:00',
    endAt: '2026-03-13T21:00:00'
  }],
  u3: [{
    id: 'i5',
    avatar: 'LH',
    inviter: 'Luca',
    description: 'Urban Photo Sprint',
    when: 'Mon Feb 23, 6:00 PM',
    unread: 1,
    acceptedMemberUserIds: ['u10', 'u29', 'u30'],
    pendingMemberUserIds: ['u3', 'u31'],
    capacityTotal: 6,
    startAt: '2026-03-14T18:00:00',
    endAt: '2026-03-14T20:00:00'
  }]
};

const SEED_EVENTS_BY_USER: Record<string, ActivityEventSeedItem[]> = {
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
      creatorUserId: 'u10',
      acceptedMemberUserIds: ['u10', 'u14', 'u15'],
      pendingMemberUserIds: ['u1', 'u16']
    },
    {
      id: 'e3',
      avatar: 'SY',
      title: 'Night Food League',
      shortDescription: 'Three-spot tasting route with ranking and vibe voting.',
      timeframe: 'Mar 12 · 7:30 PM - 11:30 PM',
      activity: 3,
      isAdmin: false,
      creatorUserId: 'u3',
      startAt: '2026-02-21T19:30:00',
      endAt: '2026-02-21T23:30:00'
    },
    {
      id: 'e6',
      avatar: 'SY',
      title: 'Sunset Beach Volley',
      shortDescription: 'Casual teams, rotation rounds, and post-game snacks.',
      timeframe: 'Mar 14 · 5:00 PM - 8:30 PM',
      activity: 2,
      isAdmin: false,
      creatorUserId: 'u4',
      startAt: '2026-02-23T17:00:00',
      endAt: '2026-02-23T20:30:00'
    },
    {
      id: 'e7',
      avatar: 'SY',
      title: 'Coffee + Book Swap',
      shortDescription: 'Small-circle meetup with curated intro prompts.',
      timeframe: 'Mar 16 · 9:30 AM - 11:30 AM',
      activity: 1,
      isAdmin: true,
      startAt: '2026-02-26T09:30:00',
      endAt: '2026-02-26T11:30:00'
    },
    {
      id: 'e8',
      avatar: 'SY',
      title: 'Lakeside Walk Lab',
      shortDescription: 'Guided walk with paired mini-conversations.',
      timeframe: 'Feb 27 · 11:15 AM - 1:00 PM',
      activity: 2,
      isAdmin: false,
      creatorUserId: 'u12',
      startAt: '2026-02-25T11:15:00',
      endAt: '2026-02-25T13:00:00'
    },
    {
      id: 'e9',
      avatar: 'SY',
      title: 'Brunch Rotation',
      shortDescription: 'Table rotations every 20 minutes for fresh intros.',
      timeframe: 'Feb 27 · 1:30 PM - 3:30 PM',
      activity: 3,
      isAdmin: false,
      creatorUserId: 'u2',
      startAt: '2026-02-27T13:30:00',
      endAt: '2026-02-27T15:30:00'
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
      isAdmin: false,
      creatorUserId: 'u13',
      startAt: '2026-02-24T08:00:00',
      endAt: '2026-02-24T12:00:00'
    },
    {
      id: 'e13',
      avatar: 'SY',
      title: 'Afterwork Tasting Circle',
      shortDescription: 'Host review pending while the guest list settles for tonight.',
      timeframe: 'Mar 11 · 6:30 PM - 9:30 PM',
      activity: 2,
      isAdmin: false,
      creatorUserId: 'u8',
      acceptedMemberUserIds: ['u8', 'u35', 'u36'],
      pendingMemberUserIds: ['u2', 'u37']
    },
    {
      id: 'waitlist-full-policy',
      avatar: 'SY',
      title: 'Full House Supper Club',
      shortDescription: 'A small paid table that is already full, useful for trying the wait-list flow.',
      timeframe: 'Apr 18 · 7:00 PM - 10:00 PM',
      activity: 4,
      isAdmin: true,
      creatorUserId: 'u2',
      startAt: '2026-04-18T19:00:00',
      endAt: '2026-04-18T22:00:00',
      frequency: 'One-time',
      ticketing: true,
      visibility: 'Public',
      blindMode: 'Open Event',
      location: 'Austin · Supper Club Kitchen',
      capacityMin: 4,
      capacityMax: 4,
      capacityTotal: 4,
      acceptedMemberUserIds: ['u2', 'u20', 'u21', 'u22'],
      pendingMemberUserIds: [],
      pricing: buildCheckoutDemoPricing(32),
      policies: buildCheckoutDemoPolicies(),
      topics: ['Food', 'Small Group', 'Waitlist'],
      rating: 9.4,
      boost: 100
    },
    {
      id: 'checkout-paid-slots',
      avatar: 'SY',
      title: 'Checkout Demo · Paid Multi-Slot',
      shortDescription: 'Choose a slot, approve policies, add optional paid extras, and continue to dummy pay.',
      timeframe: 'Apr 12 · multiple slots',
      activity: 3,
      isAdmin: false,
      creatorUserId: 'u2',
      startAt: '2026-04-12T18:00:00',
      endAt: '2026-06-14T23:00:00',
      frequency: 'Weekly',
      ticketing: true,
      visibility: 'Public',
      blindMode: 'Open Event',
      location: 'Austin · Checkout Demo Hall',
      capacityMin: 6,
      capacityMax: 18,
      acceptedMemberUserIds: ['u40', 'u41'],
      pendingMemberUserIds: ['u42'],
      slotsEnabled: true,
      slotTemplates: [
        {
          id: 'checkout-paid-slots-slot-1',
          startAt: '2026-04-12T18:30:00'
        },
        {
          id: 'checkout-paid-slots-slot-2',
          startAt: '2026-04-12T20:15:00'
        }
      ],
      pricing: buildCheckoutDemoPricing(38, [
        {
          id: 'checkout-paid-slots-slot-1',
          startAt: '2026-04-12T18:30:00'
        },
        {
          id: 'checkout-paid-slots-slot-2',
          startAt: '2026-04-12T20:15:00'
        }
      ]),
      policies: buildCheckoutDemoPolicies(),
      subEventDefinitions: buildCheckoutDemoSubEventDefinitions({
        sourceId: 'checkout-paid-slots',
        includePaidOptional: true
      }),
      rating: 9.2,
      boost: 99
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
      creatorUserId: 'u11',
      startAt: '2026-02-25T18:00:00',
      endAt: '2026-02-25T22:00:00'
    },
    {
      id: 'e14',
      avatar: 'SY',
      title: 'Moonlight Boardwalk Mixer',
      shortDescription: 'Approval queue is still open while the organizer finalizes the pair rotations.',
      timeframe: 'Mar 13 · 7:15 PM - 10:15 PM',
      activity: 2,
      isAdmin: false,
      creatorUserId: 'u7',
      acceptedMemberUserIds: ['u7', 'u38', 'u39'],
      pendingMemberUserIds: ['u3']
    },
    {
      id: 'waitlist-full-free',
      avatar: 'SY',
      title: 'Tiny Vinyl Listening Room',
      shortDescription: 'Free four-seat listening session with no open spots, seeded for wait-list testing.',
      timeframe: 'Apr 19 · 8:00 PM - 10:00 PM',
      activity: 3,
      isAdmin: true,
      creatorUserId: 'u3',
      startAt: '2026-04-19T20:00:00',
      endAt: '2026-04-19T22:00:00',
      frequency: 'One-time',
      ticketing: false,
      visibility: 'Public',
      blindMode: 'Open Event',
      location: 'Austin · Eastside Listening Room',
      capacityMin: 4,
      capacityMax: 4,
      capacityTotal: 4,
      acceptedMemberUserIds: ['u3', 'u23', 'u24', 'u25'],
      pendingMemberUserIds: [],
      policies: buildCheckoutDemoPolicies(),
      topics: ['Music', 'Culture', 'Waitlist'],
      rating: 9.0,
      boost: 99
    },
    {
      id: 'checkout-paid-policy',
      avatar: 'SY',
      title: 'Checkout Demo · Paid Policy',
      shortDescription: 'Paid join flow without slots, so you can test policies and add-ons with checkout.',
      timeframe: 'Apr 13 · 7:00 PM - 10:00 PM',
      activity: 2,
      isAdmin: false,
      creatorUserId: 'u3',
      startAt: '2026-04-13T19:00:00',
      endAt: '2026-04-13T22:00:00',
      frequency: 'One-time',
      ticketing: true,
      visibility: 'Public',
      blindMode: 'Open Event',
      location: 'Austin · Policy Demo Studio',
      capacityMin: 4,
      capacityMax: 16,
      acceptedMemberUserIds: ['u43', 'u44'],
      pendingMemberUserIds: ['u45'],
      pricing: buildCheckoutDemoPricing(22),
      policies: buildCheckoutDemoPolicies(),
      subEventDefinitions: buildCheckoutDemoSubEventDefinitions({
        sourceId: 'checkout-paid-policy',
        includePaidOptional: true
      }),
      rating: 9.1,
      boost: 98
    },
    {
      id: 'checkout-free-slots',
      avatar: 'SY',
      title: 'Checkout Demo · Free Multi-Slot',
      shortDescription: 'Free recurring event with multiple slots, so you can test slot-only join without payment.',
      timeframe: 'Apr 14 · multiple slots',
      activity: 2,
      isAdmin: false,
      creatorUserId: 'u3',
      startAt: '2026-04-14T12:30:00',
      endAt: '2026-05-26T18:00:00',
      frequency: 'Weekly',
      ticketing: false,
      visibility: 'Public',
      blindMode: 'Open Event',
      location: 'Austin · Slot Demo Yard',
      capacityMin: 6,
      capacityMax: 20,
      acceptedMemberUserIds: ['u46', 'u47'],
      pendingMemberUserIds: ['u48'],
      slotsEnabled: true,
      slotTemplates: [
        {
          id: 'checkout-free-slots-slot-1',
          startAt: '2026-04-14T13:00:00'
        },
        {
          id: 'checkout-free-slots-slot-2',
          startAt: '2026-04-14T15:00:00'
        }
      ],
      pricing: PricingBuilder.createDefaultPricingConfig('event'),
      subEventDefinitions: buildCheckoutDemoSubEventDefinitions({
        sourceId: 'checkout-free-slots',
        includePaidOptional: false
      }),
      rating: 8.9,
      boost: 97
    }
  ]
};

const SEED_EVENT_FEEDBACK_SHOWCASE_EVENTS_BY_USER: Record<string, ActivityEventSeedItem[]> = {
  u3: [
    {
      id: 'feedback-showcase-nagy-eszter-studio',
      avatar: 'NE',
      title: 'Feedback Demo · Studio Recap',
      shortDescription: 'Past creator meetup seeded so event feedback is always available for carousel testing.',
      timeframe: 'Feedback demo',
      activity: 2,
      isAdmin: false,
      creatorUserId: 'u11',
      startAt: '2026-01-12T18:00:00',
      endAt: '2026-01-12T21:00:00',
      generated: true,
      visibility: 'Public',
      blindMode: 'Open Event',
      location: 'Seattle · Demo Studio',
      acceptedMemberUserIds: ['u3', 'u4', 'u5'],
      pendingMemberUserIds: [],
      topics: ['Feedback', 'Creative', 'Demo']
    },
    {
      id: 'feedback-showcase-nagy-eszter-social',
      avatar: 'NE',
      title: 'Feedback Demo · Social Lab',
      shortDescription: 'Second past event for checking multi-card event feedback carousel behavior.',
      timeframe: 'Feedback demo',
      activity: 2,
      isAdmin: false,
      creatorUserId: 'u7',
      startAt: '2026-01-13T19:00:00',
      endAt: '2026-01-13T22:00:00',
      generated: true,
      visibility: 'Public',
      blindMode: 'Open Event',
      location: 'Seattle · Demo Lounge',
      acceptedMemberUserIds: ['u3', 'u1', 'u2'],
      pendingMemberUserIds: [],
      topics: ['Feedback', 'Social', 'Demo']
    }
  ]
};

const SEED_HOSTING_BY_USER: Record<string, ActivityHostingSeedItem[]> = {
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

const SEED_STATUS_BY_ID: Record<string, ActivityEventRecord['status']> = {
  e1: 'A',
  e4: 'A',
  e5: 'A',
  e7: 'DR',
  e10: 'A',
  e11: 'DR',
  h1: 'A',
  h2: 'A',
  h3: 'DR',
  h4: 'DR'
};


const SEED_EXPLORE_REBALANCE_BY_OWNER_USER: Record<string, readonly string[]> = {
  u1: ['e2', 'e3', 'e6', 'e8']
};

const MAX_VISIBLE_ACTIVE_EVENTS_PER_USER = 28;

interface ActivityEventSeedOverrides {
  startAt?: string;
  endAt?: string;
  distanceKm?: number;
  autoInviter?: boolean;
  frequency?: string;
  ticketing?: boolean;
  visibility?: ActivityEventRecord['visibility'];
  blindMode?: ActivityEventRecord['blindMode'];
  imageUrl?: string;
  sourceLink?: string;
  location?: string;
  locationCoordinates?: LocationCoordinates;
  capacityMin?: number | null;
  capacityMax?: number | null;
  capacityTotal?: number | null;
  acceptedMemberUserIds?: string[];
  pendingMemberUserIds?: string[];
  topics?: string[];
  pricing?: ContractTypes.PricingConfig | null;
  policies?: ContractTypes.EventPolicyDTO[];
  slotsEnabled?: boolean;
  slotTemplates?: ContractTypes.EventSlotTemplateDTO[];
  generated?: boolean;
  subEventsEnabled?: boolean;
  subEventDefinitions?: ContractTypes.SubEventDefinitionDTO[];
  subEvents?: ContractTypes.SubEventDTO[];
  mode?: ContractTypes.EventMode;
  rating?: number;
  boost?: number;
  affinity?: number;
}

export class SeedEventsBuilder {
  private static readonly SLOT_READ_MODEL_USER_ID = '__slot_read_model__';

  static buildSeedInvitationItemsByUser(): Record<string, ActivityInvitationSeedItem[]> {
    return Object.fromEntries(
      Object.entries(SEED_INVITATIONS_BY_USER).map(([userId, items]) => [userId, items.map(item => ({
        ...item,
        acceptedMemberUserIds: item.acceptedMemberUserIds ? [...item.acceptedMemberUserIds] : item.acceptedMemberUserIds,
        pendingMemberUserIds: item.pendingMemberUserIds ? [...item.pendingMemberUserIds] : item.pendingMemberUserIds,
        policies: item.policies ? item.policies.map(policy => ({ ...policy })) : item.policies
      }))])
    );
  }

  static buildSeedEventItemsByUser(): Record<string, ActivityEventSeedItem[]> {
    const seeded = Object.fromEntries(
      Object.entries(this.mergeSeedEventItemGroups(
        SEED_EVENTS_BY_USER,
        SEED_EVENT_FEEDBACK_SHOWCASE_EVENTS_BY_USER
      )).map(([userId, items]) => [
        userId,
        items.map(item => ({
          ...item,
          pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing,
          policies: item.policies ? item.policies.map(policy => ({ ...policy })) : item.policies,
          slotTemplates: this.cloneSlotTemplates(item.slotTemplates) ?? item.slotTemplates,
          subEventsEnabled: item.subEventsEnabled,
          subEventDefinitions: this.cloneSubEventDefinitions(item.subEventDefinitions) ?? item.subEventDefinitions,
          subEvents: this.cloneSubEvents(item.subEvents) ?? item.subEvents,
          topics: item.topics ? [...item.topics] : item.topics,
          acceptedMemberUserIds: item.acceptedMemberUserIds ? [...item.acceptedMemberUserIds] : item.acceptedMemberUserIds,
          pendingMemberUserIds: item.pendingMemberUserIds ? [...item.pendingMemberUserIds] : item.pendingMemberUserIds
        }))
      ])
    ) as Record<string, ActivityEventSeedItem[]>;

    this.rebalanceSeedExploreItems(seeded);
    return seeded;
  }

  private static mergeSeedEventItemGroups(
    ...groups: ReadonlyArray<Record<string, readonly ActivityEventSeedItem[]>>
  ): Record<string, ActivityEventSeedItem[]> {
    const merged: Record<string, ActivityEventSeedItem[]> = {};
    for (const group of groups) {
      for (const [userId, items] of Object.entries(group)) {
        merged[userId] = [...(merged[userId] ?? []), ...items];
      }
    }
    return merged;
  }


  private static rebalanceSeedExploreItems(seedItemsByUser: Record<string, ActivityEventSeedItem[]>): void {
    for (const [ownerUserId, eventIds] of Object.entries(SEED_EXPLORE_REBALANCE_BY_OWNER_USER)) {
      const ownerItems = seedItemsByUser[ownerUserId];
      if (!ownerItems || ownerItems.length === 0) {
        continue;
      }
      const movedEventIds = new Set(eventIds);
      const itemsToMove = ownerItems.filter(item => movedEventIds.has(item.id));
      if (itemsToMove.length === 0) {
        continue;
      }
      seedItemsByUser[ownerUserId] = ownerItems.filter(item => !movedEventIds.has(item.id));
      for (const item of itemsToMove) {
        const creatorUserId = item.creatorUserId?.trim() || ownerUserId;
        const creatorItems = seedItemsByUser[creatorUserId] ?? [];
        if (creatorItems.some(existing => existing.id === item.id)) {
          continue;
        }
        creatorItems.push({
          ...item,
          isAdmin: creatorUserId === ownerUserId ? item.isAdmin : true,
          visibility: 'Public',
          acceptedMemberUserIds: item.acceptedMemberUserIds ? [...item.acceptedMemberUserIds] : undefined,
          pendingMemberUserIds: item.pendingMemberUserIds ? [...item.pendingMemberUserIds] : undefined,
          subEventsEnabled: item.subEventsEnabled,
          subEventDefinitions: this.cloneSubEventDefinitions(item.subEventDefinitions) ?? item.subEventDefinitions,
          subEvents: this.cloneSubEvents(item.subEvents) ?? item.subEvents,
          topics: item.topics ? [...item.topics] : item.topics
        });
        seedItemsByUser[creatorUserId] = creatorItems;
      }
    }
  }

  static buildSeedHostingItemsByUser(): Record<string, ActivityHostingSeedItem[]> {
    return Object.fromEntries(
      Object.entries(SEED_HOSTING_BY_USER).map(([userId, items]) => [
        userId,
        items.map(item => ({
          ...item,
          pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing,
          policies: item.policies ? item.policies.map(policy => ({ ...policy })) : item.policies,
          slotTemplates: this.cloneSlotTemplates(item.slotTemplates) ?? item.slotTemplates,
          subEventsEnabled: item.subEventsEnabled,
          subEventDefinitions: this.cloneSubEventDefinitions(item.subEventDefinitions) ?? item.subEventDefinitions,
          subEvents: this.cloneSubEvents(item.subEvents) ?? item.subEvents,
          topics: item.topics ? [...item.topics] : item.topics,
          acceptedMemberUserIds: item.acceptedMemberUserIds ? [...item.acceptedMemberUserIds] : item.acceptedMemberUserIds,
          pendingMemberUserIds: item.pendingMemberUserIds ? [...item.pendingMemberUserIds] : item.pendingMemberUserIds
        }))
      ])
    );
  }

  static buildSeedStatusById(): Record<string, ActivityEventRecord['status']> {
    return { ...SEED_STATUS_BY_ID };
  }

  static buildRecordCollection(options: {
    invitationsByUser: Record<string, readonly ActivityInvitationSeedItem[]>;
    eventsByUser: Record<string, readonly ActivityEventSeedItem[]>;
    hostingByUser: Record<string, readonly ActivityHostingSeedItem[]>;
    statusById?: Record<string, ActivityEventRecord['status']>;
  }): ActivityEventRecordCollection {
    const byId: Record<string, ActivityEventRecord> = {};
    const ids: string[] = [];
    const creatorUserIdByEventId = this.buildCreatorUserIdByEventId(options);

    for (const [userId, items] of Object.entries(options.invitationsByUser)) {
      for (const item of items) {
        const recordKey = this.buildRecordKey(userId, 'invitations', item.id);
        const creatorUserId = this.resolveInvitationCreatorUserId(item, userId, creatorUserIdByEventId);
        byId[recordKey] = this.buildRecord({
          id: item.id,
          userId,
          type: 'invitations',
          avatar: item.avatar,
          title: item.description,
          subtitle: item.inviter,
          timeframe: item.when,
          inviter: item.inviter,
          unread: item.unread,
          activity: 0,
          trashedAtIso: null,
          creatorUserId,
          adminIds: [creatorUserId],
          seed: this.extractSeedOverrides(item)
        });
        ids.push(recordKey);
      }
    }

    for (const [userId, items] of Object.entries(options.eventsByUser)) {
      for (const item of items) {
        const creatorUserId = creatorUserIdByEventId.get(item.id) ?? userId;
        const recordKey = this.buildRecordKey(userId, 'events', item.id);
        byId[recordKey] = this.buildRecord({
          id: item.id,
          userId,
          type: 'events',
          avatar: item.avatar,
          title: item.title,
          subtitle: item.shortDescription,
          timeframe: item.timeframe,
          inviter: null,
          unread: 0,
          activity: item.activity,
          status: item.status ?? options.statusById?.[item.id] ?? 'A',
          trashedAtIso: null,
          creatorUserId,
          adminIds: this.normalizeUserIds([
            ...(item.adminIds ?? []),
            creatorUserId,
            ...(item.isAdmin || creatorUserId === userId ? [userId] : [])
          ]),
          seed: this.extractSeedOverrides(item)
        });
        ids.push(recordKey);
      }
    }

    for (const [userId, items] of Object.entries(options.hostingByUser)) {
      for (const item of items) {
        const recordKey = this.buildRecordKey(userId, 'hosting', item.id);
        byId[recordKey] = this.buildRecord({
          id: item.id,
          userId,
          type: 'hosting',
          avatar: item.avatar,
          title: item.title,
          subtitle: item.shortDescription,
          timeframe: item.timeframe,
          inviter: null,
          unread: 0,
          activity: item.activity,
          status: item.status ?? options.statusById?.[item.id] ?? 'A',
          trashedAtIso: null,
          creatorUserId: creatorUserIdByEventId.get(item.id) ?? userId,
          adminIds: this.normalizeUserIds([
            ...(item.adminIds ?? []),
            creatorUserIdByEventId.get(item.id) ?? userId,
            userId
          ]),
          seed: this.extractSeedOverrides(item)
        });
        ids.push(recordKey);
      }
    }

    this.applyLifecycleDemoStatuses(byId, ids);
    return this.materializeSeedSlotRecords(
      this.rebalanceVisibleActiveEventParticipation({ byId, ids })
    );
  }

  private static applyLifecycleDemoStatuses(byId: Record<string, ActivityEventRecord>, ids: readonly string[]): void {
    const lifecycleSeeds: readonly {
      sourceId: string;
      status: ActivityEventRecord['status'];
      statusBeforeSuppression: ActivityEventRecord['status'];
    }[] = [
      { sourceId: 'h1', status: 'UR', statusBeforeSuppression: 'A' },
      { sourceId: 'e13', status: 'B', statusBeforeSuppression: 'A' },
      { sourceId: 'e2', status: 'D', statusBeforeSuppression: 'A' },
      { sourceId: 'e14', status: 'I', statusBeforeSuppression: 'A' }
    ];

    for (const seed of lifecycleSeeds) {
      this.applyLifecycleDemoStatusToSource(byId, seed.sourceId, seed.status, seed.statusBeforeSuppression);
    }
  }

  private static applyLifecycleDemoStatusToSource(
    byId: Record<string, ActivityEventRecord>,
    sourceId: string,
    status: ActivityEventRecord['status'],
    statusBeforeSuppression: ActivityEventRecord['status']
  ): void {
    for (const [recordKey, record] of Object.entries(byId)) {
      if (!record || record.id !== sourceId || record.type === 'invitations') {
        continue;
      }
      byId[recordKey] = {
        ...record,
        status,
        statusBeforeSuppression,
        trashedAtIso: null
      };
    }
  }

  private static rebalanceVisibleActiveEventParticipation(
    collection: ActivityEventRecordCollection
  ): ActivityEventRecordCollection {
    const recordsByEventId = new Map<string, ActivityEventRecord[]>();
    for (const id of collection.ids) {
      const record = collection.byId[id];
      if (!record?.id) {
        continue;
      }
      const records = recordsByEventId.get(record.id) ?? [];
      records.push(record);
      recordsByEventId.set(record.id, records);
    }

    const byId: Record<string, ActivityEventRecord> = {};
    const ids: string[] = [];
    for (const records of recordsByEventId.values()) {
      const canonical = this.buildCanonicalEventRecord(records);
      const recordKey = this.buildRecordKey(canonical.userId, canonical.type, canonical.id);
      byId[recordKey] = canonical;
      ids.push(recordKey);

      for (const record of records) {
        if (record.type !== 'events' || this.isRecordAdmin(record) || record.generated !== true || record.userId === canonical.userId) {
          continue;
        }
        const generatedRecordKey = this.buildRecordKey(record.userId, record.type, record.id);
        if (byId[generatedRecordKey]) {
          continue;
        }
        byId[generatedRecordKey] = this.cloneRecord(record);
        ids.push(generatedRecordKey);
      }
    }

    return {
      byId,
      ids
    };
  }

  private static materializeSeedSlotRecords(
    collection: ActivityEventRecordCollection
  ): ActivityEventRecordCollection {
    const byId: Record<string, ActivityEventRecord> = { ...collection.byId };
    const ids = [...collection.ids];
    const existingIds = new Set(ids);
    const parents = ids
      .map(id => byId[id])
      .filter((record): record is ActivityEventRecord => this.isSeedSlotParentRecord(record));

    for (const parent of parents) {
      for (const record of this.buildSeedGeneratedSlotRecordsForParent(parent)) {
        const recordKey = this.buildRecordKey(record.userId, record.type, record.id);
        byId[recordKey] = record;
        if (!existingIds.has(recordKey)) {
          ids.push(recordKey);
          existingIds.add(recordKey);
        }
      }
    }

    return { byId, ids };
  }

  private static buildSeedGeneratedSlotRecordsForParent(parent: ActivityEventRecord): ActivityEventRecord[] {
    const parentStart = this.parseSeedDateTime(parent.startAtIso);
    const parentEnd = this.parseSeedDateTime(parent.endAtIso);
    if (!parentStart || !parentEnd) {
      return [];
    }

    const records: ActivityEventRecord[] = [];
    const templates = parent.slotTemplates ?? [];
    const overrideDates = new Set(
      templates
        .map(template => this.seedSlotOverrideDateKey(template.overrideDate))
        .filter((value): value is string => Boolean(value))
    );

    for (const template of templates) {
      if (this.seedSlotOverrideDateKey(template.overrideDate) || template.closed === true) {
        continue;
      }
      records.push(...this.buildSeedGeneratedSlotRecordsForTemplate(parent, template, parentStart, parentEnd, overrideDates));
    }

    for (const template of templates) {
      if (!this.seedSlotOverrideDateKey(template.overrideDate) || template.closed === true) {
        continue;
      }
      records.push(...this.buildSeedGeneratedSlotRecordsForTemplate(parent, template, parentStart, parentEnd, new Set(), true));
    }

    return records;
  }

  private static buildSeedGeneratedSlotRecordsForTemplate(
    parent: ActivityEventRecord,
    template: ContractTypes.EventSlotTemplateDTO,
    parentStart: Date,
    parentEnd: Date,
    overrideDates: ReadonlySet<string>,
    overrideOnly = false
  ): ActivityEventRecord[] {
    const templateStart = this.parseSeedDateTime(template.startAt);
    if (!templateStart) {
      return [];
    }
    const definitions = this.seedSlotTemplateSubEventDefinitions(parent, template);
    const durationMs = Math.max(0, this.seedSubEventDefinitionsDurationMinutes(definitions)) * 60 * 1000;
    const starts = overrideOnly
      ? [new Date(templateStart)]
      : this.generateSeedSlotOccurrenceStarts(parent.frequency ?? 'One-time', templateStart, parentStart, parentEnd);

    return starts.flatMap(startAt => {
      const occurrenceDateKey = this.seedSlotOccurrenceAnchorDateKey(startAt, templateStart, parentStart);
      if (!overrideOnly && occurrenceDateKey && overrideDates.has(occurrenceDateKey)) {
        return [];
      }
      const endAt = new Date(startAt.getTime() + durationMs);
      if (startAt.getTime() < parentStart.getTime() || endAt.getTime() > parentEnd.getTime()) {
        return [];
      }
      return [this.buildSeedGeneratedSlotRecord(parent, template, startAt, endAt, definitions)];
    });
  }

  private static buildSeedGeneratedSlotRecord(
    parent: ActivityEventRecord,
    template: ContractTypes.EventSlotTemplateDTO,
    startAt: Date,
    endAt: Date,
    definitions: readonly ContractTypes.SubEventDefinitionDTO[]
  ): ActivityEventRecord {
    const sourceId = this.buildGeneratedSlotSourceId(parent.id, template.id, startAt);
    const subEvents = parent.subEventsEnabled === true && definitions.length > 0
      ? this.materializeSeedSubEventDefinitionsForSlotOccurrence(definitions, startAt)
      : this.materializeSeedSubEventsForSlotOccurrence(parent.subEvents, startAt, endAt) ?? undefined;
    return {
      ...this.cloneRecord(parent),
      id: sourceId,
      userId: SeedEventsBuilder.SLOT_READ_MODEL_USER_ID,
      type: 'events',
      title: parent.title,
      subtitle: parent.subtitle,
      timeframe: this.buildGeneratedSlotTimeframe(startAt, endAt),
      inviter: null,
      unread: 0,
      activity: 0,
      trashedAtIso: null,
      creatorUserId: SeedEventsBuilder.SLOT_READ_MODEL_USER_ID,
      startAtIso: startAt.toISOString(),
      endAtIso: endAt.toISOString(),
      slotsEnabled: false,
      slotTemplates: [],
      parentEventId: parent.id,
      slotTemplateId: template.id,
      generated: true,
      eventType: 'slot',
      nextSlot: null,
      upcomingSlots: [],
      acceptedMembers: 0,
      pendingMembers: 0,
      acceptedMemberUserIds: [],
      pendingMemberUserIds: [],
      invitedMemberUserIds: [],
      pendingRequestMemberUserIds: [],
      subEventsEnabled: false,
      subEvents
    };
  }

  private static seedSubEventDefinitionTimeline(
    items: readonly ContractTypes.SubEventDefinitionDTO[] | undefined
  ): Array<{ item: ContractTypes.SubEventDefinitionDTO; startOffsetMinutes: number; durationMinutes: number }> {
    const definitions = items ?? [];
    let previousStartOffsetMinutes = 0;
    let previousEndOffsetMinutes = 0;
    let hasPrevious = false;
    return definitions.map(item => {
      const durationMinutes = Math.max(0, Math.trunc(Number(item.durationMinutes) || 0));
      const offsetMinutes = Math.max(0, Math.trunc(Number(item.offsetMinutes) || 0));
      const timing = ActivityEventDetailDTO.normalizeSubEventDefinitionTiming(item.timing);
      const startOffsetMinutes = !hasPrevious
        ? offsetMinutes
        : timing === 'During'
          ? previousStartOffsetMinutes + offsetMinutes
          : previousEndOffsetMinutes + offsetMinutes;
      previousStartOffsetMinutes = startOffsetMinutes;
      previousEndOffsetMinutes = startOffsetMinutes + durationMinutes;
      hasPrevious = true;
      return { item, startOffsetMinutes, durationMinutes };
    });
  }

  private static seedSubEventDefinitionsDurationMinutes(items: readonly ContractTypes.SubEventDefinitionDTO[] | undefined): number {
    return this.seedSubEventDefinitionTimeline(items)
      .reduce((total, entry) => Math.max(total, entry.startOffsetMinutes + entry.durationMinutes), 0);
  }

  private static seedSlotTemplateSubEventDefinitions(
    parent: ActivityEventRecord,
    template: ContractTypes.EventSlotTemplateDTO
  ): ContractTypes.SubEventDefinitionDTO[] {
    if (parent.subEventsEnabled !== true) {
      return [];
    }
    const overrideDefinitions = ActivityEventDetailDTO.normalizeSubEventDefinitions(template.subEventDefinitions ?? []);
    return overrideDefinitions.length > 0
      ? overrideDefinitions
      : ActivityEventDetailDTO.normalizeSubEventDefinitions(parent.subEventDefinitions ?? []);
  }

  private static materializeSeedSubEventDefinitionsForSlotOccurrence(
    items: readonly ContractTypes.SubEventDefinitionDTO[] | undefined,
    occurrenceStart: Date
  ): ContractTypes.SubEventDTO[] {
    return this.seedSubEventDefinitionTimeline(items).map(({ item, startOffsetMinutes, durationMinutes }, index) => {
      const startAt = new Date(occurrenceStart.getTime() + (startOffsetMinutes * 60 * 1000));
      const endAt = new Date(startAt.getTime() + (durationMinutes * 60 * 1000));
      return {
        id: `${item.id ?? `subevent-${index + 1}`}`.trim() || `subevent-${index + 1}`,
        name: `${item.name ?? `Sub Event ${index + 1}`}`.trim(),
        description: `${item.description ?? ''}`.trim(),
        startAt: AppUtils.toIsoDateTimeLocal(startAt),
        endAt: AppUtils.toIsoDateTimeLocal(endAt),
        location: item.location ?? '',
        groups: item.groups?.map(group => ({ ...group })) ?? [],
        tournamentGroupCount: item.tournamentGroupCount,
        tournamentGroupCapacityMin: item.tournamentGroupCapacityMin,
        tournamentGroupCapacityMax: item.tournamentGroupCapacityMax,
        tournamentLeaderboardType: item.tournamentLeaderboardType,
        tournamentAdvancePerGroup: item.tournamentAdvancePerGroup,
        optional: item.optional,
        pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing,
        capacityMin: item.capacityMin,
        capacityMax: item.capacityMax,
        membersAccepted: 0,
        membersPending: 0,
        carsPending: 0,
        accommodationPending: 0,
        suppliesPending: 0,
        slotStartOffsetMinutes: startOffsetMinutes,
        slotDurationMinutes: durationMinutes
      };
    });
  }

  private static materializeSeedSubEventsForSlotOccurrence(
    subEvents: readonly ContractTypes.SubEventDTO[] | undefined,
    occurrenceStart: Date,
    occurrenceEnd: Date
  ): ContractTypes.SubEventDTO[] | undefined {
    if (!Array.isArray(subEvents) || subEvents.length === 0) {
      return subEvents ? [] : undefined;
    }
    const slotDurationMinutes = Math.max(1, Math.round((occurrenceEnd.getTime() - occurrenceStart.getTime()) / 60000));
    return subEvents.map(item => {
      const rawStart = this.parseSeedDateTime(item.startAt);
      const rawEnd = this.parseSeedDateTime(item.endAt);
      const explicitOffset = Number(item.slotStartOffsetMinutes);
      const explicitDuration = Number(item.slotDurationMinutes);
      const offsetMinutes = Number.isFinite(explicitOffset)
        ? Math.max(0, Math.trunc(explicitOffset))
        : Math.max(
          0,
          rawStart
            ? ((rawStart.getHours() * 60) + rawStart.getMinutes()) - ((occurrenceStart.getHours() * 60) + occurrenceStart.getMinutes())
            : 0
        );
      const durationMinutes = Number.isFinite(explicitDuration)
        ? Math.max(1, Math.trunc(explicitDuration))
        : Math.max(
          1,
          rawStart && rawEnd
            ? Math.round((rawEnd.getTime() - rawStart.getTime()) / 60000)
            : slotDurationMinutes
        );
      const safeOffsetMinutes = AppUtils.clampNumber(offsetMinutes, 0, Math.max(0, slotDurationMinutes - 1));
      const safeDurationMinutes = AppUtils.clampNumber(
        durationMinutes,
        1,
        Math.max(1, slotDurationMinutes - safeOffsetMinutes)
      );
      const startAt = new Date(occurrenceStart.getTime() + (safeOffsetMinutes * 60 * 1000));
      const endAt = new Date(startAt.getTime() + (safeDurationMinutes * 60 * 1000));
      return {
        ...item,
        startAt: AppUtils.toIsoDateTimeLocal(startAt),
        endAt: AppUtils.toIsoDateTimeLocal(endAt),
        slotStartOffsetMinutes: safeOffsetMinutes,
        slotDurationMinutes: safeDurationMinutes
      };
    });
  }

  private static generateSeedSlotOccurrenceStarts(
    frequency: string,
    templateStart: Date,
    parentStart: Date,
    parentEnd: Date
  ): Date[] {
    const normalizedFrequency = `${frequency ?? ''}`.trim().toLowerCase();
    if (normalizedFrequency === 'one-time' || normalizedFrequency === 'custom' || !normalizedFrequency) {
      return templateStart.getTime() >= parentStart.getTime() && templateStart.getTime() <= parentEnd.getTime()
        ? [new Date(templateStart)]
        : [];
    }

    const starts: Date[] = [];
    const cursor = new Date(parentStart);
    cursor.setHours(0, 0, 0, 0);
    const endDate = new Date(parentEnd);
    endDate.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= endDate.getTime()) {
      if (this.matchesSeedSlotFrequency(cursor, templateStart, normalizedFrequency)) {
        const next = new Date(cursor);
        next.setHours(templateStart.getHours(), templateStart.getMinutes(), templateStart.getSeconds(), templateStart.getMilliseconds());
        if (next.getTime() >= parentStart.getTime() && next.getTime() <= parentEnd.getTime()) {
          starts.push(next);
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return starts;
  }

  private static matchesSeedSlotFrequency(date: Date, templateStart: Date, frequency: string): boolean {
    if (frequency === 'daily') {
      return true;
    }
    if (frequency === 'weekly') {
      return date.getDay() === templateStart.getDay();
    }
    if (frequency === 'bi-weekly' || frequency === 'biweekly') {
      if (date.getDay() !== templateStart.getDay()) {
        return false;
      }
      const diffDays = Math.floor((date.getTime() - templateStart.getTime()) / (24 * 60 * 60 * 1000));
      const diffWeeks = Math.floor(diffDays / 7);
      return diffWeeks >= 0 && diffWeeks % 2 === 0;
    }
    if (frequency === 'monthly') {
      const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      return date.getDate() === Math.min(templateStart.getDate(), lastDayOfMonth);
    }
    if (frequency === 'yearly' || frequency === 'annual' || frequency === 'annually') {
      if (date.getMonth() !== templateStart.getMonth()) {
        return false;
      }
      const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      return date.getDate() === Math.min(templateStart.getDate(), lastDayOfMonth);
    }
    return false;
  }

  private static isGeneratedSeedSlotRecord(record: ActivityEventRecord | null | undefined): boolean {
    return Boolean(record?.generated) || record?.eventType === 'slot' || Boolean(record?.parentEventId);
  }

  private static isSeedSlotParentRecord(record: ActivityEventRecord | null | undefined): boolean {
    return Boolean(record?.slotsEnabled) && !this.isGeneratedSeedSlotRecord(record) && (record?.slotTemplates?.length ?? 0) > 0;
  }

  private static buildGeneratedSlotSourceId(parentEventId: string, slotTemplateId: string, startAt: Date): string {
    return `${parentEventId}:slot:${slotTemplateId}:${startAt.toISOString()}`;
  }

  private static buildGeneratedSlotTimeframe(startAt: Date, endAt: Date): string {
    const dateLabel = startAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startLabel = startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endLabel = endAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${dateLabel} · ${startLabel} - ${endLabel}`;
  }

  private static seedSlotOverrideDateKey(value: string | null | undefined): string | null {
    const parsed = this.parseSeedDateTime(value?.includes('T') ? value : `${value ?? ''}T00:00`);
    if (!parsed) {
      return null;
    }
    const year = parsed.getFullYear();
    const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
    const day = `${parsed.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private static seedSlotOccurrenceAnchorDateKey(occurrenceStart: Date, templateStart: Date, parentStart: Date): string | null {
    const templateOffsetMs = templateStart.getTime() - parentStart.getTime();
    return this.seedSlotOverrideDateKey(new Date(occurrenceStart.getTime() - templateOffsetMs).toISOString());
  }

  private static buildCanonicalEventRecord(records: readonly ActivityEventRecord[]): ActivityEventRecord {
    const preferred = records.reduce((current, next) =>
      this.shouldPreferParticipationCanonicalRecord(next, current) ? next : current
    );
    const creatorUserId = preferred.creatorUserId?.trim()
      || records.find(record => record.creatorUserId?.trim())?.creatorUserId?.trim()
      || preferred.userId.trim();
    const adminIds = this.normalizeUserIds([
      creatorUserId,
      ...records.flatMap(record => record.adminIds ?? []),
      ...records
        .filter(record => this.isRecordAdmin(record) || record.type === 'hosting' || record.userId === record.creatorUserId)
        .map(record => record.userId)
    ]);
    const acceptedMemberUserIds = this.normalizeUserIds([
      ...records.flatMap(record => record.acceptedMemberUserIds ?? []),
      ...adminIds
    ]);
    const invitedMemberUserIds = this.normalizeUserIds(records
      .filter(record => record.type === 'invitations')
      .flatMap(record => [
        record.userId,
        ...(record.pendingMemberUserIds ?? [])
      ])
    ).filter(userId => !acceptedMemberUserIds.includes(userId));
    const pendingRequestMemberUserIds = this.normalizeUserIds(records
      .filter(record => record.type !== 'invitations')
      .flatMap(record => record.pendingMemberUserIds ?? [])
    ).filter(userId => !acceptedMemberUserIds.includes(userId) && !invitedMemberUserIds.includes(userId));
    const pendingMemberUserIds = this.normalizeUserIds([...invitedMemberUserIds, ...pendingRequestMemberUserIds]);
    const userId = adminIds[0] ?? creatorUserId;
    return {
      ...this.cloneRecord(preferred),
      userId,
      type: 'events',
      adminIds,
      creatorUserId: userId,
      acceptedMembers: acceptedMemberUserIds.length,
      pendingMembers: pendingMemberUserIds.length,
      acceptedMemberUserIds,
      pendingMemberUserIds,
      invitedMemberUserIds,
      pendingRequestMemberUserIds,
      capacityTotal: Math.max(preferred.capacityTotal, acceptedMemberUserIds.length)
    };
  }

  private static shouldPreferParticipationCanonicalRecord(next: ActivityEventRecord, current: ActivityEventRecord): boolean {
    if (next.type === 'invitations' && current.type !== 'invitations') {
      return false;
    }
    if (next.type !== 'invitations' && current.type === 'invitations') {
      return true;
    }
    if (next.type === 'hosting' && current.type !== 'hosting') {
      return true;
    }
    if (next.type !== 'hosting' && current.type === 'hosting') {
      return false;
    }
    const nextAdmin = this.isRecordAdmin(next);
    const currentAdmin = this.isRecordAdmin(current);
    if (nextAdmin !== currentAdmin) {
      return nextAdmin;
    }
    return AppUtils.toSortableDate(next.startAtIso) < AppUtils.toSortableDate(current.startAtIso);
  }

  private static isRecordAdmin(record: Pick<ActivityEventRecord, 'userId' | 'creatorUserId' | 'adminIds'>): boolean {
    const userId = record.userId.trim();
    return !!userId && (
      record.creatorUserId === userId
      || (record.adminIds ?? []).includes(userId)
    );
  }

  static cloneRecord(record: ActivityEventRecord): ActivityEventRecord {
    return {
      ...record,
      adminIds: [...(record.adminIds ?? [])],
      acceptedMemberUserIds: [...(record.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(record.pendingMemberUserIds ?? [])],
      invitedMemberUserIds: [...(record.invitedMemberUserIds ?? [])],
      pendingRequestMemberUserIds: [...(record.pendingRequestMemberUserIds ?? [])],
      locationCoordinates: this.cloneLocationCoordinates(record.locationCoordinates),
      pricing: record.pricing ? PricingBuilder.clonePricingConfig(record.pricing) : undefined,
      policies: (record.policies ?? []).map(item => ({ ...item })),
      slotTemplates: this.cloneSlotTemplates(record.slotTemplates) ?? [],
      nextSlot: record.nextSlot ? { ...record.nextSlot } : null,
      upcomingSlots: (record.upcomingSlots ?? []).map(item => ({ ...item })),
      topics: [...(record.topics ?? [])],
      subEventsEnabled: record.subEventsEnabled !== false,
      subEventDefinitions: (record.subEventDefinitions ?? []).map(item => ({
        ...item,
        groups: (item.groups ?? []).map(group => ({ ...group })),
        pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing
      })),
      subEvents: this.cloneSubEvents(record.subEvents)
    };
  }

  static buildRecordKey(
    userId: string,
    type: ActivityEventRepositoryItemType,
    sourceId: string
  ): string {
    return `${userId}:${type}:${sourceId}`;
  }

  private static buildCreatorUserIdByEventId(options: {
    invitationsByUser: Record<string, readonly ActivityInvitationSeedItem[]>;
    eventsByUser: Record<string, readonly ActivityEventSeedItem[]>;
    hostingByUser: Record<string, readonly ActivityHostingSeedItem[]>;
  }): Map<string, string> {
    const map = new Map<string, string>();
    for (const [userId, items] of Object.entries(options.hostingByUser)) {
      for (const item of items) {
        map.set(item.id, item.creatorUserId?.trim() || userId);
      }
    }
    for (const [userId, items] of Object.entries(options.eventsByUser)) {
      for (const item of items) {
        const explicitCreatorUserId = item.creatorUserId?.trim() || '';
        if (explicitCreatorUserId) {
          map.set(item.id, explicitCreatorUserId);
          continue;
        }
        if (item.isAdmin && !map.has(item.id)) {
          map.set(item.id, userId);
        }
      }
    }
    return map;
  }

  private static resolveInvitationCreatorUserId(
    item: ActivityInvitationSeedItem,
    inviteeUserId: string,
    creatorUserIdByEventId: Map<string, string>
  ): string {
    const byEventId = creatorUserIdByEventId.get(item.id)?.trim() ?? '';
    if (byEventId) {
      return byEventId;
    }
    const normalizedInviter = AppUtils.normalizeText(item.inviter);
    if (normalizedInviter) {
      const exactMatch = DEMO_EVENT_MEMBER_USERS.find(user => AppUtils.normalizeText(user.name) === normalizedInviter);
      if (exactMatch) {
        return exactMatch.id;
      }
      const firstNameMatch = DEMO_EVENT_MEMBER_USERS.find(user =>
        AppUtils.normalizeText(user.name.split(/\s+/)[0] ?? '') === normalizedInviter
      );
      if (firstNameMatch) {
        return firstNameMatch.id;
      }
    }
    const avatarInitials = item.avatar?.trim() || AppUtils.initialsFromText(item.inviter);
    if (avatarInitials) {
      const initialsMatch = DEMO_EVENT_MEMBER_USERS.find(user => user.initials === avatarInitials && user.id !== inviteeUserId);
      if (initialsMatch) {
        return initialsMatch.id;
      }
    }
    const fallbackCandidates = DEMO_EVENT_MEMBER_USERS.filter(user => user.id !== inviteeUserId);
    if (fallbackCandidates.length === 0) {
      return inviteeUserId;
    }
    const fallbackIndex = Math.abs(AppUtils.hashText(`invitation-creator:${inviteeUserId}:${item.id}:${item.inviter}`))
      % fallbackCandidates.length;
    return fallbackCandidates[fallbackIndex]?.id ?? inviteeUserId;
  }

  private static buildRecord(record: Pick<
    ActivityEventRecord,
    | 'id'
    | 'userId'
    | 'type'
    | 'avatar'
    | 'title'
    | 'subtitle'
    | 'timeframe'
    | 'inviter'
    | 'unread'
    | 'activity'
    | 'status'
    | 'trashedAtIso'
    | 'creatorUserId'
    | 'adminIds'
  > & {
    seed?: ActivityEventSeedOverrides;
  }): ActivityEventRecord {
    const decorations = this.buildRecordDecorations(record);
    return {
      ...record,
      ...decorations,
      adminIds: this.normalizeUserIds([...(record.adminIds ?? []), decorations.creatorUserId]),
      status: this.resolveLifecycleStatus(record),
      statusBeforeSuppression: null,
      timeframe: this.buildSeededTimeframeLabel({
        hint: record.timeframe,
        startAtIso: decorations.startAtIso,
        endAtIso: decorations.endAtIso,
        frequency: decorations.frequency,
        slotTemplates: decorations.slotTemplates
      })
    };
  }

  private static resolveLifecycleStatus(record: Pick<ActivityEventRecord, 'status'>): ActivityEventRecord['status'] {
    return record.status ?? 'A';
  }

  private static buildRecordDecorations(record: Pick<
    ActivityEventRecord,
    | 'id'
    | 'title'
    | 'subtitle'
    | 'type'
    | 'userId'
    | 'activity'
    | 'status'
    | 'creatorUserId'
    | 'timeframe'
  > & {
    seed?: ActivityEventSeedOverrides;
  }): Omit<
    ActivityEventRecord,
    | 'id'
    | 'userId'
    | 'type'
    | 'avatar'
    | 'title'
    | 'subtitle'
    | 'timeframe'
    | 'inviter'
    | 'unread'
    | 'activity'
    | 'status'
    | 'trashedAtIso'
  > {
    const creator = this.resolveCreatorUser(record.creatorUserId, record.title);
    const frequency = record.seed?.frequency?.trim() || this.parseFrequencyFromTimeframe(record.timeframe ?? '');
    const isGeneratedSeed = record.seed?.generated === true;
    const startAtIso = isGeneratedSeed
      ? (this.normalizeGeneratedSeedDateTime(record.seed?.startAt) || this.resolveStartAtIso(record))
      : (this.rebaseSeedDateTime(record.seed?.startAt) || this.resolveStartAtIso(record));
    const endAtIso = isGeneratedSeed
      ? (this.normalizeGeneratedSeedDateTime(record.seed?.endAt) || this.resolveEndAtIso(record, startAtIso))
      : (this.rebaseSeedDateTime(record.seed?.endAt) || this.resolveEndAtIso(record, startAtIso));
    const distanceKm = Number.isFinite(record.seed?.distanceKm)
      ? Math.max(0, Number(record.seed?.distanceKm))
      : this.resolveDistanceKm(record);
    const visibility = record.seed?.visibility ?? this.resolveVisibility(record);
    const blindMode = record.seed?.blindMode ?? this.resolveBlindMode(record);
    const capacityRange = this.resolveCapacityRange(record);
    const seededMembers = this.buildSeededMemberIds(record, startAtIso, distanceKm, creator);
    const acceptedMemberUserIds = this.normalizeUserIds(record.seed?.acceptedMemberUserIds);
    const pendingMemberUserIds = this.normalizeUserIds(record.seed?.pendingMemberUserIds);
    const rawMembers = this.normalizeDirectEventMembers(record, creator.id, {
      acceptedMemberUserIds: acceptedMemberUserIds.length > 0
        ? acceptedMemberUserIds
        : seededMembers.acceptedMemberUserIds,
      pendingMemberUserIds: pendingMemberUserIds.length > 0
        ? pendingMemberUserIds
        : seededMembers.pendingMemberUserIds
    });
    const compactMemberCounts = this.resolveCompactSeedMemberCounts(record, rawMembers);
    const compactAcceptedMemberUserIds = rawMembers.acceptedMemberUserIds
      .slice(0, compactMemberCounts.acceptedMembers);
    const members = {
      acceptedMemberUserIds: compactAcceptedMemberUserIds,
      pendingMemberUserIds: rawMembers.pendingMemberUserIds
        .filter(userId => !compactAcceptedMemberUserIds.includes(userId))
        .slice(0, compactMemberCounts.pendingMembers)
    };
    const acceptedMembers = members.acceptedMemberUserIds.length;
    const pendingMembers = members.pendingMemberUserIds.length;
    const capacityMin = this.normalizeCount(record.seed?.capacityMin) ?? this.normalizeCount(capacityRange.min);
    const capacityMax = this.normalizeCount(record.seed?.capacityMax) ?? this.normalizeCount(capacityRange.max);
    const compactCapacityTotal = this.normalizeCount(record.seed?.capacityTotal) == null
      ? this.resolveCompactSeedCapacityTotal(record, acceptedMembers, pendingMembers)
      : null;
    const capacityTotal = Math.max(
      acceptedMembers,
      this.normalizeCount(record.seed?.capacityTotal) ?? compactCapacityTotal ?? capacityMax ?? acceptedMembers
    );
    const slotTemplates = this.cloneRebasedSlotTemplates(record.seed?.slotTemplates) ?? [];
    const topics = this.normalizeTopics(record.seed?.topics).length > 0
      ? this.normalizeTopics(record.seed?.topics)
      : this.buildSeededTopics(record.id, record.title, record.subtitle);
    const explicitSubEventDefinitions = this.cloneSubEventDefinitions(record.seed?.subEventDefinitions) ?? [];
    const subEventDefinitions = explicitSubEventDefinitions.length > 0
      ? explicitSubEventDefinitions
      : this.buildSeededSubEventDefinitions(record, startAtIso, endAtIso, capacityRange);
    const subEvents = subEventDefinitions.length > 0
      ? this.materializeSeedSubEventDefinitionsForSlotOccurrence(
        subEventDefinitions,
        this.parseSeedDateTime(startAtIso) ?? new Date(startAtIso)
      )
      : [];
    const subEventsEnabled = record.seed?.subEventsEnabled ?? subEventDefinitions.length > 0;
    const rating = Number.isFinite(record.seed?.rating)
      ? Number(record.seed?.rating)
      : this.buildSeededRating(record.id, record.title, record.type);
    const acceptedUsers = members.acceptedMemberUserIds
      .map(userId => DEMO_EVENT_MEMBER_USERS.find(user => user.id === userId) ?? null)
      .filter((user): user is UserDto => Boolean(user));
    const location = record.seed?.location?.trim() || this.buildSeededLocation(record, creator);
    const ticketing = record.seed?.ticketing ?? this.resolveTicketing(record);
    return {
      creatorUserId: creator.id,
      creatorName: creator.name,
      creatorInitials: creator.initials,
      creatorGender: creator.gender,
      creatorCity: creator.city,
      visibility,
      blindMode,
      startAtIso,
      endAtIso,
      distanceKm,
      imageUrl: record.seed?.imageUrl?.trim() || this.buildRecordImageUrl(record),
      sourceLink: record.seed?.sourceLink?.trim() || this.buildRecordSourceLink(record),
      location,
      locationCoordinates: this.cloneLocationCoordinates(record.seed?.locationCoordinates)
        ?? this.cloneLocationCoordinates(creator.locationCoordinates)
        ?? this.resolveRecordLocationCoordinates(record, creator, location),
      capacityMin,
      capacityMax,
      capacityTotal,
      autoInviter: record.seed?.autoInviter ?? this.resolveAutoInviter(record),
      frequency,
      ticketing,
      pricing: record.seed?.pricing
        ? this.rebasePricingConfig(record.seed.pricing)
        : PricingBuilder.createSamplePricingConfig(ticketing ? 'hybrid' : 'fixed'),
      policies: this.clonePolicies(record.seed?.policies) ?? [],
      slotsEnabled: record.seed?.slotsEnabled === true,
      slotTemplates,
      parentEventId: null,
      slotTemplateId: null,
      generated: isGeneratedSeed,
      eventType: 'main',
      nextSlot: null,
      upcomingSlots: [],
      acceptedMembers,
      pendingMembers,
      topics,
      subEventsEnabled,
      subEventDefinitions,
      subEvents,
      mode: record.seed?.mode ?? SeedEventBuilder.inferredEventModeFromDefinitions(subEventDefinitions),
      rating,
      boost: Number.isFinite(record.seed?.boost)
        ? Number(record.seed?.boost)
        : this.buildSeededBoost(record.id, record.title, record.type),
      affinity: Number.isFinite(record.seed?.affinity)
        ? Math.max(0, Math.trunc(Number(record.seed?.affinity)))
        : this.resolveEventAffinity({
          id: record.id,
          title: record.title,
          subtitle: record.subtitle,
          topics,
          visibility,
          blindMode,
          creator,
          acceptedUsers,
          rating,
          acceptedMembers,
          capacityTotal
        })
    };
  }

  static resolveEventAffinity(options: {
    id: string;
    title: string;
    subtitle?: string | null;
    topics: readonly string[];
    visibility: string;
    blindMode: string;
    creator?: Partial<UserDto> | null;
    acceptedUsers?: ReadonlyArray<Partial<UserDto> | null | undefined>;
    rating?: number | null;
    acceptedMembers?: number | null;
    capacityTotal?: number | null;
  }): number {
    const participantUsers = [options.creator ?? null, ...(options.acceptedUsers ?? [])]
      .filter((user): user is Partial<UserDto> => Boolean(user));
    const participantAffinities = participantUsers
      .filter(user => typeof user.id === 'string' && user.id.trim().length > 0)
      .map(user => SeedUserBuilder.resolveUserAffinity({
        id: `${user.id}`,
        name: `${user.name ?? 'Unknown User'}`,
        age: Math.max(18, Math.trunc(Number(user.age) || 30)),
        city: `${user.city ?? ''}`,
        height: `${user.height ?? '170 cm'}`,
        physique: `${user.physique ?? ''}`,
        languages: [...(user.languages ?? [])],
        horoscope: `${user.horoscope ?? ''}`,
        gender: user.gender === 'woman' ? 'woman' : 'man',
        hostTier: `${user.hostTier ?? ''}`,
        traitLabel: `${user.traitLabel ?? ''}`,
        completion: Math.max(0, Math.trunc(Number(user.completion) || 0))
      }));
    const averageParticipantAffinity = participantAffinities.length > 0
      ? Math.round(participantAffinities.reduce((total, value) => total + value, 0) / participantAffinities.length)
      : 0;
    const tokens = this.uniqueAffinityTokens([
      options.title,
      options.subtitle ?? '',
      ...options.topics,
      options.visibility,
      options.blindMode,
      ...participantUsers.flatMap(user => [
        `${user.city ?? ''}`,
        `${user.physique ?? ''}`,
        ...((user.languages ?? []) as string[]),
        `${user.horoscope ?? ''}`,
        `${user.gender ?? ''}`,
        `${user.hostTier ?? ''}`,
        `${user.traitLabel ?? ''}`
      ])
    ]);
    return (
      this.resolveAffinityTokenScore(tokens, `event:${options.id}`) * 89
      + averageParticipantAffinity
      + Math.round(AppUtils.clampNumber(Number(options.rating) || 0, 0, 10) * 100) * 29
      + Math.max(0, Math.trunc(Number(options.acceptedMembers) || 0)) * 19
      + Math.max(0, Math.trunc(Number(options.capacityTotal) || 0)) * 7
    );
  }

  private static resolveCreatorUser(userId: string, fallbackTitle: string): UserDto {
    return DEMO_EVENT_MEMBER_USERS.find(user => user.id === userId)
      ?? DEMO_EVENT_MEMBER_USERS[0]
      ?? {
        id: userId,
        name: fallbackTitle || 'Unknown Host',
        age: 30,
        birthday: '1996-01-01',
        city: 'Austin',
        height: '175 cm',
        physique: 'Athletic',
        languages: ['English'],
        horoscope: 'Aries',
        initials: AppUtils.initialsFromText(fallbackTitle || 'Unknown Host'),
        gender: 'man',
        statusText: 'Recently Active',
        hostTier: 'Host',
        traitLabel: 'Reliable',
        completion: 60,
        headline: '',
        about: '',
        profileStatus: 'public',
        activities: { game: 0, chat: 0, invitations: 0, events: 0, hosting: 0 }
      };
  }

  private static recordSeedKey(
    record: Pick<ActivityEventRecord, 'id' | 'type' | 'userId' | 'title'>
  ): string {
    return `${record.type}:${record.userId}:${record.id}:${record.title}`;
  }

  private static resolveStartAtIso(
    record: Pick<ActivityEventRecord, 'id' | 'type' | 'userId' | 'title'>
  ): string {
    const seed = AppUtils.hashText(`event-start:${this.recordSeedKey(record)}`);
    const monthIndex = record.type === 'invitations' ? 1 : 2;
    const day = 1 + (seed % 28);
    const hourBase = record.type === 'hosting' ? 17 : record.type === 'invitations' ? 15 : 9;
    const hourSpan = record.type === 'hosting' ? 5 : record.type === 'invitations' ? 6 : 10;
    const hour = hourBase + ((seed >> 3) % hourSpan);
    const minute = ((seed >> 7) % 4) * 15;
    return this.rebaseSeedDateTime(new Date(2026, monthIndex, day, hour, minute, 0, 0))
      ?? AppUtils.toIsoDateTimeLocal(new Date(2026, monthIndex, day, hour, minute, 0, 0));
  }

  private static resolveEndAtIso(
    record: Pick<ActivityEventRecord, 'id' | 'type' | 'userId' | 'title'>,
    startAtIso: string
  ): string {
    const startAt = new Date(startAtIso);
    if (Number.isNaN(startAt.getTime())) {
      return AppUtils.toIsoDateTimeLocal(SeedScheduleBuilder.anchorDate());
    }
    const seed = AppUtils.hashText(`event-duration:${this.recordSeedKey(record)}`);
    const durationMinutes = 90 + ((seed % 5) * 30);
    return AppUtils.toIsoDateTimeLocal(new Date(startAt.getTime() + (durationMinutes * 60 * 1000)));
  }

  private static resolveDistanceKm(
    record: Pick<ActivityEventRecord, 'id' | 'type' | 'userId' | 'title'>
  ): number {
    const seed = AppUtils.hashText(`event-distance:${this.recordSeedKey(record)}`);
    const baseDistance = record.type === 'hosting' ? 4 : record.type === 'invitations' ? 2 : 6;
    const distance = baseDistance + (seed % 24) + (((seed >> 5) % 10) / 10);
    return Math.round(distance * 10) / 10;
  }

  private static resolveVisibility(
    record: Pick<ActivityEventRecord, 'id' | 'type' | 'userId' | 'title'>
  ): ActivityEventRecord['visibility'] {
    const seed = AppUtils.hashText(`event-visibility:${this.recordSeedKey(record)}`);
    if (record.type === 'hosting') {
      return seed % 4 === 0 ? 'Friends only' : 'Invitation only';
    }
    const variants: ActivityEventRecord['visibility'][] = ['Public', 'Friends only', 'Invitation only'];
    return variants[seed % variants.length] ?? 'Public';
  }

  private static resolveBlindMode(
    record: Pick<ActivityEventRecord, 'id' | 'type' | 'userId' | 'title'>
  ): ActivityEventRecord['blindMode'] {
    const seed = AppUtils.hashText(`event-blind-mode:${this.recordSeedKey(record)}`);
    return seed % 5 === 0 ? 'Blind Event' : 'Open Event';
  }

  private static resolveCapacityRange(
    record: Pick<ActivityEventRecord, 'id' | 'type' | 'userId' | 'title' | 'activity'>
  ): { min: number; max: number } {
    const seed = AppUtils.hashText(`event-capacity:${this.recordSeedKey(record)}`);
    const maxBase = record.type === 'hosting' ? 16 : record.type === 'invitations' ? 6 : 10;
    const max = maxBase + (seed % 22) + Math.max(0, Math.trunc(Number(record.activity) || 0));
    const minRatio = record.type === 'invitations'
      ? 0.35 + (((seed >> 4) % 2) * 0.1)
      : 0.45 + (((seed >> 4) % 3) * 0.08);
    const min = Math.max(0, Math.min(max, Math.floor(max * minRatio)));
    return { min, max };
  }

  private static resolveCompactSeedMemberCounts(
    record: Pick<ActivityEventRecord, 'id' | 'type' | 'userId' | 'title' | 'activity'>,
    members: { acceptedMemberUserIds: string[]; pendingMemberUserIds: string[] }
  ): { acceptedMembers: number; pendingMembers: number } {
    const acceptedMax = Math.max(0, members.acceptedMemberUserIds.length);
    const pendingMax = Math.max(0, members.pendingMemberUserIds.length);
    if (acceptedMax === 0 && pendingMax === 0) {
      return {
        acceptedMembers: 0,
        pendingMembers: 0
      };
    }

    const seed = AppUtils.hashText(`compact-member-count:${this.recordSeedKey(record)}:${record.activity}`);
    const invitation = record.type === 'invitations';
    const acceptedTarget = invitation
      ? Math.min(acceptedMax, 1 + (seed % 2))
      : Math.min(acceptedMax, 1 + ((seed % 5) === 0 ? 1 : 0));
    const pendingTarget = invitation
      ? Math.min(pendingMax, 1)
      : ((seed % 9) === 0 ? Math.min(pendingMax, 1) : 0);

    return {
      acceptedMembers: acceptedTarget,
      pendingMembers: pendingTarget
    };
  }

  private static resolveCompactSeedCapacityTotal(
    record: Pick<ActivityEventRecord, 'id' | 'type' | 'userId' | 'title' | 'activity'>,
    acceptedMembers: number,
    pendingMembers: number
  ): number {
    const seed = AppUtils.hashText(`compact-capacity:${this.recordSeedKey(record)}:${record.activity}`);
    const invitation = record.type === 'invitations';
    const memberFloor = Math.max(acceptedMembers, acceptedMembers + Math.min(pendingMembers, 1), invitation ? 2 : 1);
    if (!invitation && acceptedMembers > 0 && (seed % 6) === 0) {
      return acceptedMembers;
    }
    if (invitation) {
      return Math.max(memberFloor, 2 + (seed % 3));
    }
    return Math.max(memberFloor, acceptedMembers + 1 + ((seed >> 3) % 4));
  }

  private static normalizeDirectEventMembers(
    record: Pick<ActivityEventRecord, 'type' | 'userId'>,
    _creatorUserId: string,
    members: { acceptedMemberUserIds: string[]; pendingMemberUserIds: string[] }
  ): { acceptedMemberUserIds: string[]; pendingMemberUserIds: string[] } {
    const ownerUserId = record.userId.trim();
    const normalizedAcceptedMemberUserIds = this.normalizeUserIds(members.acceptedMemberUserIds);
    const normalizedPendingMemberUserIds = this.normalizeUserIds(members.pendingMemberUserIds)
      .filter(userId => !normalizedAcceptedMemberUserIds.includes(userId));
    if (record.type === 'invitations') {
      return {
        acceptedMemberUserIds: normalizedAcceptedMemberUserIds,
        pendingMemberUserIds: normalizedPendingMemberUserIds
      };
    }
    const ownerHasExplicitAcceptedMembership = normalizedAcceptedMemberUserIds.includes(ownerUserId);
    const ownerHasExplicitPendingMembership = !ownerHasExplicitAcceptedMembership
      && normalizedPendingMemberUserIds.includes(ownerUserId);
    const acceptedMemberUserIds = normalizedAcceptedMemberUserIds
      .filter(userId => userId !== ownerUserId);
    const pendingMemberUserIds = normalizedPendingMemberUserIds
      .filter(userId => userId !== ownerUserId && !acceptedMemberUserIds.includes(userId));
    if (record.type !== 'events' || !ownerUserId) {
      return {
        acceptedMemberUserIds,
        pendingMemberUserIds
      };
    }
    if (ownerHasExplicitPendingMembership) {
      return {
        acceptedMemberUserIds,
        pendingMemberUserIds: [ownerUserId, ...pendingMemberUserIds]
      };
    }
    return {
      acceptedMemberUserIds: [ownerUserId, ...acceptedMemberUserIds],
      pendingMemberUserIds
    };
  }

  private static buildRecordImageUrl(
    record: Pick<ActivityEventRecord, 'id' | 'type' | 'userId' | 'title'>
  ): string {
    const normalizedSeed = encodeURIComponent(this.recordSeedKey(record).toLowerCase().replace(/\s+/g, '-'));
    return `https://picsum.photos/seed/demo-event-${normalizedSeed}/1200/700`;
  }

  private static buildRecordSourceLink(
    record: Pick<ActivityEventRecord, 'id' | 'type' | 'userId'>
  ): string {
    const typeSegment = record.type === 'hosting' ? 'hosting' : record.type === 'invitations' ? 'invitation' : 'event';
    return `https://example.com/${typeSegment}/${encodeURIComponent(record.userId)}/${encodeURIComponent(record.id)}`;
  }

  private static buildSeededLocation(
    record: Pick<ActivityEventRecord, 'id' | 'title' | 'type'>,
    creator: UserDto
  ): string {
    const city = creator.city.trim() || 'Austin';
    const title = record.title.trim() || 'Event';
    if (record.type === 'hosting') {
      return `${city} host venue`;
    }
    if (record.type === 'invitations') {
      return `${city} meetup point`;
    }
    return `${title} · ${city}`;
  }

  private static resolveRecordLocationCoordinates(
    record: Pick<ActivityEventRecord, 'id' | 'type' | 'userId' | 'title'>,
    creator: UserDto,
    location: string
  ): LocationCoordinates {
    return SeedUserBuilder.resolveDemoLocationCoordinates(
      creator.city || 'Austin',
      `event-location:${this.recordSeedKey(record)}:${location}`
    );
  }

  private static resolveAutoInviter(
    record: Pick<ActivityEventRecord, 'id' | 'type' | 'userId' | 'title'>
  ): boolean {
    const seed = AppUtils.hashText(`event-auto-inviter:${this.recordSeedKey(record)}`);
    return record.type !== 'invitations' && (seed % 4 === 0);
  }

  private static resolveTicketing(
    record: Pick<ActivityEventRecord, 'id' | 'type' | 'userId' | 'title'>
  ): boolean {
    const seed = AppUtils.hashText(`event-ticketing:${this.recordSeedKey(record)}`);
    if (record.type === 'invitations') {
      return false;
    }
    return (seed % 3) === 0;
  }

  private static buildSeededMemberIds(
    record: Pick<ActivityEventRecord, 'id' | 'type' | 'userId' | 'title' | 'subtitle' | 'activity'>,
    startAtIso: string,
    distanceKm: number,
    creator: UserDto
  ): { acceptedMemberUserIds: string[]; pendingMemberUserIds: string[] } {
    if (record.type === 'invitations') {
      const invitee = this.resolveCreatorUser(record.userId, record.title);
      const seed = AppUtils.hashText(`invitation-members:${this.recordSeedKey(record)}:${creator.id}:${invitee.id}`);
      const acceptedTarget = 1 + (seed % 3);
      const pendingTarget = Math.max(1, 1 + ((seed >> 3) % 2));
      const orderedCandidates = DEMO_EVENT_MEMBER_USERS
        .filter(user => user.id !== invitee.id)
        .sort((left, right) =>
          AppUtils.hashText(`invitation-member:${record.id}:${left.id}`)
          - AppUtils.hashText(`invitation-member:${record.id}:${right.id}`)
        );
      const acceptedMemberUserIds = Array.from(new Set([
        creator.id,
        ...orderedCandidates
          .filter(user => user.id !== creator.id)
          .slice(0, Math.max(0, acceptedTarget - 1))
          .map(user => user.id)
      ])).slice(0, acceptedTarget);
      const pendingMemberUserIds = Array.from(new Set([
        invitee.id,
        ...orderedCandidates
          .filter(user => user.id !== creator.id && !acceptedMemberUserIds.includes(user.id))
          .slice(0, Math.max(0, pendingTarget - 1))
          .map(user => user.id)
      ]))
        .filter(userId => !acceptedMemberUserIds.includes(userId))
        .slice(0, pendingTarget);
      return {
        acceptedMemberUserIds,
        pendingMemberUserIds
      };
    }
    const seed = AppUtils.hashText(`event-members:${this.recordSeedKey(record)}:${startAtIso}:${Math.round(distanceKm)}`);
    const acceptedTarget = 1 + ((seed % 5) === 0 ? 1 : 0);
    const pendingTarget = (seed % 9) === 0 ? 1 : 0;
    const activeUserId = record.type === 'events'
      ? record.userId || creator.id
      : creator.id || record.userId;
    const members = SeedEventBuilder.seededEventMemberIds(
      record.id,
      Math.max(acceptedTarget + pendingTarget, 1),
      DEMO_EVENT_MEMBER_USERS,
      activeUserId
    );
    const acceptedMemberUserIds = this.normalizeUserIds(members)
      .slice(0, acceptedTarget);
    return {
      acceptedMemberUserIds,
      pendingMemberUserIds: this.normalizeUserIds(members)
        .filter(userId => !acceptedMemberUserIds.includes(userId))
        .slice(0, pendingTarget)
    };
  }

  private static buildSeededTopics(id: string, title: string, subtitle: string): string[] {
    const pool = Array.from(new Set(APP_STATIC_DATA.interestOptionGroups.flatMap(group => group.options)));
    if (pool.length === 0) {
      return [];
    }
    const seed = AppUtils.hashText(`${id}:${title}:${subtitle}`);
    const count = 2 + (seed % 2);
    const topics: string[] = [];
    for (let index = 0; index < pool.length && topics.length < count; index += 1) {
      const candidate = pool[(seed + (index * 3)) % pool.length];
      if (!topics.includes(candidate)) {
        topics.push(candidate);
      }
    }
    return topics;
  }

  private static buildSeededSubEventDefinitions(
    record: Pick<ActivityEventRecord, 'id' | 'title' | 'subtitle' | 'activity' | 'type' | 'userId' | 'creatorUserId' | 'adminIds'> & { timeframe?: string },
    startAtIso: string,
    endAtIso: string,
    capacityRange: { min: number; max: number }
  ): ContractTypes.SubEventDefinitionDTO[] {
    const source = {
      id: record.id,
      avatar: AppUtils.initialsFromText(record.title),
      title: record.title,
      shortDescription: record.subtitle,
      timeframe: record.timeframe ?? startAtIso,
      activity: record.activity,
      ...(record.type === 'events' ? { isAdmin: this.isRecordAdmin(record) } : {})
    } as ActivityEventSeedItem | ActivityHostingSeedItem;

    return SeedEventBuilder.buildSeededSubEventDefinitionsForEvent(source, {
      isHosting: record.type === 'hosting',
      activityDateTimeRangeById: {
        [record.id]: {
          startIso: startAtIso,
          endIso: endAtIso
        }
      },
      hostingDatesById: record.type === 'hosting'
        ? { [record.id]: startAtIso }
        : {},
      eventDatesById: record.type === 'events'
        ? { [record.id]: startAtIso }
        : {},
      eventCapacityById: {
        [record.id]: capacityRange
      },
      activityCapacityById: {},
      defaultStartIso: startAtIso
    });
  }

  private static buildSeededRating(id: string, title: string, type: ActivityEventRepositoryItemType): number {
    const seed = AppUtils.hashText(`${type}:${id}:${title}`);
    return 6 + ((seed % 35) / 10);
  }

  private static buildSeededBoost(id: string, title: string, type: ActivityEventRepositoryItemType): number {
    const seed = AppUtils.hashText(`${type}:${id}:${title}`);
    return 50 + (seed % 51);
  }

  private static extractSeedOverrides(item: ActivityEventSeedItem | ActivityHostingSeedItem | ActivityInvitationSeedItem): ActivityEventSeedOverrides | undefined {
    const overrides: ActivityEventSeedOverrides = {
      startAt: item.startAt,
      endAt: item.endAt,
      distanceKm: item.distanceKm,
      autoInviter: 'autoInviter' in item ? item.autoInviter : undefined,
      frequency: 'frequency' in item ? item.frequency : undefined,
      ticketing: 'ticketing' in item ? item.ticketing : undefined,
      visibility: 'visibility' in item ? item.visibility : undefined,
      blindMode: 'blindMode' in item ? item.blindMode : undefined,
      imageUrl: item.imageUrl,
      sourceLink: item.sourceLink,
      location: item.location,
      locationCoordinates: this.cloneLocationCoordinates(item.locationCoordinates) ?? undefined,
      capacityMin: item.capacityMin,
      capacityMax: item.capacityMax,
      capacityTotal: item.capacityTotal,
      acceptedMemberUserIds: item.acceptedMemberUserIds ? [...item.acceptedMemberUserIds] : undefined,
      pendingMemberUserIds: item.pendingMemberUserIds ? [...item.pendingMemberUserIds] : undefined,
      pricing: 'pricing' in item && item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : ('pricing' in item ? item.pricing : undefined),
      policies: this.clonePolicies(item.policies) ?? undefined,
      slotsEnabled: 'slotsEnabled' in item ? item.slotsEnabled : undefined,
      slotTemplates: 'slotTemplates' in item ? this.cloneSlotTemplates(item.slotTemplates) ?? undefined : undefined,
      topics: 'topics' in item ? item.topics : undefined,
      subEventsEnabled: 'subEventsEnabled' in item ? item.subEventsEnabled : undefined,
      subEventDefinitions: 'subEventDefinitions' in item ? this.cloneSubEventDefinitions(item.subEventDefinitions) ?? undefined : undefined,
      subEvents: 'subEvents' in item ? this.cloneSubEvents(item.subEvents) : undefined,
      mode: 'mode' in item ? item.mode : undefined,
      rating: 'rating' in item ? item.rating : undefined,
      boost: 'boost' in item ? item.boost : undefined,
      affinity: 'affinity' in item ? item.affinity : undefined,
      generated: 'generated' in item ? item.generated : undefined
    };
    if (Object.values(overrides).every(value => value === undefined)) {
      return undefined;
    }
    return overrides;
  }

  private static normalizeTopics(topics: readonly string[] | undefined): string[] {
    if (!Array.isArray(topics)) {
      return [];
    }
    return Array.from(new Set(topics
      .map(topic => `${topic ?? ''}`.trim())
      .filter(topic => topic.length > 0)));
  }

  private static normalizeUserIds(userIds: readonly string[] | undefined): string[] {
    if (!Array.isArray(userIds)) {
      return [];
    }
    return Array.from(new Set(userIds
      .map(userId => `${userId ?? ''}`.trim())
      .filter(userId => userId.length > 0)));
  }

  private static cloneSubEvents(items: readonly ContractTypes.SubEventDTO[] | undefined): ContractTypes.SubEventDTO[] | undefined {
    if (!Array.isArray(items)) {
      return undefined;
    }
    return items.map(item => ({
      ...item,
      location: typeof item.location === 'string' ? item.location : '',
      pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : undefined,
      groups: Array.isArray(item.groups)
        ? item.groups.map((group: ContractTypes.SubEventGroupDTO) => ({ ...group }))
        : []
    }));
  }

  private static cloneSubEventDefinitions(
    items: readonly ContractTypes.SubEventDefinitionDTO[] | undefined
  ): ContractTypes.SubEventDefinitionDTO[] | undefined {
    if (!Array.isArray(items)) {
      return undefined;
    }
    return items.map(item => ({
      ...item,
      pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing,
      groups: Array.isArray(item.groups)
        ? item.groups.map((group: ContractTypes.SubEventGroupDTO) => ({ ...group }))
        : []
    }));
  }

  private static clonePolicies(items: readonly ContractTypes.EventPolicyDTO[] | undefined): ContractTypes.EventPolicyDTO[] | undefined {
    if (!Array.isArray(items)) {
      return undefined;
    }
    return items.map(item => ({
      ...item,
      subEventDefinitions: this.cloneSubEventDefinitions(item.subEventDefinitions) ?? item.subEventDefinitions
    }));
  }

  static rebaseSeedDateTime(value: string | Date | null | undefined): string | undefined {
    return SeedScheduleBuilder.rebaseDateTime(value);
  }

  private static normalizeGeneratedSeedDateTime(value: string | Date | null | undefined): string | undefined {
    const parsed = this.parseSeedDateTime(value);
    if (!parsed) {
      return undefined;
    }
    return AppUtils.toIsoDateTimeLocal(parsed);
  }

  private static buildSeededTimeframeLabel(options: {
    hint?: string | null;
    startAtIso: string;
    endAtIso: string;
    frequency?: string | null;
    slotTemplates?: readonly ContractTypes.EventSlotTemplateDTO[] | null;
  }): string {
    const startAt = this.parseSeedDateTime(options.startAtIso);
    const endAt = this.parseSeedDateTime(options.endAtIso);
    if (!startAt || !endAt) {
      return `${options.hint ?? ''}`.trim() || 'Date unavailable';
    }
    const frequency = `${options.frequency ?? this.parseFrequencyFromTimeframe(options.hint ?? '')}`.trim();
    const normalizedFrequency = frequency.toLowerCase();
    const hasMultipleSlots = (options.slotTemplates?.length ?? 0) > 1;
    const dateLabel = this.formatSeedMonthDay(startAt);
    const startTimeLabel = this.formatSeedTime(startAt);
    const endTimeLabel = this.formatSeedTime(endAt);

    if (normalizedFrequency === 'weekly') {
      const weekdayLabel = startAt.toLocaleDateString('en-US', { weekday: 'short' });
      return hasMultipleSlots
        ? `Every ${weekdayLabel} · ${this.formatSeedMonthDay(startAt)} - ${this.formatSeedMonthDay(endAt)}`
        : `Every ${weekdayLabel} · ${startTimeLabel}`;
    }

    if (normalizedFrequency === 'bi-weekly' || normalizedFrequency === 'biweekly') {
      const weekdayLabel = startAt.toLocaleDateString('en-US', { weekday: 'short' });
      return `Every 2nd ${weekdayLabel} · ${startTimeLabel}`;
    }

    if (normalizedFrequency === 'monthly') {
      return `Monthly · ${this.describeMonthlyOccurrence(startAt)} · ${startTimeLabel}`;
    }

    if (normalizedFrequency === 'daily') {
      return `Daily · ${startTimeLabel}`;
    }

    if (normalizedFrequency === 'yearly' || normalizedFrequency === 'annual') {
      return `Yearly · ${this.formatSeedMonthDay(startAt)}`;
    }

    if (hasMultipleSlots) {
      return `${dateLabel} · multiple slots`;
    }

    if (endAt.getTime() - startAt.getTime() >= (24 * 60 * 60 * 1000)) {
      return `${this.formatSeedMonthDay(startAt)} - ${this.formatSeedMonthDay(endAt)}`;
    }

    return `${dateLabel} · ${startTimeLabel} - ${endTimeLabel}`;
  }

  private static cloneRebasedSlotTemplates(
    items: readonly ContractTypes.EventSlotTemplateDTO[] | undefined
  ): ContractTypes.EventSlotTemplateDTO[] | undefined {
    if (!Array.isArray(items)) {
      return undefined;
    }
    return items.map(item => ({
      ...item,
      startAt: this.rebaseSeedDateTime(item.startAt) ?? item.startAt,
      overrideDate: item.overrideDate ? (this.rebaseSeedDateTime(item.overrideDate) ?? item.overrideDate) : item.overrideDate,
      subEventDefinitions: this.cloneSubEventDefinitions(item.subEventDefinitions) ?? item.subEventDefinitions
    }));
  }

  private static cloneRebasedSubEvents(
    items: readonly ContractTypes.SubEventDTO[] | undefined
  ): ContractTypes.SubEventDTO[] | undefined {
    if (!Array.isArray(items)) {
      return undefined;
    }
    return items.map(item => ({
      ...item,
      startAt: this.rebaseSeedDateTime(item.startAt) ?? item.startAt,
      endAt: this.rebaseSeedDateTime(item.endAt) ?? item.endAt,
      location: typeof item.location === 'string' ? item.location : '',
      pricing: item.pricing ? this.rebasePricingConfig(item.pricing) : undefined,
      groups: Array.isArray(item.groups)
        ? item.groups.map((group: ContractTypes.SubEventGroupDTO) => ({ ...group }))
        : []
    }));
  }

  private static rebasePricingConfig(value: ContractTypes.PricingConfig): ContractTypes.PricingConfig {
    const pricing = PricingBuilder.clonePricingConfig(value);
    pricing.slotOverrides = (pricing.slotOverrides ?? []).map(item => ({
      ...item,
      startAt: this.rebaseSeedDateTime(item.startAt) ?? item.startAt,
      endAt: this.rebaseSeedDateTime(item.endAt) ?? item.endAt
    }));
    return pricing;
  }

  private static cloneSlotTemplates(
    items: readonly ContractTypes.EventSlotTemplateDTO[] | undefined
  ): ContractTypes.EventSlotTemplateDTO[] | undefined {
    if (!Array.isArray(items)) {
      return undefined;
    }
    return items.map(item => ({ ...item }));
  }

  private static normalizeCount(value: number | null | undefined): number | null {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }

  private static uniqueAffinityTokens(values: readonly string[]): string[] {
    const seen = new Set<string>();
    for (const value of values) {
      const normalized = AppUtils.normalizeText(`${value ?? ''}`.replace(/^#+\s*/, '').trim());
      if (normalized) {
        seen.add(normalized);
      }
    }
    return [...seen];
  }

  private static resolveAffinityTokenScore(tokens: readonly string[], seedPrefix: string): number {
    return tokens.reduce((total, token) => total + ((AppUtils.hashText(`${seedPrefix}:${token}`) % 997) + 1), 0);
  }

  private static parseFrequencyFromTimeframe(timeframe: string): string {
    const normalized = timeframe.toLowerCase();
    if (normalized.includes('2nd') || normalized.includes('bi-weekly') || normalized.includes('biweekly')) {
      return 'Bi-weekly';
    }
    if (normalized.includes('every')) {
      return 'Weekly';
    }
    if (normalized.includes('monthly')) {
      return 'Monthly';
    }
    if (normalized.includes('yearly') || normalized.includes('annual')) {
      return 'Yearly';
    }
    if (normalized.includes('daily')) {
      return 'Daily';
    }
    return 'One-time';
  }

  private static parseSeedDateTime(value: string | Date | null | undefined): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : new Date(value);
    }
    if (!value?.trim()) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  private static formatSeedMonthDay(value: Date): string {
    return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private static formatSeedTime(value: Date): string {
    return value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  private static describeMonthlyOccurrence(value: Date): string {
    const weekday = value.toLocaleDateString('en-US', { weekday: 'short' });
    const occurrence = Math.floor((value.getDate() - 1) / 7);
    const labels = ['First', 'Second', 'Third', 'Fourth', 'Fifth'] as const;
    return `${labels[occurrence] ?? 'Last'} ${weekday}`;
  }

  private static resolveLocationCoordinatesFromCreator(creator: UserDto): LocationCoordinates {
    return SeedUserBuilder.resolveDemoLocationCoordinates(creator.city, creator.id);
  }

  private static cloneLocationCoordinates(
    value: LocationCoordinates | null | undefined
  ): LocationCoordinates | null {
    if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) {
      return null;
    }
    return {
      latitude: value.latitude,
      longitude: value.longitude
    };
  }
}
