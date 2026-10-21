import { Injectable } from '@angular/core';
import { scheduleAfterPaint } from '@fssrepository/myscoutee-components';

import { POPUP_ADAPTER_LOADERS, type PopupAdapterKey, type PopupAdapterModule } from './popup-adapter-loaders';

@Injectable({ providedIn: 'root' })
export class PopupAdapterProxyService {
  private readonly modules = new Map<PopupAdapterKey, Promise<unknown>>();

  load<K extends PopupAdapterKey>(key: K): Promise<PopupAdapterModule<K>> {
    let pending = this.modules.get(key);
    if (!pending) {
      const load: () => Promise<unknown> = POPUP_ADAPTER_LOADERS[key];
      pending = Promise.resolve().then(load);
      this.modules.set(key, pending);
      const attempt = pending;
      void pending.catch(() => {
        if (this.modules.get(key) === attempt) this.modules.delete(key);
      });
    }
    return pending as Promise<PopupAdapterModule<K>>;
  }

  prepare(keys: readonly PopupAdapterKey[], signal?: AbortSignal): void {
    const missing = keys.filter(key => !this.modules.has(key));
    if (!missing.length || signal?.aborted) return;
    // The popup/list paints and starts its data request first. Preparation uses
    // the same promises as an explicit opening, without mounting components.
    const cancel = scheduleAfterPaint(() => {
      signal?.removeEventListener('abort', cancelPreparation);
      if (signal?.aborted) return;
      for (const key of missing) void this.load(key).catch(() => undefined);
    });
    const cancelPreparation = () => { cancel(); };
    if (signal?.aborted) cancel();
    else signal?.addEventListener('abort', cancelPreparation, { once: true });
  }
}
