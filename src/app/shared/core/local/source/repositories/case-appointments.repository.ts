import { Injectable,inject } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import type { ServiceProviderCalendar } from '../../../contracts/case-appointment.interface';
@Injectable({providedIn:'root'})
export class LocalCaseAppointmentsRepository {
 private readonly db=inject(LocalMemoryDb);
 ready(){return this.db.whenReady();}flush(){return this.db.flushToIndexedDb();}
 find(id:string):ServiceProviderCalendar{return structuredClone(this.db.read().serviceProviderCalendars.byId[id]??{id,appointments:[],lastOperationId:null,lastOperationSignature:null,version:null});}
 save(record:ServiceProviderCalendar,expected:number|null):ServiceProviderCalendar {
  const saved={...record,version:(expected??-1)+1};
  this.db.write(state=>{const t=state.serviceProviderCalendars;
   if((t.byId[record.id]?.version??null)!==expected)throw new Error('case.appointments.changed');
   return {...state,serviceProviderCalendars:{ids:t.byId[record.id]?t.ids:[...t.ids,record.id],byId:{...t.byId,[record.id]:structuredClone(saved)}}};});
  return saved;
 }
}
