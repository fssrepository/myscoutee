import type * as AppTypes from '.';
import { APP_INDEXED_DB_KEYS } from '../storage-scope';

export const SHARE_TOKENS_TABLE_NAME = APP_INDEXED_DB_KEYS.shareTokens;

export interface ShareTokensRecordCollection {
  byToken: Record<string, AppTypes.ShareTokenRecord>;
  tokens: string[];
}

export type ShareTokensMemorySchema = Record<typeof SHARE_TOKENS_TABLE_NAME, ShareTokensRecordCollection>;
