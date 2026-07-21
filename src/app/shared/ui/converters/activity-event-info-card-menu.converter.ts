import type {
  AppMenuItem,
  AppMenuPalette
} from '../components/core/menu';
import type { EventCheckoutState } from '../../core/contracts/activity.interface';
import {
  CARD_MENU_ACTIONS,
  type CardMenuAction
} from '../components/core/smart-list/card';
import type { UiConverter } from './converter.types';

export type ActivityEventInfoCardMenuSubject = Record<string, unknown> & {
  menu: 'activity-event-card';
  id: string;
  status?: string | null;
  ownerUserId?: string | null;
  adminIds?: readonly string[];
  acceptedMemberUserIds?: readonly string[];
  pendingMemberUserIds?: readonly string[];
  invitedMemberUserIds?: readonly string[];
  pendingRequestMemberUserIds?: readonly string[];
  eventScope?: string | null;
  checkoutMenuAction?: 'continueBooking' | 'paymentSummary' | null;
  checkoutState?: EventCheckoutState | null;
};

export interface ActivityEventInfoCardMenuContext {
  menu: 'activity-event-card';
  subject: ActivityEventInfoCardMenuSubject;
  action: CardMenuAction;
}

export interface ActivityEventInfoCardMenuConverterOptions {
  activeUserId?: string | null;
  availableActions?: readonly string[];
  hiddenActions?: readonly string[];
}

export type ActivityEventEditorAction = 'edit' | 'manage' | 'view';

export class ActivityEventInfoCardMenuConverter {
  private static readonly availableActions: readonly string[] = [
    'restore',
    'takeOver',
    'publish',
    'editEvent',
    'manageEvent',
    'viewInvitation',
    'view',
    'paymentSummary',
    'continueBooking',
    'notifyParticipants',
    'askOrganizer',
    'shareEvent',
    'unpublish',
    'reportOrganizer',
    'accept',
    'leaveEvent',
    'deleteEvent',
    'rejectInvitation'
  ];

  static convert(
    subject: ActivityEventInfoCardMenuSubject | null | undefined,
    options: ActivityEventInfoCardMenuConverterOptions = {}
  ): readonly AppMenuItem<string, ActivityEventInfoCardMenuContext>[] {
    if (!subject) {
      return [];
    }
    const availableActions = options.availableActions ?? this.availableActions;
    const hiddenActions = new Set((options.hiddenActions ?? []).map(actionId => `${actionId ?? ''}`.trim()));
    return availableActions
      .filter(actionId => !hiddenActions.has(actionId))
      .flatMap(actionId => this.menuItem(subject, actionId, options.activeUserId ?? ''));
  }

  static canEditEvent(
    subject: ActivityEventInfoCardMenuSubject | null | undefined,
    options: Pick<ActivityEventInfoCardMenuConverterOptions, 'activeUserId'> = {}
  ): boolean {
    return this.eventEditorAction(subject, options) !== 'view';
  }

  static eventEditorAction(
    subject: ActivityEventInfoCardMenuSubject | null | undefined,
    options: Pick<ActivityEventInfoCardMenuConverterOptions, 'activeUserId'> = {}
  ): ActivityEventEditorAction {
    if (!subject) {
      return 'view';
    }
    const activeUserId = options.activeUserId ?? '';
    if (this.isActionVisible(subject, 'editEvent', activeUserId)) {
      return 'edit';
    }
    return this.isActionVisible(subject, 'manageEvent', activeUserId)
      ? 'manage'
      : 'view';
  }

  private static menuItem(
    subject: ActivityEventInfoCardMenuSubject,
    actionId: string,
    activeUserId: string
  ): readonly AppMenuItem<string, ActivityEventInfoCardMenuContext>[] {
    if (!this.isActionVisible(subject, actionId, activeUserId)) {
      return [];
    }
    const config = CARD_MENU_ACTIONS[actionId];
    if (!config) {
      return [];
    }
    const action: CardMenuAction = {
      id: actionId,
      ...config
    };
    return [{
      id: actionId,
      label: config.label,
      icon: config.icon,
      palette: this.actionPalette(actionId, config.tone),
      surface: 'tinted',
      context: {
        menu: 'activity-event-card',
        subject,
        action
      }
    }];
  }

  private static isActionVisible(
    subject: ActivityEventInfoCardMenuSubject,
    actionId: string,
    activeUserId: string
  ): boolean {
    if (this.isTrashed(subject)) {
      if (this.isAdmin(subject, activeUserId)) {
        return actionId === 'view' || actionId === 'notifyParticipants';
      }
      return actionId === 'view' || actionId === 'askOrganizer';
    }
    switch (actionId) {
      case 'restore':
        return false;
      case 'takeOver':
        return this.statusCode(subject.status) === 'UR'
          && this.isAdmin(subject, activeUserId);
      case 'publish':
        return this.isAdmin(subject, activeUserId)
          && this.isDraft(subject)
          && !this.isPendingReview(subject);
      case 'editEvent':
        return this.isAdmin(subject, activeUserId)
          && this.isDraft(subject)
          && !this.isPendingReview(subject);
      case 'manageEvent':
        return this.isAdmin(subject, activeUserId)
          && !this.isDraft(subject)
          && !this.isPendingReview(subject);
      case 'viewInvitation':
        return this.hasOutstandingInvitation(subject, activeUserId) && !this.isPendingReview(subject);
      case 'view':
        return !this.hasOutstandingInvitation(subject, activeUserId);
      case 'paymentSummary':
        return subject.checkoutMenuAction === 'paymentSummary'
          && !this.isAdmin(subject, activeUserId);
      case 'continueBooking':
        return subject.checkoutMenuAction === 'continueBooking'
          && !this.isAdmin(subject, activeUserId);
      case 'notifyParticipants':
        return this.isAdmin(subject, activeUserId);
      case 'askOrganizer':
        return !this.isAdmin(subject, activeUserId);
      case 'shareEvent':
        return true;
      case 'unpublish':
        return this.isAdmin(subject, activeUserId)
          && !this.isDraft(subject)
          && !this.isPendingReview(subject);
      case 'reportOrganizer':
        return this.shouldReport(subject, activeUserId);
      case 'accept':
        return this.hasOutstandingInvitation(subject, activeUserId)
          && !this.checkoutJoinStarted(subject);
      case 'leaveEvent':
        return !this.isAdmin(subject, activeUserId)
          && this.isAcceptedOrActiveEventMember(subject, activeUserId)
          && !this.hasOutstandingInvitation(subject, activeUserId);
      case 'deleteEvent':
        return this.isAdmin(subject, activeUserId)
          && !this.isPendingReview(subject);
      case 'rejectInvitation':
        return this.hasOutstandingInvitation(subject, activeUserId)
          && !this.checkoutJoinStarted(subject)
          && !this.isPendingReview(subject);
      default:
        return false;
    }
  }

