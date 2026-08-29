import { ConfigKeys, getAllLeafKeys } from './keys';

/**
 * Validates a loaded config JSON object against all required keys in ConfigKeys.
 *
 * @param config - The loaded configuration object (from config.json or config.dev.json).
 * @returns An array of missing or empty dot-delimited key paths.
 */
export function validateConfig(config: Record<string, any> | null): string[] {
  if (!config) {
    return getAllLeafKeys(ConfigKeys);
  }

  const allKeys = getAllLeafKeys(ConfigKeys);
  const missing: string[] = [];

  for (const path of allKeys) {
    const segments = path.split('.');
    let current: any = config;

    for (const segment of segments) {
      if (current === undefined || current === null || typeof current !== 'object') {
        current = undefined;
        break;
      }
      current = current[segment];
    }

    if (current === undefined || current === null || current === '') {
      missing.push(path);
    }
  }

  return missing;
}
