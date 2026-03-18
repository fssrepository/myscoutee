import { AppUtils } from '../../../app-utils';
import type { EventMenuItem, InvitationMenuItem } from '../../../demo-data';

export function buildInvitationPreviewEventSource(invitation: InvitationMenuItem): EventMenuItem {
  return {
    id: `inv-preview-${invitation.id}`,
    avatar: AppUtils.initialsFromText(invitation.inviter),
    title: invitation.description,
    shortDescription: `Invited by ${invitation.inviter}`,
    timeframe: invitation.when,
    activity: Math.max(0, invitation.unread),
    isAdmin: false
  };
}
