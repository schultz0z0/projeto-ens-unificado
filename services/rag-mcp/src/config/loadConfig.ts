import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { appConfigSchema, type AppConfig } from './schema.js';

const defaultConfigPath = 'config/nexusai-rag-mcp.yaml';

export function loadConfig(configPath = process.env.NEXUSAI_RAG_MCP_CONFIG ?? defaultConfigPath): AppConfig {
  const resolvedPath = resolve(configPath);
  const file = readFileSync(resolvedPath, 'utf8');
  const parsed = YAML.parse(file) as unknown;

  return appConfigSchema.parse(parsed);
}

