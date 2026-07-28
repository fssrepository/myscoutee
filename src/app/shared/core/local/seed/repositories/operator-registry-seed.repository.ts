import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import { USERS_TABLE_NAME } from '../../source/entity/user.entity';
import { LocalOperatorRegistryRepository } from '../../source/repositories/operator-registry.repository';
import {
  SeedOperatorRegistryBuilder,
  type OperatorBootstrapSeedMemory,
  type OperatorBootstrapSeedResult
} from '../builders/operator-registry-seed.builder';

export interface OperatorBootstrapSeedContext {
  readonly memory: OperatorBootstrapSeedMemory;
  readonly result: OperatorBootstrapSeedResult;
}

@Injectable({
  providedIn: 'root'
})
export class SeedOperatorRegistryRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly registryRepository = inject(LocalOperatorRegistryRepository);

  async whenReady(): Promise<void> {
    await this.registryRepository.whenReady();
  }

  async prepareBootstrap(): Promise<OperatorBootstrapSeedContext> {
    await this.whenReady();
    const memory: OperatorBootstrapSeedMemory = {
      appState: this.memoryDb.read(),
      registryRecord: await this.registryRepository.read()
    };
    return {
      memory,
      result: SeedOperatorRegistryBuilder.buildBootstrapMemory(memory)
    };
  }

  async seedUsers(context: OperatorBootstrapSeedContext): Promise<void> {
    const usersTable = context.result.appState[USERS_TABLE_NAME];
    if (context.result.usersChanged) {
      this.memoryDb.write(current => ({
        ...current,
        [USERS_TABLE_NAME]: usersTable
      }));
    }
    await this.memoryDb.writeIndexedDbTableEntry(USERS_TABLE_NAME, usersTable);
  }

  async seedRegistry(context: OperatorBootstrapSeedContext): Promise<void> {
    await this.registryRepository.write(context.result.registryRecord);
  }
}
