import { AppUtils } from '../../../app-utils';
import type { ChatMenuItem } from '../../base/interfaces/activity-feed.interface';
import type { UserGameFilterPreferencesDto } from '../../base/interfaces/game.interface';
import type { DemoUserListItemDto, UserDto } from '../../base/interfaces/user.interface';
import { DemoUserMenuCountersBuilder } from './demo-user-menu-counters.builder';

interface DemoUsersRepositoryActivitySources {
  chatItems?: readonly ChatMenuItem[];
  invitationItems?: ReadonlyArray<{ unread: number }>;
  eventItems?: ReadonlyArray<{ activity: number }>;
  hostingItems?: ReadonlyArray<{ activity: number }>;
  minDemoEventItemsPerUser: number;
}

export class DemoUsersRepositoryBuilder {
  static buildRecordCollection(users: readonly UserDto[]): { byId: Record<string, UserDto>; ids: string[] } {
    const byId: Record<string, UserDto> = {};
    const ids: string[] = [];
    for (const user of users) {
      byId[user.id] = this.cloneUser(user);
      ids.push(user.id);
    }
    return { byId, ids };
  }

  static cloneUser(user: UserDto): UserDto {
    return {
      ...user,
      locationCoordinates: user.locationCoordinates
        ? {
          latitude: user.locationCoordinates.latitude,
          longitude: user.locationCoordinates.longitude
        }
        : undefined,
      languages: [...(user.languages ?? [])],
      images: [...(user.images ?? [])],
      impressions: user.impressions
        ? {
          host: user.impressions.host
            ? {
              ...user.impressions.host,
              vibeBadges: [...(user.impressions.host.vibeBadges ?? [])],
              personalityBadges: [...(user.impressions.host.personalityBadges ?? [])],
              personalityTraits: (user.impressions.host.personalityTraits ?? []).map(trait => ({ ...trait })),
              categoryBadges: [...(user.impressions.host.categoryBadges ?? [])]
            }
            : undefined,
          member: user.impressions.member
            ? {
              ...user.impressions.member,
              vibeBadges: [...(user.impressions.member.vibeBadges ?? [])],
              personalityBadges: [...(user.impressions.member.personalityBadges ?? [])],
              personalityTraits: (user.impressions.member.personalityTraits ?? []).map(trait => ({ ...trait })),
              categoryBadges: [...(user.impressions.member.categoryBadges ?? [])]
            }
            : undefined
        }
        : undefined,
      activities: {
        ...user.activities
      }
    };
  }

  static cloneFilterPreferences(preferences: UserGameFilterPreferencesDto): UserGameFilterPreferencesDto {
    return {
      ...preferences,
      interests: [...(preferences.interests ?? [])],
      values: [...(preferences.values ?? [])],
      physiques: [...(preferences.physiques ?? [])],
      languages: [...(preferences.languages ?? [])],
      genders: [...(preferences.genders ?? [])],
      horoscopes: [...(preferences.horoscopes ?? [])],
      traitLabels: [...(preferences.traitLabels ?? [])],
      smoking: [...(preferences.smoking ?? [])],
      drinking: [...(preferences.drinking ?? [])],
      workout: [...(preferences.workout ?? [])],
      pets: [...(preferences.pets ?? [])],
      familyPlans: [...(preferences.familyPlans ?? [])],
      children: [...(preferences.children ?? [])],
      loveStyles: [...(preferences.loveStyles ?? [])],
      communicationStyles: [...(preferences.communicationStyles ?? [])],
      sexualOrientations: [...(preferences.sexualOrientations ?? [])],
      religions: [...(preferences.religions ?? [])]
    };
  }

  static toDemoUserListItem(user: UserDto): DemoUserListItemDto {
    return {
      id: user.id,
      name: user.name,
      city: user.city,
      initials: user.initials,
      gender: user.gender,
      profileStatus: user.profileStatus,
      deletedAtIso: user.deletedAtIso ?? null
    };
  }

  static applySeededActivityCounts(
    user: UserDto,
    sources: DemoUsersRepositoryActivitySources
  ): UserDto {
    return {
      ...user,
      activities: {
        ...user.activities,
        chat: sources.chatItems
          ? DemoUserMenuCountersBuilder.resolveSectionBadge(sources.chatItems.map(item => item.unread), sources.chatItems.length)
          : user.activities.chat,
        invitations: sources.invitationItems
          ? DemoUserMenuCountersBuilder.resolveSectionBadge(
            sources.invitationItems.map(item => item.unread),
            sources.invitationItems.length
          )
          : user.activities.invitations,
        events: sources.eventItems
          ? (
            DemoUserMenuCountersBuilder.resolveSectionBadge(
              sources.eventItems.map(item => item.activity),
              sources.eventItems.length
            ) +
            DemoUserMenuCountersBuilder.syntheticEventActivityTotal(
              sources.eventItems.length,
              sources.minDemoEventItemsPerUser
            )
          )
          : user.activities.events,
        hosting: sources.hostingItems
          ? DemoUserMenuCountersBuilder.resolveSectionBadge(
            sources.hostingItems.map(item => item.activity),
            sources.hostingItems.length
          )
          : user.activities.hosting
      }
    };
  }
}
