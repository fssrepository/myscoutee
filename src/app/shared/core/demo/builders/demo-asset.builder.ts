import type * as AppTypes from '../../base/models';
import type { DemoUser } from '../../base/interfaces/user.interface';
import { PricingBuilder } from '../../base/builders/pricing.builder';

export class DemoAssetBuilder {
  static defaultAssetImage(type: AppTypes.AssetType, seed = type.toLowerCase()): string {
    const flavor = type === 'Car'
      ? 'road'
      : type === 'Accommodation'
        ? 'stay'
        : 'gear';
    const normalizedSeed = encodeURIComponent(`${type.toLowerCase()}-${flavor}-${seed || type.toLowerCase()}`);
    return `https://picsum.photos/seed/${normalizedSeed}/1200/700`;
  }

  static defaultAssetSubtitle(type: AppTypes.AssetType): string {
    if (type === 'Car') {
      return 'Seats + luggage capacity';
    }
    if (type === 'Accommodation') {
      return 'Rooms + sleeping spots';
    }
    return 'Packed items + delivery window';
  }

  static defaultAssetDetails(type: AppTypes.AssetType): string {
    if (type === 'Car') {
      return 'Route, pickup time, and luggage constraints are confirmed.';
    }
    if (type === 'Accommodation') {
      return 'Check-in details, room setup, and stay notes are confirmed.';
    }
    return 'Item condition, handoff location, and timing are confirmed.';
  }

