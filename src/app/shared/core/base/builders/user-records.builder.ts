import { AppUtils } from '../../../app-utils';
import type { UserGameFilterPreferencesDto } from '../interfaces/game.interface';
import type { UserSelectorListItemDto, UserDto } from '../interfaces/user.interface';
import { UserMenuCountersBuilder } from './user-menu-counters.builder';

interface UserRecordsActivitySources {
  chatItems?: ReadonlyArray<{ unread: number }>;
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

export class UserRecordsBuilder {
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

  static toDemoUserListItem(user: UserDto): UserSelectorListItemDto {
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

  static applyDerivedActivityCounts(
    user: UserDto,
    sources: UserRecordsActivitySources
  ): UserDto {
    const normalizeCounter = (value: unknown): number => {
      const count = Number(value);
      return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
    };

    const activities = user.activities;
    const chat = sources.chatItems
      ? UserMenuCountersBuilder.resolveSectionBadge(sources.chatItems.map(item => item.unread), sources.chatItems.length)
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
    const hasEventSources = Boolean(sources.invitationItems)
      || Number.isFinite(sources.eventsCount)
      || Boolean(sources.eventItems)
      || Boolean(sources.hostingItems);
    const eventPending = normalizeCounter(event?.pending);
    const eventDrafts = normalizeCounter(event?.drafts);
    const eventTrash = normalizeCounter(event?.trash);
    const eventActive = hasEventSources ? events : normalizeCounter(event?.active ?? events);
    const eventInvitations = hasEventSources ? invitations : normalizeCounter(event?.invitations ?? invitations);
    const eventHosting = hasEventSources ? hosting : normalizeCounter(event?.hosting ?? hosting);
    const eventAll = hasEventSources
      ? eventActive + eventPending + eventInvitations + eventHosting + eventDrafts
      : normalizeCounter(event?.all ?? events + invitations + hosting);
    const assetCars = Number.isFinite(sources.carsCount) ? cars : normalizeCounter(asset?.cars ?? cars);
    const assetAccommodation = Number.isFinite(sources.accommodationCount)
      ? accommodation
      : normalizeCounter(asset?.accommodation ?? accommodation);
    const assetSupplies = Number.isFinite(sources.suppliesCount) ? supplies : normalizeCounter(asset?.supplies ?? supplies);
    const assetTickets = Number.isFinite(sources.ticketsCount) ? tickets : normalizeCounter(asset?.tickets ?? tickets);
    const eventFeedbackPending = Number.isFinite(sources.feedbackCount)
      ? feedback
      : normalizeCounter(eventFeedback?.pending ?? feedback);

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
          all: eventAll,
          active: eventActive,
          pending: eventPending,
          invitations: eventInvitations,
          hosting: eventHosting,
          drafts: eventDrafts,
          trash: eventTrash,
        },
        asset: {
          cars: assetCars,
          accommodation: assetAccommodation,
          supplies: assetSupplies,
          tickets: assetTickets,
        },
        eventFeedback: {
          ownEvents: normalizeCounter(eventFeedback?.ownEvents),
          pending: eventFeedbackPending,
          feedbacked: normalizeCounter(eventFeedback?.feedbacked),
          removed: normalizeCounter(eventFeedback?.removed),
        }
      }
    };
  }

  static legacySyntheticEventActivityTotal(existingCount: number, minEventsPerUser: number): number {
    return UserMenuCountersBuilder.syntheticEventActivityTotal(existingCount, minEventsPerUser);
  }

  static stableSortSeed(value: string): number {
    return AppUtils.hashText(value);
  }
}
