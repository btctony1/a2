-- 数据库自动平滑升级脚本（幂等执行，兼容已存在的列）
ALTER TABLE coin_pairs ADD COLUMN smart_volatility_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE coin_pairs ADD COLUMN min_volatility_threshold REAL DEFAULT 1.0;
ALTER TABLE coin_pairs ADD COLUMN current_volatility REAL DEFAULT 0;
ALTER TABLE coin_pairs ADD COLUMN volatility_status TEXT DEFAULT 'active';
