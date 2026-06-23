import type * as ContractTypes from '../../../../../shared/core/contracts';
import type { SingleRowData } from '../../../../../shared/ui';

export interface ActivitiesChatTemplateData {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  unread: number;
  memberCount: number;
  groupLabel: string | null;
  avatarInitials: string;
  avatarClass: string;
  toneClass: string;
  showSupportControls: boolean;
  supportCaseStatus: ContractTypes.SupportCaseStatus | null;
  supportCaseLabelKey: string;
  supportCaseBadgeClass: string;
  supportCaseAssigneeName: string;
}

interface BuildActivitiesChatTemplateDataOptions {
  groupLabel?: string | null;
  activeUserInitials: string;
  adminServiceMode?: boolean;
}

export function buildActivitiesChatTemplateData(
  row: SingleRowData,
  options: BuildActivitiesChatTemplateDataOptions
): ActivitiesChatTemplateData {
  const avatar = `${row.avatarInitials ?? ''}`.trim();
  const supportStatus = supportCaseStatus(row.status);
  const supportTone = options.adminServiceMode === true && supportStatus
    ? ` activities-card-support-case-${supportCaseBadgeClass(supportStatus).replace('support-case-', '')}`
    : '';

  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? '',
    detail: row.detail ?? '',
    unread: row.unread ?? 0,
    memberCount: row.memberCount ?? 0,
    groupLabel: options.groupLabel ?? null,
    avatarInitials: avatar ? avatar.slice(0, 2).toUpperCase() : options.activeUserInitials,
    avatarClass: `${row.avatarToneClass ?? ''}`.trim(),
    toneClass: `${row.toneClass ?? ''}${supportTone}`.trim(),
    showSupportControls: options.adminServiceMode === true && Boolean(supportStatus),
    supportCaseStatus: supportStatus,
    supportCaseLabelKey: supportCaseLabelKey(supportStatus),
    supportCaseBadgeClass: supportCaseBadgeClass(supportStatus),
    supportCaseAssigneeName: `${row.sideLabel ?? ''}`.trim()
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

function supportCaseBadgeClass(status: string | null | undefined): string {
  if (status === 'picked') {
    return 'support-case-picked';
  }
  if (status === 'solved') {
    return 'support-case-solved';
  }
  if (status === 'blocked') {
    return 'support-case-blocked';
  }
  return 'support-case-pending';
}
