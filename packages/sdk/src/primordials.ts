/**
 * Built-ins captured when the module loads, so that later scripts can't intercept them.
 * Import this before using any of them, and don't call the global versions in the facade,
 * session memory or settings. This only protects against code that runs after the SDK loads.
 */
export const {
  create: createObject,
  defineProperty,
  freeze,
  getOwnPropertyDescriptor,
  hasOwn,
  keys: objectKeys,
  setPrototypeOf,
} = Object;
export const { apply: reflectApply, ownKeys } = Reflect;
export const { parse: parseJson, stringify: stringifyJson } = JSON;
export const { isArray, from: arrayFrom } = Array;
export const clone = structuredClone;

const regExpExec = RegExp.prototype.exec;

export function matches(pattern: RegExp, text: string): boolean {
  return reflectApply(regExpExec, pattern, [text]) !== null;
}

/** Returns a descriptor with no prototype, so a polluted `get` or `value` can't change its meaning. */
export function ownDescriptor(target: object, key: PropertyKey): PropertyDescriptor {
  return setPrototypeOf(getOwnPropertyDescriptor(target, key) as PropertyDescriptor, null);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TypeScript requires this exact signature for class mixins.
type AnyConstructor = new (...args: any[]) => object;

/**
 * Returns a subclass with its own copy of every method and no link to the built-in prototype,
 * so patching `Map.prototype.set` later can't see or affect its contents.
 */
function makeSafe<T extends AnyConstructor>(Base: T): T {
  const Safe = class extends Base {};
  const source = Base.prototype as object;
  for (const key of ownKeys(source)) {
    if (key !== 'constructor') defineProperty(Safe.prototype, key, ownDescriptor(source, key));
  }
  setPrototypeOf(Safe.prototype, null);
  freeze(Safe.prototype);
  return freeze(Safe);
}

export const SafeMap = /* @__PURE__ */ makeSafe(Map) as MapConstructor;
export const SafeSet = /* @__PURE__ */ makeSafe(Set) as SetConstructor;

/**
 * Returns a frozen copy of an API with no prototype. Every member calls `assertActive` first.
 * Values become getters, so they also stop working when the SDK shuts down. A member named in
 * `alwaysAllowed` skips the check.
 */
export function guardApi<T extends object>(api: T, assertActive: () => void, alwaysAllowed?: PropertyKey): T {
  const guarded = createObject(null) as T;
  for (const key of ownKeys(api)) {
    const descriptor = ownDescriptor(api, key);
    const check = key === alwaysAllowed ? () => {} : assertActive;

    if (typeof descriptor.value === 'function') {
      const method = descriptor.value as (...args: unknown[]) => unknown;
      const wrapped = freeze((...args: unknown[]) => {
        check();
        return reflectApply(method, api, args);
      });
      defineProperty(guarded, key, { __proto__: null, enumerable: true, value: wrapped } as PropertyDescriptor);
      continue;
    }

    const getter = descriptor.get;
    const read = getter ? () => reflectApply(getter, api, []) : () => descriptor.value as unknown;
    const guardedGetter = freeze(() => {
      check();
      return read();
    });
    defineProperty(guarded, key, { __proto__: null, enumerable: true, get: guardedGetter } as PropertyDescriptor);
  }
  return freeze(guarded);
}
