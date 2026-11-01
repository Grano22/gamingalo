import { GamingaloError } from '@gamingalo/errors';
import { snapshotOwn } from '../config';
import { freeze, hasOwn, isArray, SafeMap, SafeSet } from '../primordials';
import type { CanvasFilterLayers } from './canvas-filters';

export type ContrastPreference = 'more' | 'less' | 'no-preference';
export type CanvasFilter = 'none' | 'high-contrast' | 'grayscale';
export type MirrorRole = 'button' | 'heading' | 'text';

export interface AccessibilityPreferences {
  readonly reducedMotion: boolean;
  readonly contrast: ContrastPreference;
  readonly forcedColors: boolean;
  readonly reducedTransparency: boolean;
}

export interface MirrorItem {
  /** Stays the same across updates, so that focus is kept. */
  id: string;
  /** Always shown as text, never parsed as HTML. */
  label: string;
  role: MirrorRole;
  description?: string;
  disabled?: boolean;
  /** Called when the player activates a button. */
  onActivate?: () => void;
  /** Called on focus, so the game can show its own highlight. */
  onFocus?: () => void;
}

export interface AnnounceOptions {
  /** Interrupts the screen reader. Use only for urgent messages. */
  assertive?: boolean;
}

export interface Accessibility {
  preferences(): AccessibilityPreferences;
  /** Replaces the UI exposed to assistive technology. Throws `INVALID_ARGUMENT` for an invalid list. */
  mirror(items: readonly MirrorItem[]): void;
  /** Returns `false` if there's no such item. */
  focus(id: string): boolean;
  announce(text: string, options?: AnnounceOptions): void;
  /** Throws `INVALID_ARGUMENT` if no canvas is bound with `realm.canvas`. */
  setCanvasFilter(filter: CanvasFilter): void;
  getCanvasFilter(): CanvasFilter;
  /** Speaks through the browser, replacing any current speech. Returns `false` if unsupported. */
  speak(text: string): boolean;
  stopSpeaking(): void;
}

const CANVAS_FILTERS = freeze({
  __proto__: null,
  none: '',
  'high-contrast': 'contrast(1.5) saturate(1.2)',
  grayscale: 'grayscale(1)',
}) as unknown as Readonly<Record<CanvasFilter, string>>;

const ROLES = freeze({ __proto__: null, button: true, heading: true, text: true });

const VISUALLY_HIDDEN =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;';

function invalid(message: string): GamingaloError {
  return new GamingaloError('INVALID_ARGUMENT', message);
}

/** Validates a whole list before anything changes, reading own properties only. */
export function parseMirrorItems(items: unknown): MirrorItem[] {
  if (!isArray(items)) throw invalid('mirror() needs a list of items.');
  const ids = new SafeSet<string>();
  const parsed: MirrorItem[] = [];

  for (let index = 0; index < items.length; index++) {
    const item = snapshotOwn(items[index]);
    if (!item) throw invalid('Each mirror item must be an object.');
    const { id, label, role, description, onActivate, onFocus } = item;
    if (typeof id !== 'string' || id === '') throw invalid('A mirror item needs a non-empty id.');
    if (ids.has(id)) throw invalid(`The mirror item id "${id}" is used twice.`);
    if (typeof label !== 'string') throw invalid(`The mirror item "${id}" needs a label.`);
    if (typeof role !== 'string' || !hasOwn(ROLES, role)) throw invalid(`The mirror item "${id}" has an unknown role.`);
    if (description !== undefined && typeof description !== 'string') throw invalid(`Bad description on "${id}".`);
    if (onActivate !== undefined && typeof onActivate !== 'function') throw invalid(`Bad onActivate on "${id}".`);
    if (onFocus !== undefined && typeof onFocus !== 'function') throw invalid(`Bad onFocus on "${id}".`);
    ids.add(id);
    parsed[index] = item as unknown as MirrorItem;
  }
  return parsed;
}

export function assertCanvasFilter(filter: unknown): asserts filter is CanvasFilter {
  if (typeof filter !== 'string' || !hasOwn(CANVAS_FILTERS, filter)) {
    throw invalid('The canvas filter must be none, high-contrast or grayscale.');
  }
}

function runCallback(callback: (() => void) | undefined): void {
  try {
    callback?.();
  } catch (error) {
    console.error('[gamingalo] accessibility callback failed', error);
  }
}

function matchesMedia(query: string): boolean {
  return typeof matchMedia === 'function' && matchMedia(query).matches;
}

export function readAccessibilityPreferences(): AccessibilityPreferences {
  const contrast: ContrastPreference = matchesMedia('(prefers-contrast: more)')
    ? 'more'
    : matchesMedia('(prefers-contrast: less)')
      ? 'less'
      : 'no-preference';
  return freeze({
    reducedMotion: matchesMedia('(prefers-reduced-motion: reduce)'),
    contrast,
    forcedColors: matchesMedia('(forced-colors: active)'),
    reducedTransparency: matchesMedia('(prefers-reduced-transparency: reduce)'),
  });
}

