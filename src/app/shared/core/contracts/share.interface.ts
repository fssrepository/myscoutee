import type * as AppConstants from '../common/constants';

export type ShareTokenKind = 'event' | 'asset' | 'adminHelp';

export interface ShareTokenCreateRequest {
  kind: ShareTokenKind;
  entityId: string;
  assetType?: AppConstants.AssetType | null;
  ownerUserId?: string | null;
}

export interface ShareTokenResolvedItem {
  kind: ShareTokenKind;
  entityId: string;
  assetType?: AppConstants.AssetType | null;
  ownerUserId?: string | null;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  url?: string | null;
}
