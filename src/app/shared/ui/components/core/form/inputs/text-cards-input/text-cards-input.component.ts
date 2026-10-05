import { Component, EventEmitter, Output, computed, effect, input, untracked, viewChild } from '@angular/core';
import { of } from 'rxjs';
import { SmartListComponent, TextCardComponent, type SmartListConfig, type SmartListLoadPage } from '../../../smart-list';
import type { AppMenuItem, AppMenuItemSelectEvent } from '../../../menu';
import type { TextCardTone } from '../../../smart-list/card/text-card';

export interface TextCardsItem {
  id: string;
  title: string;
  subtitle?: string;
  detail?: string;
  icon?: string;
  tone?: TextCardTone;
  price?: string;
  menuItems: readonly AppMenuItem[];
}
export interface TextCardsConfig {
  items: readonly TextCardsItem[];
  columns?: number;
}

/** The same summary cards as Slots, hosted in the shared pageable list. */
@Component({selector:'app-text-cards-input',standalone:true,imports:[SmartListComponent,TextCardComponent],
  template:`<app-smart-list [config]="listConfig()" [loadPage]="loadPage" [itemTemplate]="cardTemplate" (menuItemSelect)="menuSelect.emit($event)"></app-smart-list>
    <ng-template #cardTemplate let-card>
      <app-text-card [title]="card.title" [subtitle]="card.subtitle || ''" [detail]="card.detail || ''"
        [icon]="card.icon || ''" [tone]="card.tone || 'neutral'" [badge]="card.price || ''" badgeTone="price" badgePosition="end"
        [menuTitle]="card.title" [menuItems]="card.menuItems" [useSharedMenuTrigger]="true" [sharedMenuId]="'text-card-' + card.id"></app-text-card>
    </ng-template>`,styles:[`:host { display:block; min-width:0; }`]})
export class TextCardsInputComponent {
  readonly config=input.required<TextCardsConfig>();
  private readonly list=viewChild(SmartListComponent<TextCardsItem>);
  @Output() readonly menuSelect=new EventEmitter<AppMenuItemSelectEvent>();
  private readonly columns=computed(()=>this.config().columns??3);
  protected readonly listConfig=computed<SmartListConfig<TextCardsItem>>(()=>({pageSize:20,listLayout:'card-grid',desktopColumns:this.columns(),
    trackBy:(_,row)=>row.id,showStickyHeader:false,showGroupMarker:()=>false,pagination:{mode:'arrows'}}));
  protected readonly loadPage:SmartListLoadPage<TextCardsItem>=query=>{
    const rows=this.config().items,start=Number(query.cursor??0),items=rows.slice(start,start+query.pageSize);
    return of({items,total:rows.length,nextCursor:start+items.length<rows.length?String(start+items.length):null});
  };
  constructor(){effect(()=>{
    const rows=this.config().items,list=this.list();if(!list)return;
    untracked(()=>{const count=Math.max(20,list.itemsSnapshot().length),items=rows.slice(0,count);
      list.syncVisibleItems(items,{total:rows.length,hasMore:items.length<rows.length,nextCursor:items.length<rows.length?String(items.length):null});});
  });}
}
