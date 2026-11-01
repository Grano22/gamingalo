import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { App } from './app';

describe('App', () => {
  it('offers a skip link and labelled navigation', async () => {
    await render(App, { providers: [provideRouter([])] });
    expect(screen.getByRole('link', { name: 'Skip to main content' }).getAttribute('href')).toBe('#main');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Status' })).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
  });
});
