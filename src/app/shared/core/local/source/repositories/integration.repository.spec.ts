import '@angular/compiler';
import { createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { LocalMemoryDb } from '../../../common/app.db';
import { LocalIntegrationRepository } from './integration.repository';
import { LocalUsersMapper } from '../mappers/user.mapper';
import { USERS_TABLE_NAME, type UserRecord } from '../entity/user.entity';

describe('Local affiliate summary', () => {
  it('persists a stable link and counts each new referral once without exposing attribution in the profile DTO', () => {
    let state: any = { [USERS_TABLE_NAME]: { ids: ['owner', 'member'], byId: {
      owner: {id:'owner',languages:[],images:[]}, member:{id:'member',languages:[],images:[]}
    }}};
    const db={read:()=>state,write:(change:any)=>{state=change(state);}};
    const injector=createEnvironmentInjector([{provide:LocalMemoryDb,useValue:db}],null as any);
    const repo=runInInjectionContext(injector,()=>new LocalIntegrationRepository());
    const first=repo.settings('owner','/api/integrations/v1');
    const code=new URL(first.affiliate.url,'https://example.test').searchParams.get('affiliate')!;
    expect(first.affiliate.registered).toBe(0);
    expect(repo.settings('owner','/api/integrations/v1').affiliate.url).toBe(first.affiliate.url);
    repo.recordRegistration('owner',code);
    repo.recordRegistration('member','invalid');
    expect(repo.settings('owner','/api/integrations/v1').affiliate.registered).toBe(0);
    repo.recordRegistration('member',code);
    repo.recordRegistration('member',code);
    expect(repo.settings('owner','/api/integrations/v1').affiliate.registered).toBe(1);
    const owner=state[USERS_TABLE_NAME].byId.owner as UserRecord;
    expect(LocalUsersMapper.toDto(owner)).not.toHaveProperty('affiliateCode');
    expect(LocalUsersMapper.cloneRecord(owner).affiliateRegistrations).toEqual(owner.affiliateRegistrations);
    injector.destroy();
  });
});
