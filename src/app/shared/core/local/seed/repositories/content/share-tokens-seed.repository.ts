import { LocalShareTokensRepository } from '../../../source/repositories/content/share-tokens.repository';
import { SHARE_TOKENS_TABLE_NAME, type ShareTokenRecord } from '../../../source/entity/content/sharing.entity';
import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../../common/app.db';


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
    return LocalShareTokensRepository.ensureAdminHelpTokenIn(this.memoryDb, request);
  }

  private isExpired(record: ShareTokenRecord | null | undefined): boolean {
    if (!record) {
      return true;
    }
    const expiresAtMs = Date.parse(record.expiresAtIso);
    return !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now();
  }
}
