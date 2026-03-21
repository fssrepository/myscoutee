import type * as AppTypes from '../../base/models';
import type { DemoUser } from '../../../demo-data';

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
    return [
      {
        id: 'asset-car-1',
        type: 'Car',
        title: 'City-to-Lake SUV',
        subtitle: 'Hyundai Tucson · Automatic',
        city: 'Austin',
        capacityTotal: 4,
        details: 'Pickup from Downtown at 17:30. Luggage: 2 cabin bags.',
        imageUrl: this.defaultAssetImage('Car', 'car-1'),
        sourceLink: this.defaultAssetImage('Car', 'car-1'),
        routes: ['Austin Downtown', 'Round Rock', 'Lake Travis'],
        requests: [
          this.buildAssetRequest('asset-member-1', 'u4', 'pending', 'Needs one medium suitcase slot.', users),
          this.buildAssetRequest('asset-member-2', 'u8', 'accepted', 'Can meet at 6th Street.', users),
          this.buildAssetRequest('asset-member-7', 'u2', 'accepted', 'Travels light with backpack only.', users)
        ]
      },
      {
        id: 'asset-car-2',
        type: 'Car',
        title: 'Airport Shuttle Hatchback',
        subtitle: 'Volkswagen Golf · Manual',
        city: 'Austin',
        capacityTotal: 4,
        details: 'Airport run before midnight, fuel split evenly.',
        imageUrl: this.defaultAssetImage('Car', 'car-2'),
        sourceLink: this.defaultAssetImage('Car', 'car-2'),
        routes: ['Austin Airport', 'Domain Northside'],
        requests: [this.buildAssetRequest('asset-member-3', 'u6', 'pending', 'Landing at 22:40.', users)]
      },
      {
        id: 'asset-acc-1',
        type: 'Accommodation',
        title: 'South Congress Loft',
        subtitle: '2 bedrooms · 1 living room',
        city: 'Austin',
        capacityTotal: 4,
        details: 'Check-in after 15:00. Quiet building, no smoking.',
        imageUrl: this.defaultAssetImage('Accommodation', 'acc-1'),
        sourceLink: this.defaultAssetImage('Accommodation', 'acc-1'),
        routes: ['101 South Congress Ave, Austin'],
        requests: [
          this.buildAssetRequest('asset-member-4', 'u3', 'pending', 'Staying for 2 nights.', users),
          this.buildAssetRequest('asset-member-5', 'u10', 'accepted', 'Can share room.', users)
        ]
      },
      {
        id: 'asset-acc-2',
        type: 'Accommodation',
        title: 'Eastside Guest Room',
        subtitle: 'Private room · Shared bathroom',
        city: 'Austin',
        capacityTotal: 2,
        details: 'Ideal for early risers. Parking available.',
        imageUrl: this.defaultAssetImage('Accommodation', 'acc-2'),
        sourceLink: this.defaultAssetImage('Accommodation', 'acc-2'),
        routes: ['East 6th Street, Austin'],
        requests: [this.buildAssetRequest('asset-member-6', 'u11', 'pending', 'Arrives Friday evening.', users)]
      },
      {
        id: 'asset-sup-1',
        type: 'Supplies',
        title: 'Camping Gear Kit',
        subtitle: 'Tent + lamps + first aid',
        city: 'Austin',
        capacityTotal: 6,
        details: 'Packed and ready in the garage. Pickup only.',
        imageUrl: this.defaultAssetImage('Supplies', 'sup-1'),
        sourceLink: this.defaultAssetImage('Supplies', 'sup-1'),
        routes: [],
        requests: []
      },
      {
        id: 'asset-sup-2',
        type: 'Supplies',
        title: 'Game Night Box',
        subtitle: 'Board games + cards + speakers',
        city: 'Austin',
        capacityTotal: 4,
        details: 'Can deliver to venue before 19:00.',
        imageUrl: this.defaultAssetImage('Supplies', 'sup-2'),
        sourceLink: this.defaultAssetImage('Supplies', 'sup-2'),
        routes: [],
        requests: []
      }
    ];
  }

  private static buildAssetRequest(
    id: string,
    userId: string,
    status: AppTypes.AssetRequestStatus,
    note: string,
    users: readonly DemoUser[]
  ): AppTypes.AssetMemberRequest {
    const user = users.find(item => item.id === userId) ?? users[0] ?? null;
    if (!user) {
      return {
        id,
        userId,
        name: 'Unknown User',
        initials: 'UN',
        gender: 'man',
        status,
        note
      };
    }
    return {
      id,
      userId,
      name: user.name,
      initials: user.initials,
      gender: user.gender,
      status,
      note
    };
  }
}
