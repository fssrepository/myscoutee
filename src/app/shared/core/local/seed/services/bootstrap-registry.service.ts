import { Injectable } from '@angular/core';

import type { UserDto } from '../../../contracts/user.interface';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import type { AssetCardDTO } from '../../../base/dto';

@Injectable({
  providedIn: 'root'
})
export class SeedBootstrapRegistryService {
  private users: readonly UserDto[] = [];
  private userIds: readonly string[] = [];
  private eventsByUserId = new Map<string, readonly ActivityEventRecord[]>();
  private assetsByUserId = new Map<string, readonly AssetCardDTO[]>();

  clear(): void {
    this.users = [];
    this.userIds = [];
    this.eventsByUserId.clear();
    this.assetsByUserId.clear();
  }

  registerUsers(users: readonly UserDto[]): void {
    this.users = users.map(user => ({ ...user, images: [...(user.images ?? [])] }));
    this.userIds = this.users
      .map(user => user.id.trim())
      .filter(userId => userId.length > 0);
  }

  getUsers(): readonly UserDto[] {
    return this.users;
  }

  getUserIds(): readonly string[] {
    return this.userIds;
  }

  registerEventsByUserId(eventsByUserId: ReadonlyMap<string, readonly ActivityEventRecord[]>): void {
    this.eventsByUserId = new Map(eventsByUserId);
  }

  getEventsByUserId(): ReadonlyMap<string, readonly ActivityEventRecord[]> {
    return this.eventsByUserId;
  }

  registerAssetsByUserId(assetsByUserId: ReadonlyMap<string, readonly AssetCardDTO[]>): void {
    this.assetsByUserId = new Map(assetsByUserId);
  }

  getAssetsByUserId(): ReadonlyMap<string, readonly AssetCardDTO[]> {
    return this.assetsByUserId;
  }
}
