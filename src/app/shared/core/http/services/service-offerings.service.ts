import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { IServiceOfferingsService, ServiceOfferingItem, ServiceOfferingFilters, SaveServiceOffering, ServiceAction } from '../../contracts/service-offering.interface';
import type { ListQuery, PageResult } from '../../contracts/list.interface';
@Injectable({providedIn:'root'})
export class HttpServiceOfferingsService implements IServiceOfferingsService {
  private readonly http=inject(HttpClient);
  private readonly url=`${environment.apiBaseUrl??'/api'}/service-offerings`;
  async page(userId:string,query:ListQuery<ServiceOfferingFilters>,signal?:AbortSignal):Promise<PageResult<ServiceOfferingItem>>{
    signal?.throwIfAborted();const params:Record<string,string|number>={userId,pageSize:query.pageSize,cursor:query.cursor??''};
    for(const [key,value]of Object.entries(query.filters??{}))if(value!=null)params[key]=Array.isArray(value)?value.join(','):value;
    const result=await firstValueFrom(this.http.get<PageResult<ServiceOfferingItem>>(this.url,{params}));signal?.throwIfAborted();return result;
  }
  async detail(userId:string,id:string,signal?:AbortSignal){signal?.throwIfAborted();const result=await firstValueFrom(this.http.get<ServiceOfferingItem>(`${this.url}/${encodeURIComponent(id)}`,{params:{userId}}));signal?.throwIfAborted();return result;}
  save(r:SaveServiceOffering){return firstValueFrom(this.http.post<ServiceOfferingItem>(this.url,r));}
  action(userId:string,id:string,action:ServiceAction,version:number){return firstValueFrom(this.http.post<ServiceOfferingItem>(`${this.url}/${encodeURIComponent(id)}/action`,{userId,action,version}));}
}
