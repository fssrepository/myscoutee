import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigatorModule } from './navigator';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NavigatorModule, RouterOutlet],
  styleUrl: './app-shell.component.scss',
  template: `
    <app-navigator></app-navigator>
    <router-outlet></router-outlet>
  `
})
export class AppShellComponent {}
