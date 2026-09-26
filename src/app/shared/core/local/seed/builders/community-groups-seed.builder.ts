import type { CommunityGroupRecord } from '../../source/entity/community-group.entity';
import type { ActivityMemberRecord } from '../../source/entity/activity.entity';
import type { UserRecord } from '../../source/entity/user.entity';

interface SeedMember { name: string; status: 'accepted' | 'pending'; requestKind?: 'invite' | 'join'; role?: 'Admin' | 'Member'; }
interface SeedDefinition {
  id: string; owner: string; name: string; description: string;
  category: CommunityGroupRecord['category']; visibility: CommunityGroupRecord['visibility'];
  hideMembers: boolean; requiredFields: readonly string[]; imageSlot: number | null; members: readonly SeedMember[];
}

const COMMUNITY_GROUP_SEED_DATE = '2026-09-20T12:00:00.000Z';
const COMMUNITY_GROUP_SEEDS: readonly SeedDefinition[] = [
  {
    id: 'seed-community-seattle-friends', owner: 'Alex Turner', name: 'Seattle Friends',
    description: 'Coffee, walks and relaxed meetups around Seattle.',
    category: 'friends', visibility: 'public', hideMembers: false,
    requiredFields: [], imageSlot: 1,
    members: [{ name: 'Nagy Eszter', status: 'accepted' }, { name: 'Maya Stone', status: 'pending', requestKind: 'join' }]
  },
  {
    id: 'seed-community-design-circle', owner: 'Alex Turner', name: 'Design Circle',
    description: 'A small invited team for sharing work and creative ideas.',
    category: 'work', visibility: 'invitation', hideMembers: true,
    requiredFields: ['profile.profession'], imageSlot: 2,
    members: [{ name: 'Lina Park', status: 'accepted' }, { name: 'Noah Hart', status: 'pending', requestKind: 'invite' }]
  },
  {
    id: 'seed-community-trail-club', owner: 'Nagy Eszter', name: 'Seattle Trail Club',
    description: 'Weekend walks and hikes for all experience levels.',
    category: 'sport', visibility: 'public', hideMembers: false,
    requiredFields: ['profile.details.interest'], imageSlot: 3,
    members: [{ name: 'Kai Morgan', status: 'accepted' }, { name: 'Farkas Anna', status: 'accepted' }]
  },
  {
    id: 'seed-community-language-lab', owner: 'Maya Stone', name: 'Language Lab',
    description: 'Practice languages together in a friendly small group.',
    category: 'learning', visibility: 'private', hideMembers: true,
    requiredFields: [], imageSlot: 4,
    members: [{ name: 'Kiss Balázs', status: 'accepted' }]
  },
  {
    id: 'seed-community-photo-walks', owner: 'Lina Park', name: 'Photo Walks',
    description: 'Explore the city and share your favourite photographs.',
    category: 'hobbies', visibility: 'public', hideMembers: false,
    requiredFields: ['profile.details.interest'], imageSlot: 5,
    members: [{ name: 'Alex Turner', status: 'accepted' }, { name: 'Nagy Eszter', status: 'accepted' }]
  },
  {
    id: 'seed-community-makers', owner: 'Noah Hart', name: 'Makers Network',
    description: 'Meet local makers and collaborate on small projects.',
    category: 'work', visibility: 'private', hideMembers: false,
    requiredFields: ['profile.profession', 'profile.experience.workplace'], imageSlot: 6,
    members: [{ name: 'Alex Turner', status: 'pending', requestKind: 'join' }, { name: 'Lina Park', status: 'accepted' }]
  },
  {
    id: 'seed-community-game-night', owner: 'Kai Morgan', name: 'Game Night',
    description: 'An invitation-only circle for board games and conversation.',
    category: 'friends', visibility: 'invitation', hideMembers: false,
    requiredFields: [], imageSlot: 7,
    members: [{ name: 'Alex Turner', status: 'pending', requestKind: 'invite' }, { name: 'Noah Hart', status: 'accepted' }]
  },
  {
    id: 'seed-community-neighbours', owner: 'Nagy Eszter', name: 'Seattle Neighbours',
    description: 'Neighbourhood news, shared plans and nearby activities.',
    category: 'neighbourhood', visibility: 'public', hideMembers: false,
    requiredFields: [], imageSlot: null,
    members: [{ name: 'Maya Stone', status: 'accepted' }]
  },
  {
    id: 'seed-community-book-circle', owner: 'Farkas Anna', name: 'Book Circle',
    description: 'An invited reading circle with monthly book discussions.',
    category: 'hobbies', visibility: 'invitation', hideMembers: true,
    requiredFields: [], imageSlot: 9,
    members: [{ name: 'Kiss Balázs', status: 'accepted' }]
  },
  {
    id: 'seed-community-study-buddies', owner: 'Kiss Balázs', name: 'Study Buddies',
    description: 'Share learning goals and support each other with new skills.',
    category: 'learning', visibility: 'public', hideMembers: false,
    requiredFields: ['profile.experience.school'], imageSlot: 10,
    members: [{ name: 'Alex Turner', status: 'accepted' }, { name: 'Farkas Anna', status: 'pending', requestKind: 'join' }]
  }
];

