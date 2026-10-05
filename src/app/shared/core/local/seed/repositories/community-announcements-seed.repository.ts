import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import { SeedCommunityAnnouncementsBuilder } from '../builders/community-announcements-seed.builder';
@Injectable({providedIn:'root'})
export class SeedCommunityAnnouncementsRepository {
  private readonly db=inject(LocalMemoryDb);
  seedDefaults():boolean {
    const state=this.db.read(), seed=SeedCommunityAnnouncementsBuilder.build(state.users.ids.map(id=>state.users.byId[id]));
    const rows=seed.filter(a=>!state.communityAnnouncements.byId[a.id]);
    if(!rows.length)return false;
    this.db.write(s=>({...s,communityAnnouncements:{ids:[...s.communityAnnouncements.ids,...rows.map(a=>a.id)],byId:{...s.communityAnnouncements.byId,...Object.fromEntries(rows.map(a=>[a.id,a]))}}}));return true;
  }
}
