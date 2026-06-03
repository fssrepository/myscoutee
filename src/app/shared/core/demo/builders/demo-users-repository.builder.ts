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
    const normalizeCounter = (value: unknown): number => {
      const count = Number(value);
      return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
    };

    const activities = user.activities;
    const chat = sources.chatItems
      ? DemoUserMenuCountersBuilder.resolveSectionBadge(sources.chatItems.map(item => item.unread), sources.chatItems.length)
      : activities.chat;
    const invitations = sources.invitationItems ? sources.invitationItems.length : activities.invitations;
    const events = Number.isFinite(sources.eventsCount)
      ? normalizeCounter(sources.eventsCount)
      : sources.eventItems
        ? sources.eventItems.length
        : activities.events;
    const hosting = sources.hostingItems ? sources.hostingItems.length : activities.hosting;
    const game = sources.rateItems ? sources.rateItems.length : activities.game;
    const cars = Number.isFinite(sources.carsCount) ? normalizeCounter(sources.carsCount) : activities.cars;
    const accommodation = Number.isFinite(sources.accommodationCount) ? normalizeCounter(sources.accommodationCount) : activities.accommodation;
    const supplies = Number.isFinite(sources.suppliesCount) ? normalizeCounter(sources.suppliesCount) : activities.supplies;
    const tickets = Number.isFinite(sources.ticketsCount) ? normalizeCounter(sources.ticketsCount) : activities.tickets;
    const contacts = Number.isFinite(sources.contactsCount) ? normalizeCounter(sources.contactsCount) : activities.contacts;
    const feedback = Number.isFinite(sources.feedbackCount) ? normalizeCounter(sources.feedbackCount) : activities.feedback;
    const event = activities.event;
    const asset = activities.asset;
    const eventFeedback = activities.eventFeedback;

    return {
      ...user,
      activities: {
        ...activities,
        chat,
        invitations,
        events,
        hosting,
        game,
        cars,
        accommodation,
        supplies,
        tickets,
        contacts,
        feedback,
        event: {
          all: normalizeCounter(event?.all ?? events + invitations + hosting),
          active: normalizeCounter(event?.active ?? events),
          pending: normalizeCounter(event?.pending),
          invitations: normalizeCounter(event?.invitations ?? invitations),
          hosting: normalizeCounter(event?.hosting ?? hosting),
          drafts: normalizeCounter(event?.drafts),
          trash: normalizeCounter(event?.trash),
        },
        asset: {
          cars: normalizeCounter(asset?.cars ?? cars),
          accommodation: normalizeCounter(asset?.accommodation ?? accommodation),
          supplies: normalizeCounter(asset?.supplies ?? supplies),
          tickets: normalizeCounter(asset?.tickets ?? tickets),
        },
        eventFeedback: {
          ownEvents: normalizeCounter(eventFeedback?.ownEvents),
          pending: normalizeCounter(eventFeedback?.pending ?? feedback),
          feedbacked: normalizeCounter(eventFeedback?.feedbacked),
          removed: normalizeCounter(eventFeedback?.removed),
        }
      }
    };
  }
}
