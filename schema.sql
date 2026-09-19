CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS coin_pairs (
  symbol TEXT PRIMARY KEY,
  period TEXT NOT NULL DEFAULT '1h',
  direction TEXT,
  direction_updated_at INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 0,
  funding_amount REAL DEFAULT 0,
  last_open_time INTEGER DEFAULT 0,
  next_jitter_ms INTEGER DEFAULT 0,
  pause_open INTEGER DEFAULT 0,
  leverage INTEGER DEFAULT 10,
  tp_ratio REAL DEFAULT 5,
  sl_ratio REAL DEFAULT 5,
  timeout_value INTEGER DEFAULT 4,
  timeout_unit TEXT DEFAULT 'hour',
  open_interval_value INTEGER DEFAULT 1,
  open_interval_unit TEXT DEFAULT 'hour',
  margin_mode TEXT DEFAULT 'isolated',
  profit_transfer_ratio REAL DEFAULT 0,
  disable_timeout INTEGER DEFAULT 0,
  smart_volatility_enabled INTEGER DEFAULT 0,
  min_volatility_threshold REAL DEFAULT 1.0,
  current_volatility REAL DEFAULT 0,
  volatility_status TEXT DEFAULT 'active'
);

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
);

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
);

CREATE TABLE IF NOT EXISTS system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_symbol_status ON positions(symbol, status);
CREATE INDEX IF NOT EXISTS idx_trade_logs_close_time ON trade_logs(close_time);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
