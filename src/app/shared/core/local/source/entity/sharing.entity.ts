import type { AssetType } from '../../../common/constants';
import type { ShareTokenKind } from '../../../contracts/share.interface';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

export const SHARE_TOKENS_TABLE_NAME = APP_INDEXED_DB_KEYS.shareTokens;

export interface ShareTokenRecord {
  token: string;
  kind: ShareTokenKind;
  entityId: string;
  assetType?: AssetType | null;
  ownerUserId?: string | null;
  createdAtIso: string;
  expiresAtIso: string;
}

export interface ShareTokensRecordCollection {
  byToken: Record<string, ShareTokenRecord>;
  tokens: string[];
}

export type ShareTokensMemorySchema = Record<typeof SHARE_TOKENS_TABLE_NAME, ShareTokensRecordCollection>;
