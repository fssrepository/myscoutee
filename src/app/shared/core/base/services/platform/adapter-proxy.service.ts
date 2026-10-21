import { Injectable, Injector, inject, type Type } from '@angular/core';

import { ADAPTER_LOADERS, cachedAdapterType, type AdapterInstance, type AdapterKey } from '../../adapter-loaders';

@Injectable({ providedIn: 'root' })
export class AdapterProxyService {
  private readonly injector = inject(Injector);
  private readonly instances = new Map<AdapterKey, Promise<unknown>>();
  private readonly resolvedInstances = new Map<AdapterKey, unknown>();
  private readonly references = new Map<AdapterKey, unknown>();

  reference<K extends AdapterKey>(key: K): AdapterInstance<K> {
    let reference = this.references.get(key);
    if (!reference) {
      // A route may hold both references. Resolve only the side it actually
      // uses, after bootstrap has loaded its constructor table. This preserves
      // synchronous cache reads without constructing the unused counterpart.
      reference = new Proxy({}, {
        get: (_target, property) => {
          const instance = this.getLoaded(key);
          const value = Reflect.get(instance, property, instance);
          return typeof value === 'function' ? value.bind(instance) : value;
        }
      });
      this.references.set(key, reference);
    }
    return reference as AdapterInstance<K>;
  }

  getLoaded<K extends AdapterKey>(key: K): AdapterInstance<K> {
    if (!this.resolvedInstances.has(key)) {
      const serviceType = cachedAdapterType(key);
      if (!serviceType) throw new Error(`Adapter side was not loaded before use: ${key}`);
      this.resolvedInstances.set(key, this.injector.get(serviceType));
    }
    return this.resolvedInstances.get(key) as AdapterInstance<K>;
  }

  get<K extends AdapterKey>(key: K): Promise<AdapterInstance<K>> {
    let pending = this.instances.get(key);
    if (!pending) {
      const load: () => Promise<Type<unknown>> = ADAPTER_LOADERS[key];
      // Cache the promise before starting the loader so concurrent callers share
      // both the import and the existing Angular singleton.
      pending = Promise.resolve()
        .then(load)
        .then(serviceType => {
          const instance = this.injector.get(serviceType);
          this.resolvedInstances.set(key, instance);
          return instance;
        });
      this.instances.set(key, pending);
      const attempt = pending;
      void pending.catch(() => {
        if (this.instances.get(key) === attempt) this.instances.delete(key);
      });
    }
    return pending as Promise<AdapterInstance<K>>;
  }
}
