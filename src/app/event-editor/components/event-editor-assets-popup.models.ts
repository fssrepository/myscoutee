export type EventEditorAssetType = 'Car' | 'Accommodation' | 'Supplies';
export type EventEditorAssetFilterType = EventEditorAssetType;
export type EventEditorAssetRequestStatus = 'pending' | 'accepted';

export interface EventEditorAssetMemberRequest {
  id: string;
  userId?: string;
  name: string;
  initials: string;
  gender: 'woman' | 'man';
  status: EventEditorAssetRequestStatus;
  note: string;
}

export interface EventEditorAssetCard {
  id: string;
  type: EventEditorAssetType;
  title: string;
  subtitle: string;
  city: string;
  capacityTotal: number;
  details: string;
  imageUrl: string;
  sourceLink: string;
  routes?: string[];
  requests: EventEditorAssetMemberRequest[];
}
