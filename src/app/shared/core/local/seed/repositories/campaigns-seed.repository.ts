import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import { CAMPAIGNS_TABLE_NAME } from '../../source/entity/campaign.entity';
import { SeedCampaignsBuilder } from '../builders/campaigns-seed.builder';

@Injectable({ providedIn: 'root' })
export class SeedCampaignsRepository {
  private readonly db = inject(LocalMemoryDb);
  seedDefaults(): boolean {
    const state = this.db.read();
    const missing = SeedCampaignsBuilder.build(state.users.ids.map(id => state.users.byId[id]))
      .filter(c => !state[CAMPAIGNS_TABLE_NAME].byId[c.id]);
    if (!missing.length) return false;
    this.db.write(current => ({ ...current, [CAMPAIGNS_TABLE_NAME]: {
      byId: { ...current[CAMPAIGNS_TABLE_NAME].byId, ...Object.fromEntries(missing.map(c => [c.id, c])) },
      ids: [...current[CAMPAIGNS_TABLE_NAME].ids, ...missing.map(c => c.id)]
    } }));
    return true;
  }
}
