import { existsSync, readFileSync } from 'node:fs';

export function loadDotEnv(path = '.env'): void {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }

    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

