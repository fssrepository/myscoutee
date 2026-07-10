import type { AssetPolicyRecord, AssetPricingConfigRecord } from '../../source/entity/asset.entity';

import * as AppConstants from '../../../common/constants';

export interface SeedAssetTemplate {
  id: string;
  type: AppConstants.AssetType;
  title: string;
  subtitle: string;
  category: AppConstants.AssetCategory;
  city: string;
  capacityTotal: number;
  quantity: number;
  details: string;
  imageUrl: string;
  sourceLink: string;
  routes: string[];
  topics?: string[];
  policies?: AssetPolicyRecord[];
  pricing?: AssetPricingConfigRecord | null;
  requests: [];
  menuActions?: string[];
}

export class SeedAssetBuilder {
  static createSamplePricingConfig(
    mode: AppConstants.PricingMode = 'hybrid'
  ): AssetPricingConfigRecord {
    return {
      enabled: true,
      mode,
      basePrice: 25,
      currency: 'USD',
      taxMode: 'excluded',
      chargeType: 'per_attendee',
      quantityRulesEnabled: false,
      quantityRules: [],
      minPrice: 15,
      maxPrice: 60,
      rounding: 'whole',
      demandRulesEnabled: mode === 'demand-based' || mode === 'hybrid',
      demandRules: [
        {
          id: 'demand-rule-1',
          operator: 'gte',
          capacityFilledPercent: 50,
          action: {
            kind: 'increase_percent',
            value: 10
          },
          appliesTo: 'all_slots',
          slotIds: []
        }
      ],
      timeRulesEnabled: mode === 'time-based' || mode === 'hybrid',
      timeRules: [
        {
          id: 'time-rule-1',
          trigger: 'days_before_start',
          offsetValue: 7,
          specificDateStart: null,
          specificDateEnd: null,
          action: {
            kind: 'decrease_percent',
            value: 5
          },
          appliesTo: 'all_slots',
          slotIds: []
        }
      ],
      cancellationPolicy: {
        enabled: true,
        rules: [
          {
            id: 'cancellation-rule-1',
            offsetUnit: 'days',
            offsetValue: 7,
            refundKind: 'percent',
            refundValue: 50
          },
          {
            id: 'cancellation-rule-2',
            offsetUnit: 'hours',
            offsetValue: 24,
            refundKind: 'none',
            refundValue: null
          }
        ]
      },
      slotPricingEnabled: false,
      slotOverrides: [],
      audience: {
        enabled: false,
        memberPrice: 20,
        vipPrice: 15,
        inviteOnlyDiscountPercent: 25,
        promoCodes: [
          {
            id: 'promo-code-1',
            code: 'EARLY',
            action: {
              kind: 'decrease_percent',
              value: 10
            }
          }
        ],
        soldOutLabel: 'Show "Sold Out"'
      }
    };
  }

  static clonePricingConfig(
    pricing: AssetPricingConfigRecord | null | undefined
  ): AssetPricingConfigRecord | null {
    if (!pricing) {
      return null;
    }
    return {
      ...pricing,
      quantityRules: (pricing.quantityRules ?? []).map(rule => ({
        ...rule,
        action: { ...rule.action }
      })),
      demandRules: (pricing.demandRules ?? []).map(rule => ({
        ...rule,
        action: { ...rule.action },
        slotIds: [...(rule.slotIds ?? [])]
      })),
      timeRules: (pricing.timeRules ?? []).map(rule => ({
        ...rule,
        action: { ...rule.action },
        slotIds: [...(rule.slotIds ?? [])]
      })),
      cancellationPolicy: {
        enabled: pricing.cancellationPolicy?.enabled === true,
        rules: (pricing.cancellationPolicy?.rules ?? []).map(rule => ({ ...rule }))
      },
      slotOverrides: (pricing.slotOverrides ?? []).map(item => ({ ...item })),
      audience: {
        ...pricing.audience,
        promoCodes: (pricing.audience?.promoCodes ?? []).map(code => ({
          ...code,
          action: { ...code.action }
        }))
      }
    };
  }

  static defaultAssetImage(type: AppConstants.AssetType, seed = type.toLowerCase()): string {
    const flavor = type === AppConstants.ASSET_TYPE_TRANSPORT
      ? 'transport'
      : type === AppConstants.ASSET_TYPE_ACCOMMODATION
        ? 'property'
        : 'gear';
    const normalizedSeed = encodeURIComponent(`${type.toLowerCase()}-${flavor}-${seed || type.toLowerCase()}`);
    return `https://picsum.photos/seed/${normalizedSeed}/1200/700`;
  }

  static defaultAssetSubtitle(type: AppConstants.AssetType): string {
    if (type === AppConstants.ASSET_TYPE_TRANSPORT) {
      return 'Passenger capacity + luggage space';
    }
    if (type === AppConstants.ASSET_TYPE_ACCOMMODATION) {
      return 'Rooms + sleeping spots';
    }
    return 'Packed items + delivery window';
  }

