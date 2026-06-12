import { Injectable, inject } from '@angular/core';

import type { UserRateRecord } from '../../base/interfaces/game.interface';
import type { UserDto } from '../../base/interfaces/user.interface';
import type {
  AdminAffinityGraphDto,
  AdminAffinityGraphEdgeDto,
  AdminAffinityGraphNodeDto
} from '../../base/interfaces/admin-affinity-graph.interface';
import { ADMIN_AFFINITY_GRAPH_STORE_KEY } from '../../base/interfaces/admin-affinity-graph.interface';
import { LocalMemoryDb } from '../../base/db';
import { USER_RATES_TABLE_NAME, USERS_TABLE_NAME } from '../../base/models/users.model';
import { SeedUserBuilder } from '../builders';

@Injectable({
  providedIn: 'root'
})
export class SeedAdminAffinityGraphRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly activeGraphProfileStatuses = new Set(['public', 'friends only', 'host only']);

  async buildGraphSnapshot(): Promise<AdminAffinityGraphDto> {
    await this.memoryDb.whenReady();

    const state = this.memoryDb.read();
    const usersTable = state[USERS_TABLE_NAME];
    const ratesTable = state[USER_RATES_TABLE_NAME];
    const nodes = usersTable.ids
      .map(id => usersTable.byId[id])
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

  async writeGraphSnapshot(snapshot: AdminAffinityGraphDto): Promise<void> {
    await this.memoryDb.writeIndexedDbTableEntry(ADMIN_AFFINITY_GRAPH_STORE_KEY, snapshot);
  }

  async buildAndWriteGraphSnapshot(): Promise<AdminAffinityGraphDto> {
    const snapshot = await this.buildGraphSnapshot();
    await this.writeGraphSnapshot(snapshot);
    return snapshot;
  }

  private isGraphMember(user: UserDto | null | undefined): user is UserDto {
    const id = `${user?.id ?? ''}`.trim();
    if (!id || id.startsWith('admin-demo-') || SeedUserBuilder.isEmptyOnboardingProfileUserId(id)) {
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
    const weight = this.rateWeight(record);
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

  private rateWeight(record: UserRateRecord): number {
    const score = Math.max(
      Number(record.rate) || 0,
      Number(record.scoreGiven) || 0,
      Number(record.scoreReceived) || 0
    );
    return this.clamp(score / 10, 0, 1);
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
