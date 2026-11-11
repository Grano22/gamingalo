import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { SessionStore } from '../../shared/session/session.store';
import { SignInPage } from './sign-in.page';

const account = {
  id: '6f1b6a4e-2a3b-4c5d-8e9f-0a1b2c3d4e5f',
  kind: 'guest',
  displayName: 'Player-1a2b',
  ageBand: '13to15',
  minor: true,
  passkeys: 0,
  createdAt: '2026-11-11T10:00:00.000Z',
};

async function setup(): Promise<HttpTestingController> {
  await render(SignInPage, {
    providers: [provideRouter([{ path: 'account', children: [] }]), provideHttpClient(), provideHttpClientTesting()],
  });
  return TestBed.inject(HttpTestingController);
}

describe('SignInPage', () => {
  it('needs an age answer before creating a guest account', async () => {
    const http = await setup();
    const button = screen.getByRole('button', { name: 'Play as a guest' });
    expect(button.hasAttribute('disabled') || button.querySelector('button')?.disabled).toBeTruthy();

    screen.getByLabelText('13 to 15').click();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play as a guest' }).hasAttribute('disabled')).toBe(false));
    screen.getByRole('button', { name: 'Play as a guest' }).click();

    const request = await waitFor(() => http.expectOne('/api/v1/accounts/guest'));
    expect(request.request.body).toEqual({ ageBand: '13to15' });
    request.flush(account);

    await waitFor(() => expect(TestBed.inject(SessionStore).account()?.displayName).toBe('Player-1a2b'));
  });

  it('shows a readable error when the service refuses', async () => {
    const http = await setup();
    screen.getByLabelText('16 or older').click();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play as a guest' }).hasAttribute('disabled')).toBe(false));
    screen.getByRole('button', { name: 'Play as a guest' }).click();

    const request = await waitFor(() => http.expectOne('/api/v1/accounts/guest'));
    request.flush(
      { error: { code: 'RATE_LIMITED', message: 'x', requestId: 'r' } },
      { status: 429, statusText: 'Too Many Requests' },
    );

    expect((await screen.findByRole('alert')).textContent).toContain('Too many attempts');
  });
});
