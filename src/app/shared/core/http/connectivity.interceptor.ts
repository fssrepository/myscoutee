import { HttpInterceptorFn, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { defer, finalize, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { reportBackendStatus } from '../common/backend-connectivity';
import { trackDemoWrite } from '../common/demo-failover';

// Observe API connectivity and guard dev-trial writes. Never retry/replay.
export const connectivityInterceptor: HttpInterceptorFn = (request, next) => {
  const api = new URL(environment.apiBaseUrl ?? '/api', document.baseURI);
  const url = new URL(request.url, document.baseURI);
  if (url.origin !== api.origin || !(url.pathname === api.pathname || url.pathname.startsWith(api.pathname.replace(/\/$/, '') + '/'))) return next(request);
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  return defer(() => {
    if (write) trackDemoWrite(true);
    return next(request).pipe(
      tap({ next: event => { if (event instanceof HttpResponse) reportBackendStatus(event.status); },
        error: error => { if (error instanceof HttpErrorResponse) reportBackendStatus(error.status); } }),
      finalize(() => { if (write) trackDemoWrite(false); })
    );
  });
};
