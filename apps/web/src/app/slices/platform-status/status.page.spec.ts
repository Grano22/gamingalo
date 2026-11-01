import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen, waitFor } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { StatusPage } from './status.page';

async function setup(): Promise<HttpTestingController> {
  await render(StatusPage, { providers: [provideHttpClient(), provideHttpClientTesting()] });
  return TestBed.inject(HttpTestingController);
}

async function flushRequest(http: HttpTestingController, url: string, body: object): Promise<void> {
  await waitFor(() => http.expectOne(url).flush(body));
}

describe('StatusPage', () => {
  it('shows the service version when the services are available', async () => {
    const http = await setup();
    expect(screen.getByRole('status').textContent).toContain('Checking');

    await flushRequest(http, '/api/ready', { status: 'ready' });
    await flushRequest(http, '/api/v1/meta', { service: 'gamingalo-api', version: '1.2.3', apiVersion: 'v1' });

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Available'));
    expect(screen.getByRole('status').textContent).toContain('gamingalo-api 1.2.3');
  });

  it('shows unavailable when the services fail', async () => {
    const http = await setup();
    await waitFor(() =>
      http.expectOne('/api/ready').flush({ error: {} }, { status: 503, statusText: 'Service Unavailable' }),
    );
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Unavailable'));
  });

  it('shows unavailable when a response has the wrong shape', async () => {
    const http = await setup();
    await flushRequest(http, '/api/ready', { status: 'ready' });
    await flushRequest(http, '/api/v1/meta', { service: 'gamingalo-api', extra: 'unexpected' });
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Unavailable'));
  });
});
