import { PwaService } from './pwa.service';
import { environment } from '../../../../../environments/environment';

describe('PWA service-worker configuration', () => {
  it('does not use a browser preference to override deployment configuration', () => {
    const service = Object.create(PwaService.prototype);
    expect(service.shouldEnableServiceWorker()).toBe('serviceWorker' in navigator && environment.serviceWorkerEnabled);
  });
});
