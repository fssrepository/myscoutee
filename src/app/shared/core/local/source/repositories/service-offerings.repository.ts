import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import type { ServiceOffering } from '../../../contracts/service-offering.interface';
@Injectable({ providedIn: 'root' })
export class LocalServiceOfferingsRepository {
  private readonly db = inject(LocalMemoryDb);
  ready() { return this.db.whenReady(); }
  flush() { return this.db.flushToIndexedDb(); }
  records() { const t = this.db.read().serviceOfferings; return t.ids.map(id => t.byId[id]); }
  find(id: string) { return this.db.read().serviceOfferings.byId[id] ?? null; }
  ratingsByProvider(profileId: string): Map<string, number> {
    const rates = this.db.read().userRates;
    return new Map(rates.ids.map(id => rates.byId[id]).filter(rate => rate.fromUserId === profileId && !rate.campaignId).map(rate => [rate.toUserId, rate.scoreGiven ?? rate.rate]));
  }
  save(s: ServiceOffering, expected?: number): ServiceOffering {
    this.db.write(state => {
      const t = state.serviceOfferings;
      if (t.byId[s.id]?.version !== expected) throw new Error('service.changed');
      return { ...state, serviceOfferings: { ids: t.byId[s.id] ? t.ids : [...t.ids, s.id], byId: { ...t.byId, [s.id]: structuredClone(s) } } };
    }); return structuredClone(s);
  }
}
