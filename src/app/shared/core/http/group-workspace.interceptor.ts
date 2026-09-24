import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { GroupWorkspaceContextService } from '../base/services/group-workspace-context.service';

export const groupWorkspaceInterceptor: HttpInterceptorFn = (request, next) => {
  const context = inject(GroupWorkspaceContextService);
  const groupId = context.active()?.groupId;
  const base = new URL(environment.apiBaseUrl ?? '/api', document.baseURI);
  const url = new URL(request.url, document.baseURI);
  if (!groupId || url.origin !== base.origin || !url.pathname.startsWith(`${base.pathname}/`)) return next(request);
  const path = url.pathname.slice(base.pathname.length);
  const body = request.body as { ownerType?: string; owner?: { ownerType?: string }; owners?: { ownerType?: string }[] } | null;
  const community = request.params.get('ownerType') === 'community'
    || body?.ownerType === 'community' || body?.owner?.ownerType === 'community'
    || !!body?.owners?.length && body.owners.every(owner => owner.ownerType === 'community');
  const accountRoute = ['/auth/me/partner-invite/claim', '/auth/me/logout', '/auth/me/delete', '/auth/me/feedback'].includes(path) || /^\/(groups|notifications|i18n|admin|operator|privacy|help|terms|explanations)(\/|$)/.test(path)
    || path.startsWith('/auth/') && !path.startsWith('/auth/me');
  return next(community || accountRoute ? request : request.clone({ setHeaders: { 'X-MyScoutee-Group-Id': groupId } }));
};
