import services from '../data/service-offerings.json';
import type { UserRecord } from '../../source/entity/user.entity';
import type { ServiceOffering } from '../../../contracts/service-offering.interface';
import { COMMUNITY_BASE_GROUP_ID } from '../../../contracts/group-type';
export class SeedServiceOfferingsBuilder {
  static build(users:readonly UserRecord[]):ServiceOffering[]{
    const names=new Map(users.filter(u=>!u.workspaceGroupId).map(u=>[u.name,u.id]));
    const account=(name:string)=>{const id=names.get(name);if(!id)throw new Error(`Missing Community actor: ${name}`);return id;};
    return services.map(({ownerName,staffNames,...s})=>({...s,baseGroupId:COMMUNITY_BASE_GROUP_ID,ownerAccountId:account(ownerName),staffAccountIds:staffNames.map(account)} as ServiceOffering));
  }
}