/** Calls back when a preference changes. Returns a function that stops watching. */
export function watchAccessibilityPreferences(onChange: (preferences: AccessibilityPreferences) => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const queries = [
    '(prefers-reduced-motion: reduce)',
    '(prefers-contrast: more)',
    '(prefers-contrast: less)',
    '(forced-colors: active)',
    '(prefers-reduced-transparency: reduce)',
  ].map((query) => matchMedia(query));
  const listener = () => onChange(readAccessibilityPreferences());
  queries.forEach((query) => query.addEventListener('change', listener));
  return () => queries.forEach((query) => query.removeEventListener('change', listener));
}

export interface BrowserAccessibility {
  api: Accessibility;
  /** Removes everything the SDK added to the page. */
  dispose(): void;
}

export function createBrowserAccessibility(
  canvas: HTMLCanvasElement | undefined,
  filters: CanvasFilterLayers,
): BrowserAccessibility {
  let currentFilter: CanvasFilter = 'none';
  let host: HTMLElement | undefined;
  let polite: HTMLElement | undefined;
  let assertive: HTMLElement | undefined;
  let mirrorRoot: HTMLElement | undefined;
  let repeatMark = false;
  const items = new SafeMap<string, MirrorItem>();
  const elements = new SafeMap<string, HTMLElement>();

  const ensureHost = (): boolean => {
    if (host) return true;
    if (typeof document === 'undefined') return false;

    host = document.createElement('div');
    host.setAttribute('data-gamingalo-accessibility', '');
    host.style.cssText = VISUALLY_HIDDEN;

    const liveRegion = (politeness: 'polite' | 'assertive') => {
      const region = document.createElement('div');
      region.setAttribute('aria-live', politeness);
      region.setAttribute('aria-atomic', 'true');
      return region;
    };
    polite = liveRegion('polite');
    assertive = liveRegion('assertive');
    mirrorRoot = document.createElement('div');
    host.append(mirrorRoot, polite, assertive);

    // Next to the canvas, so that the tab order follows the page.
    if (canvas?.isConnected) canvas.after(host);
    else document.body.append(host);
    return true;
  };

  const createElement = (id: string, role: MirrorRole): HTMLElement => {
    const tag = role === 'button' ? 'button' : role === 'heading' ? 'h2' : 'p';
    const element = document.createElement(tag);
    element.setAttribute('data-role', role);
    if (role === 'button') (element as HTMLButtonElement).type = 'button';
    else element.tabIndex = -1;
    element.addEventListener('click', () => runCallback(items.get(id)?.onActivate));
    element.addEventListener('focus', () => runCallback(items.get(id)?.onFocus));
    return element;
  };

  const api: Accessibility = {
    preferences: readAccessibilityPreferences,

    mirror(list) {
      const parsed = parseMirrorItems(list);
      if (!ensureHost() || !mirrorRoot) return;
      const root = mirrorRoot;

      const next = new SafeSet<string>();
      for (const item of parsed) next.add(item.id);
      elements.forEach((element, id) => {
        const replacement = parsed.find((item) => item.id === id);
        if (!next.has(id) || element.getAttribute('data-role') !== replacement?.role) {
          element.remove();
          elements.delete(id);
          items.delete(id);
        }
      });

      const focused = document.activeElement;
      let cursor = root.firstElementChild;

      for (const item of parsed) {
        const element = elements.get(item.id) ?? createElement(item.id, item.role);
        elements.set(item.id, element);
        items.set(item.id, item);
        element.textContent = item.label;
        if (item.description) element.setAttribute('aria-description', item.description);
        else element.removeAttribute('aria-description');
        if (item.role === 'button') (element as HTMLButtonElement).disabled = item.disabled === true;
        // Moving an element drops its focus, so elements already in position stay untouched.
        if (element === cursor) cursor = cursor.nextElementSibling;
        else root.insertBefore(element, cursor);
      }

      // A real reorder can still move the focused element, so put focus back.
      if (focused instanceof HTMLElement && root.contains(focused) && document.activeElement !== focused) {
        focused.focus();
      }
    },

    focus(id) {
      const element = elements.get(id);
      if (!element) return false;
      element.focus();
      return true;
    },

    announce(text, options) {
      if (typeof text !== 'string') throw invalid('announce() needs text.');
      if (!ensureHost()) return;
      const urgent = options !== undefined && options !== null && hasOwn(options, 'assertive') && options.assertive === true;
      const region = urgent ? assertive : polite;
      // A changed character makes screen readers repeat identical text.
      repeatMark = !repeatMark;
      if (region) region.textContent = repeatMark ? text : `${text} `;
    },

    setCanvasFilter(filter) {
      assertCanvasFilter(filter);
      if (!filters.hasCanvas) throw invalid('A canvas filter needs a canvas bound with realm.canvas.');
      currentFilter = filter;
      filters.set('accessibility', CANVAS_FILTERS[filter]);
    },

    getCanvasFilter: () => currentFilter,

    speak(text) {
      if (typeof text !== 'string') throw invalid('speak() needs text.');
      if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return false;
      try {
        speechSynthesis.cancel();
        speechSynthesis.speak(new SpeechSynthesisUtterance(text));
        return true;
      } catch {
        return false;
      }
    },

    stopSpeaking() {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    },
  };

  return {
    api,
    dispose() {
      host?.remove();
      host = undefined;
      items.clear();
      elements.clear();
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    },
  };
}
