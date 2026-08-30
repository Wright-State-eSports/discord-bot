type PrefixTree<P extends string, T> = T extends string
  ? `${P}.${T}`
  : T extends Record<string, any>
    ? { readonly [K in keyof T]: PrefixTree<P, T[K]> }
    : never;

function prefixAll(prefix: string, val: any): any {
  if (typeof val === 'string') return `${prefix}.${val}`;
  if (typeof val !== 'object' || val === null) return val;
  const res: any = {};
  for (const [k, v] of Object.entries(val)) {
    res[k] = prefixAll(prefix, v);
  }
  return res;
}

/**
 * Creates a hierarchical config key node.
 *
 * - **Leaf Node**: Call with a single argument `key('id')` to produce the local segment.
 * - **Branch Node**: Call with a segment and child nodes `key('roles', { Raider: key('raider') })`.
 *   This will recursively prefix all descendant leaf keys with `'roles.'` (e.g. `'roles.raider'`).
 *
 * @param segment - The current key path segment in `config.json` (e.g. 'webhooks', 'new-register', 'id').
 * @param children - Optional child nodes to be prefixed by this segment.
 */
export function key<K extends string>(segment: K): K;
export function key<K extends string, C extends Record<string, any>>(
  segment: K,
  children: C,
): { readonly [P in keyof C]: PrefixTree<K, C[P]> };
export function key(segment: string, children?: Record<string, any>) {
  if (children === undefined) return segment;
  return prefixAll(segment, children);
}

/**
 * Single source of truth for all dot-delimited configuration key paths in `config.json` / `config.dev.json`.
 *
 * ### How it Works:
 * Each property maps to a nested key path in the underlying JSON configuration file.
 * The `key()` helper builds the full dot-notated path string with full TypeScript type safety and autocompletion.
 *
 * ### ⚠️ Validation Rule:
 * Every key declared in `ConfigKeys` is **required**. If any `ConfigKey` is not set or missing
 * in the active configuration file (`config.json` / `config.dev.json`), the configuration produces a warning on startup.
 *
 * ### Usage Example:
 * ```typescript
 * import { Config, ConfigKeys } from './utils';
 *
 * // Getting a value:
 * const raiderRoleId = await Config.get(ConfigKeys.Roles.Raider);
 *
 * // Setting a value:
 * await Config.set(ConfigKeys.Channels.Help, '1395803876116009052');
 * ```
 */
export const ConfigKeys = {
  // Webhooks
  Webhooks: key('webhooks', {
    Logs: key('logs', {
      Name: key('name'),
    }),
    NewRegister: key('new-register', {
      Id: key('id'),
      ChannelId: key('channel-id'),
      SweepLimit: key('startup-sweep-message-limit'),
    }),
    MessageLog: key('message-log', {
      Name: key('name'),
    }),
  }),

  // Roles
  Roles: key('roles', {
    Raider: key('raider'),
    Guest: key('guest'),
    NotSignedUp: key('not-signed-up'),
  }),

  // Channels
  Channels: key('channels', {
    Help: key('help'),
    Logs: key('logs'),
    MessageLog: key('message-log'),
  }),
} as const;

type NestedLeafValues<T> = T extends string
  ? T
  : T extends object
    ? { [K in keyof T]: NestedLeafValues<T[K]> }[keyof T]
    : never;

/**
 * Represents any valid dot-delimited configuration path string derived from `ConfigKeys`
 * (e.g. `'roles.raider' | 'webhooks.new-register.channel-id' | ...`).
 */
export type ConfigKey = NestedLeafValues<typeof ConfigKeys>;

/**
 * Recursively extracts all dot-notated leaf key strings from a nested object tree.
 */
export function getAllLeafKeys(obj: Record<string, any>): string[] {
  const result: string[] = [];
  for (const value of Object.values(obj)) {
    if (typeof value === 'string') {
      result.push(value);
    } else if (typeof value === 'object' && value !== null) {
      result.push(...getAllLeafKeys(value));
    }
  }
  return result;
}
