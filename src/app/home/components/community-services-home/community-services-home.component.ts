import { ratingCriteriaFor } from '../../../shared/core/contracts/rating-snapshot';
import { ExplanationGuideService } from '../../../shared/core/base/services/explanation-guide.service';
import { AppUtils } from '../../../shared/app-utils';
import { Component, Input, inject, signal, computed, effect, untracked } from '@angular/core';
import { defer,map } from 'rxjs';
import { HomeHeaderComponent } from '../home-header/home-header.component';
import { ServiceOfferingsStore } from '../../../shared/ui/context/stores/service-offerings.store';
import { ProfileStore } from '../../../shared/ui/context/stores/profile.store';
import { ActivitiesPopupStore } from '../../../shared/ui/context/stores/activities-popup.store';
import { SERVICE_CATEGORY_STYLE, ServiceOfferingConverter } from '../../../shared/ui/converters/service-offering.converter';
import { ServiceOfferingEditorComponent } from '../../../shared/ui/components/service-offerings/service-offering-editor.component';
import { SmartListComponent,SingleCardComponent,type SingleCardData,type SmartListConfig,type SmartListLoadPage } from '../../../shared/ui/components/core/smart-list';
import { I18nService } from '../../../shared/core/base/services/i18n.service';
import { SERVICE_CATEGORIES,type ServiceOfferingFilters,type ServiceCategory,type ServiceOfferingItem } from '../../../shared/core/contracts/service-offering.interface';
import type { DeploymentBrandingDto } from '../../../shared/core/contracts/deployment-configuration.interface';
import type { AppMenuItem,AppMenuItemSelectEvent } from '../../../shared/ui/components/core/menu';
type ServiceHomeCard = SingleCardData & { id: string; eagerDetail: ServiceOfferingItem };
@Component({selector:'app-community-services-home',standalone:true,imports:[HomeHeaderComponent,SmartListComponent,SingleCardComponent,ServiceOfferingEditorComponent],
 template:`<div class="game-page" data-guide-surface="community.services.home">
   <app-home-header [branding]="branding" [items]="items()" (itemSelect)="headerAction($event)"></app-home-header>
   <section class="game-layout-single"><div class="game-card-deck">
   <app-smart-list class="home-smart-list" data-guide-field="service-discovery" [config]="config" [query]="query()" [loadPage]="loadPage" presentation="fullscreen" [fullscreenItemTemplate]="card" ></app-smart-list>
   <ng-template #card let-card>@if(card){<app-single-card [card]="card" (detailClick)="openProfile($event.userId)"></app-single-card>}</ng-template>
 </div></section></div>
 @if(!store.session()){@if(store.editor();as editor){<app-service-offering-editor [editor]="editor"></app-service-offering-editor>}}`,
 styleUrl:'./community-services-home.component.scss'})
export class CommunityServicesHomeComponent {
 private readonly guide=inject(ExplanationGuideService);
 constructor(){effect(onCleanup=>onCleanup(untracked(() => this.guide.registerContext('community.services.home'))));}
 @Input({required:true})branding!:DeploymentBrandingDto;
 protected readonly store=inject(ServiceOfferingsStore);
 private readonly profiles=inject(ProfileStore);
 private readonly activities=inject(ActivitiesPopupStore);
 private readonly i18n=inject(I18nService);
 protected readonly filters=signal<ServiceOfferingFilters>({scope:'discover'});
 protected readonly query=computed(()=>({filters:{...this.filters(),userId:this.store.profileId()},sort:'distance'}));
 protected readonly config:SmartListConfig<ServiceHomeCard,ServiceOfferingFilters>={pageSize:10,mobilePageSizeCap:null,presentation:'fullscreen',trackBy:(_,card)=>card.id,showBackgroundLoadingProgress:true,headerProgress:{enabled:true},emptyLabel:'service.empty',emptyDescription:'service.empty.description',
   groupBy:card=>card.eagerDetail?.distanceKm==null?this.i18n.translate('service.title'):AppUtils.activityGroupLabel({distanceMetersExact:card.eagerDetail.distanceKm*1000},'distance',{dateUnavailable:'',weekPrefix:''}),
   pagination:{mode:'rating-stars',ratingBarValue:card=>card?.eagerDetail?this.store.score(card.eagerDetail):0,
   ratingBarConfig:card=>card?{guideFields:{slider:'rating-input',action:'rating-save'},criteriaDefinition:ratingCriteriaFor(card.ratingDomain),subjectKey:`${this.store.profileId()}:${card.id}`,scale:[1,2,3,4,5,6,7,8,9,10],label:'service.interest',actionLabel:'Go',presentation:'fullscreen',blinkOnSelect:false}:null,
   onRatingSelect:(card,score,_query,snapshot)=>{if(card?.eagerDetail)this.store.rate(card.eagerDetail,score,snapshot);}}};
 protected readonly loadPage:SmartListLoadPage<ServiceHomeCard,ServiceOfferingFilters>=(q,c)=>defer(()=>this.store.page(q,c?.signal)).pipe(map(p=>({...p,items:p.items.map(item=>ServiceOfferingConverter.imageCard(item,k=>this.i18n.translate(k),'fullscreen'))})));
 protected readonly items = computed<AppMenuItem[]>(() => {const category=this.filters().category;return [
   {id:'category',label:category?`service.category.${category}`:'service.category.all',...(category?SERVICE_CATEGORY_STYLE[category]:{icon:'category',palette:'teal' as const}),kind:'select-trigger',layout:'pill',items:(['',...SERVICE_CATEGORIES] as const).map(id=>({id,label:id?`service.category.${id}`:'service.category.all',...(id?SERVICE_CATEGORY_STYLE[id]:{icon:'category',palette:'teal' as const}),surface:'tinted',kind:'radio',active:id===(category??''),checked:id===(category??'')}))},
   {id:'rates',label:'ratings',icon:'history',kind:'action',layout:'pill',palette:'gold'}];});
 protected headerAction(e:AppMenuItemSelectEvent):void{if(e.id==='rates')this.activities.openActivities('rates');else if(!e.id||SERVICE_CATEGORIES.includes(e.id as ServiceCategory))this.filters.update(f=>({...f,category:e.id as ServiceCategory||null}));}
 protected openProfile(userId:string):void{void this.profiles.openProfileView({userId});}
}
