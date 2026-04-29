import type { AssetType } from './asset.model';

export type ShareTokenKind = 'event' | 'asset';

export interface ShareTokenRecord {
  token: string;
  kind: ShareTokenKind;
  entityId: string;
  assetType?: AssetType | null;
  ownerUserId?: string | null;
  createdAtIso: string;
  expiresAtIso: string;
}

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