  static buildSampleAssetCards(users: readonly DemoUser[]): AppTypes.AssetCard[] {
    void users;
    const sampleSpecs: Array<{
      id: string;
      type: AppTypes.AssetType;
      title: string;
      subtitle: string;
      category: AppTypes.AssetCategory;
      city: string;
      capacityTotal: number;
      quantity: number;
      details: string;
      routes: string[];
      pricingMode: AppTypes.PricingMode;
    }> = [
      {
        id: 'asset-car-1',
        type: 'Car',
        title: 'City-to-Lake SUV',
        subtitle: 'Hyundai Tucson · Automatic',
        category: 'Ride',
        city: 'Austin',
        capacityTotal: 4,
        quantity: 1,
        details: 'Pickup from Downtown at 17:30. Luggage: 2 cabin bags.',
        routes: ['Austin Downtown', 'Round Rock', 'Lake Travis'],
        pricingMode: 'hybrid'
      },
      {
        id: 'asset-car-2',
        type: 'Car',
        title: 'Airport Shuttle Hatchback',
        subtitle: 'Volkswagen Golf · Manual',
        category: 'Ride',
        city: 'Austin',
        capacityTotal: 4,
        quantity: 1,
        details: 'Airport run before midnight, fuel split evenly.',
        routes: ['Austin Airport', 'Domain Northside'],
        pricingMode: 'demand-based'
      },
      {
        id: 'asset-car-3',
        type: 'Car',
        title: 'Volunteer Crew Van',
        subtitle: 'Ford Transit · Automatic',
        category: 'Ride',
        city: 'Austin',
        capacityTotal: 7,
        quantity: 1,
        details: 'Best for crew transfers and bulky kit runs.',
        routes: ['Austin Central', 'Expo Grounds', 'River Park'],
        pricingMode: 'time-based'
      },
      {
        id: 'asset-car-4',
        type: 'Car',
        title: 'Summit Transfer Sedan',
        subtitle: 'Toyota Corolla · Hybrid',
        category: 'Ride',
        city: 'Austin',
        capacityTotal: 4,
        quantity: 1,
        details: 'Quiet ride for speaker pickup and return.',
        routes: ['Austin Station', 'Summit Hotel'],
        pricingMode: 'fixed'
      },
      {
        id: 'asset-acc-1',
        type: 'Accommodation',
        title: 'South Congress Loft',
        subtitle: '2 bedrooms · 1 living room',
        category: 'Stay',
        city: 'Austin',
        capacityTotal: 4,
        quantity: 1,
        details: 'Check-in after 15:00. Quiet building, no smoking.',
        routes: ['101 South Congress Ave, Austin'],
        pricingMode: 'time-based'
      },
      {
        id: 'asset-acc-2',
        type: 'Accommodation',
        title: 'Eastside Guest Room',
        subtitle: 'Private room · Shared bathroom',
        category: 'Stay',
        city: 'Austin',
        capacityTotal: 2,
        quantity: 1,
        details: 'Ideal for early risers. Parking available.',
        routes: ['East 6th Street, Austin'],
        pricingMode: 'fixed'
      },
      {
        id: 'asset-acc-3',
        type: 'Accommodation',
        title: 'Harbor View Studio',
        subtitle: 'Studio loft · Self check-in',
        category: 'Stay',
        city: 'San Diego',
        capacityTotal: 2,
        quantity: 1,
        details: 'Compact overnight stay close to the venue route.',
        routes: ['Harbor Drive, San Diego'],
        pricingMode: 'hybrid'
      },
      {
        id: 'asset-acc-4',
        type: 'Accommodation',
        title: 'Riverside Family Flat',
        subtitle: '3 rooms · Kitchen access',
        category: 'Stay',
        city: 'Denver',
        capacityTotal: 5,
        quantity: 1,
        details: 'Good for short host-team overnights with gear.',
        routes: ['Riverfront District, Denver'],
        pricingMode: 'demand-based'
      },
      {
        id: 'asset-sup-1',
        type: 'Supplies',
        title: 'Camping Gear Kit',
        subtitle: 'Tent + lamps + first aid',
        category: 'Camping',
        city: 'Austin',
        capacityTotal: 6,
        quantity: 6,
        details: 'Packed and ready in the garage. Pickup only.',
        routes: [],
        pricingMode: 'fixed'
      },
      {
        id: 'asset-sup-2',
        type: 'Supplies',
        title: 'Game Night Box',
        subtitle: 'Board games + cards + speakers',
        category: 'Games',
        city: 'Austin',
        capacityTotal: 4,
        quantity: 4,
        details: 'Can deliver to venue before 19:00.',
        routes: [],
        pricingMode: 'fixed'
      },
      {
        id: 'asset-sup-3',
        type: 'Supplies',
        title: 'Field Kitchen Crate',
        subtitle: 'Burners + pots + serving tools',
        category: 'Cooking',
        city: 'Austin',
        capacityTotal: 5,
        quantity: 5,
        details: 'Built for fast meal prep at outdoor sub-events.',
        routes: [],
        pricingMode: 'time-based'
      },
      {
        id: 'asset-sup-4',
        type: 'Supplies',
        title: 'PA Speaker Pack',
        subtitle: 'Mixer + speakers + stands',
        category: 'Audio',
        city: 'Austin',
        capacityTotal: 3,
        quantity: 3,
        details: 'Venue handoff includes cable bag and quick setup notes.',
        routes: [],
        pricingMode: 'hybrid'
      },
      {
        id: 'asset-sup-5',
        type: 'Supplies',
        title: 'Safety Marshal Kit',
        subtitle: 'Radios + torches + hi-vis gear',
        category: 'Safety',
        city: 'Austin',
        capacityTotal: 8,
        quantity: 8,
        details: 'Counted at handoff and best for larger moving groups.',
        routes: [],
        pricingMode: 'fixed'
      },
      {
        id: 'asset-sup-6',
        type: 'Supplies',
        title: 'Popup Decor Set',
        subtitle: 'Lanterns + signage + table runners',
        category: 'Decor',
        city: 'Austin',
        capacityTotal: 6,
        quantity: 6,
        details: 'Packed by zone so styling the venue stays fast.',
        routes: [],
        pricingMode: 'fixed'
      },
      {
        id: 'asset-sup-7',
        type: 'Supplies',
        title: 'Trail Repair Tools',
        subtitle: 'Pumps + patches + multi-tools',
        category: 'Sports',
        city: 'Austin',
        capacityTotal: 5,
        quantity: 5,
        details: 'Best for active-day support and quick fixes on site.',
        routes: [],
        pricingMode: 'demand-based'
      },
      {
        id: 'asset-sup-8',
        type: 'Supplies',
        title: 'Charging Station Tote',
        subtitle: 'Power banks + strips + cables',
        category: 'Tech',
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
        sourceLink: imageUrl,
        routes: [...spec.routes],
        pricing: PricingBuilder.createSamplePricingConfig(spec.pricingMode),
        requests: []
      };
    });
  }
}
