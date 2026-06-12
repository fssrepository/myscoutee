import { Injectable, inject } from '@angular/core';

import {
  type AdminAffinityGraphDto,
  type AdminAffinityGraphEdgeDto,
  type AdminAffinityGraphForestDto,
  type AdminAffinityGraphForestsDto,
  type AdminAffinityGraphMetaDto,
  type AdminAffinityGraphNeighborhoodDto,
  type AdminAffinityGraphNodeDto,
  type AdminAffinityGraphTileDto
} from '../../contracts/admin.interface';
import { BaseRouteModeService } from './base-route-mode.service';
import { I18nService } from './i18n.service';
import { LocalAdminAffinityGraphService } from '../../local/services/admin-affinity-graph.service';
import {
  HttpAdminAffinityGraphService,
  type AdminAffinityGraphRangeParams,
  type AdminAffinityGraphTileParams
} from '../../http/services/admin-affinity-graph.service';

export type { AdminAffinityGraphRangeParams, AdminAffinityGraphTileParams };

const ADMIN_AFFINITY_GRAPH_ROUTE = '/admin/affinity-graph';
const AFFINITY_GRAPH_FOREST_BASE_BUDGET = 16;
const AFFINITY_GRAPH_LABEL_KEYS = {
  graphView: 'admin.affinity.graph.view',
  clusterDetail: 'admin.affinity.graph.cluster.detail',
  clusterEyebrow: 'admin.affinity.graph.cluster.eyebrow',
  clusterViewLabel: 'admin.affinity.graph.cluster.view.label',
  clusterTitle: 'admin.affinity.graph.cluster.title',
  clusterIsolatedTitle: 'admin.affinity.graph.cluster.isolated.title',
  clusterExpandedKicker: 'admin.affinity.graph.cluster.expanded.kicker',
  clusterIsolatedKicker: 'admin.affinity.graph.cluster.isolated.kicker',
  clusterSummary: 'admin.affinity.graph.cluster.summary'
} as const;

@Injectable({
  providedIn: 'root'
})
export class AdminAffinityGraphService extends BaseRouteModeService {
  private readonly localService = inject(LocalAdminAffinityGraphService);
  private readonly httpService = inject(HttpAdminAffinityGraphService);
  private readonly i18n = inject(I18nService);

  async loadInitialGraph(adminUserId?: string | null): Promise<AdminAffinityGraphDto> {
    if (this.isLocalAffinityGraph()) {
      return this.normalizeSnapshot(await this.readLocalGraphSnapshot(true), 'demo');
    }
    return this.normalizeSnapshot(await this.loadHttpInitialGraph(adminUserId), 'http');
  }

  async loadMeta(adminUserId?: string | null, range?: AdminAffinityGraphRangeParams): Promise<AdminAffinityGraphMetaDto> {
    return this.isLocalAffinityGraph()
      ? this.metaFromSnapshot(await this.demoSnapshot(range))
      : await this.httpService.loadMeta(adminUserId, range);
  }

  async loadForests(adminUserId?: string | null, range?: AdminAffinityGraphRangeParams): Promise<AdminAffinityGraphForestsDto> {
    if (!this.isLocalAffinityGraph()) {
      return await this.httpService.loadForests(adminUserId, range);
    }
    const snapshot = await this.demoSnapshot(range, true);
    const components = this.components(snapshot.nodes, snapshot.edges);
    const forests = components.map((component, index) => this.forestFromComponent(component, index));
    const page = this.forestPage(forests, range);
    return {
      generatedAtIso: snapshot.generatedAtIso,
      source: snapshot.source,
      layoutVersion: snapshot.layoutVersion,
      forestCount: forests.length,
      forestLevel: page.forestLevel,
      maxForestLevel: page.maxForestLevel,
      limit: page.limit,
      offset: page.offset,
      forests: page.forests
    };
  }

  async loadTile(adminUserId?: string | null, tile?: AdminAffinityGraphTileParams): Promise<AdminAffinityGraphTileDto> {
    if (!this.isLocalAffinityGraph()) {
      return await this.httpService.loadTile(adminUserId, tile);
    }
    const snapshot = await this.demoSnapshot(tile, true);
    return {
      generatedAtIso: snapshot.generatedAtIso,
      source: snapshot.source,
      layoutVersion: snapshot.layoutVersion,
      z: Math.max(0, Math.trunc(Number(tile?.z ?? 0))),
      x: Math.max(0, Math.trunc(Number(tile?.x ?? 0))),
      y: Math.max(0, Math.trunc(Number(tile?.y ?? 0))),
      nodeCount: snapshot.nodes.length,
      edgeCount: snapshot.edges.length,
      truncated: false,
      nodes: snapshot.nodes,
      edges: snapshot.edges
    };
  }

