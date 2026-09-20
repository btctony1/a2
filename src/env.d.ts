import type { D1Database } from '@cloudflare/workers-types';

declare global {
  interface Env {
    DB: D1Database;
    OKX_API_KEY: string;
    OKX_SECRET_KEY: string;
    OKX_PASSPHRASE: string;
    OKX_PROXY_URL?: string;
  }
}

export {};
