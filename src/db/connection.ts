import type { D1Database } from '@cloudflare/workers-types';

export function getDB(env: Env): D1Database {
  const db = env?.DB;
  if (!db) {
    throw new Error('D1 database binding "DB" not found in environment. Please verify your Cloudflare Worker D1 binding configuration.');
  }
  return db;
}

