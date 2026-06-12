import { Injectable, inject } from '@angular/core';

import type { ShareTokenCreateRequest, ShareTokenResolvedItem } from '../../contracts/share.interface';
import { LocalShareTokensRepository } from '../repositories/share-tokens.repository';

@Injectable({
  providedIn: 'root'
})
export class LocalShareTokensService {
  private readonly repository = inject(LocalShareTokensRepository);

  createToken(request: ShareTokenCreateRequest): Promise<string> {
    return Promise.resolve(this.repository.createToken(request));
  }

  resolveToken(token: string, userId: string): Promise<ShareTokenResolvedItem | null> {
    return Promise.resolve(this.repository.resolveToken(token, userId));
  }
}
