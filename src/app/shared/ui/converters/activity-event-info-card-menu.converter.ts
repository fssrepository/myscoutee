import type {
  AppMenuItem,
  AppMenuPalette
} from '../components/menu';
import {
  INFO_CARD_AVAILABLE_ACTIONS,
  type InfoCardResolvedMenuAction
} from '../components/card';

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
};

export interface ActivityEventInfoCardMenuContext {
  menu: 'activity-event-card';
  subject: ActivityEventInfoCardMenuSubject;
  action: InfoCardResolvedMenuAction;
}

export interface ActivityEventInfoCardMenuConverterOptions {
  activeUserId?: string | null;
  availableActions?: readonly string[];
}

export class ActivityEventInfoCardMenuConverter {
  static readonly availableActions: readonly string[] = [
    'restore',
    'takeOver',
    'publish',
    'editEvent',
    'manageEvent',
    'viewInvitation',
    'view',
    'notifyParticipants',
    'askOrganizer',
    'contactOrganizer',
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
    return availableActions.flatMap(actionId => this.menuItem(subject, actionId, options.activeUserId ?? ''));
  }

  private static menuItem(
    subject: ActivityEventInfoCardMenuSubject,
    actionId: string,
    activeUserId: string
  ): readonly AppMenuItem<string, ActivityEventInfoCardMenuContext>[] {
    if (!this.isActionVisible(subject, actionId, activeUserId)) {
      return [];
    }
    const config = INFO_CARD_AVAILABLE_ACTIONS[actionId];
    if (!config) {
      return [];
    }
    const action: InfoCardResolvedMenuAction = {
      id: actionId,
      ...config
    };
    return [{
      id: actionId,
      label: config.label,
      icon: config.icon,
      palette: this.actionPalette(config.tone),
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
      return actionId === 'restore' && this.shouldRestore(subject);
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
        return this.isInvited(subject, activeUserId) && !this.isPendingReview(subject);
      case 'view':
        return !this.isInvited(subject, activeUserId);
      case 'notifyParticipants':
        return this.isAdmin(subject, activeUserId);
      case 'askOrganizer':
        return this.isInvited(subject, activeUserId) || this.isPendingRequest(subject, activeUserId);
      case 'contactOrganizer':
        return !this.isAdmin(subject, activeUserId) && !this.isInvited(subject, activeUserId);
      case 'shareEvent':
        return true;
      case 'unpublish':
        return this.isAdmin(subject, activeUserId)
          && !this.isDraft(subject)
          && !this.isPendingReview(subject);
      case 'reportOrganizer':
        return this.shouldReport(subject, activeUserId);
      case 'accept':
        return this.isInvited(subject, activeUserId);
      case 'leaveEvent':
        return !this.isAdmin(subject, activeUserId)
          && this.isAcceptedMember(subject, activeUserId)
          && !this.isInvited(subject, activeUserId);
      case 'deleteEvent':
        return this.isAdmin(subject, activeUserId)
          && !this.isPendingReview(subject);
      case 'rejectInvitation':
        return this.isInvited(subject, activeUserId) && !this.isPendingReview(subject);
      default:
        return false;
    }
  }

  private static isDraft(subject: ActivityEventInfoCardMenuSubject): boolean {
    return this.statusCode(subject.status) === 'DR';
  }

  private static shouldRestore(subject: ActivityEventInfoCardMenuSubject): boolean {
    return this.statusCode(subject.status) === 'T';
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

  private static actionPalette(tone: InfoCardResolvedMenuAction['tone']): AppMenuPalette {
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
