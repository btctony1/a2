import { getDB } from './connection';
import type { Config, CoinPair, Position, TradeLog, SystemLog } from '../types';
import { DEFAULT_CONFIG } from '../constants';

let schemaEnsured = false;

export async function ensureDbSchema(env: Env): Promise<void> {
  if (schemaEnsured) return;
  try {
    const db = getDB(env);
    
    // 1. Ensure core tables exist
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `).run().catch(() => {});

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS coin_pairs (
        symbol TEXT PRIMARY KEY,
        period TEXT NOT NULL DEFAULT '1h',
        direction TEXT,
        direction_updated_at INTEGER DEFAULT 0,
        enabled INTEGER DEFAULT 0,
        funding_amount REAL DEFAULT 0,
        funding_slices INTEGER DEFAULT 10,
        last_open_time INTEGER DEFAULT 0,
        next_jitter_ms INTEGER DEFAULT 0,
        pause_open INTEGER DEFAULT 0,
        leverage INTEGER DEFAULT 10,
        tp_ratio REAL DEFAULT 5,
        sl_ratio REAL DEFAULT 5,
        open_interval_value INTEGER DEFAULT 1,
        open_interval_unit TEXT DEFAULT 'hour',
        margin_mode TEXT DEFAULT 'isolated',
        profit_transfer_ratio REAL DEFAULT 0,
        smart_volatility_enabled INTEGER DEFAULT 0,
        min_volatility_threshold REAL DEFAULT 1.0,
        current_volatility REAL DEFAULT 0,
        volatility_status TEXT DEFAULT 'active',
        add_pos_ratio REAL DEFAULT 0
      )
    `).run().catch(() => {});

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        direction TEXT NOT NULL,
        leverage INTEGER NOT NULL,
        entry_price REAL NOT NULL,
        quantity REAL NOT NULL,
        margin REAL NOT NULL,
        okx_order_id TEXT,
        open_time INTEGER NOT NULL,
        tp_price REAL NOT NULL,
        sl_price REAL NOT NULL,
        unrealized_pnl REAL DEFAULT 0,
        last_price REAL DEFAULT 0,
        tp_algo_id TEXT DEFAULT '',
        sl_algo_id TEXT DEFAULT '',
        status TEXT DEFAULT 'open',
        close_reason TEXT,
        close_price REAL,
        close_pnl REAL,
        close_time INTEGER
      )
    `).run().catch(() => {});

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS trade_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        position_id INTEGER,
        symbol TEXT NOT NULL,
        direction TEXT NOT NULL,
        entry_price REAL NOT NULL,
        exit_price REAL NOT NULL,
        quantity REAL NOT NULL,
        margin REAL NOT NULL,
        pnl REAL NOT NULL,
        pnl_percent REAL NOT NULL,
        close_reason TEXT NOT NULL,
        profit_transferred REAL DEFAULT 0,
        open_time INTEGER NOT NULL,
        close_time INTEGER NOT NULL
      )
    `).run().catch(() => {});

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `).run().catch(() => {});

    // 2. Migrate any missing columns in coin_pairs
    const tableInfo = await db.prepare("PRAGMA table_info(coin_pairs)").all() as { results: Array<{ name: string }> };
    const existingCols = new Set((tableInfo.results || []).map((r) => r.name));

    const cols = [
      { name: 'funding_amount', type: 'REAL DEFAULT 0' },
      { name: 'funding_slices', type: 'INTEGER DEFAULT 10' },
      { name: 'last_open_time', type: 'INTEGER DEFAULT 0' },
      { name: 'next_jitter_ms', type: 'INTEGER DEFAULT 0' },
      { name: 'leverage', type: 'INTEGER' },
      { name: 'open_interval_value', type: 'INTEGER' },
      { name: 'open_interval_unit', type: 'TEXT' },
      { name: 'pause_open', type: 'INTEGER DEFAULT 0' },
      { name: 'tp_ratio', type: 'REAL' },
      { name: 'sl_ratio', type: 'REAL' },
      { name: 'margin_mode', type: 'TEXT' },
      { name: 'profit_transfer_ratio', type: 'REAL' },
      { name: 'smart_volatility_enabled', type: 'INTEGER DEFAULT 0' },
      { name: 'min_volatility_threshold', type: 'REAL DEFAULT 1.0' },
      { name: 'current_volatility', type: 'REAL DEFAULT 0' },
      { name: 'volatility_status', type: 'TEXT DEFAULT "active"' },
      { name: 'add_pos_ratio', type: 'REAL DEFAULT 0' },
      { name: 'period_start_time', type: 'INTEGER DEFAULT 0' },
      { name: 'cur_open', type: 'REAL' },
      { name: 'cur_high', type: 'REAL' },
      { name: 'cur_low', type: 'REAL' },
      { name: 'cur_close', type: 'REAL' },
      { name: 'prev1_open', type: 'REAL' },
      { name: 'prev1_close', type: 'REAL' },
      { name: 'prev1_high', type: 'REAL' },
      { name: 'prev1_low', type: 'REAL' },
      { name: 'prev2_high', type: 'REAL' },
      { name: 'prev2_low', type: 'REAL' },
      { name: 'error_message', type: 'TEXT DEFAULT NULL' },
    ];
    for (const c of cols) {
      if (!existingCols.has(c.name)) {
        try {
          await db.prepare(`ALTER TABLE coin_pairs ADD COLUMN ${c.name} ${c.type}`).run();
        } catch {}
      }
    }

    // 3. Ensure indexes
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_positions_symbol_status ON positions(symbol, status)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_positions_close_time ON positions(close_time)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_trade_logs_close_time ON trade_logs(close_time)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at)").run().catch(() => {});
    
    schemaEnsured = true;
  } catch (err) {
    console.error('[DB Schema] ensureDbSchema warning:', err);
  }
}

const configMemoryCache = new Map<string, { value: string | null; timestamp: number }>();
const CONFIG_CACHE_TTL_MS = 30 * 1000; // 30 秒内存缓存

export function invalidateConfigCache(key?: string): void {
  if (key) {
    configMemoryCache.delete(key);
  } else {
    configMemoryCache.clear();
  }
}

export async function getConfig(env: Env): Promise<Config> {
  const map: Record<string, string> = { ...DEFAULT_CONFIG };
  try {
    const keys = ['enabled', 'okx_api_key', 'okx_secret_key', 'okx_passphrase'];
    let allCached = true;
    for (const k of keys) {
      const cached = configMemoryCache.get(k);
      if (cached && (Date.now() - cached.timestamp < CONFIG_CACHE_TTL_MS)) {
        if (cached.value !== null) map[k] = cached.value;
      } else {
        allCached = false;
        break;
      }
    }

    if (allCached) {
      return {
        enabled: map.enabled === 'true',
        okx_api_key: map.okx_api_key || '',
        okx_secret_key: map.okx_secret_key || '',
        okx_passphrase: map.okx_passphrase || '',
      };
    }

    await ensureDbSchema(env);
    const db = getDB(env);
    const rows = await db.prepare('SELECT key, value FROM config').all() as {
      results: Array<{ key: string; value: string }>;
    };

    const now = Date.now();
    for (const row of rows.results || []) {
      map[row.key] = row.value;
      configMemoryCache.set(row.key, { value: row.value, timestamp: now });
    }

    return {
      enabled: map.enabled === 'true',
      okx_api_key: map.okx_api_key || '',
      okx_secret_key: map.okx_secret_key || '',
      okx_passphrase: map.okx_passphrase || '',
    };
  } catch (err) {
    console.error('[DB Error] getConfig failed:', err);
    return {
      enabled: false,
      okx_api_key: '',
      okx_secret_key: '',
      okx_passphrase: '',
    };
  }
}

export async function setConfigValue(env: Env, key: string, value: string): Promise<void> {
  await ensureDbSchema(env);
  const db = getDB(env);
  configMemoryCache.set(key, { value, timestamp: Date.now() });
  await db
    .prepare('INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)')
    .bind(key, value, Date.now())
    .run();
}

export async function getConfigValue(env: Env, key: string): Promise<string | null> {
  const cached = configMemoryCache.get(key);
  if (cached && (Date.now() - cached.timestamp < CONFIG_CACHE_TTL_MS)) {
    return cached.value;
  }
  await ensureDbSchema(env);
  const db = getDB(env);
  try {
    const row = await db.prepare('SELECT value FROM config WHERE key = ?').bind(key).first() as { value: string } | null;
    const val = row?.value ?? null;
    configMemoryCache.set(key, { value: val, timestamp: Date.now() });
    return val;
  } catch (err) {
    console.error(`[DB Error] getConfigValue for key '${key}' failed:`, err);
    return null;
  }
}

export async function setConfigValues(env: Env, values: Record<string, string>): Promise<void> {
  await ensureDbSchema(env);
  const db = getDB(env);
  const now = Date.now();
  for (const [k, v] of Object.entries(values)) {
    configMemoryCache.set(k, { value: v, timestamp: now });
  }
  const stmts = Object.entries(values).map(([key, value]) =>
    db.prepare('INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)').bind(key, value, now)
  );
  await db.batch(stmts);
}

let coinPairsMemoryCache: { data: CoinPair[]; timestamp: number } | null = null;
const COIN_PAIRS_CACHE_TTL_MS = 15000;

export function invalidateCoinPairsCache(): void {
  coinPairsMemoryCache = null;
}

export async function getCoinPairs(env: Env): Promise<CoinPair[]> {
  const now = Date.now();
  if (coinPairsMemoryCache && (now - coinPairsMemoryCache.timestamp < COIN_PAIRS_CACHE_TTL_MS)) {
    return coinPairsMemoryCache.data.map(c => ({ ...c }));
  }

  await ensureDbSchema(env);
  const db = getDB(env);
  const rows = await db
    .prepare(
      'SELECT symbol, period, direction, direction_updated_at, enabled, COALESCE(funding_amount, 0) as funding_amount, COALESCE(funding_slices, 10) as funding_slices, COALESCE(last_open_time, 0) as last_open_time, COALESCE(next_jitter_ms, 0) as next_jitter_ms, leverage, open_interval_value, open_interval_unit, COALESCE(pause_open, 0) as pause_open, tp_ratio, sl_ratio, margin_mode, profit_transfer_ratio, COALESCE(smart_volatility_enabled, 0) as smart_volatility_enabled, COALESCE(min_volatility_threshold, 1.0) as min_volatility_threshold, COALESCE(current_volatility, 0) as current_volatility, COALESCE(volatility_status, "active") as volatility_status, COALESCE(add_pos_ratio, 0) as add_pos_ratio, period_start_time, cur_open, cur_high, cur_low, cur_close, prev1_open, prev1_close, prev1_high, prev1_low, prev2_high, prev2_low FROM coin_pairs'
    )
    .all() as { results: any[] };
  const mapped = rows.results.map((r) => ({
    ...r,
    enabled: Boolean(r.enabled),
    pause_open: Boolean(r.pause_open),
    smart_volatility_enabled: Boolean(r.smart_volatility_enabled),
    min_volatility_threshold: r.min_volatility_threshold !== undefined && r.min_volatility_threshold !== null ? r.min_volatility_threshold : 1.0,
    current_volatility: r.current_volatility !== undefined && r.current_volatility !== null ? r.current_volatility : 0,
    volatility_status: r.volatility_status || 'active',
    add_pos_ratio: r.add_pos_ratio !== undefined && r.add_pos_ratio !== null ? r.add_pos_ratio : null,
    funding_amount: r.funding_amount || 0,
    funding_slices: r.funding_slices !== undefined && r.funding_slices !== null ? r.funding_slices : 10,
    last_open_time: r.last_open_time || 0,
    next_jitter_ms: r.next_jitter_ms || 0,
    leverage: r.leverage !== undefined && r.leverage !== null ? r.leverage : null,
    tp_ratio: r.tp_ratio !== undefined && r.tp_ratio !== null ? r.tp_ratio : null,
    sl_ratio: r.sl_ratio !== undefined && r.sl_ratio !== null ? r.sl_ratio : null,
    open_interval_value: r.open_interval_value !== undefined && r.open_interval_value !== null ? r.open_interval_value : null,
    open_interval_unit: r.open_interval_unit || null,
    margin_mode: r.margin_mode || null,
    profit_transfer_ratio: r.profit_transfer_ratio !== undefined && r.profit_transfer_ratio !== null ? r.profit_transfer_ratio : null,
    period_start_time: r.period_start_time !== undefined && r.period_start_time !== null ? r.period_start_time : 0,
    cur_open: r.cur_open !== undefined && r.cur_open !== null ? r.cur_open : null,
    cur_high: r.cur_high !== undefined && r.cur_high !== null ? r.cur_high : null,
    cur_low: r.cur_low !== undefined && r.cur_low !== null ? r.cur_low : null,
    cur_close: r.cur_close !== undefined && r.cur_close !== null ? r.cur_close : null,
    prev1_open: r.prev1_open !== undefined && r.prev1_open !== null ? r.prev1_open : null,
    prev1_close: r.prev1_close !== undefined && r.prev1_close !== null ? r.prev1_close : null,
    prev1_high: r.prev1_high !== undefined && r.prev1_high !== null ? r.prev1_high : null,
    prev1_low: r.prev1_low !== undefined && r.prev1_low !== null ? r.prev1_low : null,
    prev2_high: r.prev2_high !== undefined && r.prev2_high !== null ? r.prev2_high : null,
    prev2_low: r.prev2_low !== undefined && r.prev2_low !== null ? r.prev2_low : null,
    error_message: r.error_message || null,
  }));
  coinPairsMemoryCache = { data: mapped, timestamp: now };
  return mapped.map(c => ({ ...c }));
}

export async function batchUpdateCoinPairs(
  env: Env,
  updatesList: Array<{ symbol: string; updates: Record<string, any> }>
): Promise<void> {
  if (updatesList.length === 0) return;
  await ensureDbSchema(env);
  const db = getDB(env);
  const stmts: any[] = [];

  for (const item of updatesList) {
    const sets: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    const u = item.updates;

    if (u.direction !== undefined) { sets.push('direction = ?'); values.push(u.direction); }
    if (u.direction_updated_at !== undefined) { sets.push('direction_updated_at = ?'); values.push(u.direction_updated_at); }
    if (u.enabled !== undefined) { sets.push('enabled = ?'); values.push(u.enabled ? 1 : 0); }
    if (u.pause_open !== undefined) { sets.push('pause_open = ?'); values.push(u.pause_open ? 1 : 0); }
    if (u.period !== undefined) { sets.push('period = ?'); values.push(u.period); }
    if (u.funding_amount !== undefined) { sets.push('funding_amount = ?'); values.push(u.funding_amount); }
    if (u.funding_slices !== undefined) { sets.push('funding_slices = ?'); values.push(u.funding_slices); }
    if (u.last_open_time !== undefined) { sets.push('last_open_time = ?'); values.push(u.last_open_time); }
    if (u.next_jitter_ms !== undefined) { sets.push('next_jitter_ms = ?'); values.push(u.next_jitter_ms); }
    if (u.leverage !== undefined) { sets.push('leverage = ?'); values.push(u.leverage); }
    if (u.open_interval_value !== undefined) { sets.push('open_interval_value = ?'); values.push(u.open_interval_value); }
    if (u.open_interval_unit !== undefined) { sets.push('open_interval_unit = ?'); values.push(u.open_interval_unit); }
    if (u.tp_ratio !== undefined) { sets.push('tp_ratio = ?'); values.push(u.tp_ratio); }
    if (u.sl_ratio !== undefined) { sets.push('sl_ratio = ?'); values.push(u.sl_ratio); }
    if (u.margin_mode !== undefined) { sets.push('margin_mode = ?'); values.push(u.margin_mode); }
    if (u.profit_transfer_ratio !== undefined) { sets.push('profit_transfer_ratio = ?'); values.push(u.profit_transfer_ratio); }
    if (u.smart_volatility_enabled !== undefined) { sets.push('smart_volatility_enabled = ?'); values.push(u.smart_volatility_enabled ? 1 : 0); }
    if (u.min_volatility_threshold !== undefined) { sets.push('min_volatility_threshold = ?'); values.push(u.min_volatility_threshold); }
    if (u.current_volatility !== undefined) { sets.push('current_volatility = ?'); values.push(u.current_volatility); }
    if (u.volatility_status !== undefined) { sets.push('volatility_status = ?'); values.push(u.volatility_status); }
    if (u.add_pos_ratio !== undefined) { sets.push('add_pos_ratio = ?'); values.push(u.add_pos_ratio); }
    if (u.period_start_time !== undefined) { sets.push('period_start_time = ?'); values.push(u.period_start_time); }
    if (u.cur_open !== undefined) { sets.push('cur_open = ?'); values.push(u.cur_open); }
    if (u.cur_high !== undefined) { sets.push('cur_high = ?'); values.push(u.cur_high); }
    if (u.cur_low !== undefined) { sets.push('cur_low = ?'); values.push(u.cur_low); }
    if (u.cur_close !== undefined) { sets.push('cur_close = ?'); values.push(u.cur_close); }
    if (u.prev1_open !== undefined) { sets.push('prev1_open = ?'); values.push(u.prev1_open); }
    if (u.prev1_close !== undefined) { sets.push('prev1_close = ?'); values.push(u.prev1_close); }
    if (u.prev1_high !== undefined) { sets.push('prev1_high = ?'); values.push(u.prev1_high); }
    if (u.prev1_low !== undefined) { sets.push('prev1_low = ?'); values.push(u.prev1_low); }
    if (u.prev2_high !== undefined) { sets.push('prev2_high = ?'); values.push(u.prev2_high); }
    if (u.prev2_low !== undefined) { sets.push('prev2_low = ?'); values.push(u.prev2_low); }
    if (u.error_message !== undefined) { sets.push('error_message = ?'); values.push(u.error_message); }

    if (sets.length > 0) {
      values.push(item.symbol);
      stmts.push(
        db.prepare(`UPDATE coin_pairs SET ${sets.join(', ')} WHERE symbol = ?`).bind(...values)
      );
    }
  }

  if (stmts.length === 0) return;
  for (let i = 0; i < stmts.length; i += 80) {
    await db.batch(stmts.slice(i, i + 80));
  }
  invalidateCoinPairsCache();
}

export async function updateCoinPair(
  env: Env,
  symbol: string,
  updates: any
): Promise<void> {
  await ensureDbSchema(env);
  const db = getDB(env);
  const sets: string[] = [];
  const values: (string | number | boolean | null)[] = [];

  if (updates.direction !== undefined) {
    sets.push('direction = ?');
    values.push(updates.direction);
  }
  if (updates.direction_updated_at !== undefined) {
    sets.push('direction_updated_at = ?');
    values.push(updates.direction_updated_at);
  }
  if (updates.enabled !== undefined) {
    sets.push('enabled = ?');
    values.push(updates.enabled ? 1 : 0);
  }
  if (updates.pause_open !== undefined) {
    sets.push('pause_open = ?');
    values.push(updates.pause_open ? 1 : 0);
  }
  if (updates.period !== undefined) {
    sets.push('period = ?');
    values.push(updates.period);
  }
  if (updates.funding_amount !== undefined) {
    sets.push('funding_amount = ?');
    values.push(updates.funding_amount);
  }
  if (updates.last_open_time !== undefined) {
    sets.push('last_open_time = ?');
    values.push(updates.last_open_time);
  }
  if (updates.next_jitter_ms !== undefined) {
    sets.push('next_jitter_ms = ?');
    values.push(updates.next_jitter_ms);
  }
  if (updates.leverage !== undefined) {
    sets.push('leverage = ?');
    values.push(updates.leverage);
  }
  if (updates.open_interval_value !== undefined) {
    sets.push('open_interval_value = ?');
    values.push(updates.open_interval_value);
  }
  if (updates.open_interval_unit !== undefined) {
    sets.push('open_interval_unit = ?');
    values.push(updates.open_interval_unit);
  }
  if (updates.tp_ratio !== undefined) {
    sets.push('tp_ratio = ?');
    values.push(updates.tp_ratio);
  }
  if (updates.sl_ratio !== undefined) {
    sets.push('sl_ratio = ?');
    values.push(updates.sl_ratio);
  }
  if (updates.funding_slices !== undefined) {
    sets.push('funding_slices = ?');
    values.push(updates.funding_slices);
  }
  if (updates.margin_mode !== undefined) {
    sets.push('margin_mode = ?');
    values.push(updates.margin_mode);
  }
  if (updates.profit_transfer_ratio !== undefined) {
    sets.push('profit_transfer_ratio = ?');
    values.push(updates.profit_transfer_ratio);
  }
  if (updates.smart_volatility_enabled !== undefined) {
    sets.push('smart_volatility_enabled = ?');
    values.push(updates.smart_volatility_enabled ? 1 : 0);
  }
  if (updates.min_volatility_threshold !== undefined) {
    sets.push('min_volatility_threshold = ?');
    values.push(updates.min_volatility_threshold);
  }
  if (updates.current_volatility !== undefined) {
    sets.push('current_volatility = ?');
    values.push(updates.current_volatility);
  }
  if (updates.volatility_status !== undefined) {
    sets.push('volatility_status = ?');
    values.push(updates.volatility_status);
  }
  if (updates.add_pos_ratio !== undefined) {
    sets.push('add_pos_ratio = ?');
    values.push(updates.add_pos_ratio);
  }
  if (updates.period_start_time !== undefined) {
    sets.push('period_start_time = ?');
    values.push(updates.period_start_time);
  }
  if (updates.cur_open !== undefined) {
    sets.push('cur_open = ?');
    values.push(updates.cur_open);
  }
  if (updates.cur_high !== undefined) {
    sets.push('cur_high = ?');
    values.push(updates.cur_high);
  }
  if (updates.cur_low !== undefined) {
    sets.push('cur_low = ?');
    values.push(updates.cur_low);
  }
  if (updates.cur_close !== undefined) {
    sets.push('cur_close = ?');
    values.push(updates.cur_close);
  }
  if (updates.prev1_open !== undefined) {
    sets.push('prev1_open = ?');
    values.push(updates.prev1_open);
  }
  if (updates.prev1_close !== undefined) {
    sets.push('prev1_close = ?');
    values.push(updates.prev1_close);
  }
  if (updates.prev1_high !== undefined) {
    sets.push('prev1_high = ?');
    values.push(updates.prev1_high);
  }
  if (updates.prev1_low !== undefined) {
    sets.push('prev1_low = ?');
    values.push(updates.prev1_low);
  }
  if (updates.prev2_high !== undefined) {
    sets.push('prev2_high = ?');
    values.push(updates.prev2_high);
  }
  if (updates.prev2_low !== undefined) {
    sets.push('prev2_low = ?');
    values.push(updates.prev2_low);
  }

  if (sets.length === 0) return;

  values.push(symbol);
  await db
    .prepare(`UPDATE coin_pairs SET ${sets.join(', ')} WHERE symbol = ?`)
    .bind(...values)
    .run();
  invalidateCoinPairsCache();
}

export async function addCoinPair(env: Env, symbol: string, period?: string): Promise<void> {
  const db = getDB(env);
  await db
    .prepare(`
      INSERT OR IGNORE INTO coin_pairs (
        symbol, period, direction, direction_updated_at, enabled,
        funding_amount, funding_slices, last_open_time, next_jitter_ms, pause_open,
        leverage, tp_ratio, sl_ratio,
        open_interval_value, open_interval_unit, margin_mode, profit_transfer_ratio
      ) VALUES (?, ?, NULL, 0, 0, 0, 10, 0, 0, 0, 10, 5, 5, 1, 'hour', 'isolated', 0)
    `)
    .bind(symbol, period || '')
    .run();
  invalidateCoinPairsCache();
}

export async function batchAddCoinPairs(
  env: Env,
  items: Array<{
    symbol: string;
    period?: string;
    funding_amount?: number;
    funding_slices?: number;
    enabled?: number;
    last_open_time?: number;
    leverage?: number;
    open_interval_value?: number;
    open_interval_unit?: string;
    tp_ratio?: number | null;
    sl_ratio?: number | null;
    margin_mode?: string;
    profit_transfer_ratio?: number | null;
    smart_volatility_enabled?: number;
    min_volatility_threshold?: number;
    add_pos_ratio?: number | null;
  }>
): Promise<void> {
  if (!items || items.length === 0) return;
  await ensureDbSchema(env);
  const db = getDB(env);
  const stmts = items.map((item) =>
    db
      .prepare(`
        INSERT INTO coin_pairs (
          symbol, period, direction, direction_updated_at, enabled,
          funding_amount, funding_slices, last_open_time, next_jitter_ms, pause_open,
          leverage, tp_ratio, sl_ratio,
          open_interval_value, open_interval_unit, margin_mode, profit_transfer_ratio,
          smart_volatility_enabled, min_volatility_threshold, add_pos_ratio
        ) VALUES (?, ?, NULL, 0, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(symbol) DO UPDATE SET
          period = CASE WHEN excluded.period != '' THEN excluded.period ELSE coin_pairs.period END,
          funding_amount = COALESCE(excluded.funding_amount, coin_pairs.funding_amount),
          funding_slices = COALESCE(excluded.funding_slices, coin_pairs.funding_slices),
          leverage = COALESCE(excluded.leverage, coin_pairs.leverage),
          open_interval_value = COALESCE(excluded.open_interval_value, coin_pairs.open_interval_value),
          open_interval_unit = COALESCE(excluded.open_interval_unit, coin_pairs.open_interval_unit),
          tp_ratio = COALESCE(excluded.tp_ratio, coin_pairs.tp_ratio),
          sl_ratio = COALESCE(excluded.sl_ratio, coin_pairs.sl_ratio),
          margin_mode = COALESCE(excluded.margin_mode, coin_pairs.margin_mode),
          profit_transfer_ratio = COALESCE(excluded.profit_transfer_ratio, coin_pairs.profit_transfer_ratio),
          smart_volatility_enabled = COALESCE(excluded.smart_volatility_enabled, coin_pairs.smart_volatility_enabled),
          min_volatility_threshold = COALESCE(excluded.min_volatility_threshold, coin_pairs.min_volatility_threshold),
          add_pos_ratio = COALESCE(excluded.add_pos_ratio, coin_pairs.add_pos_ratio),
          enabled = CASE WHEN excluded.enabled = 1 THEN 1 ELSE coin_pairs.enabled END,
          last_open_time = CASE WHEN excluded.enabled = 1 THEN 0 ELSE coin_pairs.last_open_time END
      `)
      .bind(
        item.symbol,
        item.period || '',
        item.enabled ? 1 : 0,
        item.funding_amount !== undefined ? item.funding_amount : 0,
        item.funding_slices !== undefined ? item.funding_slices : 10,
        item.last_open_time !== undefined ? item.last_open_time : 0,
        item.leverage !== undefined ? item.leverage : 10,
        item.tp_ratio !== undefined ? item.tp_ratio : 5,
        item.sl_ratio !== undefined && item.sl_ratio !== null ? item.sl_ratio : null,
        item.open_interval_value !== undefined ? item.open_interval_value : 1,
        item.open_interval_unit || 'hour',
        item.margin_mode || 'isolated',
        item.profit_transfer_ratio !== undefined ? item.profit_transfer_ratio : 0,
        item.smart_volatility_enabled ? 1 : 0,
        item.min_volatility_threshold !== undefined ? item.min_volatility_threshold : 1.0,
        item.add_pos_ratio !== undefined ? item.add_pos_ratio : 0
      )
  );

  for (let i = 0; i < stmts.length; i += 80) {
    await db.batch(stmts.slice(i, i + 80));
  }
  invalidateCoinPairsCache();
}

export async function deleteCoinPair(env: Env, symbol: string): Promise<void> {
  const db = getDB(env);
  const cleanSymbol = (symbol || '').trim().toUpperCase();
  await db.prepare('DELETE FROM coin_pairs WHERE symbol = ?').bind(cleanSymbol).run();
  invalidateCoinPairsCache();
}

export async function batchDeleteCoinPairs(env: Env, symbols: string[]): Promise<number> {
  if (!symbols || symbols.length === 0) return 0;
  const db = getDB(env);
  const cleanSymbols = Array.from(new Set(symbols.map(s => (s || '').trim().toUpperCase()))).filter(Boolean);
  if (cleanSymbols.length === 0) return 0;

  const stmts = cleanSymbols.map(s => db.prepare('DELETE FROM coin_pairs WHERE symbol = ?').bind(s));
  for (let i = 0; i < stmts.length; i += 80) {
    await db.batch(stmts.slice(i, i + 80));
  }
  invalidateCoinPairsCache();
  return cleanSymbols.length;
}

export async function getOpenPositions(env: Env): Promise<Position[]> {
  const db = getDB(env);
  const rows = await db.prepare("SELECT * FROM positions WHERE status = 'open'").all() as { results: Position[] };
  return rows.results;
}

export async function getOpenPositionsBySymbol(env: Env, symbol: string): Promise<Position[]> {
  const db = getDB(env);
  const rows = await db.prepare("SELECT * FROM positions WHERE status = 'open' AND symbol = ?").bind(symbol).all() as { results: Position[] };
  return rows.results;
}

export async function getTotalAssetsBySymbol(env: Env, symbol: string): Promise<number> {
  const db = getDB(env);
  const row = await db
    .prepare("SELECT COALESCE(SUM(margin + unrealized_pnl), 0) as total FROM positions WHERE status = 'open' AND symbol = ?")
    .bind(symbol)
    .first() as { total: number } | null;
  return row?.total ?? 0;
}

export async function getPositionById(env: Env, id: number): Promise<Position | null> {
  const db = getDB(env);
  const row = await db.prepare('SELECT * FROM positions WHERE id = ?').bind(id).first() as Position | null;
  return row;
}

export async function insertPosition(env: Env, position: Omit<Position, 'id'>): Promise<number> {
  const db = getDB(env);

  const result = await db
    .prepare(
      `INSERT INTO positions (symbol, direction, leverage, entry_price, quantity, margin, okx_order_id, open_time, tp_price, sl_price, tp_algo_id, sl_algo_id, unrealized_pnl, last_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      position.symbol,
      position.direction,
      position.leverage,
      position.entry_price,
      position.quantity,
      position.margin,
      position.okx_order_id || '',
      position.open_time,
      position.tp_price,
      position.sl_price,
      position.tp_algo_id || '',
      position.sl_algo_id || '',
      position.unrealized_pnl,
      position.last_price,
      'open'
    )
    .run();
  return result.meta.last_row_id as number;
}

