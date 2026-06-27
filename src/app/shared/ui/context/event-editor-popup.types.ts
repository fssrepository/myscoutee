import type { SubEventResourceFilter } from '../../core/common/constants';
import type { ActivityMemberEntry } from '../../core/contracts/activity.interface';

export interface EventEditorState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  sourceEvent?: any;
  readOnly?: boolean;
}

export type EventEditorSubEventResourceType = SubEventResourceFilter;

export interface EventEditorSubEventResourcePopupRequest {
  type: EventEditorSubEventResourceType;
  subEvent: any;
  ownerId?: string | null;
  parentTitle?: string;
  group?: {
    id?: string | null;
    groupLabel?: string;
    source?: string | null;
    pending?: number;
    accepted?: number;
    capacityMin?: number;
    capacityMax?: number;
    canManage?: boolean;
    members?: readonly ActivityMemberEntry[];
    onMembersChanged?: (members: readonly ActivityMemberEntry[]) => void;
  } | null;
}
