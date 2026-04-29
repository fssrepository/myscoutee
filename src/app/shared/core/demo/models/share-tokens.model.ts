import type * as AppTypes from '../../../core/base/models';

export const SHARE_TOKENS_TABLE_NAME = 'shareTokens' as const;

export interface DemoShareTokensRecordCollection {
  byToken: Record<string, AppTypes.ShareTokenRecord>;
  tokens: string[];
}

export type DemoShareTokensMemorySchema = Record<typeof SHARE_TOKENS_TABLE_NAME, DemoShareTokensRecordCollection>;
