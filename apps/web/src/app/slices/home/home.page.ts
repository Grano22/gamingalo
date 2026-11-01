import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-3xl font-bold">Play and publish web games</h1>
    <p class="mt-2">The game catalog is on its way.</p>
  `,
})
export class HomePage {}
