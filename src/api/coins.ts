import type { ApiResponse, CoinPair, TimeoutUnit } from '../types';
import { getConfig, getCoinPairs, updateCoinPair, addCoinPair, deleteCoinPair, insertSystemLog, setConfigValue } from '../db/queries';
import { refreshCoinDirection } from '../engine/direction';
import { createLiveClient } from '../okx/live-client';

export async function getCoinsHandler(env: Env): Promise<ApiResponse<CoinPair[]>> {
  const coins = await getCoinPairs(env);
  try {
    const config = await getConfig(env);
    const apiKey = env.OKX_API_KEY || config.okx_api_key || '';
    const secretKey = env.OKX_SECRET_KEY || config.okx_secret_key || '';
    const passphrase = env.OKX_PASSPHRASE || config.okx_passphrase || '';
    const client = createLiveClient(apiKey, secretKey, passphrase, env.OKX_PROXY_URL);
    const tickers = await client.getTickersByType('SWAP');
    if (tickers && tickers.size > 0) {
      for (const c of coins) {
        const clean = c.symbol.replace(/-SWAP$/, '').replace(/[\/\-_]/g, '').replace(/USDT$/, '');
        const ticker = tickers.get(c.symbol) 
          || tickers.get(`${clean}-USDT-SWAP`) 
          || tickers.get(c.symbol.replace('-USDT-SWAP', '')) 
          || tickers.get(clean);
        if (ticker?.last) {
          const p = parseFloat(ticker.last);
          if (p > 0) {
            c.last_price = p;
          }
        }
      }
    }
  } catch (e) {
    // 降级使用数据库已存的价格
  }
  return { success: true, data: coins };
}

