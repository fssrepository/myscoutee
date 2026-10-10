import type { Campaign, CampaignCategory, CampaignKind, CampaignStatus } from '../../core/contracts/campaign.interface';
import {
  type ImageCardData,
  type SingleCardData,
  type AppMenuItem,
  type AppMenuPalette
} from '@myscoutee/components';

export const CAMPAIGN_KIND_STYLE: Record<CampaignKind, { icon: string; palette: AppMenuPalette }> = {
  work: { icon: 'work', palette: 'blue' }, business: { icon: 'lightbulb', palette: 'amber' }, both: { icon: 'handshake', palette: 'teal' }
};
export const CAMPAIGN_CATEGORY_STYLE: Record<CampaignCategory, { icon: string; palette: AppMenuPalette }> = {
  technology: { icon: 'code', palette: 'blue' }, creative: { icon: 'palette', palette: 'violet' }, services: { icon: 'handyman', palette: 'orange' },
  education: { icon: 'school', palette: 'teal' }, community: { icon: 'groups', palette: 'green' }, other: { icon: 'category', palette: 'slate' }
};
export const CAMPAIGN_STATUS_STYLE: Record<CampaignStatus, { icon: string; palette: AppMenuPalette }> = {
  draft: { icon: 'edit_note', palette: 'gold' }, published: { icon: 'campaign', palette: 'green' }, trash: { icon: 'delete', palette: 'danger' }
};
const CATEGORY_HUE: Record<CampaignCategory, number> = {technology:215,creative:265,services:28,education:175,community:140,other:215};
export class CampaignConverter {
  static card(c: Campaign, translate: (key: string) => string, selecting = false, selected = false): ImageCardData<Campaign> {
    const kind=CAMPAIGN_KIND_STYLE[c.kind];
    return {id:c.id,title:c.title,subtitle:c.description,imageUrl:c.imageUrls[0]??null,aspectRatio:'3 / 4',layout:'overlay',mediaFit:'contain',
      accentHue:CATEGORY_HUE[c.category],descriptionLines:2,dateIso:c.updatedAtIso,eagerDetail:c,placeholderIcon:kind.icon,
      statusChip:{icon:kind.icon,label:translate(`campaign.kind.${c.kind}`),palette:kind.palette},
      badge:selecting?null:{label:translate(`campaign.status.${c.status}`),active:c.status==='published',pending:c.status==='draft',
        className:c.status==='trash'?'ui-image-card__badge--danger':null},
      menuTitle:c.title,imageMenuPosition:'bottom-right',
      mediaActions:selecting?[{id:'select',guideFieldId:'campaign-select',icon:'add',selectedIcon:'check',selected,position:'top-right',tone:selected?'success':'default',
        ariaLabel:translate(selected?'remove':'campaign.select')}]:[]};
  }
  static imageCard(c:Campaign,t:(key:string)=>string):SingleCardData & {id:string;eagerDetail:Campaign} {
    return {id:c.id,rowId:c.id,eagerDetail:c,ratingDomain:'campaign',presentation:'fullscreen',state:'active',descriptionLines:2,
      slides:(c.imageUrls.length?c.imageUrls:['']).map(imageUrl=>({imageUrl,primaryLine:c.title,secondaryLine:c.description})),
      profileView:{userId:c.ownerUserId,label:t('campaign.details')},
      contextBadge:{label:t(`campaign.category.${c.category}`),icon:CAMPAIGN_CATEGORY_STYLE[c.category].icon,
        accentHue:CATEGORY_HUE[c.category],ariaLabel:t(`campaign.category.${c.category}`)}};
  }
  static menu(c: Campaign, userId: string): AppMenuItem[] {
    const items: AppMenuItem[] = [
      { id: 'view', label: 'campaign.view', icon: 'article', palette: 'blue', surface: 'tinted', context: c }
    ];
    if (c.ownerUserId !== userId) {
      items.push({ id: 'author', label: 'campaign.author', icon: 'person', palette: 'violet', surface: 'tinted', context: c });
      if ((c.viewerRating ?? 0) > 0 && c.status === 'published') items.push({ id: 'ask', label: 'campaign.ask', icon: 'chat', palette: 'teal', surface:'tinted', context: c });
      return items;
    }
    if (c.status !== 'trash') items.push({ id: 'edit', label: 'edit', icon: 'edit', palette: 'blue', surface: 'tinted', context: c });
    items.push({ id: 'ratings', guideId: 'campaign-ratings', label: 'ratings', icon: 'star', palette: 'gold', surface: 'tinted', context: c });
    const actions = c.status === 'trash' ? ['restore'] : c.status === 'draft' ? ['publish', 'trash'] : ['unpublish', 'trash'];
    for (const id of actions) items.push({ id, label: `campaign.action.${id}`, icon: id === 'trash' ? 'delete' : id === 'publish' ? 'publish' : id === 'restore' ? 'restore' : 'unpublished',
      palette: id === 'trash' ? 'danger' : id === 'unpublish' ? 'gold' : 'green', surface: 'tinted', context: c });
    return items;
  }
}
