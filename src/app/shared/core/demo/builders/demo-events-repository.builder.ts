import { APP_STATIC_DATA } from '../../../app-static-data';
import { ActivityMembersBuilder } from '../../base/builders/activity-members.builder';
import { PricingBuilder } from '../../base/builders/pricing.builder';
import { DemoEventSeedBuilder } from './demo-event-seed.builder';
import { DemoUserSeedBuilder } from './demo-user-seed.builder';
import type * as AppTypes from '../../../core/base/models';
import { AppUtils } from '../../../app-utils';
import type { DemoUser } from '../../base/interfaces/user.interface';
import type { EventMenuItem, HostingMenuItem, InvitationMenuItem } from '../../base/interfaces/activity-feed.interface';
import type { LocationCoordinates } from '../../base/interfaces';
import type {
  DemoEventRecord,
  DemoEventRecordCollection,
  DemoRepositoryEventItemType
} from '../models/events.model';

const DEMO_EVENT_MEMBER_USERS = DemoUserSeedBuilder.buildExpandedDemoUsers(50)
  .filter(user => !DemoUserSeedBuilder.isEmptyOnboardingProfileUserId(user.id));

function buildCheckoutDemoPolicies(): AppTypes.EventPolicyItem[] {
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
  slotTemplates: readonly AppTypes.EventSlotTemplate[] = []
): AppTypes.PricingConfig {
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
      endAt: slot.endAt,
      price: basePrice + (index * 6),
      currency: 'USD'
    }));
  } else {
    pricing.slotPricingEnabled = false;
    pricing.slotOverrides = [];
  }
  return pricing;
}

function buildCheckoutDemoSubEvents(options: {
  sourceId: string;
  firstSlotStartAt: string;
  firstSlotEndAt: string;
  includePaidOptional: boolean;
}): AppTypes.SubEventFormItem[] {
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
      startAt: options.firstSlotStartAt,
      endAt: options.firstSlotEndAt,
      optional: false,
      capacityMin: 0,
      capacityMax: 24,
      membersAccepted: 0,
      membersPending: 0,
      carsPending: 0,
      accommodationPending: 0,
      suppliesPending: 0,
      pricing: includedPricing,
      slotStartOffsetMinutes: 0,
      slotDurationMinutes: 75
    },
    {
      id: `${options.sourceId}-vip-lounge`,
      name: options.includePaidOptional ? 'VIP Lounge Access' : 'Community Lounge Access',
      description: options.includePaidOptional
        ? 'Optional add-on with a separate basket line and accommodation request support.'
        : 'Optional free add-on for the slot-based join flow.',
      startAt: options.firstSlotStartAt,
      endAt: options.firstSlotEndAt,
      optional: true,
      capacityMin: 0,
      capacityMax: 10,
      membersAccepted: 0,
      membersPending: 0,
      carsPending: 0,
      accommodationPending: 0,
      suppliesPending: 0,
      accommodationCapacityMin: 0,
      accommodationCapacityMax: options.includePaidOptional ? 4 : 0,
      pricing: paidAddOnPricing,
      slotStartOffsetMinutes: 20,
      slotDurationMinutes: 45
    },
    {
      id: `${options.sourceId}-ride-share`,
      name: 'Ride-share Pickup',
      description: 'Optional transport-style add-on so checkout can show an asset request path too.',
      startAt: options.firstSlotStartAt,
      endAt: options.firstSlotEndAt,
      optional: true,
      capacityMin: 0,
      capacityMax: 12,
      membersAccepted: 0,
      membersPending: 0,
      carsPending: 0,
      accommodationPending: 0,
      suppliesPending: 0,
      carsCapacityMin: 0,
      carsCapacityMax: 3,
      pricing: transportPricing,
      slotStartOffsetMinutes: 0,
      slotDurationMinutes: 20
    }
  ];
}

