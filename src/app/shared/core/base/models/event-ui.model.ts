import type { ActivityMemberRole } from '../../common/constants';

export interface EventFeedbackOption {
  value: string;
  label: string;
  icon: string;
  impressionTag?: string;
}

export interface EventFeedbackTraitOption {
  id: string;
  label: string;
  icon: string;
  coreVibe: string;
}

export interface EventFeedbackCard {
  id: string;
  eventId: string;
  kind: 'event' | 'attendee';
  attendeeUserId?: string;
  targetUserId?: string;
  targetRole?: ActivityMemberRole;
  icon: string;
  imageUrl: string;
  toneClass: string;
  heading: string;
  subheading: string;
  identityTitle?: string;
  identitySubtitle?: string;
  identityStatusClass?: string;
  identityStatusIcon?: string;
  questionPrimary: string;
  questionSecondary: string;
  primaryOptions: EventFeedbackOption[];
  secondaryOptions: EventFeedbackOption[];
  traitQuestion: string;
  traitOptions: EventFeedbackTraitOption[];
  selectedTraitIds: string[];
  answerPrimary: string;
  answerSecondary: string;
}

export interface EventFeedbackEventCard {
  eventId: string;
  title: string;
  subtitle: string;
  timeframe: string;
  imageUrl: string;
  startAtMs: number;
  pendingCards: number;
  totalCards: number;
  isRemoved: boolean;
  isFeedbacked: boolean;
  feedbackedAtMs: number | null;
  removedAtMs?: number | null;
  isOwnEvent?: boolean;
}
