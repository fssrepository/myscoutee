import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type * as AppTypes from '../../../core/base/models';
import { DemoAssetsService } from '../../demo/services/assets.service';
import { HttpAssetsService } from '../../http/services/assets.service';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class AssetsService {
  private readonly demoAssetsService = inject(DemoAssetsService);
  private readonly httpAssetsService = inject(HttpAssetsService);
  private readonly sessionService = inject(SessionService);

  private get demoModeEnabled(): boolean {
    return this.sessionService.currentSession()?.kind === 'demo' || !environment.loginEnabled;
  }

  private get assetsService(): DemoAssetsService | HttpAssetsService {
    return this.demoModeEnabled ? this.demoAssetsService : this.httpAssetsService;
  }

  peekOwnedAssetsByUser(userId: string): AppTypes.AssetCard[] {
    return this.assetsService.peekOwnedAssetsByUser(userId);
  }

  async queryOwnedAssetsByUser(userId: string): Promise<AppTypes.AssetCard[]> {
    return this.assetsService.queryOwnedAssetsByUser(userId);
  }

  async saveOwnedAsset(userId: string, asset: AppTypes.AssetCard): Promise<AppTypes.AssetCard> {
    return this.assetsService.saveOwnedAsset(userId, asset);
  }

  async deleteOwnedAsset(userId: string, assetId: string): Promise<void> {
    await this.assetsService.deleteOwnedAsset(userId, assetId);
  }
}
