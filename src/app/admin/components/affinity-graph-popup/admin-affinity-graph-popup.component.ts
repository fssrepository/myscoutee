import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { AdminService } from '../../admin.service';
import { ADMIN_AFFINITY_GRAPH_STORE_KEY, AdminAffinityGraphService } from '../../services/admin-affinity-graph.service';

@Component({
  selector: 'app-admin-affinity-graph-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './admin-affinity-graph-popup.component.html',
  styleUrl: './admin-affinity-graph-popup.component.scss'
})
export class AdminAffinityGraphPopupComponent implements OnDestroy {
  protected readonly admin = inject(AdminService);
  protected readonly graphUrl = signal<SafeResourceUrl | null>(null);
  protected readonly popupKey = 'affinity-graph';
  private readonly document = inject(DOCUMENT);
  private readonly affinityGraph = inject(AdminAffinityGraphService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly originalBodyOverflow = this.document.body.style.overflow;
  private readonly originalHtmlOverflow = this.document.documentElement.style.overflow;
  private readonly graphMessageHandler = (event: MessageEvent) => this.handleGraphMessage(event);
  private graphOpenRequestId = 0;

  constructor() {
    this.document.defaultView?.addEventListener('message', this.graphMessageHandler);
    effect(() => {
      const shouldLockScroll = this.admin.activePopup() === this.popupKey;
      this.document.body.style.overflow = shouldLockScroll ? 'hidden' : this.originalBodyOverflow;
      this.document.documentElement.style.overflow = shouldLockScroll ? 'hidden' : this.originalHtmlOverflow;
      if (shouldLockScroll) {
        queueMicrotask(() => this.prepareGraphFrame());
      } else {
        this.graphOpenRequestId += 1;
        queueMicrotask(() => this.graphUrl.set(null));
      }
    });
  }

  ngOnDestroy(): void {
    this.document.defaultView?.removeEventListener('message', this.graphMessageHandler);
    this.document.body.style.overflow = this.originalBodyOverflow;
    this.document.documentElement.style.overflow = this.originalHtmlOverflow;
  }

  protected close(): void {
    this.admin.closePopup();
  }

  private prepareGraphFrame(): void {
    if (this.admin.activePopup() !== this.popupKey) {
      return;
    }
    const requestId = this.graphOpenRequestId + 1;
    this.graphOpenRequestId = requestId;
    this.graphUrl.set(null);
    void this.affinityGraph.prepareGraphSnapshot(this.admin.activeAdmin()?.id).then(() => {
      if (requestId !== this.graphOpenRequestId || this.admin.activePopup() !== this.popupKey) {
        return;
      }
      const params = new URLSearchParams({
        store: ADMIN_AFFINITY_GRAPH_STORE_KEY,
        v: Date.now().toString()
      });
      this.graphUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(
        `assets/admin/affinity-graph/index.html?${params.toString()}`
      ));
    }).catch(() => {
      if (requestId === this.graphOpenRequestId) {
        this.graphUrl.set(null);
      }
    });
  }

  private handleGraphMessage(event: MessageEvent): void {
    const win = this.document.defaultView;
    if (!win || event.origin !== win.location.origin || this.admin.activePopup() !== this.popupKey) {
      return;
    }
    const data = event.data as { source?: string; type?: string; requestId?: string; method?: string; params?: Record<string, unknown> } | null;
    if (data?.source !== 'admin-affinity-graph' || data.type !== 'request' || !data.requestId || !data.method) {
      return;
    }
    const target = event.source as WindowProxy | null;
    if (!target) {
      return;
    }
    void this.resolveGraphRequest(data.method, data.params ?? {})
      .then(result => target.postMessage({
        source: 'admin-affinity-graph',
        type: 'response',
        requestId: data.requestId,
        ok: true,
        result
      }, win.location.origin))
      .catch(error => target.postMessage({
        source: 'admin-affinity-graph',
        type: 'response',
        requestId: data.requestId,
        ok: false,
        error: error instanceof Error ? error.message : 'Affinity graph request failed.'
      }, win.location.origin));
  }

  private resolveGraphRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    const adminUserId = this.admin.activeAdmin()?.id;
    switch (method) {
      case 'meta':
        return this.affinityGraph.loadMeta(adminUserId, this.rangeParams(params));
      case 'forests':
        return this.affinityGraph.loadForests(adminUserId, this.rangeParams(params));
      case 'tile':
        return this.affinityGraph.loadTile(adminUserId, {
          ...this.rangeParams(params),
          layoutVersion: this.optionalString(params['layoutVersion']),
          componentId: this.optionalString(params['componentId']),
          z: this.optionalNumber(params['z']),
          x: this.optionalNumber(params['x']),
          y: this.optionalNumber(params['y'])
        });
      case 'neighborhood':
        return this.affinityGraph.loadNeighborhood(
          this.optionalString(params['userId']) ?? '',
          this.optionalNumber(params['depth']),
          adminUserId,
          this.rangeParams(params)
        );
      default:
        return Promise.reject(new Error(`Unsupported affinity graph request: ${method}`));
    }
  }

  private rangeParams(params: Record<string, unknown>): { minWeight?: number; maxWeight?: number } {
    return {
      minWeight: this.optionalNumber(params['minWeight']),
      maxWeight: this.optionalNumber(params['maxWeight'])
    };
  }

  private optionalString(value: unknown): string | undefined {
    const normalized = `${value ?? ''}`.trim();
    return normalized || undefined;
  }

  private optionalNumber(value: unknown): number | undefined {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }
}
