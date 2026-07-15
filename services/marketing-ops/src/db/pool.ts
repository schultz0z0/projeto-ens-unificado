import dns from 'node:dns';
import pg from 'pg';

// Node.js 18+ may prefer IPv6 which is unreachable inside Docker
// containers on VPS hosts without IPv6 networking.
dns.setDefaultResultOrder('ipv4first');

export function createPool(databaseUrl: string): pg.Pool {
  const isRemote = !databaseUrl.includes('127.0.0.1') && !databaseUrl.includes('localhost');
  return new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    application_name: 'nexus-marketing-ops',
    ssl: isRemote ? { rejectUnauthorized: false } : undefined
  });
}