  async loadNeighborhood(
    userId: string,
    depth?: number | null,
    adminUserId?: string | null,
    range?: AdminAffinityGraphRangeParams
  ): Promise<AdminAffinityGraphNeighborhoodDto> {
    if (!this.isLocalAffinityGraph()) {
      return await this.httpService.loadNeighborhood(userId, depth, adminUserId, range);
    }
    const snapshot = await this.demoSnapshot(range, true);
    const normalizedUserId = `${userId ?? ''}`.trim();
    const selectedIds = this.neighborhoodIds(snapshot.edges, normalizedUserId, Math.max(1, Math.min(3, Math.trunc(Number(depth ?? 1)))));
    if (snapshot.nodes.some(node => node.id === normalizedUserId)) {
      selectedIds.add(normalizedUserId);
    }
    return {
      generatedAtIso: snapshot.generatedAtIso,
      source: snapshot.source,
      layoutVersion: snapshot.layoutVersion,
      centerUserId: normalizedUserId,
      depth: Math.max(1, Math.min(3, Math.trunc(Number(depth ?? 1)))),
      nodes: snapshot.nodes.filter(node => selectedIds.has(node.id)),
      edges: snapshot.edges.filter(edge => selectedIds.has(edge.source) && selectedIds.has(edge.target))
    };
  }

  async rebuildLayout(adminUserId?: string | null): Promise<AdminAffinityGraphMetaDto> {
    return this.isLocalAffinityGraph()
      ? this.metaFromSnapshot(await this.demoSnapshot())
      : await this.httpService.rebuildLayout(adminUserId);
  }

  private isLocalAffinityGraph(): boolean {
    return this.isLocalRouteEnabled(ADMIN_AFFINITY_GRAPH_ROUTE);
  }

  private async loadHttpInitialGraph(adminUserId?: string | null): Promise<AdminAffinityGraphDto> {
    const [meta, forests, firstTile] = await Promise.all([
      this.httpService.loadMeta(adminUserId),
      this.httpService.loadForests(adminUserId, { forestLevel: 0, limit: AFFINITY_GRAPH_FOREST_BASE_BUDGET + 4, offset: 0 }),
      this.httpService.loadTile(adminUserId, { z: 0, x: 0, y: 0, minWeight: 0, maxWeight: 1 })
    ]);
    const nodesById = new Map<string, AdminAffinityGraphNodeDto>();
    for (const node of firstTile.nodes ?? []) {
      nodesById.set(node.id, node);
    }
    return this.normalizeSnapshot({
      generatedAtIso: meta.generatedAtIso ?? forests.generatedAtIso ?? firstTile.generatedAtIso,
      source: 'http',
      layoutVersion: meta.layoutVersion ?? forests.layoutVersion ?? firstTile.layoutVersion,
      memberCount: meta.memberCount,
      linkCount: meta.linkCount,
      componentCount: meta.componentCount,
      isolatedCount: meta.isolatedCount,
      forestCount: forests.forestCount ?? meta.componentCount,
      maxForestLevel: forests.maxForestLevel,
      maxZoom: meta.maxZoom,
      nodes: [...nodesById.values()],
      edges: firstTile.edges ?? [],
      forests: forests.forests ?? []
    }, 'http');
  }

  private async demoSnapshot(
    range?: AdminAffinityGraphRangeParams | null,
    waitForRouteDelay = false
  ): Promise<AdminAffinityGraphDto> {
    const snapshot = await this.readLocalGraphSnapshot(waitForRouteDelay);
    return {
      ...snapshot,
      edges: this.filterEdges(snapshot.edges, range)
    };
  }

  private async readLocalGraphSnapshot(waitForRouteDelay = false): Promise<AdminAffinityGraphDto> {
    const snapshot = await this.localService.readGraphSnapshot({ waitForRouteDelay });
    if (!snapshot) {
      throw new Error('Demo affinity graph snapshot is not bootstrapped.');
    }
    return this.normalizeSnapshot(snapshot, 'demo');
  }

