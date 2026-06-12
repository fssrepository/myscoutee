import type { AssetType } from './asset.model';
import type { ShareTokenKind } from '../../contracts/share.interface';

export interface ShareTokenRecord {
  token: string;
  kind: ShareTokenKind;
  entityId: string;
  assetType?: AssetType | null;
  ownerUserId?: string | null;
  createdAtIso: string;
  expiresAtIso: string;
}
