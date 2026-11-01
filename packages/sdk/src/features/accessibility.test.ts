import { afterEach, describe, expect, it, vi } from 'vitest';
import { startSdk, stopSdks } from '../test-helpers';
import { createMockSdk } from '../testing';
import { createBrowserAccessibility, parseMirrorItems } from './accessibility';
import { createCanvasFilterLayers } from './canvas-filters';

afterEach(async () => {
  vi.unstubAllGlobals();
  await stopSdks();
  document.body.innerHTML = '';
});

function hostOf(): HTMLElement {
  return document.querySelector('[data-gamingalo-accessibility]') as HTMLElement;
}

describe('mirror', () => {
  it('creates elements with the right tags and text', async () => {
    const sdk = await startSdk();
    sdk.accessibility.mirror([
      { id: 'title', role: 'heading', label: 'Menu' },
      { id: 'start', role: 'button', label: 'Start', description: 'Begins the game' },
      { id: 'hint', role: 'text', label: 'Press start' },
    ]);

    const host = hostOf();
    expect(host.querySelector('h2')?.textContent).toBe('Menu');
    expect(host.querySelector('button')?.textContent).toBe('Start');
    expect(host.querySelector('button')?.getAttribute('aria-description')).toBe('Begins the game');
    expect(host.querySelector('p')?.textContent).toBe('Press start');
  });

  it('calls onActivate and onFocus, and survives a callback that throws', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onActivate = vi.fn(() => {
      throw new Error('game bug');
    });
    const onFocus = vi.fn();
    const sdk = await startSdk();
    sdk.accessibility.mirror([{ id: 'start', role: 'button', label: 'Start', onActivate, onFocus }]);
    const button = hostOf().querySelector('button') as HTMLButtonElement;

    button.click();
    expect(sdk.accessibility.focus('start')).toBe(true);

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(sdk.accessibility.focus('missing')).toBe(false);
  });

  it('keeps the same element across updates, and uses the latest callback', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const sdk = await startSdk();
    sdk.accessibility.mirror([{ id: 'a', role: 'button', label: 'One', onActivate: first }]);
    const element = hostOf().querySelector('button');

    sdk.accessibility.mirror([{ id: 'a', role: 'button', label: 'Two', onActivate: second }]);
    const updated = hostOf().querySelector('button') as HTMLButtonElement;
    updated.click();

    expect(updated === element).toBe(true);
    expect(updated.textContent).toBe('Two');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('removes items that are gone and replaces items whose role changes', async () => {
    const sdk = await startSdk();
    sdk.accessibility.mirror([
      { id: 'a', role: 'button', label: 'A' },
      { id: 'b', role: 'button', label: 'B' },
    ]);
    sdk.accessibility.mirror([{ id: 'a', role: 'heading', label: 'A' }]);

    expect(hostOf().querySelectorAll('button').length).toBe(0);
    expect(hostOf().querySelector('h2')?.textContent).toBe('A');
  });

  it('treats HTML in labels as text', async () => {
    const sdk = await startSdk();
    sdk.accessibility.mirror([{ id: 'a', role: 'text', label: '<img src=x onerror=alert(1)>' }]);
    expect(hostOf().querySelector('img')).toBeNull();
    expect(hostOf().querySelector('p')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it.each([
    ['not a list', 'nope'],
    ['a non-object item', [1]],
    ['a missing id', [{ role: 'text', label: 'x' }]],
    ['a duplicate id', [{ id: 'a', role: 'text', label: 'x' }, { id: 'a', role: 'text', label: 'y' }]],
    ['a missing label', [{ id: 'a', role: 'text' }]],
    ['an unknown role', [{ id: 'a', role: 'nope', label: 'x' }]],
    ['a bad callback', [{ id: 'a', role: 'button', label: 'x', onActivate: 'nope' }]],
  ])('rejects %s and leaves the mirror unchanged', async (_name, items) => {
    const sdk = await startSdk();
    sdk.accessibility.mirror([{ id: 'keep', role: 'text', label: 'Keep' }]);

    expect(() => sdk.accessibility.mirror(items as never)).toThrow();

    expect(hostOf().querySelector('p')?.textContent).toBe('Keep');
  });

  it('ignores options from a polluted prototype', () => {
    const prototype = Object.prototype as unknown as Record<string, unknown>;
    prototype['role'] = 'button';
    try {
      expect(() => parseMirrorItems([{ id: 'a', label: 'x' }])).toThrow(/unknown role/);
    } finally {
      delete prototype['role'];
    }
  });
});

describe('announce', () => {
  it('uses the right live region and repeats identical text', async () => {
    const sdk = await startSdk();
    sdk.accessibility.announce('Saved');
    const polite = hostOf().querySelector('[aria-live=polite]') as HTMLElement;
    const first = polite.textContent;
    sdk.accessibility.announce('Saved');

    expect(first?.trim()).toBe('Saved');
    expect(polite.textContent?.trim()).toBe('Saved');
    expect(polite.textContent === first).toBe(false);

    sdk.accessibility.announce('Low health', { assertive: true });
    expect(hostOf().querySelector('[aria-live=assertive]')?.textContent?.trim()).toBe('Low health');
  });
});

describe('canvas filter', () => {
  it('applies filters and restores the original on shutdown', async () => {
    const canvas = document.createElement('canvas');
    canvas.style.filter = 'blur(1px)';
    document.body.append(canvas);
    const sdk = await startSdk({ gameId: 'my-game', realm: { canvas } });

    sdk.accessibility.setCanvasFilter('grayscale');
    expect(canvas.style.filter).toBe('blur(1px) grayscale(1)');
    expect(sdk.accessibility.getCanvasFilter()).toBe('grayscale');

    sdk.accessibility.setCanvasFilter('none');
    expect(canvas.style.filter).toBe('blur(1px)');

    sdk.accessibility.setCanvasFilter('high-contrast');
    sdk.accessibility.announce('x');
    await sdk.shutdown();

    expect(canvas.style.filter).toBe('blur(1px)');
    expect(hostOf()).toBeNull();
  });

  it('needs a bound canvas and a known filter', async () => {
    const sdk = await startSdk();
    expect(() => sdk.accessibility.setCanvasFilter('grayscale')).toThrow(/realm.canvas/);
    expect(() => sdk.accessibility.setCanvasFilter('nope' as never)).toThrow(/high-contrast/);
  });
});

describe('speech and preferences', () => {
  it('returns false without speech support', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    expect(createBrowserAccessibility(undefined, createCanvasFilterLayers(undefined)).api.speak('hi')).toBe(false);
  });

  it('replaces current speech', () => {
    const cancel = vi.fn();
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { cancel, speak });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        constructor(readonly text: string) {}
      },
    );
    expect(createBrowserAccessibility(undefined, createCanvasFilterLayers(undefined)).api.speak('hi')).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('gives default preferences without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(createBrowserAccessibility(undefined, createCanvasFilterLayers(undefined)).api.preferences()).toEqual({
      reducedMotion: false,
      contrast: 'no-preference',
      forcedColors: false,
      reducedTransparency: false,
    });
  });
});

describe('mock helpers', () => {
  it('records announcements and mirror items, and activates them', async () => {
    const onActivate = vi.fn();
    const sdk = await createMockSdk();
    sdk.accessibility.mirror([{ id: 'start', role: 'button', label: 'Start', onActivate }]);
    sdk.accessibility.announce('Hello');

    expect(sdk.mock.accessibility.announcements()).toEqual(['Hello']);
    expect(sdk.mock.accessibility.mirrorItems()).toEqual([{ id: 'start', role: 'button', label: 'Start' }]);
    expect(sdk.mock.accessibility.activate('start')).toBe(true);
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-gamingalo-accessibility]')).toBeNull();
  });

  it('sets preferences and emits the event', async () => {
    const sdk = await createMockSdk();
    const handler = vi.fn();
    sdk.on('accessibility', handler);

    sdk.mock.accessibility.setPreferences({ reducedMotion: true });

    expect(sdk.accessibility.preferences().reducedMotion).toBe(true);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reducedMotion: true }));
  });
});
