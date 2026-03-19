import { Component, OnDestroy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { NavigatorBindings, NavigatorComponent, NavigatorService } from './navigator';
import { AppCalendarDateAdapter, AppCalendarDateFormats } from './shared/app-calendar-date-adapter';

@Component({
  selector: 'app-core',
  imports: [
    RouterOutlet,
    NavigatorComponent
  ],
  providers: [
    { provide: DateAdapter, useClass: AppCalendarDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: AppCalendarDateFormats.dateTime }
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnDestroy {
  protected readonly navigatorService = inject(NavigatorService);
  private readonly navigatorBindings: NavigatorBindings = {};

  constructor() {
    this.navigatorService.registerBindings(this.navigatorBindings);
  }

  ngOnDestroy(): void {
    this.navigatorService.clearBindings(this.navigatorBindings);
  }
}