export async function batchInsertPositions(
  env: Env,
  positions: Array<Omit<Position, 'id'>>
): Promise<number[]> {
  if (positions.length === 0) return [];
  await ensureDbSchema(env);
  const db = getDB(env);
  const stmts = positions.map((position) =>
    db
      .prepare(
        `INSERT INTO positions (symbol, direction, leverage, entry_price, quantity, margin, okx_order_id, open_time, tp_price, sl_price, tp_algo_id, sl_algo_id, unrealized_pnl, last_price, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        position.symbol,
        position.direction,
        position.leverage,
        position.entry_price,
        position.quantity,
        position.margin,
        position.okx_order_id || '',
        position.open_time,
        position.tp_price,
        position.sl_price,
        position.tp_algo_id || '',
        position.sl_algo_id || '',
        position.unrealized_pnl,
        position.last_price,
        'open'
      )
  );

  const ids: number[] = [];
  for (let i = 0; i < stmts.length; i += 80) {
    const chunk = stmts.slice(i, i + 80);
    const results = await db.batch(chunk);
    for (const r of results) {
      const rowId = (r as any)?.meta?.last_row_id;
      if (rowId) ids.push(Number(rowId));
    }
  }
  return ids;
}

/**
 * 聚合持仓批量更新/写入（全仓模式单币种单一活跃仓位）
 * 彻底消除高频重复插入订单记录，仅维护每个币种方向唯一的活跃仓位记录
 */
export async function batchUpsertAggregatedPositions(
  env: Env,
  orders: Array<Omit<Position, 'id'> | {
    symbol: string;
    direction: 'long' | 'short';
    leverage: number;
    entry_price: number;
    quantity: number;
    margin: number;
    okx_order_id?: string;
    open_time: number;
    tp_price: number;
    sl_price: number;
    tp_algo_id?: string;
    sl_algo_id?: string;
    last_price: number;
  }>
): Promise<void> {
  if (orders.length === 0) return;
  await ensureDbSchema(env);
  const db = getDB(env);

  const openPositions = await getOpenPositions(env);
  const openMap = new Map<string, Position>();
  for (const pos of openPositions) {
    openMap.set(`${pos.symbol}:${pos.direction}`, pos);
  }

  const stmts: any[] = [];

  for (const ord of orders) {
    const key = `${ord.symbol}:${ord.direction}`;
    const existing = openMap.get(key);

    if (existing) {
      const newQty = existing.quantity + ord.quantity;
      const newMargin = existing.margin + ord.margin;
      const newAvgEntry = newQty > 0
        ? (existing.entry_price * existing.quantity + ord.entry_price * ord.quantity) / newQty
        : ord.entry_price;

      existing.quantity = newQty;
      existing.margin = newMargin;
      existing.entry_price = newAvgEntry;
      existing.last_price = ord.last_price || ord.entry_price;

      stmts.push(
        db
          .prepare(
            `UPDATE positions 
             SET quantity = ?, margin = ?, entry_price = ?, last_price = ?, okx_order_id = ?
             WHERE id = ? AND status = 'open'`
          )
          .bind(newQty, newMargin, newAvgEntry, ord.last_price || ord.entry_price, ord.okx_order_id || existing.okx_order_id, existing.id)
      );
    } else {
      stmts.push(
        db
          .prepare(
            `INSERT INTO positions (
               symbol, direction, leverage, entry_price, quantity, margin, 
               okx_order_id, open_time, tp_price, sl_price, tp_algo_id, sl_algo_id, 
               unrealized_pnl, last_price, status
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`
          )
          .bind(
            ord.symbol,
            ord.direction,
            ord.leverage,
            ord.entry_price,
            ord.quantity,
            ord.margin,
            ord.okx_order_id || '',
            ord.open_time,
            ord.tp_price || 0,
            ord.sl_price || 0,
            ord.tp_algo_id || '',
            ord.sl_algo_id || '',
            0,
            ord.last_price || ord.entry_price
          )
      );
    }
  }

  if (stmts.length > 0) {
    for (let i = 0; i < stmts.length; i += 80) {
      await db.batch(stmts.slice(i, i + 80));
    }
  }
}

export async function closePositionRecord(
  env: Env,
  id: number,
  closeReason: string,
  closePrice: number,
  closePnl: number
): Promise<boolean> {
  const db = getDB(env);
  const result = await db
    .prepare(
      `UPDATE positions SET status = 'closed', close_reason = ?, close_price = ?, close_pnl = ?, close_time = ? WHERE id = ? AND status = 'open'`
    )
    .bind(closeReason, closePrice, closePnl, Date.now(), id)
    .run();
  return result.meta.changes > 0;
}

export async function updatePositionUnrealizedPnl(
  env: Env,
  id: number,
  unrealizedPnl: number,
  lastPrice: number
): Promise<void> {
  const db = getDB(env);
  await db
    .prepare(`UPDATE positions SET unrealized_pnl = ?, last_price = ? WHERE id = ?`)
    .bind(unrealizedPnl, lastPrice, id)
    .run();
}

export async function updatePositionTpSl(
  env: Env,
  id: number,
  tpAlgoId: string,
  tpPrice: number,
  slPrice: number
): Promise<void> {
  const db = getDB(env);
  await db
    .prepare(`UPDATE positions SET tp_algo_id = ?, tp_price = ?, sl_price = ? WHERE id = ?`)
    .bind(tpAlgoId, tpPrice, slPrice, id)
    .run();
}

export async function insertTradeLog(env: Env, log: Omit<TradeLog, 'id'>): Promise<void> {
  const db = getDB(env);
  await db
    .prepare(
      `INSERT INTO trade_logs (position_id, symbol, direction, entry_price, exit_price, quantity, margin, pnl, pnl_percent, close_reason, profit_transferred, open_time, close_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      log.position_id ?? null,
      log.symbol,
      log.direction,
      log.entry_price,
      log.exit_price,
      log.quantity,
      log.margin,
      log.pnl,
      log.pnl_percent,
      log.close_reason,
      log.profit_transferred,
      log.open_time,
      log.close_time
    )
    .run();
}

export async function getTradeLogByPositionId(env: Env, positionId: number): Promise<TradeLog | null> {
  const db = getDB(env);
  const row = await db.prepare('SELECT * FROM trade_logs WHERE position_id = ? LIMIT 1').bind(positionId).first() as TradeLog | null;
  return row;
}

export async function updateTradeLogTransferred(
  env: Env,
  tradeLogId: number,
  amount: number
): Promise<void> {
  const db = getDB(env);
  await db
    .prepare(`UPDATE trade_logs SET profit_transferred = profit_transferred + ? WHERE id = ?`)
    .bind(amount, tradeLogId)
    .run();
}

export async function getRecentTradeLogs(
  env: Env,
  limit: number = 50,
  offset: number = 0
): Promise<TradeLog[]> {
  const db = getDB(env);
  const rows = await db
    .prepare(`SELECT * FROM trade_logs ORDER BY close_time DESC LIMIT ? OFFSET ?`)
    .bind(limit, offset)
    .all() as { results: TradeLog[] };
  return rows.results;
}

export async function clearTradeLogs(env: Env): Promise<number> {
  const db = getDB(env);
  const result = await db.prepare('DELETE FROM trade_logs').run();
  return result.meta.changes;
}

export async function hasPositionInRecentMs(
  env: Env,
  symbol: string,
  recentMs: number
): Promise<boolean> {
  const db = getDB(env);
  const cutoff = Date.now() - recentMs;

  const row = await db
    .prepare(
      `SELECT COUNT(*) as count FROM positions WHERE symbol = ? AND status = 'open' AND open_time >= ?`
    )
    .bind(symbol, cutoff)
    .first() as { count: number } | null;

  return (row?.count ?? 0) > 0;
}

export async function getTradeLogStats(env: Env): Promise<{ total: number; wins: number; winRate: number }> {
  const db = getDB(env);
  const totalRow = await db.prepare('SELECT COUNT(*) as count FROM trade_logs').first() as { count: number } | null;
  const winRow = await db
    .prepare('SELECT COUNT(*) as count FROM trade_logs WHERE pnl > 0')
    .first() as { count: number } | null;
  const total = totalRow?.count ?? 0;
  const wins = winRow?.count ?? 0;
  return { total, wins, winRate: total > 0 ? (wins / total) * 100 : 0 };
}

// 系统日志持久化与内存多级缓存（上限严格 1000 条，超出自动截断，跨 Worker 实例/刷新绝不丢失）
export const MAX_WORKER_LOGS = 1000;
let workerLogIdSeq = 1;
const workerMemoryLogs: SystemLog[] = [];
let logInsertCounter = 0;

export function appendWorkerLog(type: string, message: string, createdAt?: number, id?: number): SystemLog {
  const item: SystemLog = {
    id: id || workerLogIdSeq++,
    type,
    message,
    created_at: createdAt || Date.now(),
  };
  workerMemoryLogs.push(item);
  if (workerMemoryLogs.length > MAX_WORKER_LOGS) {
    workerMemoryLogs.splice(0, workerMemoryLogs.length - MAX_WORKER_LOGS);
  }
  return item;
}

export async function insertSystemLog(env: Env, type: string, message: string): Promise<void> {
  const now = Date.now();
  appendWorkerLog(type, message, now);

  try {
    const db = getDB(env);
    await db
      .prepare('INSERT INTO system_logs (type, message, created_at) VALUES (?, ?, ?)')
      .bind(type, message, now)
      .run();

    logInsertCounter++;
    // 每累积插入 20 条日志，执行一次上限截断修剪，确保 system_logs 总数严格不超过 1000 条
    if (logInsertCounter >= 20) {
      logInsertCounter = 0;
      await db.prepare(`
        DELETE FROM system_logs WHERE id <= (
          SELECT id FROM system_logs ORDER BY id DESC LIMIT 1 OFFSET 1000
        )
      `).run().catch(() => {});
    }
  } catch (err) {
    console.warn('[insertSystemLog] D1 写入异常，已保留内存日志:', err);
  }
}

export async function getRecentSystemLogs(env: Env, limit: number = 50): Promise<SystemLog[]> {
  const safeLimit = Math.min(Math.max(limit || 50, 1), 1000);
  try {
    const db = getDB(env);
    // 从 D1 查询最新的日志（按 id 降序获取最新的 safeLimit 条）
    const rows = await db
      .prepare('SELECT id, type, message, created_at FROM system_logs ORDER BY id DESC LIMIT ?')
      .bind(safeLimit)
      .all<SystemLog>();

    if (rows && rows.results && rows.results.length > 0) {
      // 倒序排列为时间正序返回给前端
      const dbLogs = [...rows.results].reverse();
      // 同步刷新本地内存缓存
      workerMemoryLogs.length = 0;
      for (const item of dbLogs) {
        workerMemoryLogs.push(item);
      }
      return dbLogs;
    }
  } catch (err) {
    console.warn('[getRecentSystemLogs] D1 读取异常，回退内存日志:', err);
  }

  // 若 D1 暂无数据或查询异常，回退至当前 Worker 内存日志
  const count = Math.min(safeLimit, workerMemoryLogs.length);
  return workerMemoryLogs.slice(workerMemoryLogs.length - count);
}

export async function clearSystemLogs(env: Env): Promise<void> {
  workerMemoryLogs.length = 0;
  try {
    const db = getDB(env);
    await db.prepare('DELETE FROM system_logs').run();
  } catch (err) {
    console.warn('[clearSystemLogs] D1 清空异常:', err);
  }
}

export async function cleanupOldRecords(env: Env): Promise<number> {
  const db = getDB(env);
  const now = Date.now();
  const cutoff30d = now - 30 * 86400000; // 30 天时间截止线
  const cutoff7d = now - 7 * 86400000;   // 报错与系统日志 7 天（一周）截止线
  let deleted = 0;

  try {
    // 1. 【持仓严格永久保留】：根据指令，所有持仓（无论是 open 还是 closed）必须全部保留，绝不删除！

    // 2. 清理超过 30 天的交易记录（trade_logs）
    const trade30dResult = await db
      .prepare('DELETE FROM trade_logs WHERE close_time < ?')
      .bind(cutoff30d)
      .run();
    deleted += trade30dResult?.meta?.changes ?? (trade30dResult as any)?.changes ?? 0;

    // 3. 交易记录容量限制（按 1000 条，超出部分清理最老的数据）
    const tradeCountRow = await db.prepare('SELECT COUNT(*) as cnt FROM trade_logs').first() as { cnt: number } | null;
    const tradeCount = tradeCountRow?.cnt ?? 0;
    if (tradeCount > 1000) {
      const excess = tradeCount - 1000;
      const trimTrade = await db.prepare(`
        DELETE FROM trade_logs 
        WHERE id IN (
          SELECT id FROM trade_logs 
          ORDER BY close_time ASC 
          LIMIT ?
        )
      `).bind(excess).run();
      deleted += trimTrade?.meta?.changes ?? (trimTrade as any)?.changes ?? 0;
    }

    // 4. 系统日志与报错记录清理：
    // a. 超过 7 天（一周）的日志与报错全部删除
    const log7dResult = await db
      .prepare('DELETE FROM system_logs WHERE created_at < ?')
      .bind(cutoff7d)
      .run();
    deleted += log7dResult?.meta?.changes ?? (log7dResult as any)?.changes ?? 0;

    // b. 非 error 类型的普通日志超过 30 天或容量超出 1000 条时清理（保留最近 1000 条普通日志）
    const normLog30dResult = await db
      .prepare("DELETE FROM system_logs WHERE type != 'error' AND created_at < ?")
      .bind(cutoff30d)
      .run();
    deleted += normLog30dResult?.meta?.changes ?? (normLog30dResult as any)?.changes ?? 0;

    const normLogCountRow = await db.prepare("SELECT COUNT(*) as cnt FROM system_logs WHERE type != 'error'").first() as { cnt: number } | null;
    const normLogCount = normLogCountRow?.cnt ?? 0;
    if (normLogCount > 1000) {
      const excessNorm = normLogCount - 1000;
      const trimNormLogs = await db.prepare(`
        DELETE FROM system_logs 
        WHERE id IN (
          SELECT id FROM system_logs 
          WHERE type != 'error' 
          ORDER BY created_at ASC 
          LIMIT ?
        )
      `).bind(excessNorm).run();
      deleted += trimNormLogs?.meta?.changes ?? (trimNormLogs as any)?.changes ?? 0;
    }

    // c. 针对一周内的 error 报错记录做容量上限保护（最大容纳 1000 条最近报错），超额修剪
    const errLogCountRow = await db.prepare("SELECT COUNT(*) as cnt FROM system_logs WHERE type = 'error'").first() as { cnt: number } | null;
    const errLogCount = errLogCountRow?.cnt ?? 0;
    if (errLogCount > 1000) {
      const excessErr = errLogCount - 1000;
      const trimErrLogs = await db.prepare(`
        DELETE FROM system_logs 
        WHERE id IN (
          SELECT id FROM system_logs 
          WHERE type = 'error' 
          ORDER BY created_at ASC 
          LIMIT ?
        )
      `).bind(excessErr).run();
      deleted += trimErrLogs?.meta?.changes ?? (trimErrLogs as any)?.changes ?? 0;
    }
  } catch (err) {
    console.warn('[cleanupOldRecords] 清理异常:', err);
  }

  return deleted;
}

export async function batchClosePositionsAndTradeLogs(
  env: Env,
  items: Array<{
    positionId: number;
    closeReason: string;
    closePrice: number;
    closePnl: number;
    closeTime: number;
    tradeLog: Omit<TradeLog, 'id'>;
  }>
): Promise<void> {
  if (items.length === 0) return;
  const db = getDB(env);
  const stmts: any[] = [];

  for (const item of items) {
    stmts.push(
      db
        .prepare(
          `UPDATE positions SET status = 'closed', close_reason = ?, close_price = ?, close_pnl = ?, close_time = ? WHERE id = ? AND status = 'open'`
        )
        .bind(item.closeReason, item.closePrice, item.closePnl, item.closeTime, item.positionId)
    );

    stmts.push(
      db
        .prepare(
          `INSERT INTO trade_logs (position_id, symbol, direction, entry_price, exit_price, quantity, margin, pnl, pnl_percent, close_reason, profit_transferred, open_time, close_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          item.tradeLog.position_id ?? null,
          item.tradeLog.symbol,
          item.tradeLog.direction,
          item.tradeLog.entry_price,
          item.tradeLog.exit_price,
          item.tradeLog.quantity,
          item.tradeLog.margin,
          item.tradeLog.pnl,
          item.tradeLog.pnl_percent,
          item.tradeLog.close_reason,
          item.tradeLog.profit_transferred,
          item.tradeLog.open_time,
          item.tradeLog.close_time
        )
    );
  }

  // Chunk in batches of 80 statements to stay well within D1 limits
  for (let i = 0; i < stmts.length; i += 80) {
    await db.batch(stmts.slice(i, i + 80));
  }
}

export async function batchInsertSystemLogs(
  env: Env,
  logs: Array<{ type: string; message: string; created_at?: number }>
): Promise<void> {
  if (!logs || logs.length === 0) return;
  const now = Date.now();
  for (const l of logs) {
    appendWorkerLog(l.type, l.message, l.created_at || now);
  }

  try {
    const db = getDB(env);

    // 智能合并行日志：将同类型的多条零散日志合并为结构化多行单条记录写入 D1，极大压降 D1 写入频次
    const mergedForD1: Array<{ type: string; message: string; created_at: number }> = [];
    let currentBlock: { type: string; messages: string[]; created_at: number } | null = null;

    for (const l of logs) {
      const time = l.created_at || now;
      if (!currentBlock) {
        currentBlock = { type: l.type, messages: [l.message], created_at: time };
      } else if (currentBlock.type === l.type && currentBlock.messages.length < 25) {
        currentBlock.messages.push(l.message);
      } else {
        mergedForD1.push({
          type: currentBlock.type,
          message: currentBlock.messages.join('\n'),
          created_at: currentBlock.created_at,
        });
        currentBlock = { type: l.type, messages: [l.message], created_at: time };
      }
    }
    if (currentBlock) {
      mergedForD1.push({
        type: currentBlock.type,
        message: currentBlock.messages.join('\n'),
        created_at: currentBlock.created_at,
      });
    }

    const stmts = mergedForD1.map(l =>
      db.prepare('INSERT INTO system_logs (type, message, created_at) VALUES (?, ?, ?)')
        .bind(l.type, l.message, l.created_at)
    );

    for (let i = 0; i < stmts.length; i += 50) {
      await db.batch(stmts.slice(i, i + 50));
    }

    // 批量写入后进行一次上限修剪，严格保证不超过 1000 条
    await db.prepare(`
      DELETE FROM system_logs WHERE id <= (
        SELECT id FROM system_logs ORDER BY id DESC LIMIT 1 OFFSET 1000
      )
    `).run().catch(() => {});
  } catch (err) {
    console.warn('[batchInsertSystemLogs] D1 批量写入异常，已保留内存日志:', err);
  }
}

export async function batchUpdatePositionUnrealizedPnl(env: Env, updates: {id: number, unrealizedPnl: number, lastPrice: number, margin?: number}[]): Promise<void> {
  if (updates.length === 0) return;
  const db = getDB(env);
  const stmts = updates.map(u => {
    if (u.margin !== undefined && u.margin > 0) {
      return db.prepare('UPDATE positions SET unrealized_pnl = ?, last_price = ?, margin = ? WHERE id = ?')
        .bind(u.unrealizedPnl, u.lastPrice, u.margin, u.id);
    }
    return db.prepare('UPDATE positions SET unrealized_pnl = ?, last_price = ? WHERE id = ?')
      .bind(u.unrealizedPnl, u.lastPrice, u.id);
  });
  // Batch in chunks of 100 to maximize D1 throughput
  for (let i = 0; i < stmts.length; i += 100) {
    await db.batch(stmts.slice(i, i + 100));
  }
}

export async function batchUpdateCoinPairsFunding(env: Env, updates: {symbol: string, fundingAmount: number}[]): Promise<void> {
  if (updates.length === 0) return;
  const db = getDB(env);
  const stmts = updates.map(u => 
    db.prepare('UPDATE coin_pairs SET funding_amount = ? WHERE symbol = ?')
      .bind(u.fundingAmount, u.symbol)
  );
  await db.batch(stmts);
  invalidateCoinPairsCache();
}

export async function resetEntireDatabase(env: Env, preservedPasswordHash?: string): Promise<void> {
  const db = getDB(env);
  
  // 1. 彻底 DROP 物理表，清除所有自增 ID 序列、数据与索引 (完全等同于重新创建 D1 数据库)
  await db.batch([
    db.prepare('DROP TABLE IF EXISTS positions'),
    db.prepare('DROP TABLE IF EXISTS trade_logs'),
    db.prepare('DROP TABLE IF EXISTS system_logs'),
    db.prepare('DROP TABLE IF EXISTS coin_pairs'),
    db.prepare('DROP TABLE IF EXISTS config'),
  ]);

  // 2. 重新初始化崭新的表结构与索引
  schemaEnsured = false;
  await ensureDbSchema(env);

  // 3. 插入初始默认配置
  const now = Date.now();
  const initStmts = [
    db.prepare('INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)').bind('enabled', 'false', now),
    db.prepare('INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)').bind('okx_api_key', '', now),
    db.prepare('INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)').bind('okx_secret_key', '', now),
    db.prepare('INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)').bind('okx_passphrase', '', now),
  ];

  if (preservedPasswordHash) {
    const sessionSecret = crypto.randomUUID();
    initStmts.push(
      db.prepare('INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)').bind('dashboard_password', preservedPasswordHash, now),
      db.prepare('INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)').bind('auth_session_secret', sessionSecret, now)
    );
  }

  // 4. 记录一条初始重置日志
  initStmts.push(
    db.prepare('INSERT INTO system_logs (type, message, created_at) VALUES (?, ?, ?)')
      .bind('system', '【系统重置完成】D1 数据库所有数据表已彻底销毁并重新初始化，系统恢复至全新部署状态。', now)
  );

  await db.batch(initStmts);
  invalidateConfigCache();
  invalidateCoinPairsCache();
}

export interface GlobalCoinParams {
  leverage: number;
  open_interval_value: number;
  open_interval_unit: string;
  tp_ratio: number;
  sl_ratio: number | null;
  funding_slices: number;
  margin_mode: string;
  profit_transfer_ratio: number;
  smart_volatility_enabled: number;
  min_volatility_threshold: number;
  add_pos_ratio: number;
}

export const DEFAULT_GLOBAL_PARAMS: GlobalCoinParams = {
  leverage: 10,
  open_interval_value: 1,
  open_interval_unit: 'hour',
  tp_ratio: 5,
  sl_ratio: null,
  funding_slices: 10,
  margin_mode: 'isolated',
  profit_transfer_ratio: 0,
  smart_volatility_enabled: 0,
  min_volatility_threshold: 1.0,
  add_pos_ratio: 0,
};

export async function getGlobalDefaultParams(env: Env): Promise<GlobalCoinParams> {
  try {
    await ensureDbSchema(env);
    const db = getDB(env);
    const row = await db.prepare("SELECT value FROM config WHERE key = 'global_default_params'").first<{ value: string }>();
    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      return { ...DEFAULT_GLOBAL_PARAMS, ...parsed };
    }
  } catch (err) {
    console.warn('[DB] getGlobalDefaultParams fallback:', err);
  }
  return { ...DEFAULT_GLOBAL_PARAMS };
}

export async function setGlobalDefaultParams(env: Env, params: Partial<GlobalCoinParams>): Promise<GlobalCoinParams> {
  const current = await getGlobalDefaultParams(env);
  const updated: GlobalCoinParams = { ...current, ...params };
  await ensureDbSchema(env);
  const db = getDB(env);
  const jsonStr = JSON.stringify(updated);
  const now = Date.now();
  await db
    .prepare("INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('global_default_params', ?, ?)")
    .bind(jsonStr, now)
    .run();
  invalidateConfigCache('global_default_params');
  return updated;
}

