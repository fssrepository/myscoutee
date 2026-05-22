import { AppUtils } from '../../../app-utils';
import type { ChatRecord } from '../../base/models/chat.model';
import type { UserGameFilterPreferencesDto } from '../../base/interfaces/game.interface';
import type { DemoUserListItemDto, UserDto } from '../../base/interfaces/user.interface';
import { DemoUserMenuCountersBuilder } from './demo-user-menu-counters.builder';

interface DemoUsersRepositoryActivitySources {
  chatItems?: readonly ChatRecord[];
  invitationItems?: ReadonlyArray<{ unread: number }>;
  eventItems?: ReadonlyArray<{ activity: number }>;
  eventsCount?: number;
  hostingItems?: ReadonlyArray<{ activity: number }>;
  rateItems?: readonly unknown[];
  carsCount?: number;
  accommodationCount?: number;
  suppliesCount?: number;
  ticketsCount?: number;
  contactsCount?: number;
  feedbackCount?: number;
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
      profileDetails: user.profileDetails
        ? user.profileDetails.map(group => ({
          title: `${group.title ?? ''}`,
          rows: (group.rows ?? []).map(row => ({
            labelKey: `${row.labelKey ?? ''}`,
            value: `${row.value ?? ''}`,
            privacy: row.privacy,
            options: [...(row.options ?? [])]
          }))
        }))
        : undefined,
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
      statusText: user.statusText,
      completion: user.completion,
      profileFormVersion: user.profileFormVersion,
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
          ? sources.invitationItems.length
          : user.activities.invitations,
        events: Number.isFinite(sources.eventsCount)
          ? Math.max(0, Math.trunc(Number(sources.eventsCount)))
          : sources.eventItems
            ? sources.eventItems.length
          : user.activities.events,
        hosting: sources.hostingItems
          ? sources.hostingItems.length
          : user.activities.hosting,
        game: sources.rateItems
          ? sources.rateItems.length
          : user.activities.game,
        cars: Number.isFinite(sources.carsCount)
          ? Math.max(0, Math.trunc(Number(sources.carsCount)))
          : user.activities.cars,
        accommodation: Number.isFinite(sources.accommodationCount)
          ? Math.max(0, Math.trunc(Number(sources.accommodationCount)))
          : user.activities.accommodation,
        supplies: Number.isFinite(sources.suppliesCount)
          ? Math.max(0, Math.trunc(Number(sources.suppliesCount)))
          : user.activities.supplies,
        tickets: Number.isFinite(sources.ticketsCount)
          ? Math.max(0, Math.trunc(Number(sources.ticketsCount)))
          : user.activities.tickets,
        contacts: Number.isFinite(sources.contactsCount)
          ? Math.max(0, Math.trunc(Number(sources.contactsCount)))
          : user.activities.contacts,
        feedback: Number.isFinite(sources.feedbackCount)
          ? Math.max(0, Math.trunc(Number(sources.feedbackCount)))
          : user.activities.feedback
      }
    };
  }
}
