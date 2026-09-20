import type { ApiResponse, CoinPair, OKXTicker } from '../types';
import {
  getConfig,
  getCoinPairs,
  updateCoinPair,
  addCoinPair,
  batchAddCoinPairs,
  deleteCoinPair,
  batchDeleteCoinPairs,
  insertSystemLog,
  setConfigValue,
  getConfigValue,
  setConfigValues,
  batchUpdateCoinPairs,
  batchInsertSystemLogs,
  getGlobalDefaultParams,
  setGlobalDefaultParams,
  type GlobalCoinParams
} from '../db/queries';
import {
  refreshCoinDirection,
  calculateSingleDirection,
  parsePeriod,
  getOkxBar,
  formatInstId,
  evaluateHistoricalPeriod,
  type DirectionCalculationResult
} from '../engine/direction';
import { createLiveClient } from '../okx/live-client';
import { getLivePriceMapCached } from './positions';
import { mainLoop } from '../engine/main-loop';
import { preloadAllInstruments, syncFixedRoiFullPositionAlgoOrders } from '../engine/scheduler';

export async function getCoinsHandler(env: Env): Promise<ApiResponse<CoinPair[]>> {
  const coins = await getCoinPairs(env);
  try {
    const livePriceMap = await getLivePriceMapCached(env);
    if (livePriceMap && livePriceMap.size > 0) {
      for (const c of coins) {
        const clean = c.symbol.replace(/-SWAP$/, '').replace(/[\/\-_]/g, '').replace(/USDT$/, '');
        const p = livePriceMap.get(c.symbol) 
          || livePriceMap.get(`${clean}-USDT-SWAP`) 
          || livePriceMap.get(c.symbol.replace('-USDT-SWAP', '')) 
          || livePriceMap.get(clean);
        if (p && p > 0) {
          c.last_price = p;
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
    direction?: string | null;
    funding_amount?: number;
    funding_slices?: number;
    leverage?: number;
    open_interval_value?: number;
    open_interval_unit?: string;
    tp_ratio?: number;
    sl_ratio?: number | null;
    margin_mode?: string;
    profit_transfer_ratio?: number;
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
      funding_slices?: number;
      leverage?: number;
      open_interval_value?: number;
      open_interval_unit?: string;
      tp_ratio?: number;
      sl_ratio?: number | null;
      margin_mode?: string;
      profit_transfer_ratio?: number;
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
      (updates as any).period_start_time = 0;
      (updates as any).cur_open = null;
      (updates as any).cur_high = null;
      (updates as any).cur_low = null;
      (updates as any).cur_close = null;
      (updates as any).prev1_open = null;
      (updates as any).prev1_close = null;
      (updates as any).prev1_high = null;
      (updates as any).prev1_low = null;
      (updates as any).prev2_high = null;
      (updates as any).prev2_low = null;
    }
    if (body.direction !== undefined) {
      updates.direction = body.direction;
      updates.direction_updated_at = body.direction ? Date.now() : 0;
      if (body.direction) {
        await insertSystemLog(
          env,
          'info',
          `${body.symbol} 判定方向已更新为【${body.direction === 'long' ? '做多' : body.direction === 'short' ? '做空' : body.direction}】`
        );
      }
    }
    if (body.funding_amount !== undefined) {
      updates.funding_amount = body.funding_amount;
    }
    if (body.funding_slices !== undefined) {
      updates.funding_slices = body.funding_slices;
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
    if (body.sl_ratio !== undefined) {
      updates.sl_ratio = (body.sl_ratio === null || body.sl_ratio === '' as any || isNaN(Number(body.sl_ratio))) ? null : Number(body.sl_ratio);
    }
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

    if (body.tp_ratio !== undefined || body.sl_ratio !== undefined) {
      const tpDisplay = updates.tp_ratio !== undefined ? `${updates.tp_ratio}%` : '未变';
      const slDisplay = updates.sl_ratio !== undefined ? (updates.sl_ratio === null ? '无止损' : `${updates.sl_ratio}%`) : '未变';
      await insertSystemLog(
        env,
        'info',
        `【止盈止损参数修改】${body.symbol} 更新参数：止盈 [${tpDisplay}]，止损 [${slDisplay}]，正在立即修改对应策略挂单...`
      );
      try {
        await syncFixedRoiFullPositionAlgoOrders(
          liveClient,
          env,
          [`${body.symbol}:long`, `${body.symbol}:short`]
        );
      } catch (algoErr) {
        console.warn(`[updateCoinPairHandler] 触发改单异常:`, algoErr);
      }
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
  body: { symbol?: string; symbols?: string[] }
): Promise<ApiResponse<{ deletedCount: number; message: string }>> {
  try {
    const symbolsToDelete: string[] = [];
    if (body.symbols && Array.isArray(body.symbols) && body.symbols.length > 0) {
      symbolsToDelete.push(...body.symbols);
    } else if (body.symbol && typeof body.symbol === 'string') {
      symbolsToDelete.push(body.symbol);
    }

    const cleanSymbols = Array.from(new Set(symbolsToDelete.map((s) => (s || '').trim().toUpperCase()))).filter(Boolean);
    if (cleanSymbols.length === 0) {
      return { success: false, error: '未指定要删除的币种名称' };
    }

    const count = await batchDeleteCoinPairs(env, cleanSymbols);
    await insertSystemLog(
      env,
      'info',
      `[删除币种] 成功删除 ${count} 个币种: ${cleanSymbols.join(', ')}`
    );

    return {
      success: true,
      data: {
        deletedCount: count,
        message: `成功删除 ${count} 个币种 (${cleanSymbols.map((s) => s.replace('-USDT-SWAP', '')).join(', ')})`,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
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
    const toAddList: Array<{ symbol: string; period?: string }> = [];

    for (const instId of activeInstIds) {
      if (!currentSymbols.has(instId)) {
        toAddList.push({ symbol: instId, period: '' });
        added.push(instId);
      } else {
        existing.push(instId);
      }
    }

    if (toAddList.length > 0) {
      // 1. 底层单次批量事务插入新币种
      await batchAddCoinPairs(env, toAddList);

      // 2. 底层单次批量事务写入系统日志
      const logList = toAddList.map((item) => ({
        type: 'info',
        message: `[币种同步] 从 OKX 实际持仓成功同步导入新币种: ${item.symbol}`,
      }));
      await batchInsertSystemLogs(env, logList).catch(() => {});
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

export async function startAllCoinsHandler(
  env: Env,
  ctx?: { waitUntil?: (p: Promise<any>) => void } | any
): Promise<ApiResponse<{ startedCount: number; message: string }>> {
  try {
    // 1. 只需一次拉取全局参数与所有币种
    const [config, coinPairs] = await Promise.all([
      getConfig(env),
      getCoinPairs(env),
    ]);

    if (!coinPairs || coinPairs.length === 0) {
      return { success: true, data: { startedCount: 0, message: '当前没有代币，请先添加代币' } };
    }

    const apiKey = env.OKX_API_KEY || config.okx_api_key;
    const secretKey = env.OKX_SECRET_KEY || config.okx_secret_key;
    const passphrase = env.OKX_PASSPHRASE || config.okx_passphrase;
    const hasCredentials = Boolean(apiKey && secretKey && passphrase);

    // 2. 批量多币种K线方向研判与智能振幅计算（单次批量获取所有当前周期k线数据包，在内存极速研判）
    const directionResults = new Map<string, DirectionCalculationResult>();
    const coinsToCalc = coinPairs.filter((c) => c.period);

    if (hasCredentials && coinsToCalc.length > 0) {
      const liveClient = createLiveClient(apiKey, secretKey, passphrase, env.OKX_PROXY_URL);

      // 核心铁律：到周期方向判定和智能下单振幅研判执行时，必须延迟2秒后再拉取当前各周期k线数据进行判定和振幅研判
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 单次拉取全量SWAP行情大包快照（1次网络请求，包含全市场几千个合约大包，绝不逐币拉取，杜绝卡死）
      let globalTickerMap: Map<string, OKXTicker> = new Map();
      try {
        globalTickerMap = await liveClient.getTickersByType('SWAP');
      } catch (err) {
        console.warn('[startAllCoinsHandler] 获取SWAP行情大包异常，将在主循环继续重试:', err);
        await insertSystemLog(
          env,
          'warn',
          '【一键启动提示】获取行情大包异常，方向与振幅研判将在下一个主循环周期自动继续重试，直到成功！'
        ).catch(() => {});
      }

      // 纯内存遍历判定，0 网络请求，极速毫秒级完成
      for (const coin of coinsToCalc) {
        try {
          const parsed = parsePeriod(coin.period);
          if (!parsed) continue;

          const okxBar = getOkxBar(parsed);
          const instId = formatInstId(coin.symbol);
          const ticker = globalTickerMap.get(instId) || globalTickerMap.get(coin.symbol);
          const snapshotPrice = ticker?.last ? parseFloat(ticker.last) : (coin.cur_close || 1);

          const prev1Open = coin.prev1_open && coin.prev1_open > 0 ? coin.prev1_open : snapshotPrice;
          const prev1Close = coin.prev1_close && coin.prev1_close > 0 ? coin.prev1_close : snapshotPrice;
          const prev1High = coin.prev1_high && coin.prev1_high > 0 ? coin.prev1_high : snapshotPrice;
          const prev1Low = coin.prev1_low && coin.prev1_low > 0 ? coin.prev1_low : snapshotPrice;
          const prev2High = coin.prev2_high && coin.prev2_high > 0 ? coin.prev2_high : prev1High;
          const prev2Low = coin.prev2_low && coin.prev2_low > 0 ? coin.prev2_low : prev1Low;

          const res = evaluateHistoricalPeriod(
            coin,
            okxBar,
            prev1Open,
            prev1Close,
            prev1High,
            prev1Low,
            prev2High,
            prev2Low,
            'immediate'
          );
          directionResults.set(coin.symbol, res);
        } catch (err) {
          console.warn(`[BatchEnable] ${coin.symbol} 内存方向研判失败:`, err);
        }
      }
    }

    // 3. 批量多币种状态构建 (全部重置 last_open_time = 0 准备立即开单)
    const now = Date.now();
    const updatesList = coinPairs.map((coin) => {
      const dirRes = directionResults.get(coin.symbol);
      const updates: Record<string, any> = {
        enabled: 1,
        last_open_time: 0,
        next_jitter_ms: 0,
      };
      if (dirRes) {
        updates.direction = dirRes.direction;
        updates.direction_updated_at = now;
        updates.current_volatility = dirRes.currentVolatility;
        updates.volatility_status = dirRes.volatilityStatus;
      }
      return {
        symbol: coin.symbol,
        updates,
      };
    });

    // 4. 批量更新数据库 D1 (批量重试保障全部成功)
    let updateSuccess = false;
    let updateRetries = 0;
    while (!updateSuccess && updateRetries < 3) {
      try {
        await batchUpdateCoinPairs(env, updatesList);
        updateSuccess = true;
      } catch (err) {
        updateRetries++;
        if (updateRetries >= 3) throw new Error(`批量更新币种数据失败: ${String(err)}`);
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // 5. 设置全局交易启动开关
    await setConfigValue(env, 'enabled', 'true');

    // 6. 批量写入系统日志（精简为单行合并汇总，避免大量消耗 D1 写入配额）
    const logList: Array<{ type: string; message: string }> = [{
      type: 'info',
      message: `【全部启动】已批量启动全部 ${coinPairs.length} 个代币交易，已就绪立即开单并激活全局交易`,
    }];

    let logSuccess = false;
    let logRetries = 0;
    while (!logSuccess && logRetries < 3) {
      try {
        await batchInsertSystemLogs(env, logList);
        logSuccess = true;
      } catch {
        logRetries++;
        if (logRetries >= 3) break;
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    // 7. 触发首轮主循环巡检与即时开单
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(mainLoop(env));
    } else {
      mainLoop(env).catch((e: any) => console.error('[startAllCoinsHandler] mainLoop error:', e));
    }

    return {
      success: true,
      data: {
        startedCount: coinPairs.length,
        message: `成功批量启动全部 ${coinPairs.length} 个代币交易`,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function stopAllCoinsHandler(
  env: Env
): Promise<ApiResponse<{ stoppedCount: number; message: string }>> {
  try {
    // 1. 只需一次拉取全局参数与所有币种
    const [config, coinPairs] = await Promise.all([
      getConfig(env),
      getCoinPairs(env),
    ]);

    if (!coinPairs || coinPairs.length === 0) {
      await setConfigValue(env, 'enabled', 'false');
      return { success: true, data: { stoppedCount: 0, message: '已停止全局交易' } };
    }

    // 2. 批量多币种状态构建 (关闭所有代币)
    const updatesList = coinPairs.map((coin) => ({
      symbol: coin.symbol,
      updates: {
        enabled: 0,
      },
    }));

    // 3. 批量更新数据库 D1 (批量重试保障全部成功)
    let updateSuccess = false;
    let updateRetries = 0;
    while (!updateSuccess && updateRetries < 3) {
      try {
        await batchUpdateCoinPairs(env, updatesList);
        updateSuccess = true;
      } catch (err) {
        updateRetries++;
        if (updateRetries >= 3) throw new Error(`批量停止币种数据失败: ${String(err)}`);
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // 4. 设置全局交易关闭开关
    await setConfigValue(env, 'enabled', 'false');

    // 5. 批量写入系统日志（精简为单行合并汇总，避免大量消耗 D1 写入配额）
    const logList: Array<{ type: string; message: string }> = [{
      type: 'info',
      message: `【全部停止】已批量停止全部 ${coinPairs.length} 个代币交易，已关闭全局交易`,
    }];

    let logSuccess = false;
    let logRetries = 0;
    while (!logSuccess && logRetries < 3) {
      try {
        await batchInsertSystemLogs(env, logList);
        logSuccess = true;
      } catch {
        logRetries++;
        if (logRetries >= 3) break;
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    return {
      success: true,
      data: {
        stoppedCount: coinPairs.length,
        message: `成功批量停止全部 ${coinPairs.length} 个代币交易`,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * 获取全局币种默认参数
 */
export async function getGlobalParamsHandler(env: Env): Promise<ApiResponse<GlobalCoinParams>> {
  try {
    const params = await getGlobalDefaultParams(env);
    return { success: true, data: params };
  } catch (err: any) {
    return { success: false, error: String(err) };
  }
}

/**
 * 保存全局币种默认参数
 */
export async function saveGlobalParamsHandler(
  env: Env,
  body: Partial<GlobalCoinParams>
): Promise<ApiResponse<GlobalCoinParams>> {
  try {
    const updated = await setGlobalDefaultParams(env, body);
    await insertSystemLog(env, 'info', `[全局参数] 交易默认参数已成功更新并保存`);
    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: String(err) };
  }
}

/**
 * 批量更新指定或全部币种的交易参数
 */
export async function batchUpdateCoinParamsHandler(
  env: Env,
  body: {
    symbols?: string[]; // 为空表示更新当前全部币种
    params: Partial<GlobalCoinParams> & { funding_amount?: number; period?: string };
    saveAsGlobalDefault?: boolean;
  }
): Promise<ApiResponse<{ updatedCount: number; message: string }>> {
  try {
    const allCoins = await getCoinPairs(env);
    if (!allCoins || allCoins.length === 0) {
      return { success: false, error: '当前没有任何代币，请先添加代币' };
    }

    const targetSymbols = new Set(
      body.symbols && body.symbols.length > 0
        ? body.symbols.map((s) => s.trim().toUpperCase())
        : allCoins.map((c) => c.symbol)
    );

    const coinsToUpdate = allCoins.filter((c) => targetSymbols.has(c.symbol));
    if (coinsToUpdate.length === 0) {
      return { success: false, error: '未匹配到需要更新的代币' };
    }

    const { params } = body;
    const cleanUpdates: Record<string, any> = {};

    if (params.funding_amount !== undefined) cleanUpdates.funding_amount = Number(params.funding_amount);
    if (params.funding_slices !== undefined) cleanUpdates.funding_slices = Math.max(1, Number(params.funding_slices));
    if (params.leverage !== undefined) cleanUpdates.leverage = Math.max(1, Number(params.leverage));
    if (params.open_interval_value !== undefined) cleanUpdates.open_interval_value = Math.max(1, Number(params.open_interval_value));
    if (params.open_interval_unit !== undefined) cleanUpdates.open_interval_unit = params.open_interval_unit;
    if (params.tp_ratio !== undefined) cleanUpdates.tp_ratio = Number(params.tp_ratio);
    if (params.sl_ratio !== undefined) {
      cleanUpdates.sl_ratio = (params.sl_ratio === null || params.sl_ratio === '' as any || isNaN(Number(params.sl_ratio))) ? null : Number(params.sl_ratio);
    }
    if (params.margin_mode !== undefined) cleanUpdates.margin_mode = params.margin_mode;
    if (params.profit_transfer_ratio !== undefined) cleanUpdates.profit_transfer_ratio = Number(params.profit_transfer_ratio);
    if (params.smart_volatility_enabled !== undefined) cleanUpdates.smart_volatility_enabled = params.smart_volatility_enabled ? 1 : 0;
    if (params.min_volatility_threshold !== undefined) cleanUpdates.min_volatility_threshold = Number(params.min_volatility_threshold);
    if (params.add_pos_ratio !== undefined) cleanUpdates.add_pos_ratio = Number(params.add_pos_ratio);
    if (params.period !== undefined && params.period) {
      cleanUpdates.period = params.period;
      cleanUpdates.direction = null;
      cleanUpdates.direction_updated_at = 0;
      cleanUpdates.period_start_time = 0;
      cleanUpdates.cur_open = null;
      cleanUpdates.cur_high = null;
      cleanUpdates.cur_low = null;
      cleanUpdates.cur_close = null;
      cleanUpdates.prev1_open = null;
      cleanUpdates.prev1_close = null;
      cleanUpdates.prev1_high = null;
      cleanUpdates.prev1_low = null;
      cleanUpdates.prev2_high = null;
      cleanUpdates.prev2_low = null;
    }

    const updatesList = coinsToUpdate.map((c) => ({
      symbol: c.symbol,
      updates: { ...cleanUpdates },
    }));

    await batchUpdateCoinPairs(env, updatesList);

    if (body.saveAsGlobalDefault) {
      await setGlobalDefaultParams(env, params as any);
    }

    await insertSystemLog(
      env,
      'info',
      `[批量参数设置] 成功为 ${coinsToUpdate.length} 个币种统一设定交易参数${body.saveAsGlobalDefault ? '（并已同步保存为全局默认模板）' : ''}`
    );

    // 止盈止损修改立即直接修改对应的止盈止损挂单
    if (params.tp_ratio !== undefined || params.sl_ratio !== undefined) {
      try {
        const config = await getConfig(env);
        const apiKey = env.OKX_API_KEY || config.okx_api_key;
        const secretKey = env.OKX_SECRET_KEY || config.okx_secret_key;
        const passphrase = env.OKX_PASSPHRASE || config.okx_passphrase;
        if (apiKey && secretKey && passphrase) {
          const liveClient = createLiveClient(apiKey, secretKey, passphrase, env.OKX_PROXY_URL);
          const pairsToSync: string[] = [];
          for (const c of coinsToUpdate) {
            pairsToSync.push(`${c.symbol}:long`, `${c.symbol}:short`);
          }
          await insertSystemLog(
            env,
            'info',
            `【批量改单】已更新止盈止损参数，正在批量修改 ${coinsToUpdate.length} 个币种的策略挂单...`
          );
          await syncFixedRoiFullPositionAlgoOrders(liveClient, env, pairsToSync);
        }
      } catch (algoErr) {
        console.warn('[batchUpdateCoinParamsHandler] 批量修改挂单异常:', algoErr);
      }
    }

    return {
      success: true,
      data: {
        updatedCount: coinsToUpdate.length,
        message: `成功为 ${coinsToUpdate.length} 个币种批量更新交易参数`,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export interface SmartCoinPreviewItem {
  symbol: string;
  cleanSymbol: string;
  currentPrice: number;
  ctVal: number;
  ctValCcy?: string;
  minSz: number;
  lotSz: number;
  rawContracts: number;
  actualContracts: number;
  perSliceContracts?: number; // 单笔/每份开仓张数
  minTotalForSlices?: number; // 满足全部等分所需最低总张数 (等分数 * minSz)
  maxContracts?: number; // 前端兼容别名
  fundingSlices: number;
  initialAmount: number;
  nominalValue: number;
  leverage?: number;
  isExisting: boolean;
}

/**
 * 优选币种在线筛选与预览 (0 逐一开销，全局极速批量计算)
 */
export async function previewSmartCoinsHandler(
  env: Env,
  body: {
    accountBalancePercent?: number; // 默认 10%
    fund_percent?: number;
    funding_slices?: number;        // 等分数，默认 10
    slices?: number;
    manualBalance?: number;         // 手动输入总资金（当未绑定API或模拟测算时使用）
    total_balance?: number;
    totalBal?: number;
    leverage?: number;
    balance_mode?: 'live' | 'manual' | string;
  }
): Promise<
  ApiResponse<{
    accountBalance: number;
    balanceSource: string;
    accountBalancePercent: number;
    initialAmount: number;
    nominalValue: number;
    fundingSlices: number;
    leverage: number;
    totalEligible: number;
    coins: SmartCoinPreviewItem[];
    eligibleCoins: SmartCoinPreviewItem[]; // 保证前后端数据属性完全对齐
  }>
> {
  try {
    const config = await getConfig(env);
    const apiKey = env.OKX_API_KEY || config.okx_api_key;
    const secretKey = env.OKX_SECRET_KEY || config.okx_secret_key;
    const passphrase = env.OKX_PASSPHRASE || config.okx_passphrase;

    // 智能提取用户资金基数（支持 camelCase 及 snake_case 各种前端字段）
    const manualBal = Number(body.manualBalance ?? body.total_balance ?? body.totalBal ?? 0);
    const balanceMode = body.balance_mode || (manualBal > 0 ? 'manual' : 'live');

    let accountBalance = 0;
    let balanceSource = 'manual';
    let liveClient = createLiveClient(apiKey || '', secretKey || '', passphrase || '', env.OKX_PROXY_URL);

    // 若明确选用实盘模式且配置了有效 API Key，优先拉取 OKX 真实账户净资产
    if (balanceMode === 'live' && apiKey && secretKey && passphrase) {
      try {
        const balData = await liveClient.getBalance();
        if (balData && balData.trade_account > 0) {
          accountBalance = balData.trade_account;
          balanceSource = 'live';
        }
      } catch (err) {
        console.warn('[previewSmartCoins] 获取实盘账户资金失败，将尝试使用手动资金基数:', err);
      }
    }

    // 若模式为 manual，或实盘拉取未成功，但前端传递了大于0的手动参考资金，采用该手动资金
    if (accountBalance <= 0 && manualBal > 0) {
      accountBalance = manualBal;
      balanceSource = 'manual';
    }

    // 若依然为空，尝试从系统已保存的配置读取
    if (accountBalance <= 0) {
      const savedManualBal = parseFloat((await getConfigValue(env, 'smart_auto_import_manual_balance')) || '0');
      if (savedManualBal > 0) {
        accountBalance = savedManualBal;
      }
    }

    // 最终兜底
    if (accountBalance <= 0) {
      accountBalance = 100;
    }

    const percent = Math.max(0.1, Math.min(100, Number(body.accountBalancePercent ?? body.fund_percent ?? 10)));
    const fundingSlices = Math.max(1, Math.floor(Number(body.funding_slices ?? body.slices ?? 10)));
    const leverage = Math.max(1, Math.min(125, Number(body.leverage ?? 10)));

    const initialAmount = parseFloat(((accountBalance * percent) / 100).toFixed(4));
    // 依据选定杠杆倍率精准测算名义本金 (初始保证金 * 杠杆倍率)
    const nominalValue = parseFloat((initialAmount * leverage).toFixed(4));

    // 轻量批量请求 1：拉取全量合约信息（受 24H 内存缓存保护，0 额外开销）
    let instrumentsMap = await preloadAllInstruments(liveClient);
    if (instrumentsMap.size === 0) {
      try {
        instrumentsMap = await liveClient.getInstruments('SWAP');
      } catch (e) {
        console.warn('[previewSmartCoins] 单次拉取全量合约规则重试失败:', e);
      }
    }

    // 轻量批量请求 2：单次拉取全量 SWAP Ticker（仅 1 次网络请求获取所有币种价格）
    let tickerMap = new Map<string, OKXTicker>();
    try {
      tickerMap = await liveClient.getTickersByType('SWAP');
    } catch (e) {
      console.warn('[previewSmartCoins] 单次拉取全量Ticker失败:', e);
    }

    if (tickerMap.size === 0) {
      try {
        await new Promise((r) => setTimeout(r, 300));
        tickerMap = await liveClient.getTickersByType('SWAP');
      } catch (retryErr) {
        console.warn('[previewSmartCoins] 重试拉取全量Ticker依然未成功:', retryErr);
      }
    }

    if (tickerMap.size === 0) {
      return {
        success: false,
        error: '未能从 OKX 接口拉取到永续合约行情数据（可能受网络连通性影响），请检查网络连接或稍后重试',
      };
    }

    const currentCoins = await getCoinPairs(env);
    const existingSymbols = new Set(currentCoins.map((c) => c.symbol));

    const matchedList: SmartCoinPreviewItem[] = [];

    for (const [instId, ticker] of tickerMap.entries()) {
      if (!instId.endsWith('-USDT-SWAP')) continue;

      const currentPrice = ticker?.last ? parseFloat(ticker.last) : 0;
      if (!currentPrice || isNaN(currentPrice) || currentPrice <= 0) continue;

      const info = instrumentsMap.get(instId);
      const ctVal = parseFloat(info?.ctVal) || 1;
      const ctValCcy = info?.ctValCcy || 'USDT';
      const minSz = parseFloat(info?.minSz) || 1;
      const lotSz = parseFloat(info?.lotSz) || 1;

      // 1 张合约的 USDT 价值 = ctVal * currentPrice
      const contractValue = ctVal * currentPrice;
      if (contractValue <= 0) continue;

      // 理论最大可开张数 = (名义本金) / (ctVal * 最新价)
      const rawContracts = nominalValue / contractValue;
      // 按照交易所下单最小步长 lotSz 取整
      const actualContracts = Math.floor((rawContracts + 1e-9) / lotSz) * lotSz;
      if (actualContracts <= 0) continue;

      // 计算单笔（每份等分）对应的开仓张数
      const perSliceRaw = actualContracts / fundingSlices;
      const perSliceContracts = Math.floor((perSliceRaw + 1e-9) / lotSz) * lotSz;

      // 核心筛选规则：
      // 1. 每笔单需满足交易所最小下单量 minSz (即 actualContracts >= fundingSlices * minSz)
      // 2. 或总张数满足等分数 (actualContracts >= fundingSlices 或 rawContracts >= fundingSlices)
      // 3. 且实际可开总张数必须大于等于交易所最小下单量 minSz
      const minTotalForSlices = fundingSlices * minSz;
      const canFulfillSlices =
        actualContracts >= minTotalForSlices - 1e-8 ||
        actualContracts >= fundingSlices ||
        rawContracts >= fundingSlices;

      if (canFulfillSlices && actualContracts >= minSz) {
        const cleanSymbol = instId.replace('-USDT-SWAP', '');
        matchedList.push({
          symbol: instId,
          cleanSymbol,
          currentPrice,
          ctVal,
          ctValCcy,
          minSz,
          lotSz,
          rawContracts: parseFloat(rawContracts.toFixed(2)),
          actualContracts,
          perSliceContracts,
          minTotalForSlices,
          maxContracts: actualContracts,
          fundingSlices,
          initialAmount,
          nominalValue,
          leverage,
          isExisting: existingSymbols.has(instId),
        });
      }
    }

    // 按实际可开张数降序排列，可开张数越充裕越稳定
    matchedList.sort((a, b) => b.actualContracts - a.actualContracts);

    return {
      success: true,
      data: {
        accountBalance,
        balanceSource,
        accountBalancePercent: percent,
        initialAmount,
        nominalValue,
        fundingSlices,
        leverage,
        totalEligible: matchedList.length,
        coins: matchedList,
        eligibleCoins: matchedList,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * 优选币种一键导入到币种列表并支持自动启动交易
 */
export async function importSmartCoinsHandler(
  env: Env,
  body: {
    coins: Array<{ symbol: string; period?: string }>;
    params: {
      funding_amount: number;
      funding_slices: number;
      leverage?: number;
      open_interval_value?: number;
      open_interval_unit?: string;
      tp_ratio?: number;
      sl_ratio?: number;
      margin_mode?: string;
      profit_transfer_ratio?: number;
      period?: string;
      smart_volatility_enabled?: number | boolean;
      min_volatility_threshold?: number;
      add_pos_ratio?: number;
      autoStart?: boolean;
    };
  },
  ctx?: { waitUntil?: (p: Promise<any>) => void } | any
): Promise<ApiResponse<{ importedCount: number; autoStarted: boolean; message: string }>> {
  try {
    let coinList = body.coins;
    if ((!coinList || coinList.length === 0) && Array.isArray((body as any).symbols)) {
      coinList = (body as any).symbols.map((sym: string) => ({ symbol: sym }));
    }

    if (!coinList || coinList.length === 0) {
      return { success: false, error: '请选择需要导入的优选币种' };
    }

    const rawParams = body.params || (body as any).default_params || (body as any);
    const fundingAmount = Math.max(1, Number(rawParams.funding_amount || (body as any).initial_amount || 10));
    const fundingSlices = Math.max(1, Number(rawParams.funding_slices || (body as any).funding_slices || 10));
    const leverage = Math.max(1, Number(rawParams.leverage || 10));
    const openIntervalValue = Math.max(1, Number(rawParams.open_interval_value || 1));
    const openIntervalUnit = rawParams.open_interval_unit || 'hour';
    const tpRatio = Number(rawParams.tp_ratio ?? 5);
    const slRatio = (rawParams.sl_ratio !== undefined && rawParams.sl_ratio !== null && (rawParams.sl_ratio as any) !== '' && !isNaN(Number(rawParams.sl_ratio))) ? Number(rawParams.sl_ratio) : null;
    const marginMode = rawParams.margin_mode || 'isolated';
    const profitTransferRatio = Number(rawParams.profit_transfer_ratio ?? 0);
    const defaultPeriod = rawParams.period || '1h';
    const smartVolatilityEnabled = (rawParams.smart_volatility_enabled === 1 || rawParams.smart_volatility_enabled === true) ? 1 : 0;
    const minVolatilityThreshold = Number(rawParams.min_volatility_threshold ?? 1.0);
    const addPosRatio = Number(rawParams.add_pos_ratio ?? 0);
    const autoStart = Boolean(rawParams.autoStart ?? (body as any).auto_start);

    const itemsToInsert = coinList.map((c) => ({
      symbol: c.symbol,
      period: c.period || defaultPeriod,
      funding_amount: fundingAmount,
      funding_slices: fundingSlices,
      leverage,
      open_interval_value: openIntervalValue,
      open_interval_unit: openIntervalUnit,
      tp_ratio: tpRatio,
      sl_ratio: slRatio,
      margin_mode: marginMode,
      profit_transfer_ratio: profitTransferRatio,
      smart_volatility_enabled: smartVolatilityEnabled,
      min_volatility_threshold: minVolatilityThreshold,
      add_pos_ratio: addPosRatio,
      enabled: autoStart ? 1 : 0,
      last_open_time: 0,
    }));

    // 单次批量插入/更新 D1
    await batchAddCoinPairs(env, itemsToInsert);

    if (autoStart) {
      await setConfigValue(env, 'enabled', 'true');
    }

    // 批量记录审计日志（精简合并为单条汇总记录，避免消耗大量 D1 写入配额）
    const syms = itemsToInsert.map((item) => item.symbol).join(', ');
    const logList = [{
      type: 'info',
      message: `【优选币种导入】成功批量导入 ${itemsToInsert.length} 个优选代币 (${syms})，统一配置: ${fundingAmount}U / ${fundingSlices}等分 / ${leverage}X / 模式:${marginMode === 'cross' ? '全仓' : '逐仓'} / 周期:${defaultPeriod}${smartVolatilityEnabled ? ` / 智能下单:${minVolatilityThreshold}%` : ''}${autoStart ? ' (已自动启动交易)' : ' (待手动启动)'}`,
    }];
    await batchInsertSystemLogs(env, logList).catch(() => {});

    if (autoStart) {
      if (ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(mainLoop(env));
      } else {
        mainLoop(env).catch((e: any) => console.error('[importSmartCoins] mainLoop error:', e));
      }
    }

    return {
      success: true,
      data: {
        importedCount: itemsToInsert.length,
        autoStarted: autoStart,
        message: `成功导入 ${itemsToInsert.length} 个优选代币${autoStart ? '并已自动启动交易' : ''}`,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * 获取定时自动优选与导入配置
 */
export async function getSmartConfigHandler(env: Env): Promise<ApiResponse<any>> {
  try {
    const config = await getConfig(env);
    const enabledVal = await getConfigValue(env, 'smart_auto_import_enabled');
    const schedIntervalValVal = await getConfigValue(env, 'smart_auto_import_sched_interval_val');
    const schedIntervalUnitVal = await getConfigValue(env, 'smart_auto_import_sched_interval_unit');
    const intervalHoursVal = await getConfigValue(env, 'smart_auto_import_interval_hours');
    const lastRunVal = await getConfigValue(env, 'smart_auto_import_last_run');
    const fundPctVal = await getConfigValue(env, 'smart_auto_import_fund_pct');
    const slicesVal = await getConfigValue(env, 'smart_auto_import_slices');
    const autoStartVal = await getConfigValue(env, 'smart_auto_import_auto_start');
    const periodVal = await getConfigValue(env, 'smart_auto_import_period');
    const marginModeVal = await getConfigValue(env, 'smart_auto_import_margin_mode');
    const smartVolVal = await getConfigValue(env, 'smart_auto_import_smart_vol');
    const volThresholdVal = await getConfigValue(env, 'smart_auto_import_vol_threshold');
    const addPosVal = await getConfigValue(env, 'smart_auto_import_add_pos_ratio');
    const transferVal = await getConfigValue(env, 'smart_auto_import_profit_transfer');
    const leverageVal = await getConfigValue(env, 'smart_auto_import_leverage');
    const tpRatioVal = await getConfigValue(env, 'smart_auto_import_tp_ratio');
    const slRatioVal = await getConfigValue(env, 'smart_auto_import_sl_ratio');
    const openIntervalVal = await getConfigValue(env, 'smart_auto_import_interval_val');
    const openIntervalUnitVal = await getConfigValue(env, 'smart_auto_import_interval_unit');
    const balanceModeVal = await getConfigValue(env, 'smart_auto_import_balance_mode');
    const manualBalanceVal = await getConfigValue(env, 'smart_auto_import_manual_balance');

    const lastRun = lastRunVal ? Number(lastRunVal) : 0;
    const intervalHours = intervalHoursVal ? Number(intervalHoursVal) : 4;
    let autoImportVal = schedIntervalValVal ? Number(schedIntervalValVal) : 0;
    let autoImportUnit = schedIntervalUnitVal || '';

    if (!autoImportVal || !autoImportUnit) {
      if (intervalHours % 720 === 0 && intervalHours >= 720) {
        autoImportVal = intervalHours / 720;
        autoImportUnit = 'month';
      } else if (intervalHours % 168 === 0 && intervalHours >= 168) {
        autoImportVal = intervalHours / 168;
        autoImportUnit = 'week';
      } else if (intervalHours % 24 === 0 && intervalHours >= 24) {
        autoImportVal = intervalHours / 24;
        autoImportUnit = 'day';
      } else {
        autoImportVal = intervalHours;
        autoImportUnit = 'hour';
      }
    }

    const nextRun = lastRun > 0 && intervalHours > 0 ? lastRun + intervalHours * 3600000 : 0;

    return {
      success: true,
      data: {
        enabled: enabledVal === '1',
        interval_val: autoImportVal,
        interval_unit: autoImportUnit,
        interval_hours: intervalHours,
        last_run: lastRun,
        next_run: nextRun,
        fund_pct: fundPctVal ? Number(fundPctVal) : 10,
        slices: slicesVal ? Number(slicesVal) : 10,
        auto_start: autoStartVal === '1',
        period: periodVal || '1h',
        margin_mode: marginModeVal || 'isolated',
        smart_volatility_enabled: smartVolVal === '1',
        min_volatility_threshold: volThresholdVal ? Number(volThresholdVal) : 1.0,
        add_pos_ratio: addPosVal ? Number(addPosVal) : 0,
        profit_transfer_ratio: transferVal ? Number(transferVal) : 0,
        leverage: leverageVal ? Number(leverageVal) : 10,
        tp_ratio: tpRatioVal ? Number(tpRatioVal) : 5,
        sl_ratio: slRatioVal !== null && slRatioVal !== undefined && slRatioVal !== '' && !isNaN(Number(slRatioVal)) ? Number(slRatioVal) : null,
        open_interval_value: openIntervalVal ? Number(openIntervalVal) : 1,
        open_interval_unit: openIntervalUnitVal || 'hour',
        balance_mode: balanceModeVal || 'live',
        manual_balance: manualBalanceVal ? Number(manualBalanceVal) : 100,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * 保存定时自动优选与导入配置
 */
export async function saveSmartConfigHandler(
  env: Env,
  body: {
    enabled: boolean;
    interval_hours?: number;
    interval_val?: number;
    interval_unit?: string;
    fund_pct: number;
    slices: number;
    auto_start: boolean;
    period: string;
    margin_mode: string;
    smart_volatility_enabled: boolean;
    min_volatility_threshold: number;
    add_pos_ratio: number;
    profit_transfer_ratio: number;
    leverage: number;
    tp_ratio: number;
    sl_ratio?: number | null;
    open_interval_value: number;
    open_interval_unit: string;
    balance_mode?: string;
    manual_balance?: number;
  }
): Promise<ApiResponse<{ message: string }>> {
  try {
    const autoImportUnit = body.interval_unit || 'hour';
    const autoImportVal = Math.max(1, Number(body.interval_val || 1));
    let mult = 1;
    if (autoImportUnit === 'day') mult = 24;
    else if (autoImportUnit === 'week') mult = 168;
    else if (autoImportUnit === 'month') mult = 720;

    let computedHours = autoImportVal * mult;
    if (body.interval_hours && !body.interval_val) {
      computedHours = Number(body.interval_hours);
    }

    const values: Record<string, string> = {
      smart_auto_import_enabled: body.enabled ? '1' : '0',
      smart_auto_import_sched_interval_val: String(autoImportVal),
      smart_auto_import_sched_interval_unit: autoImportUnit,
      smart_auto_import_interval_hours: String(Math.max(0.5, computedHours)),
      smart_auto_import_fund_pct: String(Math.max(0.1, Math.min(100, Number(body.fund_pct || 10)))),
      smart_auto_import_slices: String(Math.max(1, Math.floor(Number(body.slices || 10)))),
      smart_auto_import_auto_start: body.auto_start ? '1' : '0',
      smart_auto_import_period: body.period || '1h',
      smart_auto_import_margin_mode: body.margin_mode || 'isolated',
      smart_auto_import_smart_vol: body.smart_volatility_enabled ? '1' : '0',
      smart_auto_import_vol_threshold: String(Number(body.min_volatility_threshold ?? 1.0)),
      smart_auto_import_add_pos_ratio: String(Number(body.add_pos_ratio ?? 0)),
      smart_auto_import_profit_transfer: String(Number(body.profit_transfer_ratio ?? 0)),
      smart_auto_import_leverage: String(Math.max(1, Number(body.leverage || 10))),
      smart_auto_import_tp_ratio: String(Number(body.tp_ratio ?? 5)),
      smart_auto_import_sl_ratio: (body.sl_ratio !== undefined && body.sl_ratio !== null && (body.sl_ratio as any) !== '' && !isNaN(Number(body.sl_ratio))) ? String(body.sl_ratio) : '',
      smart_auto_import_interval_val: String(Math.max(1, Number(body.open_interval_value || 1))),
      smart_auto_import_interval_unit: body.open_interval_unit || 'hour',
      smart_auto_import_balance_mode: body.balance_mode || 'live',
      smart_auto_import_manual_balance: String(Math.max(1, Number(body.manual_balance || 100))),
    };

    const unitMap: Record<string, string> = { hour: '小时', day: '天', week: '周', month: '月' };
    const unitText = unitMap[autoImportUnit] || '小时';

    await setConfigValues(env, values);
    await insertSystemLog(
      env,
      'info',
      `[定时自动优选配置] 已更新: 定时状态=${body.enabled ? '开启(每' + autoImportVal + unitText + ')' : '关闭'}, 周期=${body.period}, 自动启动交易=${body.auto_start ? '是' : '否'}`
    );

    return {
      success: true,
      data: { message: '定时自动优选与导入设置保存成功！' },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * 执行定时自动优选币种并导入的核心引擎函数
 * force = true 表示手动点击“立即执行一次”
 */
export async function executeSmartAutoImport(
  env: Env,
  force: boolean = false
): Promise<{ success: boolean; importedCount: number; autoStarted: boolean; message: string }> {
  try {
    const enabledVal = await getConfigValue(env, 'smart_auto_import_enabled');
    if (!force && enabledVal !== '1') {
      return { success: true, importedCount: 0, autoStarted: false, message: '定时自动导入未开启' };
    }

    const intervalHours = parseFloat((await getConfigValue(env, 'smart_auto_import_interval_hours')) || '4');
    const lastRun = parseInt((await getConfigValue(env, 'smart_auto_import_last_run')) || '0', 10);
    const now = Date.now();
    const intervalMs = Math.max(1800000, intervalHours * 3600000); // 最少30分钟

    if (!force && lastRun > 0 && now - lastRun < intervalMs) {
      return { success: true, importedCount: 0, autoStarted: false, message: '未到达预定导入时间' };
    }

    // 满足触发条件，开始执行
    const config = await getConfig(env);
    const apiKey = env.OKX_API_KEY || config.okx_api_key;
    const secretKey = env.OKX_SECRET_KEY || config.okx_secret_key;
    const passphrase = env.OKX_PASSPHRASE || config.okx_passphrase;

    const balanceMode = (await getConfigValue(env, 'smart_auto_import_balance_mode')) || 'live';
    const manualBal = parseFloat((await getConfigValue(env, 'smart_auto_import_manual_balance')) || '100');
    let accountBalance = manualBal > 0 ? manualBal : 100;

    let liveClient = createLiveClient(apiKey || '', secretKey || '', passphrase || '', env.OKX_PROXY_URL);

    if (balanceMode === 'live' && apiKey && secretKey && passphrase) {
      try {
        const balData = await liveClient.getBalance();
        if (balData && balData.trade_account > 0) {
          accountBalance = balData.trade_account;
        }
      } catch (err) {
        console.warn('[executeSmartAutoImport] 读取实盘资金失败，使用备用资金基数:', err);
      }
    }

    const fundPct = parseFloat((await getConfigValue(env, 'smart_auto_import_fund_pct')) || '10');
    const slices = parseInt((await getConfigValue(env, 'smart_auto_import_slices')) || '10', 10);
    const autoStart = (await getConfigValue(env, 'smart_auto_import_auto_start')) === '1';
    const period = (await getConfigValue(env, 'smart_auto_import_period')) || '1h';
    const marginMode = (await getConfigValue(env, 'smart_auto_import_margin_mode')) || 'isolated';
    const smartVol = (await getConfigValue(env, 'smart_auto_import_smart_vol')) === '1';
    const volThreshold = parseFloat((await getConfigValue(env, 'smart_auto_import_vol_threshold')) || '1.0');
    const addPosRatio = parseFloat((await getConfigValue(env, 'smart_auto_import_add_pos_ratio')) || '0');
    const profitTransfer = parseFloat((await getConfigValue(env, 'smart_auto_import_profit_transfer')) || '0');
    const leverage = parseInt((await getConfigValue(env, 'smart_auto_import_leverage')) || '10', 10);
    const tpRatio = parseFloat((await getConfigValue(env, 'smart_auto_import_tp_ratio')) || '5');
    const slRatioRaw = await getConfigValue(env, 'smart_auto_import_sl_ratio');
    const slRatio = slRatioRaw !== null && slRatioRaw !== undefined && slRatioRaw !== '' && !isNaN(parseFloat(slRatioRaw)) ? parseFloat(slRatioRaw) : null;
    const intervalVal = parseInt((await getConfigValue(env, 'smart_auto_import_interval_val')) || '1', 10);
    const intervalUnit = (await getConfigValue(env, 'smart_auto_import_interval_unit')) || 'hour';

    const initialAmount = parseFloat(((accountBalance * fundPct) / 100).toFixed(4));
    const nominalValue = parseFloat((initialAmount * leverage).toFixed(4));

    // 拉取全量合约定义和全量行情
    const instrumentsMap = await preloadAllInstruments(liveClient);
    let tickerMap = new Map<string, OKXTicker>();
    try {
      tickerMap = await liveClient.getTickersByType('SWAP');
    } catch (e) {
      console.warn('[executeSmartAutoImport] 拉取行情失败:', e);
    }

    const currentCoins = await getCoinPairs(env);
    const existingSymbols = new Set(currentCoins.map((c) => c.symbol));

    const newEligibleSymbols: string[] = [];

    for (const [instId, ticker] of tickerMap.entries()) {
      if (!instId.endsWith('-USDT-SWAP')) continue;
      if (existingSymbols.has(instId)) continue; // 仅关注全新未添加的币种

      const currentPrice = ticker?.last ? parseFloat(ticker.last) : 0;
      if (!currentPrice || isNaN(currentPrice) || currentPrice <= 0) continue;

      const info = instrumentsMap.get(instId);
      const ctVal = parseFloat(info?.ctVal) || 1;
      const minSz = parseFloat(info?.minSz) || 1;
      const lotSz = parseFloat(info?.lotSz) || 1;

      const contractValue = ctVal * currentPrice;
      if (contractValue <= 0) continue;

      const rawContracts = nominalValue / contractValue;
      const actualContracts = Math.floor((rawContracts + 1e-9) / lotSz) * lotSz;
      if (actualContracts <= 0) continue;

      const minTotalForSlices = slices * minSz;
      const canFulfillSlices =
        actualContracts >= minTotalForSlices - 1e-8 ||
        actualContracts >= slices ||
        rawContracts >= slices;

      if (canFulfillSlices && actualContracts >= minSz) {
        newEligibleSymbols.push(instId);
      }
    }

    // 更新最后执行时间
    await setConfigValue(env, 'smart_auto_import_last_run', String(now));

    if (newEligibleSymbols.length === 0) {
      await insertSystemLog(
        env,
        'info',
        `[定时自动优选] 定时巡检完成: 未发现需新增的优选新合约 (当前资产: ${accountBalance.toFixed(2)}U, 等分: ${slices}份)`
      );
      return {
        success: true,
        importedCount: 0,
        autoStarted: autoStart,
        message: '巡检完成，当前无新增符合条件的合约币种',
      };
    }

    // 构造写入数据
    const itemsToInsert = newEligibleSymbols.map((symbol) => ({
      symbol,
      period,
      funding_amount: initialAmount,
      funding_slices: slices,
      leverage,
      open_interval_value: intervalVal,
      open_interval_unit: intervalUnit,
      tp_ratio: tpRatio,
      sl_ratio: slRatio,
      margin_mode: marginMode,
      profit_transfer_ratio: profitTransfer,
      smart_volatility_enabled: smartVol ? 1 : 0,
      min_volatility_threshold: volThreshold,
      add_pos_ratio: addPosRatio,
      enabled: autoStart ? 1 : 0,
      last_open_time: 0,
    }));

    await batchAddCoinPairs(env, itemsToInsert);

    if (autoStart) {
      await setConfigValue(env, 'enabled', 'true');
    }

    const syms = itemsToInsert.map((item) => item.symbol).join(', ');
    await insertSystemLog(
      env,
      'info',
      `【定时自动优选】成功自动导入 ${itemsToInsert.length} 个全新优选代币 (${syms})，统一配置: ${initialAmount}U / ${slices}等分 / 周期:${period}${smartVol ? ` / 智能下单:${volThreshold}%` : ''}${autoStart ? '【已自动启动交易并纳入自动化调度】' : '【已导入列表，等待手动启动】'}`
    );

    return {
      success: true,
      importedCount: itemsToInsert.length,
      autoStarted: autoStart,
      message: `成功定时导入 ${itemsToInsert.length} 个全新优选代币${autoStart ? '，已自动启动交易' : ''}`,
    };
  } catch (err: any) {
    console.error('[executeSmartAutoImport] 执行异常:', err);
    await insertSystemLog(env, 'error', `[定时自动优选] 执行异常: ${err?.message || String(err)}`);
    return { success: false, importedCount: 0, autoStarted: false, message: err?.message || String(err) };
  }
}

/**
 * 手动立即触发一次定时自动优选导入
 */
export async function runSmartImportNowHandler(
  env: Env,
  ctx?: { waitUntil?: (p: Promise<any>) => void } | any
): Promise<ApiResponse<{ message: string; importedCount: number }>> {
  try {
    const res = await executeSmartAutoImport(env, true);
    if (res.autoStarted && res.importedCount > 0) {
      if (ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(mainLoop(env));
      } else {
        mainLoop(env).catch((e: any) => console.error('[runSmartImportNow] mainLoop error:', e));
      }
    }
    return {
      success: res.success,
      data: {
        message: res.message,
        importedCount: res.importedCount,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * 获取 OKX 账户资产概览 /api/overview
 */
export async function getOverviewHandler(env: Env): Promise<ApiResponse<{
  total_equity: number;
  total_balance: number;
  trade_account: number;
  fund_account: number;
  balance: number;
  currency: string;
}>> {
  try {
    const config = await getConfig(env);
    const apiKey = env.OKX_API_KEY || config.okx_api_key;
    const secretKey = env.OKX_SECRET_KEY || config.okx_secret_key;
    const passphrase = env.OKX_PASSPHRASE || config.okx_passphrase;

    if (!apiKey || !secretKey || !passphrase) {
      return {
        success: false,
        error: '未配置 OKX API Key，请先在上方配置 API 密钥并保存',
      };
    }

    const liveClient = createLiveClient(apiKey, secretKey, passphrase, env.OKX_PROXY_URL);
    const balData = await liveClient.getBalance();
    const tradeBal = balData.trade_account || 0;
    const fundBal = balData.fund_account || 0;
    const total = tradeBal + fundBal;

    return {
      success: true,
      data: {
        total_equity: total,
        total_balance: total,
        trade_account: tradeBal,
        fund_account: fundBal,
        balance: tradeBal > 0 ? tradeBal : total,
        currency: 'USDT',
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || String(err),
    };
  }
}



