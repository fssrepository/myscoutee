import type { AssetType } from '../common/constants';

export type ShareTokenKind = 'event' | 'asset' | 'adminHelp';

export interface ShareTokenCreateRequest {
  kind: ShareTokenKind;
  entityId: string;
  assetType?: AssetType | null;
  ownerUserId?: string | null;
}

export interface ShareTokenResolvedItem {
  kind: ShareTokenKind;
  entityId: string;
  assetType?: AssetType | null;
  ownerUserId?: string | null;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  url?: string | null;
}
