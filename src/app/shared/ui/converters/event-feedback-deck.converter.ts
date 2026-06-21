import { APP_STATIC_DATA } from '../../app-static-data';
import type * as AppTypes from '../../core/base/models';
import type { ActivityMemberRole } from '../../core/common/constants';
import type {
  EventFeedbackCardSourceDto,
  EventFeedbackDeckResultDto
} from '../../core/contracts/activity.interface';
import type { ImageCardData, InfoCardData } from '../components/card';

export class EventFeedbackDeckConverter {
  static convert(result: EventFeedbackDeckResultDto): AppTypes.EventFeedbackCard[] {
    return (result.cards ?? []).map(card => this.convertCard(card));
  }

  static infoCard(card: AppTypes.EventFeedbackCard): InfoCardData {
    const detailRows = [card.identityTitle].filter((row): row is string => !!row?.trim());
    return {
      id: card.id,
      title: card.heading,
      imageUrl: card.imageUrl,
      metaRows: [card.subheading],
      metaRowsLimit: 1,
      detailRows,
      leadingIcon: {
        icon: card.icon
      },
      clickable: false
    };
  }

  static imageCard(card: AppTypes.EventFeedbackCard): ImageCardData {
    const isEventCard = card.kind === 'event';
    return {
      id: card.id,
      title: isEventCard ? card.heading : card.identityTitle || card.heading,
      subtitle: isEventCard ? card.subheading : card.identitySubtitle || card.subheading,
      detail: isEventCard ? card.identityTitle : null,
      imageUrl: card.imageUrl,
      layout: 'overlay',
      toneClass: card.toneClass,
      placeholderIcon: card.icon,
      placeholderLabel: isEventCard ? 'Event' : 'Member',
      statusChip: {
        icon: card.icon,
        tone: isEventCard ? 'info' : 'success',
        palette: isEventCard ? 'blue' : 'green',
        ariaLabel: isEventCard ? 'Event feedback' : 'Member feedback'
      }
    };
  }

  private static convertCard(source: EventFeedbackCardSourceDto): AppTypes.EventFeedbackCard {
    const eventId = source.eventId.trim();
    const eventTitle = source.eventTitle.trim() || 'Event';
    const eventSubtitle = source.eventSubtitle.trim();
    const eventLabel = source.eventLabel.trim() || source.eventTimeframe.trim() || 'Recent event';
    const targetName = source.targetName.trim() || 'Member';
    const targetCity = source.targetCity?.trim() || '';
    const targetTraitLabel = source.targetTraitLabel?.trim() || 'participant';
    if (source.kind === 'attendee') {
      const targetRole = this.normalizeRole(source.targetRole) ?? 'Member';
      return {
        id: source.id.trim(),
        eventId,
        kind: 'attendee',
        attendeeUserId: source.attendeeUserId?.trim() || undefined,
        targetUserId: source.targetUserId?.trim() || undefined,
        targetRole,
        icon: 'groups',
        imageUrl: source.targetImageUrl?.trim()
          || source.eventImageUrl?.trim()
          || `https://picsum.photos/seed/event-feedback-attendee-${eventId}-${source.targetUserId ?? source.id}/1200/700`,
        toneClass: `feedback-card-tone-attendee ${this.feedbackRoleToneClass(targetRole)}`,
        heading: `${targetName} · ${eventTitle}`,
        subheading: `Attendee feedback · ${eventLabel}`,
        identityTitle: this.identityTitle(targetName, source.targetAge),
        identitySubtitle: [targetRole, targetCity].filter(Boolean).join(' · '),
        identityStatusClass: this.feedbackRoleStatusClass(targetRole),
        identityStatusIcon: this.feedbackRoleStatusIcon(targetRole),
        questionPrimary: `How was collaboration with ${targetName} (${targetTraitLabel}) during this event?`,
        questionSecondary: `Would you team up with ${targetName} again in a future event?`,
        primaryOptions: [...APP_STATIC_DATA.eventFeedbackAttendeeCollabOptions],
        secondaryOptions: [...APP_STATIC_DATA.eventFeedbackAttendeeRejoinOptions],
        traitQuestion: `Which personality traits best matched ${targetName} in this event?`,
        traitOptions: [...APP_STATIC_DATA.eventFeedbackPersonalityTraitOptions],
        selectedTraitIds: [],
        answerPrimary: '',
        answerSecondary: ''
      };
    }

    return {
      id: source.id.trim(),
      eventId,
      kind: 'event',
      targetUserId: source.targetUserId?.trim() || undefined,
      targetRole: 'Admin',
      icon: 'event_available',
      imageUrl: source.eventImageUrl?.trim() || `https://picsum.photos/seed/event-feedback-card-${eventId}/1200/700`,
      toneClass: 'feedback-card-tone-event feedback-role-admin',
      heading: eventTitle,
      subheading: [eventLabel, eventSubtitle].filter(Boolean).join(' · '),
      identityTitle: `${targetName} · Host`,
      identitySubtitle: ['Admin', targetCity].filter(Boolean).join(' · '),
      identityStatusClass: 'member-status-admin',
      identityStatusIcon: 'admin_panel_settings',
      questionPrimary: `How did ${eventTitle} feel for you overall?`,
      questionSecondary: `What should ${targetName} improve next time?`,
      primaryOptions: [...APP_STATIC_DATA.eventFeedbackEventOverallOptions],
      secondaryOptions: [...APP_STATIC_DATA.eventFeedbackHostImproveOptions],
      traitQuestion: `Which traits describe ${targetName} best as the event creator?`,
      traitOptions: [...APP_STATIC_DATA.eventFeedbackPersonalityTraitOptions],
      selectedTraitIds: [],
      answerPrimary: '',
      answerSecondary: ''
    };
  }

  private static identityTitle(name: string, age: number | null | undefined): string {
    const normalizedAge = Number(age);
    if (!Number.isFinite(normalizedAge) || normalizedAge <= 0) {
      return name;
    }
    return `${name}, ${Math.trunc(normalizedAge)}`;
  }

  private static normalizeRole(role: ActivityMemberRole | undefined): ActivityMemberRole | undefined {
    if (role === 'Admin' || role === 'Manager' || role === 'Member') {
      return role;
    }
    return undefined;
  }

  private static feedbackRoleToneClass(role: ActivityMemberRole): string {
    if (role === 'Admin') {
      return 'feedback-role-admin';
    }
    if (role === 'Manager') {
      return 'feedback-role-manager';
    }
    return 'feedback-role-member';
  }

  private static feedbackRoleStatusClass(role: ActivityMemberRole): string {
    if (role === 'Admin') {
      return 'member-status-admin';
    }
    if (role === 'Manager') {
      return 'member-status-manager';
    }
    return 'member-status-member';
  }

  private static feedbackRoleStatusIcon(role: ActivityMemberRole): string {
    if (role === 'Admin') {
      return 'admin_panel_settings';
    }
    if (role === 'Manager') {
      return 'manage_accounts';
    }
    return 'person';
  }
}
