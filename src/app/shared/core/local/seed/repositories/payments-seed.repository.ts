import {Injectable,inject} from '@angular/core';
import {LocalMemoryDb} from '../../../common/app.db';
import {SeedPaymentsBuilder} from '../builders/payments-seed.builder';
@Injectable({providedIn:'root'})
export class SeedPaymentsRepository {
  private readonly db=inject(LocalMemoryDb);
  seedDefaults():void {this.db.write(state=>({...state,users:SeedPaymentsBuilder.build(state)}));}
}
