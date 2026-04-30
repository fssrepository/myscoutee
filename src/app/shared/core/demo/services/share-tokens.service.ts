import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { DemoShareTokensRepository } from '../repositories/share-tokens.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoShareTokensService {
  private readonly repository = inject(DemoShareTokensRepository);

  createToken(request: AppTypes.ShareTokenCreateRequest): Promise<string> {
    return Promise.resolve(this.repository.createToken(request));
  }

  resolveToken(token: string, userId: string): Promise<AppTypes.ShareTokenResolvedItem | null> {
    return Promise.resolve(this.repository.resolveToken(token, userId));
  }
}
