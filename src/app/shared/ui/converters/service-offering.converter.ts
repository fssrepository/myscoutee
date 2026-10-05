import type { ServiceCategory, ServiceStatus, ServiceOfferingItem } from '../../core/contracts/service-offering.interface';
import type { InfoCardData, SingleCardData } from '../components/core/smart-list';
import type { AppMenuItem, AppMenuPalette } from '../components/core/menu';
export const SERVICE_STATUS_STYLE: Record<ServiceStatus, { icon: string; palette: AppMenuPalette }> = {
  published: { icon: 'public', palette: 'green' }, draft: { icon: 'edit_note', palette: 'gold' }, trash: { icon: 'delete', palette: 'danger' }
};
export const SERVICE_CATEGORY_STYLE: Record<ServiceCategory, { icon: string; palette: AppMenuPalette; hue: number }> = {
  maintenance: {icon:'build',palette:'blue',hue:215}, plumbing:{icon:'plumbing',palette:'cyan',hue:190},
  electrical:{icon:'bolt',palette:'gold',hue:43}, cleaning:{icon:'cleaning_services',palette:'teal',hue:170},
  renovation:{icon:'construction',palette:'orange',hue:28}, fitness:{icon:'fitness_center',palette:'rose',hue:340},
  education:{icon:'school',palette:'violet',hue:265}, other:{icon:'category',palette:'slate',hue:205}
};
export type ServiceImageCard = SingleCardData & { id:string; eagerDetail:ServiceOfferingItem };
export class ServiceOfferingConverter {
  static imageCard(item:ServiceOfferingItem,t:(key:string)=>string,presentation:SingleCardData['presentation']='list'):ServiceImageCard {
    const service=item.service,category=SERVICE_CATEGORY_STYLE[service.category];
    return {id:service.id,rowId:service.id,eagerDetail:item,ratingDomain:'service-interest',presentation,descriptionLines:2,state:'active',
      slides:(service.imageUrls.length?service.imageUrls:['']).map(imageUrl=>({imageUrl,primaryLine:service.title,secondaryLine:service.description})),
      profileView:{userId:item.ownerUserId,label:item.ownerName},
      contextBadge:{label:t(`service.category.${service.category}`),icon:category.icon,accentHue:category.hue,ariaLabel:t(`service.category.${service.category}`)}};
  }
  static card(item:ServiceOfferingItem,t:(key:string)=>string,selecting=false,selected=false):InfoCardData<ServiceOfferingItem>{const s=item.service;return {
    id:s.id,title:item.ownerName,mediaTitle:s.title,menuTitle:s.title,description:s.description,descriptionLines:2,imageUrl:s.imageUrls[0]??null,imageUrls:s.imageUrls,mediaMode:s.imageUrls.length?'image':'title',mediaFit:'contain',
    mediaEnd:selecting?{variant:'toggle',icon:'add',selectedIcon:'check',selected,ariaLabel:selected?'remove':'service.select',interactive:true,tone:selected?'selected':'default'}:null,
    dateIso:s.updatedAtIso,eagerDetail:item,hasMenuOptions:true,leadingIcon:{icon:'home_repair_service',palette:'teal'},
    metaRows:[],mediaStart:{variant:'badge',label:t(`service.category.${s.category}`),icon:SERVICE_CATEGORY_STYLE[s.category].icon,tone:'stage',interactive:false},
    mediaTone:'neutral',mediaIcon:SERVICE_CATEGORY_STYLE[s.category].icon,surfaceTone:'subevent-light',accentHue:SERVICE_CATEGORY_STYLE[s.category].hue};}
  static menu(item:ServiceOfferingItem,readOnly=false):AppMenuItem[]{const actions:[string,string][]=[['view','article'],['author','person']];
    if(item.canManage&&!readOnly){if(item.service.status!=='trash')actions.push(['edit','edit']);if(item.service.status==='draft')actions.push(['publish','publish']);if(item.service.status==='published')actions.push(['unpublish','unpublished']);if(item.service.status==='trash')actions.push(['restore','restore']);else actions.push(['trash','delete']);}
    const palettes:Record<string,AppMenuPalette>={view:'blue',author:'violet',edit:'blue',publish:'green',unpublish:'gold',restore:'green',trash:'danger'};
    return actions.map(([id,icon])=>({id,icon,label:`service.action.${id}`,palette:palettes[id],surface:'tinted',context:item}));}
}
