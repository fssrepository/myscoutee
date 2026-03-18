import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { RateMenuItem } from '../../../demo-data';
import { DemoRatesService } from '../../demo';
import { HttpRatesService } from '../../http';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class RatesService {
  private readonly demoRatesService = inject(DemoRatesService);
  private readonly httpRatesService = inject(HttpRatesService);
  private readonly sessionService = inject(SessionService);

  private get demoModeEnabled(): boolean {
    return this.sessionService.currentSession()?.kind === 'demo' || !environment.loginEnabled;
  }

  private get ratesService(): DemoRatesService | HttpRatesService {
    return this.demoModeEnabled ? this.demoRatesService : this.httpRatesService;
  }

  peekRateItemsByUser(userId: string): RateMenuItem[] {
    return this.ratesService.peekRateItemsByUser(userId);
  }

  async queryRateItemsByUser(userId: string): Promise<RateMenuItem[]> {
    return this.ratesService.queryRateItemsByUser(userId);
  }
}
