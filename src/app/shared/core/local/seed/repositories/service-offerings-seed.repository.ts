import { Injectable,inject } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import { SeedServiceOfferingsBuilder } from '../builders/service-offerings-seed.builder';
@Injectable({providedIn:'root'})
export class SeedServiceOfferingsRepository {
  private readonly db=inject(LocalMemoryDb);
  seedDefaults():boolean {const state=this.db.read();const rows=SeedServiceOfferingsBuilder.build(state.users.ids.map(id=>state.users.byId[id])).filter(s=>!state.serviceOfferings.byId[s.id]);
    if(!rows.length)return false;this.db.write(s=>({...s,serviceOfferings:{ids:[...s.serviceOfferings.ids,...rows.map(row=>row.id)],byId:{...s.serviceOfferings.byId,...Object.fromEntries(rows.map(row=>[row.id,row]))}}}));return true;}
}
