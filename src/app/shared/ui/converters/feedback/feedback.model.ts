import type { ActivityMemberRole } from '../../../core/common/constants';

export interface FeedbackOption {
  value: string;
  label: string;
  icon: string;
  impressionTag?: string;
}

export interface FeedbackTraitOption {
  id: string;
  label: string;
  icon: string;
  coreVibe: string;
}

export interface FeedbackCard {
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
  primaryOptions: FeedbackOption[];
  secondaryOptions: FeedbackOption[];
  traitQuestion: string;
  traitOptions: FeedbackTraitOption[];
  selectedTraitIds: string[];
  answerPrimary: string;
  answerSecondary: string;
  eventComment: string;
}
