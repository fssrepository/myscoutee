import { LocalCampaignsRepository } from '../../../source/repositories/campaigns/campaigns.repository';
import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../../common/app.db';
import { CAMPAIGNS_TABLE_NAME } from '../../../source/entity/campaigns/campaign.entity';
import { SeedCampaignsBuilder } from '../../builders/campaigns/campaigns-seed.builder';

@Injectable({ providedIn: 'root' })
export class SeedCampaignsRepository {
  private readonly db = inject(LocalMemoryDb);
  seedDefaults(): boolean {
    const state = this.db.read();
    const missing = SeedCampaignsBuilder.build(state.users.ids.map(id => state.users.byId[id]))
      .filter(c => !state[CAMPAIGNS_TABLE_NAME].byId[c.id]);
    const retained = state.campaigns.ids.map(id => state.campaigns.byId[id]).filter(c => !c.counterApplied);
    if (!missing.length && !retained.length) return false;
    this.db.write(current => [...retained, ...missing].reduce(
      (next, campaign) => LocalCampaignsRepository.withCounterWrite(next, campaign), current));
    return true;
  }
}