  private metaFromSnapshot(snapshot: AdminAffinityGraphDto): AdminAffinityGraphMetaDto {
    const components = this.components(snapshot.nodes, snapshot.edges);
    return {
      generatedAtIso: snapshot.generatedAtIso,
      source: snapshot.source,
      layoutVersion: snapshot.layoutVersion,
      memberCount: snapshot.nodes.length,
      linkCount: snapshot.edges.length,
      componentCount: components.length,
      isolatedCount: components.filter(component => component.nodes.length === 1 && component.edges.length === 0).length,
      maxZoom: 6,
      tileSize: 256,
      nodeRenderBudget: 1000,
      edgeRenderBudget: 5000,
      materialized: false
    };
  }

  private components(nodes: AdminAffinityGraphNodeDto[], edges: AdminAffinityGraphEdgeDto[]): AffinityGraphComponentGroup[] {
    const parent = new Map(nodes.map(node => [node.id, node.id]));
    const find = (id: string): string => {
      const parentId = parent.get(id) ?? id;
      if (parentId === id) {
        return id;
      }
      const root = find(parentId);
      parent.set(id, root);
      return root;
    };
    const union = (left: string, right: string): void => {
      const leftRoot = find(left);
      const rightRoot = find(right);
      if (leftRoot !== rightRoot) {
        parent.set(rightRoot, leftRoot);
      }
    };
    edges.forEach(edge => union(edge.source, edge.target));
    const nodesByRoot = new Map<string, AdminAffinityGraphNodeDto[]>();
    nodes.forEach(node => {
      const root = find(node.id);
      nodesByRoot.set(root, [...(nodesByRoot.get(root) ?? []), node]);
    });
    return [...nodesByRoot.entries()]
      .map(([root, componentNodes], index) => ({
        id: `c${index}`,
        nodes: componentNodes,
        edges: edges.filter(edge => find(edge.source) === root && find(edge.target) === root)
      }))
      .sort((left, right) => right.nodes.length - left.nodes.length || left.id.localeCompare(right.id));
  }

  private forestFromComponent(component: AffinityGraphComponentGroup, index: number): AdminAffinityGraphForestDto {
    const representative = [...component.nodes].sort((left, right) => {
      const leftWeight = this.nodeWeight(left.id, component.edges);
      const rightWeight = this.nodeWeight(right.id, component.edges);
      return rightWeight - leftWeight || left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
    })[0] ?? component.nodes[0];
    const angle = index * 2.399963229728653;
    const distance = index === 0 ? 0 : 70 + Math.sqrt(index) * 42;
    return {
      componentId: component.id,
      representativeUserId: representative?.id ?? '',
      representativeName: representative?.name ?? '',
      representativeInitials: representative?.initials ?? '',
      gender: representative?.gender ?? null,
      memberCount: component.nodes.length,
      edgeCount: component.edges.length,
      weightedDegree: this.round(component.edges.reduce((total, edge) => total + edge.weight, 0)),
      x: this.round(Math.cos(angle) * distance),
      y: this.round((index % 3 - 1) * 10),
      z: this.round(Math.sin(angle) * distance),
      radius: this.round(Math.max(3, Math.sqrt(component.nodes.length) * 5.5))
    };
  }

  private forestPage(
    forests: AdminAffinityGraphForestDto[],
    params?: AdminAffinityGraphRangeParams | null
  ): {
    forests: AdminAffinityGraphForestDto[];
    forestLevel: number;
    maxForestLevel: number;
    limit: number;
    offset: number;
  } {
    const total = forests.length;
    const maxForestLevel = this.maxForestLevel(total);
    const forestLevel = Math.max(0, Math.min(maxForestLevel, Math.trunc(Number(params?.forestLevel ?? 0))));
    const levelLimit = Math.min(total, Math.max(1, AFFINITY_GRAPH_FOREST_BASE_BUDGET * (2 ** forestLevel)));
    const limit = Math.max(1, Math.min(total || 1, Math.trunc(Number(params?.limit ?? levelLimit))));
    const offset = Math.max(0, Math.min(total, Math.trunc(Number(params?.offset ?? 0))));
    return {
      forests: forests.slice(offset, offset + limit),
      forestLevel,
      maxForestLevel,
      limit,
      offset
    };
  }

  private maxForestLevel(totalCount: number): number {
    const total = Math.max(1, Math.trunc(Number(totalCount) || 1));
    return Math.max(0, Math.ceil(Math.log2(total / AFFINITY_GRAPH_FOREST_BASE_BUDGET)));
  }

