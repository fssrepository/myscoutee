import { Pipe, PipeTransform, inject } from '@angular/core';

import { I18nService } from '../../core';

@Pipe({
  name: 'i18n',
  standalone: true,
  pure: false
})
export class I18nPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: string | null | undefined, fallback?: string | null): string {
    this.i18n.revision();
    return this.i18n.translate(value, fallback);
  }
}