export class SeedCommunityGroupsBuilder {
  static build(users: readonly UserRecord[]): { groups: CommunityGroupRecord[]; members: ActivityMemberRecord[]; profiles: UserRecord[] } {
    const byName = new Map(users.filter(user => !user.workspaceGroupId).map(user => [user.name, user]));
    const groups: CommunityGroupRecord[] = [];
    const members: ActivityMemberRecord[] = [];
    const profiles: UserRecord[] = [];
    const date = COMMUNITY_GROUP_SEED_DATE;
    const milliseconds = Date.parse(date);
    const account = (name: string): UserRecord => {
      const user = byName.get(name);
      if (!user) throw new Error(`Missing community seed account: ${name}`);
      return user;
    };
    for (const definition of COMMUNITY_GROUP_SEEDS) {
      const owner = account(definition.owner);
      const group: CommunityGroupRecord = {
        id: definition.id, ownerUserId: owner.id, name: definition.name, description: definition.description,
        // Slots 1–10 share the existing event image pool with the HTTP seed.
        imageUrl: definition.imageSlot ? `https://picsum.photos/id/${49 + definition.imageSlot}/1200/700` : null,
        category: definition.category, visibility: definition.visibility, hideMembers: definition.hideMembers,
        policy: { workspace: true, enabled: definition.requiredFields.length > 0, requiredFields: [...definition.requiredFields] },
        createdAtIso: date, updatedAtIso: date, version: 0, moderationStatus: 'accepted',
        pendingMembers: definition.members.filter(member => member.status === 'pending').length
      };
      groups.push(group);
      const roster: readonly SeedMember[] = [{ name: definition.owner, status: 'accepted', role: 'Admin' }, ...definition.members];
      for (const entry of roster) {
        const user = account(entry.name);
        const ownerKey = `community:${group.id}`;
        members.push({
          id: `${ownerKey}:${user.id}`, ownerKey, ownerType: 'community', ownerId: group.id, userId: user.id,
          name: user.name, initials: user.initials, gender: user.gender, city: user.city, statusText: '',
          role: entry.role ?? 'Member', status: entry.status, requestKind: entry.requestKind ?? null,
          pendingSource: entry.requestKind ? entry.requestKind === 'invite' ? 'admin' : 'member' : null,
          invitedByActiveUser: false, invitedByUserId: entry.requestKind === 'invite' ? owner.id : null,
          metWhere: group.name, metAtIso: date, actionAtIso: date, avatarUrl: user.images?.[0] ?? '', organizerOnly: false,
          createdMs: milliseconds, updatedMs: milliseconds, createdAtIso: date, updatedAtIso: date
        });
        if (entry.status !== 'accepted') continue;
        const profile: UserRecord = {
          id: `group:${group.id}:${user.id}`, workspaceGroupId: group.id, accountUserId: user.id,
          name: user.name, initials: user.initials, age: user.age, birthday: user.birthday, gender: user.gender,
          city: user.city, height: user.height, physique: user.physique, languages: [...user.languages],
          horoscope: user.horoscope, headline: user.headline, about: user.about, images: [...(user.images ?? [])],
          locationCoordinates: user.locationCoordinates ? { ...user.locationCoordinates } : undefined,
          partitionKey: user.partitionKey, profileDetails: structuredClone(user.profileDetails ?? []),
          profileStatus: user.profileStatus, status: user.status, statusText: user.statusText,
          completion: user.completion, profileFormVersion: user.profileFormVersion, hostTier: '', traitLabel: '',
          activities: { game: 0, chats: 0, invitations: 0, events: 0, hosting: 0 }
        };
        for (const section of profile.profileDetails ?? []) for (const row of section.rows) {
          if (definition.requiredFields.includes(row.labelKey)) row.privacy = 'Public';
        }
        profiles.push(profile);
      }
    }
    return { groups, members, profiles };
  }
}