  static defaultAssetDetails(type: AppConstants.AssetType): string {
    if (type === AppConstants.ASSET_TYPE_TRANSPORT) {
      return 'Route, pickup time, and luggage constraints are confirmed.';
    }
    if (type === AppConstants.ASSET_TYPE_ACCOMMODATION) {
      return 'Check-in details, room setup, and property notes are confirmed.';
    }
    return 'Item condition, handoff location, and timing are confirmed.';
  }

  static buildSampleAssetCards(users: readonly unknown[]): SeedAssetTemplate[] {
    void users;
    const sampleSpecs: Array<{
      id: string;
      type: AppConstants.AssetType;
      title: string;
      subtitle: string;
      category: AppConstants.AssetCategory;
      city: string;
      capacityTotal: number;
      quantity: number;
      details: string;
      routes: string[];
      pricingMode: AppConstants.PricingMode;
    }> = [
      {
        id: 'asset-transport-1',
        type: AppConstants.ASSET_TYPE_TRANSPORT,
        title: 'City-to-Lake SUV',
        subtitle: 'Hyundai Tucson · Automatic',
        category: AppConstants.TRANSPORT_CATEGORY_SUV,
        city: 'Austin',
        capacityTotal: 4,
        quantity: 1,
        details: 'Pickup from Downtown at 17:30. Luggage: 2 cabin bags.',
        routes: ['Austin Downtown', 'Round Rock', 'Lake Travis'],
        pricingMode: 'hybrid'
      },
      {
        id: 'asset-transport-2',
        type: AppConstants.ASSET_TYPE_TRANSPORT,
        title: 'Airport Shuttle Hatchback',
        subtitle: 'Volkswagen Golf · Manual',
        category: AppConstants.TRANSPORT_CATEGORY_SHUTTLE,
        city: 'Austin',
        capacityTotal: 4,
        quantity: 1,
        details: 'Airport run before midnight, fuel split evenly.',
        routes: ['Austin Airport', 'Domain Northside'],
        pricingMode: 'demand-based'
      },
      {
        id: 'asset-transport-3',
        type: AppConstants.ASSET_TYPE_TRANSPORT,
        title: 'Volunteer Crew Van',
        subtitle: 'Ford Transit · Automatic',
        category: AppConstants.TRANSPORT_CATEGORY_VAN,
        city: 'Austin',
        capacityTotal: 7,
        quantity: 1,
        details: 'Best for crew transfers and bulky kit runs.',
        routes: ['Austin Central', 'Expo Grounds', 'River Park'],
        pricingMode: 'time-based'
      },
      {
        id: 'asset-transport-4',
        type: AppConstants.ASSET_TYPE_TRANSPORT,
        title: 'Summit Transfer Sedan',
        subtitle: 'Toyota Corolla · Hybrid',
        category: AppConstants.TRANSPORT_CATEGORY_SEDAN,
        city: 'Austin',
        capacityTotal: 4,
        quantity: 1,
        details: 'Quiet ride for speaker pickup and return.',
        routes: ['Austin Station', 'Summit Hotel'],
        pricingMode: 'fixed'
      },
      {
        id: 'asset-acc-1',
        type: AppConstants.ASSET_TYPE_ACCOMMODATION,
        title: 'South Congress Loft',
        subtitle: '2 bedrooms · 1 living room',
        category: AppConstants.ACCOMMODATION_CATEGORY_APARTMENT,
        city: 'Austin',
        capacityTotal: 4,
        quantity: 1,
        details: 'Check-in after 15:00. Quiet building, no smoking.',
        routes: ['101 South Congress Ave, Austin'],
        pricingMode: 'time-based'
      },
      {
        id: 'asset-acc-2',
        type: AppConstants.ASSET_TYPE_ACCOMMODATION,
        title: 'Eastside Guest Room',
        subtitle: 'Private room · Shared bathroom',
        category: AppConstants.ACCOMMODATION_CATEGORY_ROOM,
        city: 'Austin',
        capacityTotal: 2,
        quantity: 1,
        details: 'Ideal for early risers. Parking available.',
        routes: ['East 6th Street, Austin'],
        pricingMode: 'fixed'
      },
      {
        id: 'asset-acc-3',
        type: AppConstants.ASSET_TYPE_ACCOMMODATION,
        title: 'Harbor View Studio',
        subtitle: 'Studio loft · Self check-in',
        category: AppConstants.ACCOMMODATION_CATEGORY_APARTMENT,
        city: 'San Diego',
        capacityTotal: 2,
        quantity: 1,
        details: 'Compact overnight stay close to the venue route.',
        routes: ['Harbor Drive, San Diego'],
        pricingMode: 'hybrid'
      },
      {
        id: 'asset-acc-4',
        type: AppConstants.ASSET_TYPE_ACCOMMODATION,
        title: 'Riverside Family Flat',
        subtitle: '3 rooms · Kitchen access',
        category: AppConstants.ACCOMMODATION_CATEGORY_HOUSE,
        city: 'Denver',
        capacityTotal: 5,
        quantity: 1,
        details: 'Good for short host-team overnights with gear.',
        routes: ['Riverfront District, Denver'],
        pricingMode: 'demand-based'
      },
      {
        id: 'asset-sup-1',
        type: AppConstants.ASSET_TYPE_SUPPLIES,
        title: 'Camping Gear Kit',
        subtitle: 'Tent + lamps + first aid',
        category: AppConstants.SUPPLIES_CATEGORY_CAMPING,
        city: 'Austin',
        capacityTotal: 6,
        quantity: 6,
        details: 'Packed and ready in the garage. Pickup only.',
        routes: [],
        pricingMode: 'fixed'
      },
      {
        id: 'asset-sup-2',
        type: AppConstants.ASSET_TYPE_SUPPLIES,
        title: 'Game Night Box',
        subtitle: 'Board games + cards + speakers',
        category: AppConstants.SUPPLIES_CATEGORY_GAMES,
        city: 'Austin',
        capacityTotal: 4,
        quantity: 4,
        details: 'Can deliver to venue before 19:00.',
        routes: [],
        pricingMode: 'fixed'
      },
      {
        id: 'asset-sup-3',
        type: AppConstants.ASSET_TYPE_SUPPLIES,
        title: 'Field Kitchen Crate',
        subtitle: 'Burners + pots + serving tools',
        category: AppConstants.SUPPLIES_CATEGORY_COOKING,
        city: 'Austin',
        capacityTotal: 5,
        quantity: 5,
        details: 'Built for fast meal prep at outdoor sub-events.',
        routes: [],
        pricingMode: 'time-based'
      },
      {
        id: 'asset-sup-4',
        type: AppConstants.ASSET_TYPE_SUPPLIES,
        title: 'PA Speaker Pack',
        subtitle: 'Mixer + speakers + stands',
        category: AppConstants.SUPPLIES_CATEGORY_AUDIO,
        city: 'Austin',
        capacityTotal: 3,
        quantity: 3,
        details: 'Venue handoff includes cable bag and quick setup notes.',
        routes: [],
        pricingMode: 'hybrid'
      },
      {
        id: 'asset-sup-5',
        type: AppConstants.ASSET_TYPE_SUPPLIES,
        title: 'Safety Marshal Kit',
        subtitle: 'Radios + torches + hi-vis gear',
        category: AppConstants.SUPPLIES_CATEGORY_SAFETY,
        city: 'Austin',
        capacityTotal: 8,
        quantity: 8,
        details: 'Counted at handoff and best for larger moving groups.',
        routes: [],
        pricingMode: 'fixed'
      },
      {
        id: 'asset-sup-6',
        type: AppConstants.ASSET_TYPE_SUPPLIES,
        title: 'Popup Decor Set',
        subtitle: 'Lanterns + signage + table runners',
        category: AppConstants.SUPPLIES_CATEGORY_DECOR,
        city: 'Austin',
        capacityTotal: 6,
        quantity: 6,
        details: 'Packed by zone so styling the venue stays fast.',
        routes: [],
        pricingMode: 'fixed'
      },
      {
        id: 'asset-sup-7',
        type: AppConstants.ASSET_TYPE_SUPPLIES,
        title: 'Trail Repair Tools',
        subtitle: 'Pumps + patches + multi-tools',
        category: AppConstants.SUPPLIES_CATEGORY_SPORTS,
        city: 'Austin',
        capacityTotal: 5,
        quantity: 5,
        details: 'Best for active-day support and quick fixes on site.',
        routes: [],
        pricingMode: 'demand-based'
      },
      {
        id: 'asset-sup-8',
        type: AppConstants.ASSET_TYPE_SUPPLIES,
        title: 'Charging Station Tote',
        subtitle: 'Power banks + strips + cables',
        category: AppConstants.SUPPLIES_CATEGORY_TECH,
        city: 'Austin',
        capacityTotal: 7,
        quantity: 7,
        details: 'Labelled by connector type for fast check-in and return.',
        routes: [],
        pricingMode: 'hybrid'
      }
    ];

    return sampleSpecs.map(spec => {
      const imageUrl = this.defaultAssetImage(spec.type, spec.id);
      return {
        id: spec.id,
        type: spec.type,
        title: spec.title,
        subtitle: spec.subtitle,
        category: spec.category,
        city: spec.city,
        capacityTotal: spec.capacityTotal,
        quantity: spec.quantity,
        details: spec.details,
        imageUrl,
        sourceLink: '',
        routes: [...spec.routes],
        pricing: this.createSamplePricingConfig(spec.pricingMode),
        requests: []
      };
    });
  }
}
