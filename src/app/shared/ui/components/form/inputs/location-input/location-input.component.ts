import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

import { AppMenuComponent, type AppMenuItem } from '../../../menu';

export type LocationInputLiveValue<T> = T | (() => T);
export type LocationInputMapMode = 'auto' | 'search' | 'directions';

export interface LocationInputConfig {
  label?: LocationInputLiveValue<string | null | undefined>;
  placeholder?: LocationInputLiveValue<string | null | undefined>;
  required?: LocationInputLiveValue<boolean | null | undefined>;
  routeStops?: LocationInputLiveValue<readonly string[] | null | undefined>;
  mapMode?: LocationInputLiveValue<LocationInputMapMode | null | undefined>;
  mapLabel?: LocationInputLiveValue<string | null | undefined>;
  mapAriaLabel?: LocationInputLiveValue<string | null | undefined>;
}

@Component({
  selector: 'app-location-input',
  standalone: true,
  imports: [CommonModule, FormsModule, AppMenuComponent],
  templateUrl: './location-input.component.html',
  styleUrl: './location-input.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LocationInputComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LocationInputComponent implements ControlValueAccessor {
  @Input() config: LocationInputConfig = {};
  @Input() readOnly = false;
  @Input() disabled = false;

  protected value = '';

  private controlDisabled = false;
  private onValueChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: unknown): void {
    this.value = this.toText(value);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onValueChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.controlDisabled = isDisabled;
  }

  protected label(): string {
    return this.toText(this.resolveConfigValue(this.config.label)) || 'Location';
  }

  protected placeholder(): string {
    return this.toText(this.resolveConfigValue(this.config.placeholder));
  }

  protected required(): boolean {
    return this.resolveConfigValue(this.config.required) === true;
  }

  protected inputDisabled(): boolean {
    return this.disabled || this.controlDisabled;
  }

  protected updateValue(value: unknown): void {
    const nextValue = this.toText(value);
    this.value = nextValue;
    this.onValueChange(nextValue);
  }

  protected markTouched(): void {
    this.onTouched();
  }

  protected mapMenuItems(): readonly AppMenuItem<string>[] {
    const href = this.mapsUrl();
    return [{
      id: 'location-map',
      icon: this.mapIcon(),
      layout: 'action',
      palette: 'orange',
      ariaLabel: this.mapAriaLabel(),
      href: href || undefined,
      target: '_blank',
      rel: 'noopener,noreferrer',
      disabled: this.inputDisabled() || !href
    }];
  }

  private mapIcon(): string {
    return this.mapStops().length > 1 ? 'route' : 'location_on';
  }

  private mapAriaLabel(): string {
    return this.toText(this.resolveConfigValue(this.config.mapAriaLabel)) || 'Open location on map';
  }

  private mapsUrl(): string {
    const stops = this.mapStops();
    if (stops.length === 0) {
      return '';
    }
    const requestedMode = this.resolveMapMode();
    const mode = requestedMode === 'auto'
      ? (stops.length > 1 ? 'directions' : 'search')
      : requestedMode;
    if (mode === 'directions' && stops.length > 1) {
      const [origin, ...rest] = stops;
      const destination = rest[rest.length - 1] ?? origin;
      const waypoints = rest.slice(0, -1);
      let url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
      if (waypoints.length > 0) {
        url += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
      }
      return url;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stops[0])}`;
  }

  private mapStops(): string[] {
    const configuredStops = this.normalizeStops(this.resolveConfigValue(this.config.routeStops));
    const stops = configuredStops.length > 0 ? configuredStops : [this.value];
    return Array.from(new Set(this.normalizeStops(stops)));
  }

  private normalizeStops(value: readonly unknown[] | null | undefined): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(item => this.toText(item).trim())
      .filter(item => item.length > 0);
  }

  private resolveMapMode(): LocationInputMapMode {
    const mode = this.resolveConfigValue(this.config.mapMode);
    return mode === 'search' || mode === 'directions' ? mode : 'auto';
  }

  private resolveConfigValue<T>(value: LocationInputLiveValue<T> | undefined): T | undefined {
    return typeof value === 'function' ? (value as () => T)() : value;
  }

  private toText(value: unknown): string {
    return `${value ?? ''}`;
  }
}
