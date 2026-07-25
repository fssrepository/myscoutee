import { Injectable, inject } from '@angular/core';

import type { ShareTokenCreateRequest, ShareTokenResolvedItem } from '../../../contracts/share.interface';
import { LocalShareTokensRepository } from '../repositories/share-tokens.repository';

@Injectable({
  providedIn: 'root'
})
export class LocalShareTokensService {
  private readonly repository = inject(LocalShareTokensRepository);

  async createToken(request: ShareTokenCreateRequest): Promise<string> {
    const token = this.repository.createToken(request);
    if (token) {
      await this.repository.flushToIndexedDb();
    }
    return token;
  }

  resolveToken(token: string, userId: string): Promise<ShareTokenResolvedItem | null> {
    return Promise.resolve(this.repository.resolveToken(token, userId));
  }
}