  private neighborhoodIds(edges: AdminAffinityGraphEdgeDto[], userId: string, depth: number): Set<string> {
    const adjacency = new Map<string, AdminAffinityGraphEdgeDto[]>();
    edges.forEach(edge => {
      adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge]);
      adjacency.set(edge.target, [...(adjacency.get(edge.target) ?? []), edge]);
    });
    const selected = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: userId, depth: 0 }];
    selected.add(userId);
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || current.depth >= depth) {
        continue;
      }
      for (const edge of adjacency.get(current.id) ?? []) {
        const nextId = edge.source === current.id ? edge.target : edge.source;
        if (!selected.has(nextId)) {
          selected.add(nextId);
          queue.push({ id: nextId, depth: current.depth + 1 });
        }
      }
    }
    return selected;
  }

  private filterEdges(edges: AdminAffinityGraphEdgeDto[], range?: AdminAffinityGraphRangeParams | null): AdminAffinityGraphEdgeDto[] {
    const minWeight = this.clamp(Number(range?.minWeight ?? 0), 0, 1);
    const maxWeight = this.clamp(Number(range?.maxWeight ?? 1), 0, 1);
    const min = Math.min(minWeight, maxWeight);
    const max = Math.max(minWeight, maxWeight);
    return edges.filter(edge => edge.weight >= min && edge.weight <= max);
  }

  private nodeWeight(nodeId: string, edges: AdminAffinityGraphEdgeDto[]): number {
    return edges.reduce((total, edge) => total + (edge.source === nodeId || edge.target === nodeId ? edge.weight : 0), 0);
  }

  private edgeKey(source: string, target: string): string {
    return source.localeCompare(target) <= 0 ? `${source}:${target}` : `${target}:${source}`;
  }

  private normalizeSnapshot(
    snapshot: AdminAffinityGraphDto | null | undefined,
    fallbackSource: 'demo' | 'http'
  ): AdminAffinityGraphDto {
    const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
    const nodeIds = new Set<string>();
    const normalizedNodes = nodes
      .map(node => this.normalizeNode(node))
      .filter((node): node is AdminAffinityGraphNodeDto => {
        if (!node || nodeIds.has(node.id)) {
          return false;
        }
        nodeIds.add(node.id);
        return true;
      });
    const normalizedEdges = (Array.isArray(snapshot?.edges) ? snapshot.edges : [])
      .map(edge => this.normalizeEdge(edge))
      .filter((edge): edge is AdminAffinityGraphEdgeDto =>
        Boolean(edge && nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source !== edge.target)
      );
    const normalizedForests = (Array.isArray(snapshot?.forests) ? snapshot.forests : [])
      .map(forest => this.normalizeForest(forest))
      .filter((forest): forest is AdminAffinityGraphForestDto => Boolean(forest));
    return {
      generatedAtIso: snapshot?.generatedAtIso ?? new Date().toISOString(),
      source: snapshot?.source ?? fallbackSource,
      layoutVersion: snapshot?.layoutVersion ?? `${fallbackSource}-${snapshot?.generatedAtIso ?? Date.now()}`,
      memberCount: this.positiveInteger(snapshot?.memberCount, normalizedNodes.length),
      linkCount: this.positiveInteger(snapshot?.linkCount, normalizedEdges.length),
      componentCount: this.positiveInteger(snapshot?.componentCount ?? snapshot?.forestCount, normalizedForests.length),
      isolatedCount: this.positiveInteger(snapshot?.isolatedCount, 0),
      forestCount: this.positiveInteger(snapshot?.forestCount ?? snapshot?.componentCount, normalizedForests.length),
      forestLevel: this.positiveInteger(snapshot?.forestLevel, 0),
      maxForestLevel: this.positiveInteger(snapshot?.maxForestLevel, 0),
      maxZoom: this.positiveInteger(snapshot?.maxZoom, 0),
      labels: this.affinityGraphLabels(),
      nodes: normalizedNodes,
      edges: normalizedEdges,
      forests: normalizedForests
    };
  }

  private affinityGraphLabels(): Record<string, string> {
    return Object.fromEntries(
      Object.entries(AFFINITY_GRAPH_LABEL_KEYS).map(([labelKey, i18nKey]) => [
        labelKey,
        this.i18n.translate(i18nKey)
      ])
    );
  }

  private normalizeNode(node: AdminAffinityGraphNodeDto | null | undefined): AdminAffinityGraphNodeDto | null {
    const id = `${node?.id ?? ''}`.trim();
    if (!id || id === 'u-onboarding') {
      return null;
    }
    const images = (node?.images ?? []).map(image => `${image ?? ''}`.trim()).filter(Boolean);
    const image = `${node?.image ?? images[0] ?? ''}`.trim();
    return {
      ...node,
      id,
      name: `${node?.name ?? ''}`.trim() || id,
      initials: `${node?.initials ?? ''}`.trim().slice(0, 3).toUpperCase() || 'M',
      gender: node?.gender ?? null,
      city: node?.city ?? null,
      age: Number.isFinite(Number(node?.age)) ? Math.trunc(Number(node?.age)) : null,
      headline: node?.headline ?? null,
      traitLabel: node?.traitLabel ?? null,
      statusText: node?.statusText ?? null,
      profileStatus: node?.profileStatus ?? null,
      image: image || null,
      images,
      componentId: node?.componentId ?? null,
      x: Number.isFinite(Number(node?.x)) ? Number(node?.x) : null,
      y: Number.isFinite(Number(node?.y)) ? Number(node?.y) : null,
      z: Number.isFinite(Number(node?.z)) ? Number(node?.z) : null,
      degree: Number.isFinite(Number(node?.degree)) ? Math.trunc(Number(node?.degree)) : null,
      weightedDegree: Number.isFinite(Number(node?.weightedDegree)) ? Number(node?.weightedDegree) : null,
      centrality: Number.isFinite(Number(node?.centrality)) ? Number(node?.centrality) : null,
      forestMemberCount: Number.isFinite(Number(node?.forestMemberCount)) ? Math.trunc(Number(node?.forestMemberCount)) : null,
      forestEdgeCount: Number.isFinite(Number(node?.forestEdgeCount)) ? Math.trunc(Number(node?.forestEdgeCount)) : null
    };
  }

  private normalizeEdge(edge: AdminAffinityGraphEdgeDto | null | undefined): AdminAffinityGraphEdgeDto | null {
    const source = `${edge?.source ?? ''}`.trim();
    const target = `${edge?.target ?? ''}`.trim();
    if (!source || !target || source === target) {
      return null;
    }
    const weight = this.clamp(Number(edge?.weight ?? edge?.affinityScore ?? 0), 0, 1);
    if (weight <= 0) {
      return null;
    }
    return {
      id: `${edge?.id ?? this.edgeKey(source, target)}`.trim() || this.edgeKey(source, target),
      source,
      target,
      weight,
      affinityScore: Number.isFinite(Number(edge?.affinityScore)) ? Number(edge?.affinityScore) : weight,
      updatedDate: edge?.updatedDate ?? null
    };
  }

  private normalizeForest(forest: AdminAffinityGraphForestDto | null | undefined): AdminAffinityGraphForestDto | null {
    const componentId = `${forest?.componentId ?? ''}`.trim();
    if (!componentId) {
      return null;
    }
    const representativeUserId = `${forest?.representativeUserId ?? ''}`.trim();
    const representativeName = `${forest?.representativeName ?? ''}`.trim() || representativeUserId || componentId;
    const memberCount = Number.isFinite(Number(forest?.memberCount)) ? Math.max(0, Math.trunc(Number(forest?.memberCount))) : 0;
    const edgeCount = Number.isFinite(Number(forest?.edgeCount)) ? Math.max(0, Math.trunc(Number(forest?.edgeCount))) : 0;
    return {
      componentId,
      representativeUserId,
      representativeName,
      representativeInitials: `${forest?.representativeInitials ?? ''}`.trim().slice(0, 3).toUpperCase()
        || representativeName.split(/\s+/).map(part => part[0]).join('').slice(0, 3).toUpperCase()
        || 'F',
      gender: forest?.gender ?? null,
      memberCount,
      edgeCount,
      weightedDegree: Number.isFinite(Number(forest?.weightedDegree)) ? Number(forest?.weightedDegree) : 0,
      x: Number.isFinite(Number(forest?.x)) ? Number(forest?.x) : 0,
      y: Number.isFinite(Number(forest?.y)) ? Number(forest?.y) : 0,
      z: Number.isFinite(Number(forest?.z)) ? Number(forest?.z) : 0,
      radius: Number.isFinite(Number(forest?.radius)) ? Math.max(0, Number(forest?.radius)) : Math.max(3, Math.sqrt(memberCount) * 5.5)
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  }

  private positiveInteger(value: unknown, fallback: number): number {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < 0) {
      return fallback;
    }
    return Math.trunc(numberValue);
  }

  private round(value: number): number {
    return Math.round(value * 1000) / 1000;
  }
}

interface AffinityGraphComponentGroup {
  id: string;
  nodes: AdminAffinityGraphNodeDto[];
  edges: AdminAffinityGraphEdgeDto[];
}