const SEED_INVITATIONS_BY_USER: Record<string, InvitationMenuItem[]> = {
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

const SEED_EVENTS_BY_USER: Record<string, EventMenuItem[]> = {
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
          startAt: '2026-04-12T18:30:00',
          endAt: '2026-04-12T20:00:00'
        },
        {
          id: 'checkout-paid-slots-slot-2',
          startAt: '2026-04-12T20:15:00',
          endAt: '2026-04-12T22:15:00'
        }
      ],
      pricing: buildCheckoutDemoPricing(38, [
        {
          id: 'checkout-paid-slots-slot-1',
          startAt: '2026-04-12T18:30:00',
          endAt: '2026-04-12T20:00:00'
        },
        {
          id: 'checkout-paid-slots-slot-2',
          startAt: '2026-04-12T20:15:00',
          endAt: '2026-04-12T22:15:00'
        }
      ]),
      policies: buildCheckoutDemoPolicies(),
      subEvents: buildCheckoutDemoSubEvents({
        sourceId: 'checkout-paid-slots',
        firstSlotStartAt: '2026-04-12T18:30:00',
        firstSlotEndAt: '2026-04-12T20:00:00',
        includePaidOptional: true
      }),
      rating: 9.2,
      relevance: 99
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
      subEvents: buildCheckoutDemoSubEvents({
        sourceId: 'checkout-paid-policy',
        firstSlotStartAt: '2026-04-13T19:10:00',
        firstSlotEndAt: '2026-04-13T20:30:00',
        includePaidOptional: true
      }),
      rating: 9.1,
      relevance: 98
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
          startAt: '2026-04-14T13:00:00',
          endAt: '2026-04-14T14:15:00'
        },
        {
          id: 'checkout-free-slots-slot-2',
          startAt: '2026-04-14T15:00:00',
          endAt: '2026-04-14T16:30:00'
        }
      ],
      pricing: PricingBuilder.createDefaultPricingConfig('event'),
      subEvents: buildCheckoutDemoSubEvents({
        sourceId: 'checkout-free-slots',
        firstSlotStartAt: '2026-04-14T13:00:00',
        firstSlotEndAt: '2026-04-14T14:15:00',
        includePaidOptional: false
      }),
      rating: 8.9,
      relevance: 97
    }
  ]
};