export async function updateCoinHandler(
  env: Env,
  body: {
    symbol: string;
    enabled?: boolean;
    pause_open?: boolean;
    period?: string;
    funding_amount?: number;
    leverage?: number;
    open_interval_value?: number;
    open_interval_unit?: TimeoutUnit;
    tp_ratio?: number;
    sl_ratio?: number;
    timeout_value?: number;
    timeout_unit?: TimeoutUnit;
    margin_mode?: string;
    profit_transfer_ratio?: number;
    disable_timeout?: boolean;
    smart_volatility_enabled?: boolean;
    min_volatility_threshold?: number;
    add_pos_ratio?: number;
  }
): Promise<ApiResponse<{ funding_amount?: number }>> {
  try {
    const updates: {
      enabled?: number;
      pause_open?: number;
      period?: string;
      direction?: string | null;
      direction_updated_at?: number;
      funding_amount?: number;
      leverage?: number;
      open_interval_value?: number;
      open_interval_unit?: TimeoutUnit;
      tp_ratio?: number;
      sl_ratio?: number;
      timeout_value?: number;
      timeout_unit?: TimeoutUnit;
      margin_mode?: string;
      profit_transfer_ratio?: number;
      disable_timeout?: number;
      smart_volatility_enabled?: number;
      min_volatility_threshold?: number;
      add_pos_ratio?: number;
      last_open_time?: number;
      next_jitter_ms?: number;
    } = {};

    if (body.enabled !== undefined) {
      updates.enabled = body.enabled ? 1 : 0;
      if (body.enabled) {
        updates.last_open_time = 0;
        updates.next_jitter_ms = 0;
        await setConfigValue(env, 'enabled', 'true');
      }
      await insertSystemLog(
        env,
        'info',
        `${body.symbol} ${body.enabled ? '已独立启动自动交易 (已就绪立即开单)' : '已独立停止自动交易'}`
      );
    }
    if (body.disable_timeout !== undefined) {
      updates.disable_timeout = body.disable_timeout ? 1 : 0;
      await insertSystemLog(
        env,
        'info',
        `${body.symbol} ${body.disable_timeout ? '已开启免超时平仓' : '已关闭免超时平仓'}`
      );
    }
    if (body.pause_open !== undefined) {
      updates.pause_open = body.pause_open ? 1 : 0;
      await insertSystemLog(
        env,
        'info',
        `${body.symbol} ${body.pause_open ? '已暂停自动下单 (保留方向判断与持仓监控)' : '已恢复自动下单'}`
      );
    }
    if (body.period !== undefined) {
      updates.period = body.period;
      updates.direction = null;
      updates.direction_updated_at = 0;
    }
    if (body.funding_amount !== undefined) {
      updates.funding_amount = body.funding_amount;
    }
    if (body.leverage !== undefined) {
      updates.leverage = body.leverage;
    }
    if (body.open_interval_value !== undefined) {
      updates.open_interval_value = body.open_interval_value;
    }
    if (body.open_interval_unit !== undefined) {
      updates.open_interval_unit = body.open_interval_unit;
    }
    if (body.tp_ratio !== undefined) updates.tp_ratio = body.tp_ratio;
    if (body.sl_ratio !== undefined) updates.sl_ratio = body.sl_ratio;
    if (body.timeout_value !== undefined) updates.timeout_value = body.timeout_value;
    if (body.timeout_unit !== undefined) updates.timeout_unit = body.timeout_unit;
    if (body.margin_mode !== undefined) updates.margin_mode = body.margin_mode;
    if (body.profit_transfer_ratio !== undefined) updates.profit_transfer_ratio = body.profit_transfer_ratio;
    if (body.smart_volatility_enabled !== undefined) {
      updates.smart_volatility_enabled = body.smart_volatility_enabled ? 1 : 0;
      await insertSystemLog(
        env,
        'info',
        `${body.symbol} ${body.smart_volatility_enabled ? '已开启智能波动过滤(波动低于设定阈值自动暂停下单)' : '已关闭智能波动过滤'}`
      );
    }
    if (body.min_volatility_threshold !== undefined) {
      updates.min_volatility_threshold = body.min_volatility_threshold;
    }
    if (body.add_pos_ratio !== undefined) {
      updates.add_pos_ratio = body.add_pos_ratio;
    }

    await updateCoinPair(env, body.symbol, updates);

    const config = await getConfig(env);
    const apiKey = env.OKX_API_KEY || config.okx_api_key;
    const secretKey = env.OKX_SECRET_KEY || config.okx_secret_key;
    const passphrase = env.OKX_PASSPHRASE || config.okx_passphrase;
    const liveClient = createLiveClient(apiKey, secretKey, passphrase, env.OKX_PROXY_URL);
    const coin = (await getCoinPairs(env)).find((item) => item.symbol === body.symbol);
    if (!coin) {
      return { success: false, error: 'Coin not found after update' };
    }

    try {
      await refreshCoinDirection(liveClient, env, coin, 'immediate');
    } catch {
      // 忽略方向刷新错误
    }

    return { success: true, data: { funding_amount: coin.funding_amount } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function retryCoinHandler(
  env: Env,
  body: { symbol: string }
): Promise<ApiResponse<null>> {
  try {
    const config = await getConfig(env);
    const apiKey = env.OKX_API_KEY || config.okx_api_key;
    const secretKey = env.OKX_SECRET_KEY || config.okx_secret_key;
    const passphrase = env.OKX_PASSPHRASE || config.okx_passphrase;
    const liveClient = createLiveClient(apiKey, secretKey, passphrase, env.OKX_PROXY_URL);

    // Get existing coin
    let coin = (await getCoinPairs(env)).find((item) => item.symbol === body.symbol);
    if (!coin) {
      return { success: false, error: 'Coin not found' };
    }

    // Reset runtime states, preserve configuration
    await updateCoinPair(env, body.symbol, {
      enabled: 1,
      pause_open: 0,
      last_open_time: 0,
      next_jitter_ms: 0,
      direction: null,
      direction_updated_at: 0
    });

    // Refresh coin state
    coin = (await getCoinPairs(env)).find((item) => item.symbol === body.symbol);
    if (coin) {
      // Refresh direction immediately
      try {
        await refreshCoinDirection(liveClient, env, coin, 'immediate');
      } catch {
        // 忽略
      }
    }

    await insertSystemLog(
      env,
      'open',
      `[API] 手动触发重试: ${body.symbol}, 状态已重置`
    );

    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function addCoinHandler(
  env: Env,
  body: { symbol: string; period?: string }
): Promise<ApiResponse<null>> {
  try {
    let symbol = body.symbol.trim().toUpperCase();
    if (!symbol) return { success: false, error: '请输入代币符号' };
    if (!symbol.includes('-')) {
      symbol = `${symbol}-USDT-SWAP`;
    }
    if (!symbol.endsWith('-USDT-SWAP')) {
      return { success: false, error: '合约格式应为 XXX-USDT-SWAP' };
    }
    await addCoinPair(env, symbol, body.period || '');
    await insertSystemLog(env, 'info', `[币种管理] 新增币种 ${symbol}，当前处于停止交易状态(未配置默认参数)`);
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function deleteCoinHandler(
  env: Env,
  body: { symbol: string }
): Promise<ApiResponse<null>> {
  try {
    await deleteCoinPair(env, body.symbol);
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function syncOkxCoinsHandler(
  env: Env
): Promise<ApiResponse<{ added: string[]; existing: string[]; total: number }>> {
  try {
    const config = await getConfig(env);
    const apiKey = env.OKX_API_KEY || config.okx_api_key;
    const secretKey = env.OKX_SECRET_KEY || config.okx_secret_key;
    const passphrase = env.OKX_PASSPHRASE || config.okx_passphrase;

    if (!apiKey || !secretKey || !passphrase) {
      return { success: false, error: 'OKX API 密钥未配置，请先在右上角保存 API Key' };
    }

    const liveClient = createLiveClient(apiKey, secretKey, passphrase, env.OKX_PROXY_URL);
    const rawPositions = await liveClient.getPositions();

    // 筛选所有有实际持仓的合约 (pos !== '0' 且 pos !== '')
    const activeInstIds = Array.from(
      new Set(
        rawPositions
          .filter((p) => p.instId && parseFloat(p.pos) !== 0)
          .map((p) => p.instId.trim().toUpperCase())
      )
    );

    if (activeInstIds.length === 0) {
      return {
        success: true,
        data: { added: [], existing: [], total: 0 },
        message: 'OKX 交易所当前无活跃持仓合约'
      };
    }

    const currentCoins = await getCoinPairs(env);
    const currentSymbols = new Set(currentCoins.map((c) => c.symbol));

    const added: string[] = [];
    const existing: string[] = [];

    for (const instId of activeInstIds) {
      if (!currentSymbols.has(instId)) {
        await addCoinPair(env, instId, '');
        added.push(instId);
        await insertSystemLog(
          env,
          'info',
          `[币种同步] 从 OKX 实际持仓成功同步导入新币种: ${instId}`
        );
      } else {
        existing.push(instId);
      }
    }

    return {
      success: true,
      data: {
        added,
        existing,
        total: activeInstIds.length
      }
    };
  } catch (err) {
    return { success: false, error: `同步 OKX 持仓币种失败: ${String(err)}` };
  }
}
