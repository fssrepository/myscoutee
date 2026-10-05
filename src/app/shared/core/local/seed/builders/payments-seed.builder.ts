import fixtures from '../data/payment-fixtures.json';
import type {UserRecord,UsersRecordCollection} from '../../source/entity/user.entity';
import type {AssetRecord} from '../../source/entity/asset.entity';
import type {ActivityEventRecord} from '../../../contracts/activity.interface';
import type {SavedPaymentMethodDto} from '../../../contracts/payment-method.interface';
export class SeedPaymentsBuilder {
 static build(state:{users:UsersRecordCollection;assets:{byId:Record<string,AssetRecord>};events:{byId:Record<string,ActivityEventRecord>}}):UsersRecordCollection {
  const byId={...state.users.byId};
  const user=(ref:string)=>{const found=Object.values(byId).find(u=>!u.workspaceGroupId&&`user:${u.name}`===ref);if(!found)throw new Error(`Missing payment fixture member: ${ref}`);return found;};
  const source=(ref:string)=>{if(ref.startsWith('event:')){const event=Object.values(state.events.byId).find(e=>e.title===ref.slice(6));if(event)return event.id;}
   else {const [,name,...title]=ref.split(':');const owner=user(`user:${name}`);const asset=Object.values(state.assets.byId).find(a=>a.ownerUserId===owner.id&&a.title===title.join(':'));if(asset)return asset.id;}
   throw new Error(`Missing payment fixture source: ${ref}`);};
  for(const method of fixtures.methods){const owner=user(method.userId);if(owner.savedPaymentMethods!==undefined)continue;
   byId[owner.id]={...owner,savedPaymentMethods:fixtures.methods.filter(m=>m.userId===method.userId).map(m=>({id:m._id,provider:m.provider,brand:m.brand,last4:m.last4,expiryMonth:m.expiryMonth,expiryYear:m.expiryYear,cardholderName:m.cardholderName,artworkKey:m.artworkKey,artworkUrl:'',status:m.status,createdAtIso:m.createdAtIso,updatedAtIso:m.updatedAtIso} as SavedPaymentMethodDto))};}
  for(const payment of fixtures.payments){const payer=user(payment.userId),recipient=user(payment.recipientUserId);if(payer.affiliatePayments?.[payment._id])continue;
   const record:NonNullable<UserRecord['affiliatePayments']>[string]={ownerId:'',currency:payment.currency,gross:payment.amount,refunded:0,eventBooking:payment.fulfillmentKind==='event_join',sourceId:source(payment.sourceId),recipientUserId:recipient.id,provider:payment.provider,paymentMethodId:payment.paymentMethodId,paymentStatus:payment.status,fulfillmentKind:payment.fulfillmentKind,checkoutSessionId:payment.checkoutSessionId,bookingStatus:payment.bookingStatus,createdAtIso:payment.createdDate,receiptPayerName:payer.name,receiptRecipientName:recipient.name};
   byId[payer.id]={...payer,affiliatePayments:{...payer.affiliatePayments,[payment._id]:record}};}
  return {...state.users,byId};
 }
}