const SEED_HOSTING_BY_USER: Record<string, HostingMenuItem[]> = {
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

const SEED_PUBLISHED_BY_ID: Record<string, boolean> = {
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


const SEED_EXPLORE_REBALANCE_BY_OWNER_USER: Record<string, readonly string[]> = {
  u1: ['e2', 'e3', 'e6', 'e8']
};

const MAX_VISIBLE_ACTIVE_EVENTS_PER_USER = 28;

interface DemoEventSeedOverrides {
  startAt?: string;
  endAt?: string;
  distanceKm?: number;
  autoInviter?: boolean;
  frequency?: string;
  ticketing?: boolean;
  visibility?: DemoEventRecord['visibility'];
  blindMode?: DemoEventRecord['blindMode'];
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
  pricing?: AppTypes.PricingConfig | null;
  policies?: AppTypes.EventPolicyItem[];
  slotsEnabled?: boolean;
  slotTemplates?: AppTypes.EventSlotTemplate[];
  subEvents?: AppTypes.SubEventFormItem[];
  subEventsDisplayMode?: AppTypes.SubEventsDisplayMode;
  rating?: number;
  relevance?: number;
  affinity?: number;
}

export class DemoEventsRepositoryBuilder {
  private static readonly SEED_SCHEDULE_REFERENCE_DATE = new Date(2026, 2, 1, 0, 0, 0, 0);

  static buildSeedInvitationItemsByUser(): Record<string, InvitationMenuItem[]> {
    return Object.fromEntries(
      Object.entries(SEED_INVITATIONS_BY_USER).map(([userId, items]) => [userId, items.map(item => ({
        ...item,
        acceptedMemberUserIds: item.acceptedMemberUserIds ? [...item.acceptedMemberUserIds] : item.acceptedMemberUserIds,
        pendingMemberUserIds: item.pendingMemberUserIds ? [...item.pendingMemberUserIds] : item.pendingMemberUserIds,
        policies: item.policies ? item.policies.map(policy => ({ ...policy })) : item.policies
      }))])
    );
  }

  static buildSeedEventItemsByUser(): Record<string, EventMenuItem[]> {
    const seeded = Object.fromEntries(
      Object.entries(SEED_EVENTS_BY_USER).map(([userId, items]) => [
        userId,
        items.map(item => ({
          ...item,
          pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing,
          policies: item.policies ? item.policies.map(policy => ({ ...policy })) : item.policies,
          slotTemplates: item.slotTemplates ? item.slotTemplates.map(slot => ({ ...slot })) : item.slotTemplates,
          subEvents: this.cloneSubEvents(item.subEvents) ?? item.subEvents,
          topics: item.topics ? [...item.topics] : item.topics,
          acceptedMemberUserIds: item.acceptedMemberUserIds ? [...item.acceptedMemberUserIds] : item.acceptedMemberUserIds,
          pendingMemberUserIds: item.pendingMemberUserIds ? [...item.pendingMemberUserIds] : item.pendingMemberUserIds
        }))
      ])
    ) as Record<string, EventMenuItem[]>;

    this.rebalanceSeedExploreItems(seeded);
    return seeded;
  }


  private static rebalanceSeedExploreItems(seedItemsByUser: Record<string, EventMenuItem[]>): void {
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
          topics: item.topics ? [...item.topics] : item.topics
        });
        seedItemsByUser[creatorUserId] = creatorItems;
      }
    }
  }

  static buildSeedHostingItemsByUser(): Record<string, HostingMenuItem[]> {
    return Object.fromEntries(
      Object.entries(SEED_HOSTING_BY_USER).map(([userId, items]) => [
        userId,
        items.map(item => ({
          ...item,
          pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing,
          policies: item.policies ? item.policies.map(policy => ({ ...policy })) : item.policies,
          slotTemplates: item.slotTemplates ? item.slotTemplates.map(slot => ({ ...slot })) : item.slotTemplates,
          subEvents: this.cloneSubEvents(item.subEvents) ?? item.subEvents,
          topics: item.topics ? [...item.topics] : item.topics
        }))
      ])
    );
  }

  static buildSeedPublishedById(): Record<string, boolean> {
    return { ...SEED_PUBLISHED_BY_ID };
  }

  static buildRecordCollection(options: {
    invitationsByUser: Record<string, readonly InvitationMenuItem[]>;
    eventsByUser: Record<string, readonly EventMenuItem[]>;
    hostingByUser: Record<string, readonly HostingMenuItem[]>;
    publishedById?: Record<string, boolean>;
  }): DemoEventRecordCollection {
    const byId: Record<string, DemoEventRecord> = {};
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
          isAdmin: false,
          isInvitation: true,
          isHosting: false,
          isTrashed: false,
          published: true,
          trashedAtIso: null,
          creatorUserId,
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
          isAdmin: item.isAdmin || creatorUserId === userId,
          isInvitation: false,
          isHosting: false,
          isTrashed: false,
          published: item.published ?? (options.publishedById?.[item.id] !== false),
          trashedAtIso: null,
          creatorUserId,
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
          isAdmin: true,
          isInvitation: false,
          isHosting: true,
          isTrashed: false,
          published: item.published ?? (options.publishedById?.[item.id] !== false),
          trashedAtIso: null,
          creatorUserId: creatorUserIdByEventId.get(item.id) ?? userId,
          seed: this.extractSeedOverrides(item)
        });
        ids.push(recordKey);
      }
    }

    return this.rebalanceVisibleActiveEventParticipation({ byId, ids });
  }

  private static rebalanceVisibleActiveEventParticipation(
    collection: DemoEventRecordCollection
  ): DemoEventRecordCollection {
    const nextById = { ...collection.byId };
    const canonicalRecordByEventId = new Map<string, DemoEventRecord>();
    const recordKeysByEventId = new Map<string, string[]>();
    const guaranteedVisibleActiveCountByUser = new Map<string, number>();

    for (const recordKey of collection.ids) {
      const record = collection.byId[recordKey];
      if (!record || record.isInvitation) {
        continue;
      }
      const eventId = record.id.trim();
      if (!eventId) {
        continue;
      }
      const ownerKeys = recordKeysByEventId.get(eventId) ?? [];
      ownerKeys.push(recordKey);
      recordKeysByEventId.set(eventId, ownerKeys);
      const currentPreferred = canonicalRecordByEventId.get(eventId);
      if (!currentPreferred || this.shouldPreferParticipationCanonicalRecord(record, currentPreferred)) {
        canonicalRecordByEventId.set(eventId, record);
      }
      const ownerUserId = record.userId.trim();
      if (
        record.type === 'events'
        && record.isAdmin !== true
        && record.isTrashed !== true
        && record.published !== false
        && ownerUserId.length > 0
        && record.creatorUserId.trim() === ownerUserId
      ) {
        guaranteedVisibleActiveCountByUser.set(ownerUserId, (guaranteedVisibleActiveCountByUser.get(ownerUserId) ?? 0) + 1);
      }
    }

    const remainingGuestSlotsByUser = new Map<string, number>();
    const canonicalRecords = [...canonicalRecordByEventId.values()].sort((left, right) => {
      const delta = AppUtils.toSortableDate(left.startAtIso) - AppUtils.toSortableDate(right.startAtIso);
      if (delta !== 0) {
        return delta;
      }
      return left.id.localeCompare(right.id);
    });

    for (const record of canonicalRecords) {
      const eventId = record.id.trim();
      if (!eventId) {
        continue;
      }
      const creatorUserId = record.creatorUserId.trim();
      const acceptedMemberUserIds = this.normalizeUserIds(record.acceptedMemberUserIds);
      const pendingMemberUserIds = this.normalizeUserIds(record.pendingMemberUserIds)
        .filter(userId => !acceptedMemberUserIds.includes(userId));
      const nextAcceptedMemberUserIds: string[] = [];
      const nextPendingMemberUserIds: string[] = [];
      const seen = new Set<string>();

      const tryKeepUser = (userId: string): boolean => {
        const normalizedUserId = userId.trim();
        if (!normalizedUserId || seen.has(normalizedUserId)) {
          return false;
        }
        seen.add(normalizedUserId);
        if (normalizedUserId === creatorUserId) {
          return true;
        }
        const guaranteedVisibleActiveCount = guaranteedVisibleActiveCountByUser.get(normalizedUserId) ?? 0;
        const remainingGuestSlots = remainingGuestSlotsByUser.get(normalizedUserId)
          ?? Math.max(0, MAX_VISIBLE_ACTIVE_EVENTS_PER_USER - guaranteedVisibleActiveCount);
        if (remainingGuestSlots <= 0) {
          return false;
        }
        remainingGuestSlotsByUser.set(normalizedUserId, remainingGuestSlots - 1);
        return true;
      };

      for (const userId of acceptedMemberUserIds) {
        if (tryKeepUser(userId)) {
          nextAcceptedMemberUserIds.push(userId);
        }
      }
      for (const userId of pendingMemberUserIds) {
        if (tryKeepUser(userId)) {
          nextPendingMemberUserIds.push(userId);
        }
      }

      const acceptedMembers = nextAcceptedMemberUserIds.length;
      const pendingMembers = nextPendingMemberUserIds.length;
      for (const recordKey of recordKeysByEventId.get(eventId) ?? []) {
        const currentRecord = nextById[recordKey];
        if (!currentRecord || currentRecord.isInvitation) {
          continue;
        }
        nextById[recordKey] = {
          ...currentRecord,
          acceptedMembers,
          pendingMembers,
          acceptedMemberUserIds: [...nextAcceptedMemberUserIds],
          pendingMemberUserIds: [...nextPendingMemberUserIds],
          capacityTotal: Math.max(acceptedMembers, currentRecord.capacityTotal)
        };
      }
    }

    return {
      byId: nextById,
      ids: [...collection.ids]
    };
  }

  private static shouldPreferParticipationCanonicalRecord(next: DemoEventRecord, current: DemoEventRecord): boolean {
    if (next.type === 'hosting' && current.type !== 'hosting') {
      return true;
    }
    if (next.type !== 'hosting' && current.type === 'hosting') {
      return false;
    }
    if (next.isAdmin !== current.isAdmin) {
      return next.isAdmin;
    }
    return AppUtils.toSortableDate(next.startAtIso) < AppUtils.toSortableDate(current.startAtIso);
  }

  static cloneRecord(record: DemoEventRecord): DemoEventRecord {
    return {
      ...record,
      locationCoordinates: this.cloneLocationCoordinates(record.locationCoordinates),
      pricing: record.pricing ? PricingBuilder.clonePricingConfig(record.pricing) : undefined,
      policies: (record.policies ?? []).map(item => ({ ...item })),
      slotTemplates: (record.slotTemplates ?? []).map(item => ({ ...item })),
      nextSlot: record.nextSlot ? { ...record.nextSlot } : null,
      upcomingSlots: (record.upcomingSlots ?? []).map(item => ({ ...item })),
      acceptedMemberUserIds: [...record.acceptedMemberUserIds],
      pendingMemberUserIds: [...record.pendingMemberUserIds],
      topics: [...record.topics],
      subEvents: this.cloneSubEvents(record.subEvents)
    };
  }

  static buildRecordKey(
    userId: string,
    type: DemoRepositoryEventItemType,
    sourceId: string
  ): string {
    return `${userId}:${type}:${sourceId}`;
  }

  private static buildCreatorUserIdByEventId(options: {
    invitationsByUser: Record<string, readonly InvitationMenuItem[]>;
    eventsByUser: Record<string, readonly EventMenuItem[]>;
    hostingByUser: Record<string, readonly HostingMenuItem[]>;
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
    item: InvitationMenuItem,
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
    DemoEventRecord,
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
    | 'isAdmin'
    | 'isInvitation'
    | 'isHosting'
    | 'isTrashed'
    | 'published'
    | 'trashedAtIso'
    | 'creatorUserId'
  > & {
    seed?: DemoEventSeedOverrides;
  }): DemoEventRecord {
    const decorations = this.buildRecordDecorations(record);
    return {
      ...record,
      ...decorations,
      timeframe: this.buildSeededTimeframeLabel({
        hint: record.timeframe,
        startAtIso: decorations.startAtIso,
        endAtIso: decorations.endAtIso,
        frequency: decorations.frequency,
        slotTemplates: decorations.slotTemplates
      })
    };
  }

  private static buildRecordDecorations(record: Pick<
    DemoEventRecord,
    | 'id'
    | 'title'
    | 'subtitle'
    | 'type'
    | 'userId'
    | 'activity'
    | 'isAdmin'
    | 'isInvitation'
    | 'published'
    | 'creatorUserId'
    | 'timeframe'
  > & {
    seed?: DemoEventSeedOverrides;
  }): Omit<
    DemoEventRecord,
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
    | 'isAdmin'
    | 'isInvitation'
    | 'isHosting'
    | 'isTrashed'
    | 'published'
    | 'trashedAtIso'
  > {
    const creator = this.resolveCreatorUser(record.creatorUserId, record.title);
    const frequency = record.seed?.frequency?.trim() || this.parseFrequencyFromTimeframe(record.timeframe ?? '');
    const startAtIso = this.rebaseSeedDateTime(record.seed?.startAt) || this.resolveStartAtIso(record);
    const endAtIso = this.rebaseSeedDateTime(record.seed?.endAt) || this.resolveEndAtIso(record, startAtIso);
    const distanceKm = Number.isFinite(record.seed?.distanceKm)
      ? Math.max(0, Number(record.seed?.distanceKm))
      : this.resolveDistanceKm(record);
    const visibility = record.seed?.visibility ?? this.resolveVisibility(record);
    const blindMode = record.seed?.blindMode ?? this.resolveBlindMode(record);
    const capacityRange = this.resolveCapacityRange(record);
    const seededMembers = this.buildSeededMemberIds(record, startAtIso, distanceKm, creator);
    const acceptedMemberUserIds = this.normalizeUserIds(record.seed?.acceptedMemberUserIds);
    const pendingMemberUserIds = this.normalizeUserIds(record.seed?.pendingMemberUserIds);
    const members = this.normalizeDirectEventMembers(record, creator.id, {
      acceptedMemberUserIds: acceptedMemberUserIds.length > 0
        ? acceptedMemberUserIds
        : seededMembers.acceptedMemberUserIds,
      pendingMemberUserIds: pendingMemberUserIds.length > 0
        ? pendingMemberUserIds
        : seededMembers.pendingMemberUserIds
    });
    const acceptedMembers = members.acceptedMemberUserIds.length;
    const pendingMembers = members.pendingMemberUserIds.length;
    const capacityMin = this.normalizeCount(record.seed?.capacityMin) ?? this.normalizeCount(capacityRange.min);
    const capacityMax = this.normalizeCount(record.seed?.capacityMax) ?? this.normalizeCount(capacityRange.max);
    const capacityTotal = Math.max(
      acceptedMembers,
      this.normalizeCount(record.seed?.capacityTotal) ?? capacityMax ?? acceptedMembers
    );
    const slotTemplates = this.cloneRebasedSlotTemplates(record.seed?.slotTemplates) ?? [];
    const topics = this.normalizeTopics(record.seed?.topics).length > 0
      ? this.normalizeTopics(record.seed?.topics)
      : this.buildSeededTopics(record.id, record.title, record.subtitle);
    const subEvents = this.cloneRebasedSubEvents(record.seed?.subEvents)
      ?? this.buildSeededSubEvents(record, startAtIso, endAtIso, creator.id, capacityRange);
    const rating = Number.isFinite(record.seed?.rating)
      ? Number(record.seed?.rating)
      : this.buildSeededRating(record.id, record.title, record.type);
    const acceptedUsers = members.acceptedMemberUserIds
      .map(userId => DEMO_EVENT_MEMBER_USERS.find(user => user.id === userId) ?? null)
      .filter((user): user is DemoUser => Boolean(user));
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
      generated: false,
      eventType: 'main',
      nextSlot: null,
      upcomingSlots: [],
      acceptedMembers,
      pendingMembers,
      acceptedMemberUserIds: members.acceptedMemberUserIds,
      pendingMemberUserIds: members.pendingMemberUserIds,
      topics,
      subEvents,
      subEventsDisplayMode: record.seed?.subEventsDisplayMode ?? DemoEventSeedBuilder.inferredSubEventsDisplayMode(subEvents),
      rating,
      relevance: Number.isFinite(record.seed?.relevance)
        ? Number(record.seed?.relevance)
        : this.buildSeededRelevance(record.id, record.title, record.type),
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
    creator?: Partial<DemoUser> | null;
    acceptedUsers?: ReadonlyArray<Partial<DemoUser> | null | undefined>;
    rating?: number | null;
    acceptedMembers?: number | null;
    capacityTotal?: number | null;
  }): number {
    const participantUsers = [options.creator ?? null, ...(options.acceptedUsers ?? [])]
      .filter((user): user is Partial<DemoUser> => Boolean(user));
    const participantAffinities = participantUsers
      .filter(user => typeof user.id === 'string' && user.id.trim().length > 0)
      .map(user => DemoUserSeedBuilder.resolveUserAffinity({
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

  private static resolveCreatorUser(userId: string, fallbackTitle: string): DemoUser {
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
    record: Pick<DemoEventRecord, 'id' | 'type' | 'userId' | 'title'>
  ): string {
    return `${record.type}:${record.userId}:${record.id}:${record.title}`;
  }

  private static resolveStartAtIso(
    record: Pick<DemoEventRecord, 'id' | 'type' | 'userId' | 'title'>
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
    record: Pick<DemoEventRecord, 'id' | 'type' | 'userId' | 'title'>,
    startAtIso: string
  ): string {
    const startAt = new Date(startAtIso);
    if (Number.isNaN(startAt.getTime())) {
      return AppUtils.toIsoDateTimeLocal(new Date());
    }
    const seed = AppUtils.hashText(`event-duration:${this.recordSeedKey(record)}`);
    const durationMinutes = 90 + ((seed % 5) * 30);
    return AppUtils.toIsoDateTimeLocal(new Date(startAt.getTime() + (durationMinutes * 60 * 1000)));
  }

  private static resolveDistanceKm(
    record: Pick<DemoEventRecord, 'id' | 'type' | 'userId' | 'title'>
  ): number {
    const seed = AppUtils.hashText(`event-distance:${this.recordSeedKey(record)}`);
    const baseDistance = record.type === 'hosting' ? 4 : record.type === 'invitations' ? 2 : 6;
    const distance = baseDistance + (seed % 24) + (((seed >> 5) % 10) / 10);
    return Math.round(distance * 10) / 10;
  }

  private static resolveVisibility(
    record: Pick<DemoEventRecord, 'id' | 'type' | 'userId' | 'title'>
  ): DemoEventRecord['visibility'] {
    const seed = AppUtils.hashText(`event-visibility:${this.recordSeedKey(record)}`);
    if (record.type === 'hosting') {
      return seed % 4 === 0 ? 'Friends only' : 'Invitation only';
    }
    const variants: DemoEventRecord['visibility'][] = ['Public', 'Friends only', 'Invitation only'];
    return variants[seed % variants.length] ?? 'Public';
  }

  private static resolveBlindMode(
    record: Pick<DemoEventRecord, 'id' | 'type' | 'userId' | 'title'>
  ): DemoEventRecord['blindMode'] {
    const seed = AppUtils.hashText(`event-blind-mode:${this.recordSeedKey(record)}`);
    return seed % 5 === 0 ? 'Blind Event' : 'Open Event';
  }

  private static resolveCapacityRange(
    record: Pick<DemoEventRecord, 'id' | 'type' | 'userId' | 'title' | 'activity'>
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


  private static normalizeDirectEventMembers(
    record: Pick<DemoEventRecord, 'type' | 'userId' | 'isAdmin' | 'isInvitation'>,
    _creatorUserId: string,
    members: { acceptedMemberUserIds: string[]; pendingMemberUserIds: string[] }
  ): { acceptedMemberUserIds: string[]; pendingMemberUserIds: string[] } {
    const ownerUserId = record.userId.trim();
    const normalizedAcceptedMemberUserIds = this.normalizeUserIds(members.acceptedMemberUserIds);
    const normalizedPendingMemberUserIds = this.normalizeUserIds(members.pendingMemberUserIds)
      .filter(userId => !normalizedAcceptedMemberUserIds.includes(userId));
    if (record.isInvitation) {
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
    if (record.type !== 'events' || record.isInvitation || !ownerUserId) {
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
    record: Pick<DemoEventRecord, 'id' | 'type' | 'userId' | 'title'>
  ): string {
    const normalizedSeed = encodeURIComponent(this.recordSeedKey(record).toLowerCase().replace(/\s+/g, '-'));
    return `https://picsum.photos/seed/demo-event-${normalizedSeed}/1200/700`;
  }

  private static buildRecordSourceLink(
    record: Pick<DemoEventRecord, 'id' | 'type' | 'userId'>
  ): string {
    const typeSegment = record.type === 'hosting' ? 'hosting' : record.type === 'invitations' ? 'invitation' : 'event';
    return `https://example.com/${typeSegment}/${encodeURIComponent(record.userId)}/${encodeURIComponent(record.id)}`;
  }

  private static buildSeededLocation(
    record: Pick<DemoEventRecord, 'id' | 'title' | 'type'>,
    creator: DemoUser
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
    record: Pick<DemoEventRecord, 'id' | 'type' | 'userId' | 'title'>,
    creator: DemoUser,
    location: string
  ): LocationCoordinates {
    return DemoUserSeedBuilder.resolveDemoLocationCoordinates(
      creator.city || 'Austin',
      `event-location:${this.recordSeedKey(record)}:${location}`
    );
  }

  private static resolveAutoInviter(
    record: Pick<DemoEventRecord, 'id' | 'type' | 'userId' | 'title'>
  ): boolean {
    const seed = AppUtils.hashText(`event-auto-inviter:${this.recordSeedKey(record)}`);
    return record.type !== 'invitations' && (seed % 4 === 0);
  }

  private static resolveTicketing(
    record: Pick<DemoEventRecord, 'id' | 'type' | 'userId' | 'title'>
  ): boolean {
    const seed = AppUtils.hashText(`event-ticketing:${this.recordSeedKey(record)}`);
    if (record.type === 'invitations') {
      return false;
    }
    return (seed % 3) === 0;
  }

  private static buildSeededMemberIds(
    record: Pick<DemoEventRecord, 'id' | 'type' | 'userId' | 'title' | 'subtitle' | 'activity' | 'isAdmin'>,
    startAtIso: string,
    distanceKm: number,
    creator: DemoUser
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
    const row: AppTypes.ActivityListRow = {
      id: record.id,
      type: record.type === 'hosting' ? 'hosting' : 'events',
      title: record.title,
      subtitle: record.subtitle,
      detail: startAtIso,
      dateIso: startAtIso,
      distanceKm,
      unread: record.activity,
      metricScore: record.activity,
      isAdmin: record.type === 'hosting' ? true : record.isAdmin,
      source: {
        id: record.id,
        avatar: creator.initials,
        title: record.title,
        shortDescription: record.subtitle,
        timeframe: startAtIso,
        activity: record.activity,
        isAdmin: record.type === 'hosting' ? true : record.isAdmin
      } as AppTypes.ActivityListRow['source']
    };
    const rowKey = `${row.type}:${row.id}`;
    const members = ActivityMembersBuilder.generateActivityMembersForRow(
      row,
      rowKey,
      DEMO_EVENT_MEMBER_USERS,
      creator
    );
    return {
      acceptedMemberUserIds: members
        .filter(member => member.status === 'accepted')
        .map(member => member.userId),
      pendingMemberUserIds: members
        .filter(member => member.status === 'pending')
        .map(member => member.userId)
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

  private static buildSeededSubEvents(
    record: Pick<DemoEventRecord, 'id' | 'title' | 'subtitle' | 'activity' | 'type' | 'isAdmin'> & { timeframe?: string },
    startAtIso: string,
    endAtIso: string,
    activeUserId: string,
    capacityRange: { min: number; max: number }
  ): AppTypes.SubEventFormItem[] {
    const source = {
      id: record.id,
      avatar: AppUtils.initialsFromText(record.title),
      title: record.title,
      shortDescription: record.subtitle,
      timeframe: record.timeframe ?? startAtIso,
      activity: record.activity,
      ...(record.type === 'events' ? { isAdmin: record.isAdmin } : {})
    } as EventMenuItem | HostingMenuItem;

    return DemoEventSeedBuilder.buildSeededSubEventsForEvent(source, {
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
      defaultStartIso: startAtIso,
      activeUserId
    });
  }

  private static buildSeededRating(id: string, title: string, type: DemoRepositoryEventItemType): number {
    const seed = AppUtils.hashText(`${type}:${id}:${title}`);
    return 6 + ((seed % 35) / 10);
  }

  private static buildSeededRelevance(id: string, title: string, type: DemoRepositoryEventItemType): number {
    const seed = AppUtils.hashText(`${type}:${id}:${title}`);
    return 50 + (seed % 51);
  }

  private static extractSeedOverrides(item: EventMenuItem | HostingMenuItem | InvitationMenuItem): DemoEventSeedOverrides | undefined {
    const overrides: DemoEventSeedOverrides = {
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
      subEvents: 'subEvents' in item ? this.cloneSubEvents(item.subEvents) : undefined,
      subEventsDisplayMode: 'subEventsDisplayMode' in item ? item.subEventsDisplayMode : undefined,
      rating: 'rating' in item ? item.rating : undefined,
      relevance: 'relevance' in item ? item.relevance : undefined,
      affinity: 'affinity' in item ? item.affinity : undefined
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

  private static cloneSubEvents(items: readonly AppTypes.SubEventFormItem[] | undefined): AppTypes.SubEventFormItem[] | undefined {
    if (!Array.isArray(items)) {
      return undefined;
    }
    return items.map(item => ({
      ...item,
      location: typeof item.location === 'string' ? item.location : '',
      pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : undefined,
      groups: Array.isArray(item.groups)
        ? item.groups.map((group: AppTypes.SubEventGroupItem) => ({ ...group }))
        : []
    }));
  }

  private static clonePolicies(items: readonly AppTypes.EventPolicyItem[] | undefined): AppTypes.EventPolicyItem[] | undefined {
    if (!Array.isArray(items)) {
      return undefined;
    }
    return items.map(item => ({ ...item }));
  }

  static rebaseSeedDateTime(value: string | Date | null | undefined): string | undefined {
    const parsed = this.parseSeedDateTime(value);
    if (!parsed) {
      return undefined;
    }
    return AppUtils.toIsoDateTimeLocal(this.shiftSeedDate(parsed));
  }

  private static buildSeededTimeframeLabel(options: {
    hint?: string | null;
    startAtIso: string;
    endAtIso: string;
    frequency?: string | null;
    slotTemplates?: readonly AppTypes.EventSlotTemplate[] | null;
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
    items: readonly AppTypes.EventSlotTemplate[] | undefined
  ): AppTypes.EventSlotTemplate[] | undefined {
    if (!Array.isArray(items)) {
      return undefined;
    }
    return items.map(item => ({
      ...item,
      startAt: this.rebaseSeedDateTime(item.startAt) ?? item.startAt,
      endAt: this.rebaseSeedDateTime(item.endAt) ?? item.endAt,
      overrideDate: item.overrideDate ? (this.rebaseSeedDateTime(item.overrideDate) ?? item.overrideDate) : item.overrideDate
    }));
  }

  private static cloneRebasedSubEvents(
    items: readonly AppTypes.SubEventFormItem[] | undefined
  ): AppTypes.SubEventFormItem[] | undefined {
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
        ? item.groups.map((group: AppTypes.SubEventGroupItem) => ({ ...group }))
        : []
    }));
  }

  private static rebasePricingConfig(value: AppTypes.PricingConfig): AppTypes.PricingConfig {
    const pricing = PricingBuilder.clonePricingConfig(value);
    pricing.slotOverrides = (pricing.slotOverrides ?? []).map(item => ({
      ...item,
      startAt: this.rebaseSeedDateTime(item.startAt) ?? item.startAt,
      endAt: this.rebaseSeedDateTime(item.endAt) ?? item.endAt
    }));
    return pricing;
  }

  private static cloneSlotTemplates(
    items: readonly AppTypes.EventSlotTemplate[] | undefined
  ): AppTypes.EventSlotTemplate[] | undefined {
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

  private static shiftSeedDate(value: Date): Date {
    return new Date(value.getTime() + this.resolveSeedScheduleShiftMs());
  }

  private static resolveSeedScheduleShiftMs(): number {
    const today = new Date();
    const rollingAnchor = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.round((rollingAnchor.getTime() - this.SEED_SCHEDULE_REFERENCE_DATE.getTime()) / dayMs);
    return Math.round(diffDays / 7) * 7 * dayMs;
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

  private static resolveLocationCoordinatesFromCreator(creator: DemoUser): LocationCoordinates {
    return DemoUserSeedBuilder.resolveDemoLocationCoordinates(creator.city, creator.id);
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
