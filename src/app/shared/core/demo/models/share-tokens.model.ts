import type * as AppTypes from '../../../core/base/models';
import { APP_INDEXED_DB_KEYS } from '../../base/storage-scope';

export const SHARE_TOKENS_TABLE_NAME = APP_INDEXED_DB_KEYS.shareTokens;

export interface DemoShareTokensRecordCollection {
  byToken: Record<string, AppTypes.ShareTokenRecord>;
  tokens: string[];
}

export type DemoShareTokensMemorySchema = Record<typeof SHARE_TOKENS_TABLE_NAME, DemoShareTokensRecordCollection>;
