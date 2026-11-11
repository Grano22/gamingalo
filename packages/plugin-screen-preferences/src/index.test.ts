import { createMockSdk, type MockGamingaloSdk } from '@gamingalo/sdk/testing';
import { describe, expect, it } from 'vitest';
import { screenPreferences, type ScreenPreferences } from './index';

async function start(options = {}): Promise<{ sdk: MockGamingaloSdk; screen: ScreenPreferences }> {
  const plugin = screenPreferences(options);
  const sdk = await createMockSdk({ plugins: [plugin] });
  return { sdk, screen: sdk.use(plugin) };
}

describe('package manifest', () => {
  it('declares itself a plugin for @gamingalo/vite-plugin, with the default export name', async () => {
    const { readFile } = await import('node:fs/promises');
    // Vitest runs from the package folder. This test environment has no file URLs.
    const pkg = JSON.parse(await readFile(`${process.cwd()}/package.json`, 'utf8'));
    const { pluginManifestSchema } = await import('@gamingalo/contracts');
    expect(pluginManifestSchema.parse(pkg.gamingalo).export).toBe('gamingaloPlugin');
    const module = await import('./index');
    expect(module.gamingaloPlugin).toBe(module.screenPreferences);
  });
});

describe('screenPreferences', () => {
  it('leaves the picture unchanged by default', async () => {
    const { sdk, screen } = await start();
    expect(screen.values()).toEqual({ brightness: 1, contrast: 1, saturation: 1, gamma: 1 });
    expect(sdk.mock.canvasFilter()).toBe('');
  });

  it('builds a filter from the values', async () => {
    const { sdk, screen } = await start();
    screen.setBrightness(1.2);
    screen.setContrast(0.8);
    screen.setSaturation(1.5);
    expect(sdk.mock.canvasFilter()).toBe('brightness(1.2) contrast(0.8) saturate(1.5)');
    expect(screen.values().brightness).toBe(1.2);
  });

  it('removes a setting that returns to 1, and resets everything', async () => {
    const { sdk, screen } = await start();
    screen.setBrightness(1.2);
    screen.setContrast(0.8);
    screen.setBrightness(1);
    expect(sdk.mock.canvasFilter()).toBe('contrast(0.8)');
    screen.reset();
    expect(sdk.mock.canvasFilter()).toBe('');
    expect(screen.values().contrast).toBe(1);
  });

  it('rejects values outside the limits, and keeps the previous value', async () => {
    const { screen } = await start();
    screen.setBrightness(1.2);
    expect(() => screen.setBrightness(5)).toThrow(/doesn't fit/);
    expect(screen.values().brightness).toBe(1.2);
    expect(() => screen.setGamma(0)).toThrow(/doesn't fit/);
  });

  it('lets a game narrow the limits', async () => {
    const { screen } = await start({ limits: { brightness: { min: 0.9, max: 1.1 } } });
    expect(screen.limits().brightness).toEqual({ min: 0.9, max: 1.1 });
    expect(() => screen.setBrightness(1.2)).toThrow(/doesn't fit/);
  });

  it.each([
    ['wider than allowed', { brightness: { min: 0, max: 1 } }],
    ['excluding 1', { brightness: { min: 1.1, max: 1.2 } }],
    ['not numbers', { brightness: {} }],
  ])('rejects limits that are %s', (_name, limits) => {
    expect(() => screenPreferences({ limits: limits as never })).toThrow(/must include 1/);
  });

  it('stores values in its own preferences, separate from the game', async () => {
    const { sdk, screen } = await start();
    screen.setBrightness(1.2);
    expect(sdk.preferences.get('brightness')).toBeUndefined();
  });

  it('has a frozen plugin object and API', async () => {
    const plugin = screenPreferences();
    expect(Object.isFrozen(plugin)).toBe(true);
    const sdk = await createMockSdk({ plugins: [plugin] });
    expect(Object.isFrozen(sdk.use(plugin))).toBe(true);
  });
});
