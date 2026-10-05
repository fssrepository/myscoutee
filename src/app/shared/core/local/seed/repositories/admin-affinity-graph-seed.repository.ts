import { Injectable, inject } from '@angular/core';
import type { AdminAffinityGraphDto } from '../../../contracts/admin.interface';
import { LocalAdminAffinityGraphRepository } from '../../source/repositories/admin-affinity-graph.repository';

@Injectable({ providedIn: 'root' })
export class SeedAdminAffinityGraphRepository {
  private readonly repository = inject(LocalAdminAffinityGraphRepository);
  buildGraphSnapshot(): Promise<AdminAffinityGraphDto> { return this.repository.buildGraphSnapshot(); }
  writeGraphSnapshot(snapshot: AdminAffinityGraphDto): Promise<void> { return this.repository.writeGraphSnapshot(snapshot); }
  async buildAndWriteGraphSnapshot(): Promise<AdminAffinityGraphDto> {
    const dating = await this.repository.buildAndWriteGraphSnapshot();
    await this.repository.buildAndWriteGraphSnapshot('myscoutee-work');
    await this.repository.buildAndWriteGraphSnapshot('myscoutee-community');
    return dating;
  }
}
