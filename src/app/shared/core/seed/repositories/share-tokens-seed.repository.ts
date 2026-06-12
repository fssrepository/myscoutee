import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../base/models';
import { LocalMemoryDb } from '../../base/db';
import { SHARE_TOKENS_TABLE_NAME } from '../../base/models/share-tokens.model';

@Injectable({
  providedIn: 'root'
})
export class SeedShareTokensRepository {
  private static readonly TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

  private readonly memoryDb = inject(LocalMemoryDb);

  ensureAdminHelpToken(request: {
    adminId: string;
    userId: string;
    targetKey: string;
    targetUrl: string;
  }): string {
    const adminId = `${request.adminId ?? ''}`.trim();
    const userId = `${request.userId ?? ''}`.trim();
    const targetKey = `${request.targetKey ?? ''}`.trim();
    const targetUrl = `${request.targetUrl ?? ''}`.trim();
    if (!adminId || !userId || !targetKey || !targetUrl) {
      return '';
    }
    const safeAdminId = adminId.replace(/[^A-Za-z0-9-]/g, '-');
    const targetSuffix = targetKey === 'current' ? '' : `-${targetKey}`;
    const token = `myscoutee:token:admin-help-${safeAdminId}-${userId}${targetSuffix}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SeedShareTokensRepository.TOKEN_TTL_MS);
    const record: AppTypes.ShareTokenRecord = {
      token,
      kind: 'adminHelp',
      entityId: targetUrl,
      ownerUserId: userId,
      createdAtIso: now.toISOString(),
      expiresAtIso: expiresAt.toISOString()
    };
    this.memoryDb.write(state => {
      const table = state[SHARE_TOKENS_TABLE_NAME];
      const existing = table.byToken[token];
      if (existing && !this.isExpired(existing) && existing.entityId === targetUrl) {
        return state;
      }
      return {
        ...state,
        [SHARE_TOKENS_TABLE_NAME]: {
          byToken: {
            ...table.byToken,
            [token]: record
          },
          tokens: table.tokens.includes(token) ? [...table.tokens] : [...table.tokens, token]
        }
      };
    });
    return token;
  }

  private isExpired(record: AppTypes.ShareTokenRecord | null | undefined): boolean {
    if (!record) {
      return true;
    }
    const expiresAtMs = Date.parse(record.expiresAtIso);
    return !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now();
  }
}
