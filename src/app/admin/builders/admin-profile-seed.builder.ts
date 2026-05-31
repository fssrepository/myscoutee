import type { UserDto } from '../../shared/core';
import type { AdminSeedUserDto } from './admin-seed.models';

export class AdminProfileSeedBuilder {
  static buildDemoAdminUser(admin: AdminSeedUserDto): UserDto {
    return {
      id: admin.id,
      name: admin.name,
      age: 0,
      birthday: '',
      city: 'Admin',
      height: '',
      physique: '',
      languages: ['English'],
      horoscope: '',
      initials: admin.initials,
      gender: admin.id.includes('noel') ? 'man' : 'woman',
      statusText: 'Admin workspace',
      hostTier: 'Admin',
      traitLabel: 'Safety',
      completion: 100,
      headline: `${admin.headline ?? ''}`.trim() || 'Moderation workspace',
      about: `${admin.about ?? ''}`.trim() || 'Reviews reports, feedback, and support chats.',
      images: [...(admin.images?.length ? admin.images : this.demoAdminImages(admin.id))],
      profileStatus: 'public',
      activities: {
        game: 0,
        chat: 0,
        invitations: 0,
        events: 0,
        hosting: 0,
        cars: 0,
        accommodation: 0,
        supplies: 0,
        tickets: 0,
        contacts: 0,
        feedback: 0,
        adminJobs: 0,
        adminMetrics: 0
      }
    };
  }

  static demoAdminImages(adminUserId: string): string[] {
    return adminUserId.includes('noel')
      ? ['https://randomuser.me/api/portraits/men/75.jpg']
      : ['https://randomuser.me/api/portraits/women/65.jpg'];
  }

  static isLegacyDemoAdminImage(imageUrl: string | null | undefined): boolean {
    const normalized = `${imageUrl ?? ''}`.trim();
    return normalized.includes('picsum.photos/seed/admin-ava-moderation')
      || normalized.includes('picsum.photos/seed/admin-noel-safety');
  }
}
