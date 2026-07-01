import type * as ContractTypes from '../../../../../shared/core/contracts';
import type { SingleRowData } from '../../../../../shared/ui';

interface BuildActivitiesChatSingleRowDataOptions {
  groupLabel?: string | null;
  activeUserInitials: string;
  adminServiceMode?: boolean;
  translate?: (key: string) => string;
}

type SupportCaseMenuActionId =
  | 'supportPick'
  | 'supportUnpick'
  | 'supportSolve'
  | 'supportBlock'
  | 'supportReopen';

export function buildActivitiesChatSingleRowData(
  row: SingleRowData,
  options: BuildActivitiesChatSingleRowDataOptions
): SingleRowData {
  const avatar = `${row.avatarInitials ?? ''}`.trim();
  const supportStatus = supportCaseStatus(row.status);
  const showSupportControls = options.adminServiceMode === true && Boolean(supportStatus);

  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? '',
    detail: row.detail ?? '',
    unread: showSupportControls ? 0 : row.unread ?? 0,
    badgeCount: showSupportControls ? 0 : row.badgeCount ?? row.unread ?? 0,
    memberCount: showSupportControls ? 0 : row.memberCount ?? 0,
    groupLabel: options.groupLabel ?? null,
    avatarInitials: avatar ? avatar.slice(0, 2).toUpperCase() : options.activeUserInitials,
    avatarToneClass: `${row.avatarToneClass ?? ''}`.trim(),
    surfaceTone: showSupportControls
      ? supportCaseSurfaceTone(supportStatus)
      : chatSurfaceTone(row.toneClass ?? ''),
    badges: showSupportControls
      ? [{
        label: supportCaseBadgeLabel(supportStatus, row.sideLabel, options.translate),
        title: supportCaseBadgeLabel(supportStatus, row.sideLabel, options.translate),
        tone: supportCaseBadgeTone(supportStatus),
        position: 'top-right'
      }]
      : [],
    menuActions: showSupportControls
      ? supportCaseMenuActionIds(supportStatus)
      : [],
    clickable: true
  };
}

function supportCaseStatus(status: string | null | undefined): ContractTypes.SupportCaseStatus | null {
  if (status === 'pending' || status === 'picked' || status === 'solved' || status === 'blocked') {
    return status;
  }
  return null;
}

function supportCaseLabelKey(status: string | null | undefined): string {
  if (status === 'picked') {
    return 'activities.support.case.status.picked';
  }
  if (status === 'solved') {
    return 'activities.support.case.status.solved';
  }
  if (status === 'blocked') {
    return 'activities.support.case.status.blocked';
  }
  return 'activities.support.case.status.pending';
}

function supportCaseBadgeLabel(
  status: ContractTypes.SupportCaseStatus | null,
  assigneeName: string | null | undefined,
  translate: ((key: string) => string) | undefined
): string {
  const resolvedAssigneeName = `${assigneeName ?? ''}`.trim();
  const t = translate ?? ((key: string) => key);
  if (resolvedAssigneeName) {
    return `${t('activities.support.case.assignee.by')} ${resolvedAssigneeName}`.trim();
  }
  return t(supportCaseLabelKey(status));
}

function supportCaseBadgeTone(status: ContractTypes.SupportCaseStatus | null): NonNullable<SingleRowData['surfaceTone']> {
  switch (status) {
    case 'picked':
      return 'info';
    case 'solved':
      return 'success';
    case 'blocked':
      return 'danger';
    default:
      return 'warning';
  }
}

function supportCaseSurfaceTone(status: ContractTypes.SupportCaseStatus | null): SingleRowData['surfaceTone'] {
  return supportCaseBadgeTone(status);
}

function supportCaseMenuActionIds(status: ContractTypes.SupportCaseStatus | null): readonly SupportCaseMenuActionId[] {
  if (status === 'solved' || status === 'blocked') {
    return ['supportReopen'];
  }
  if (status === 'picked') {
    return ['supportUnpick', 'supportSolve', 'supportBlock'];
  }
  return ['supportPick', 'supportSolve', 'supportBlock'];
}

function chatSurfaceTone(toneClass: string): SingleRowData['surfaceTone'] {
  if (toneClass.includes('activities-card-chat-group-sub-event')) {
    return 'success';
  }
  if (toneClass.includes('activities-card-chat-optional-sub-event')) {
    return 'warning';
  }
  if (toneClass.includes('activities-card-chat-service-notification')) {
    return 'danger';
  }
  if (
    toneClass.includes('activities-card-chat-service-event')
    || toneClass.includes('activities-card-chat-service-asset')
  ) {
    return 'neutral';
  }
  if (toneClass.includes('activities-card-chat-main-event')) {
    return 'info';
  }
  return 'default';
}
