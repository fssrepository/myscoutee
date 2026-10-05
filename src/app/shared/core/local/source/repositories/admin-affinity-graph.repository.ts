import { LocalUserRatesMapper } from '../mappers/rate.mapper';
import { USER_RATES_TABLE_NAME } from '../entity/rate.entity';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import { Injectable, inject } from '@angular/core';

import type { UserRateRecord } from '../entity/rate.entity';
import type { UserDto } from '../../../contracts/user.interface';
import type { AdminAffinityGraphDto, AdminAffinityGraphEdgeDto, AdminAffinityGraphNodeDto } from '../../../contracts/admin.interface';
import { LocalMemoryDb } from '../../../common/app.db';

import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

const ADMIN_AFFINITY_GRAPH_STORE_KEY = APP_INDEXED_DB_KEYS.adminAffinityGraph;

@Injectable({
  providedIn: 'root'
})
export class LocalAdminAffinityGraphRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly activeGraphProfileStatuses = new Set(['public', 'friends only', 'host only']);

  async buildGraphSnapshot(groupId: string | null = null): Promise<AdminAffinityGraphDto> {
    await this.memoryDb.whenReady();

    const state = this.memoryDb.read();
    const usersTable = state[USERS_TABLE_NAME];
    const ratesTable = state[USER_RATES_TABLE_NAME];
    const nodes = usersTable.ids
      .map(id => usersTable.byId[id])
      .filter(user => (user?.workspaceGroupId ?? null) === groupId)
      .filter((user): user is UserDto => this.isGraphMember(user))
      .map(user => this.toNodeDto(user));
    const nodeIds = new Set(nodes.map(node => node.id));
    const edgesByKey = new Map<string, AdminAffinityGraphEdgeDto>();

    for (const id of ratesTable.ids) {
      const record = ratesTable.byId[id];
      if (record) {
        this.addRateEdge(edgesByKey, nodeIds, record);
      }
    }

    return {
      generatedAtIso: new Date().toISOString(),
      source: 'demo',
      layoutVersion: `demo-${nodes.length}-${edgesByKey.size}`,
      nodes,
      edges: [...edgesByKey.values()]
    };
  }

  async readGraphSnapshot(adminUserId?: string | null): Promise<AdminAffinityGraphDto | null> {
    await this.memoryDb.whenReady();
    return this.readGroupSnapshot(this.memoryDb.read().users.byId[adminUserId ?? '']?.workspaceGroupId ?? null);
  }

  async readGroupSnapshot(groupId: string | null): Promise<AdminAffinityGraphDto | null> {
    const root = await this.memoryDb.readIndexedDbTableEntry<AdminAffinityGraphDto & { baseGroups?: Record<string, AdminAffinityGraphDto> }>(ADMIN_AFFINITY_GRAPH_STORE_KEY);
    if (groupId) return root?.baseGroups?.[groupId] ?? null;
    if (!root) return null;
    const { baseGroups: _groups, ...snapshot } = root;
    return snapshot;
  }

  async writeGraphSnapshot(snapshot: AdminAffinityGraphDto, groupId: string | null = null): Promise<void> {
    await this.memoryDb.updateIndexedDbTableEntry<AdminAffinityGraphDto & { baseGroups?: Record<string, AdminAffinityGraphDto> }>(ADMIN_AFFINITY_GRAPH_STORE_KEY, root =>
      groupId ? { ...root!, baseGroups: { ...root?.baseGroups, [groupId]: snapshot } } : { ...snapshot, baseGroups: root?.baseGroups });
  }

  async buildAndWriteGraphSnapshot(groupId: string | null = null): Promise<AdminAffinityGraphDto> {
    const snapshot = await this.buildGraphSnapshot(groupId);
    await this.writeGraphSnapshot(snapshot, groupId);
    return snapshot;
  }

  private isGraphMember(user: UserDto | null | undefined): user is UserDto {
    const id = `${user?.id ?? ''}`.trim();
    if (!id || user?.admin || id.startsWith('admin-demo-')) {
      return false;
    }
    return this.activeGraphProfileStatuses.has(`${user?.profileStatus ?? ''}`.trim().toLowerCase());
  }

  private toNodeDto(user: UserDto): AdminAffinityGraphNodeDto {
    const images = (user.images ?? []).map(image => `${image ?? ''}`.trim()).filter(Boolean);
    return {
      id: user.id.trim(),
      name: user.name?.trim() || user.initials?.trim() || user.id.trim(),
      initials: this.initialsFor(user),
      gender: user.gender,
      city: user.city ?? null,
      age: Number.isFinite(user.age) ? Math.trunc(Number(user.age)) : null,
      headline: user.headline ?? null,
      traitLabel: user.traitLabel ?? null,
      statusText: user.statusText ?? null,
      profileStatus: user.profileStatus ?? null,
      image: images[0] ?? null,
      images
    };
  }

  private addRateEdge(
    edgesByKey: Map<string, AdminAffinityGraphEdgeDto>,
    nodeIds: Set<string>,
    record: UserRateRecord
  ): void {
    const source = `${record.fromUserId ?? ''}`.trim();
    const target = `${record.toUserId ?? ''}`.trim();
    if (!source || !target || source === target || !nodeIds.has(source) || !nodeIds.has(target)) {
      return;
    }
    const key = this.edgeKey(source, target);
    const weight = LocalUserRatesMapper.affinityWeight(record);
    if (weight <= 0) {
      return;
    }
    const existing = edgesByKey.get(key);
    if (existing && existing.weight >= weight) {
      return;
    }
    edgesByKey.set(key, {
      id: key,
      source,
      target,
      weight,
      affinityScore: weight,
      updatedDate: record.updatedAtIso ?? record.happenedAtIso ?? record.createdAtIso ?? null
    });
  }

  private edgeKey(source: string, target: string): string {
    return source.localeCompare(target) <= 0 ? `${source}:${target}` : `${target}:${source}`;
  }

  private initialsFor(user: UserDto): string {
    const explicit = `${user.initials ?? ''}`.trim();
    if (explicit) {
      return explicit.slice(0, 3).toUpperCase();
    }
    return `${user.name ?? ''}`
      .trim()
      .split(/\s+/)
      .map(part => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'M';
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  }
}
