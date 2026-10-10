import type { ActivityMemberDTO } from '../../../core/contracts/activity.interface';
import { AppUtils } from '../../../core/base/app-utils';
import { CASE_TYPES, type CaseOffer, type CaseFilters, type CaseListContext, type CaseStatus, type CaseType, type CommunityCase } from '../../../core/contracts/community-case.interface';
import {
  type InfoCardData,
  type InfoCardOverlayTone,
  type SingleRowData,
  type AppMenuItem,
  type AppMenuPalette,
  type AppMenuTrigger
} from '@fssrepository/myscoutee-components';

type Presentation = { icon: string; palette: NonNullable<InfoCardData['leadingIcon']>['palette']; hue: number; tone: InfoCardOverlayTone };
const TYPES: Record<CaseType, Presentation> = {
  fault: { icon: 'report_problem', palette: 'orange', hue: 28, tone: 'orange' },
  maintenance: { icon: 'build', palette: 'blue', hue: 215, tone: 'stage-scheduled' },
  'meter-replacement': { icon: 'speed', palette: 'teal', hue: 175, tone: 'teal' },
  'chimney-sweep': { icon: 'fireplace', palette: 'violet', hue: 265, tone: 'purple' },
  renovation: { icon: 'construction', palette: 'green', hue: 140, tone: 'stage-finalized' },
  other: { icon: 'category', palette: 'rose', hue: 340, tone: 'woman' }
};
const STATUSES: Record<CaseStatus | 'active', { icon: string; palette: AppMenuPalette; tone: InfoCardOverlayTone }> = {
  active: { icon: 'inbox', palette: 'blue', tone: 'public' },
  open: { icon: 'inbox', palette: 'blue', tone: 'stage-scheduled' },
  'in-progress': { icon: 'play_circle', palette: 'orange', tone: 'orange' },
  completed: { icon: 'check_circle', palette: 'green', tone: 'stage-finalized' },
  cancelled: { icon: 'cancel', palette: 'red', tone: 'stage-suspended' },
  trash: { icon: 'delete', palette: 'danger', tone: 'deleted' }
};

export class CommunityCaseConverter {
  static offerStyle(status: CaseOffer['status'] | 'all') {
    return ({all:{icon:'request_quote',palette:'gold',tone:'neutral'},pending:{icon:'hourglass_top',palette:'gold',tone:'warning'},
      accepted:{icon:'check_circle',palette:'green',tone:'success'},rejected:{icon:'cancel',palette:'danger',tone:'danger'}} as const)[status];
  }
  static offerRow(offer: CaseOffer, c: CommunityCase, t: (key:string)=>string, menuActions: string[] = []): SingleRowData<CaseOffer> {
    const style=this.offerStyle(offer.status);
    return {id:offer.id,title:`${offer.amount} ${offer.currency}`,subtitle:c.members.find(m=>m.accountId===offer.providerAccountId)?.name??'',
      detail:offer.note,icon:'request_quote',eagerDetail:offer,menuActions,
      badges:[{label:t(`case.offer.${offer.status}`),icon:style.icon,tone:style.tone,position:'top-right'}]};
  }
  static offerForm(offer: CaseOffer, t: (key:string)=>string) {
    // Keep already-saved free-text terms visible when opening them in the shared policy editor.
    const policies=(items:CaseOffer['workPolicies'],legacy:string|undefined,kind:string)=>items?.length?structuredClone(items):legacy?.trim()
      ? [{id:`${offer.id}-${kind}`,title:t(`case.offer.${kind}`),description:legacy,required:true}]:[];
    return {amount:offer.amount,currency:offer.currency,note:offer.note,
      workPolicies:policies(offer.workPolicies,offer.workPolicy,'work-policy'),refundPolicies:policies(offer.refundPolicies,offer.refundPolicy,'refund-policy')};
  }
  static canChatOffer(c: CommunityCase, offer: CaseOffer, actor: string): boolean {
    return c.membershipStatus==='accepted' && (offer.providerAccountId===actor || c.canManage || c.audienceAccountIds.includes(actor) || !c.support.some(s=>s.accountId===actor));
  }
  static members(c: CommunityCase): ActivityMemberDTO[] {
    return c.members.map(m => ({ id: `${c.id}:${m.accountId}`, userId: m.accountId, name: m.name,
      initials: AppUtils.initialsFromText(m.name), gender: m.gender, city: '', avatarUrl: m.avatarUrl ?? '',
      role: m.accountId === c.ownerAccountId ? 'Admin' : 'Member', status: m.status === 'accepted' ? 'accepted' : m.status === 'invited' ? 'pending' : 'deleted',
      revision: String(c.version), statusText: '', pendingSource: m.status === 'invited' ? 'admin' : null,
      requestKind: m.status === 'invited' ? 'invite' : null, invitedByActiveUser: false, metAtIso: '', actionAtIso: '', metWhere: '' }));
  }
  static card(c: CommunityCase): InfoCardData<CommunityCase> {
    const type = TYPES[c.caseType], status = STATUSES[c.status];
    return { id: c.id, title: c.communityName ?? '', mediaTitle: c.title, menuTitle: c.title, description: c.description, descriptionLines: 2,
      mediaMode: 'title', mediaTone: 'neutral', mediaIcon: type.icon, imageUrl: null,
      dateIso: c.updatedAtIso, leadingIcon: { icon: 'groups', palette: type.palette },
      eagerDetail: c, hasMenuOptions: true, metaRows: [],
      mediaStart: { variant: 'badge', label: `case.type.${c.caseType}`, icon: type.icon, tone: 'stage', interactive: false },
      mediaEnd: { variant: 'badge', label: `case.status.${c.status}`, icon: status.icon, tone: status.tone, interactive: false },
      surfaceTone: 'subevent-light', accentHue: type.hue, menuBadgeCount: c.boardTasks.length };
  }