  private static isDraft(subject: ActivityEventInfoCardMenuSubject): boolean {
    return this.statusCode(subject.status) === 'DR';
  }

  private static shouldReport(subject: ActivityEventInfoCardMenuSubject, activeUserId: string): boolean {
    const ownerUserId = `${subject.ownerUserId ?? ''}`.trim();
    return !!ownerUserId && ownerUserId !== activeUserId.trim();
  }

  private static isPendingReview(subject: ActivityEventInfoCardMenuSubject): boolean {
    const status = this.statusCode(subject.status);
    return status === 'UR' || status === 'B';
  }

  private static isTrashed(subject: ActivityEventInfoCardMenuSubject): boolean {
    const status = this.statusCode(subject.status);
    return status === 'T';
  }

  private static isAdmin(subject: ActivityEventInfoCardMenuSubject, activeUserId: string): boolean {
    const userId = activeUserId.trim();
    const ownerUserId = `${subject.ownerUserId ?? ''}`.trim();
    return !!userId && (
      ownerUserId === userId
      || this.includesUserId(subject.adminIds, userId)
    );
  }

  private static isInvited(subject: ActivityEventInfoCardMenuSubject, activeUserId: string): boolean {
    return this.includesUserId(subject.invitedMemberUserIds, activeUserId);
  }

  private static hasOutstandingInvitation(
    subject: ActivityEventInfoCardMenuSubject,
    activeUserId: string
  ): boolean {
    return this.isInvited(subject, activeUserId)
      && !this.isAcceptedMember(subject, activeUserId)
      && !this.isPendingRequest(subject, activeUserId);
  }

  private static isPendingRequest(subject: ActivityEventInfoCardMenuSubject, activeUserId: string): boolean {
    const userId = activeUserId.trim();
    return this.includesUserId(subject.pendingRequestMemberUserIds, userId)
      || (
        this.includesUserId(subject.pendingMemberUserIds, userId)
        && !this.includesUserId(subject.invitedMemberUserIds, userId)
      );
  }

  private static isAcceptedMember(subject: ActivityEventInfoCardMenuSubject, activeUserId: string): boolean {
    return this.includesUserId(subject.acceptedMemberUserIds, activeUserId);
  }

  private static checkoutJoinStarted(subject: ActivityEventInfoCardMenuSubject): boolean {
    return subject.checkoutState === 'approved'
      || subject.checkoutState === 'confirmed'
      || subject.checkoutState === 'pay';
  }

  private static isAcceptedOrActiveEventMember(subject: ActivityEventInfoCardMenuSubject, activeUserId: string): boolean {
    if (this.isAcceptedMember(subject, activeUserId)) {
      return true;
    }
    if (subject.checkoutMenuAction === 'paymentSummary') {
      return true;
    }
    return subject.eventScope === 'active-events'
      && !this.isPendingRequest(subject, activeUserId);
  }

  private static includesUserId(userIds: readonly string[] | null | undefined, activeUserId: string): boolean {
    const userId = activeUserId.trim();
    return !!userId && (userIds ?? []).some(candidate => `${candidate ?? ''}`.trim() === userId);
  }

  private static statusCode(statusValue: string | null | undefined): string {
    const status = `${statusValue ?? ''}`.trim();
    switch (status) {
      case 'A':
        return 'A';
      case 'DR':
        return 'DR';
      case 'T':
        return 'T';
      case 'UR':
        return 'UR';
      case 'B':
        return 'B';
      case 'D':
        return 'D';
      case 'I':
        return 'I';
      default:
        return 'A';
    }
  }

  private static actionPalette(actionId: string, tone: CardMenuAction['tone']): AppMenuPalette {
    if (actionId === 'paymentSummary') {
      return 'teal';
    }
    switch (tone) {
      case 'accent':
        return 'brown';
      case 'warning':
      case 'review':
        return 'orange';
      case 'destructive':
        return 'danger';
      default:
        return 'default';
    }
  }
}

export const activityEventInfoCardMenuConverter =
  ActivityEventInfoCardMenuConverter satisfies UiConverter<
    ActivityEventInfoCardMenuSubject | null | undefined,
    readonly AppMenuItem<string, ActivityEventInfoCardMenuContext>[],
    ActivityEventInfoCardMenuConverterOptions | undefined
  >;