  static actions(c: CommunityCase, actor: string): AppMenuItem[] {
    const active = c.status === 'open' || c.status === 'in-progress';
    const own = c.support.find(s => s.accountId === actor);
    const audience = c.audienceAccountIds.includes(actor);
    const result: AppMenuItem[] = [];
    const add = (id: string, icon: string, palette: AppMenuPalette, count = 0) => result.push({
      id, icon, label: `case.action.${id}`, palette, surface: 'tinted', context: c,
      counter: count > 0 ? { value: count, max: 99 } : null, counterTone: 'alert'
    });
    add('view', 'view_kanban', 'blue', c.boardTasks.length);
    if (c.canTakeOver) add('take-over', 'assignment_ind', 'violet');
    if (c.canChat) add('chat', 'chat', 'teal');
    if (active && c.membershipStatus === 'invited') { add('join', 'login', 'green'); add('decline', 'close', 'danger'); }
    if (active && ['left', 'declined'].includes(c.membershipStatus ?? '')) add('join', 'login', 'green');
    if (c.status !== 'trash' && c.membershipStatus === 'accepted') add('leave', 'logout', 'orange');
    add('members', 'groups', 'teal');
    if (c.canReviewOffers || own?.status === 'accepted') add('offers', 'request_quote', 'gold');
    if (c.canManage) {
      if (c.status !== 'trash') add('edit', 'edit', 'blue');
      if (active) {
        add('invite-provider', 'person_add', 'violet');
        if (c.status === 'open') add('start', 'play_arrow', 'orange');
        add('complete', 'done', 'green');
        add('cancel', 'cancel', 'red');
      } else add('reopen', 'restore', 'green');
      if (c.status !== 'trash') add('trash', 'delete', 'danger');
    }
    return result;
  }

  static count(context: CaseListContext, status: CaseFilters['status'], type?: CaseType | null): number {
    const statuses = !status || status === 'active' ? ['open', 'in-progress'] : [status];
    const types: readonly CaseType[] = type ? [type] : CASE_TYPES;
    return statuses.reduce<number>((total, s) => total + types.reduce<number>((sum, t) => sum + (context[`${s}:${t}`] ?? 0), 0), 0);
  }

  static statusOption(id: CaseStatus | 'active', current: CaseFilters, context: CaseListContext | (() => CaseListContext)): AppMenuItem {
    return this.option(id, `case.status.${id}`, STATUSES[id], current.status === id,
      typeof context === 'function' ? () => this.count(context(), id, current.caseType) : this.count(context, id, current.caseType));
  }
  static typeOption(id: CaseType | '', current: CaseFilters, context: CaseListContext | (() => CaseListContext)): AppMenuItem {
    return this.option(id, id ? `case.type.${id}` : 'all', id ? TYPES[id] : { icon: 'category', palette: 'teal' },
      id === (current.caseType ?? ''), typeof context === 'function' ? () => this.count(context(), current.status, id || null) : this.count(context, current.status, id || null));
  }
  static trigger(item: AppMenuItem): AppMenuTrigger {
    return { label: item.label, icon: item.icon, palette: item.palette, counter: item.counter ?? { value: 0, max: 99 }, layout: 'pill' };
  }
  private static option(id: string, label: string, style: { icon: string; palette?: AppMenuPalette }, active: boolean, count: number | (() => number)): AppMenuItem {
    return { id, label, ...style, kind: 'radio', active, checked: active, surface: 'tinted', counterTone: 'alert',
      counter: typeof count === 'function' || count > 0 ? { value: count, max: 99 } : null };
  }
}
