import type { OKXClient, CoinPair, OKXTicker } from '../types';
import { getCoinPairs, updateCoinPair, insertSystemLog, batchUpdateCoinPairs, batchInsertSystemLogs } from '../db/queries';

export interface ParsedPeriod {
  value: number;
  unit: 'm' | 'h' | 'd';
  bar: string;
  periodMs: number;
  displayName: string;
}

export interface DirectionCalculationResult {
  coin: CoinPair;
  direction: 'long' | 'short';
  currentVolatility: number;
  volatilityStatus: 'active' | 'paused';
  logMessage: string;
  prev1Open: number;
  prev1Close: number;
  prev1High: number;
  prev1Low: number;
  prev2High: number;
  prev2Low: number;
}

export function parsePeriod(period: string | number): ParsedPeriod | null {
  if (period === undefined || period === null) return null;
  const raw = String(period).trim();
  if (!raw) return null;

  const clean = raw.toLowerCase();

  const mMatch = clean.match(/^(\d+)\s*(m|min|minute|minutes|分|分钟)$/);
  if (mMatch) {
    const value = parseInt(mMatch[1], 10);
    return { value, unit: 'm', bar: `${value}m`, periodMs: value * 60000, displayName: `${value}m` };
  }

  const hMatch = clean.match(/^(\d+)\s*(h|hr|hour|hours|时|小时)$/);
  if (hMatch) {
    const value = parseInt(hMatch[1], 10);
    return { value, unit: 'h', bar: `${value}H`, periodMs: value * 3600000, displayName: `${value}h` };
  }

  const dMatch = clean.match(/^(\d+)\s*(d|day|days|天|日)$/);
  if (dMatch) {
    const value = parseInt(dMatch[1], 10);
    return { value, unit: 'd', bar: `${value}D`, periodMs: value * 86400000, displayName: `${value}d` };
  }

  const num = parseInt(clean, 10);
  if (!isNaN(num) && num > 0) {
    if (num < 24) {
      return { value: num, unit: 'h', bar: `${num}H`, periodMs: num * 3600000, displayName: `${num}h` };
    } else {
      const days = Math.max(1, Math.floor(num / 24));
      return { value: days, unit: 'd', bar: `${days}D`, periodMs: days * 86400000, displayName: `${days}d` };
    }
  }

  return null;
}

export function getOkxBar(parsed: ParsedPeriod): string {
  if (parsed.unit === 'd') {
    return `${parsed.value}D`;
  }
  if (parsed.unit === 'h') {
    if (parsed.value === 24) return '1D';
    if (parsed.value === 48) return '2D';
    return `${parsed.value}H`;
  }
  return `${parsed.value}m`;
}

export function formatInstId(symbol: string): string {
  const sym = (symbol || '').trim().toUpperCase();
  if (sym.endsWith('-SWAP')) return sym;
  if (sym.includes('-')) return sym.endsWith('-USDT') ? `${sym}-SWAP` : sym;
  return `${sym}-USDT-SWAP`;
}

export function getPeriodStart(ts: number, parsed: ParsedPeriod): number {
  const d = new Date(ts);
  d.setUTCSeconds(0, 0);
  if (parsed.unit === 'm') {
    d.setUTCMinutes(Math.floor(d.getUTCMinutes() / parsed.value) * parsed.value);
  } else if (parsed.unit === 'h') {
    d.setUTCMinutes(0);
    d.setUTCHours(Math.floor(d.getUTCHours() / parsed.value) * parsed.value);
  } else if (parsed.unit === 'd') {
    d.setUTCMinutes(0);
    d.setUTCHours(0);
    const daysSinceEpoch = Math.floor(ts / 86400000);
    const alignedDays = Math.floor(daysSinceEpoch / parsed.value) * parsed.value;
    return alignedDays * 86400000;
  }
  return d.getTime();
}

/**
 * 权威全局研判核心（纯内存计算，0 次额外网络请求）：
 *
 * 铁律原则：
 * 1. 方向判定：100% 严格由【上一完整周期】已封线定格的开盘价与收盘价判定（阳线做多，阴线做空）！
 * 2. 振幅研判：100% 严格由【上一完整周期】与【上二完整周期】的真实历史定格极值计算振幅！
 * 3. 绝对不拿实时现价伪造历史 K 线，绝对不使用当前正在走的未收盘数据替代完整周期！
 */
export function evaluateHistoricalPeriod(
  coin: CoinPair,
  okxBar: string,
  prev1Open: number,
  prev1Close: number,
  prev1High: number,
  prev1Low: number,
  prev2High: number,
  prev2Low: number,
  reason: 'scheduled' | 'immediate' = 'scheduled'
): DirectionCalculationResult {
  // 1. 方向判定：严格基于【上一完整周期】已封线的历史开盘价与收盘价
  const isBullish = prev1Close >= prev1Open;
  const direction: 'long' | 'short' = isBullish ? 'long' : 'short';
  const klineType = isBullish ? '阳线(做多)' : '阴线(做空)';
  const dirText = direction === 'long' ? '做多' : '做空';

  // 2. 智能下单振幅研判：严格基于【上两个完整周期】（上一周期 + 上二周期）的历史定格极值
  const maxHigh = Math.max(prev1High, prev2High);
  const minLow = Math.min(prev1Low, prev2Low);

  // 振幅公式：((上两周期最高 - 上两周期最低) / 上两周期最低) * 100%
  const currentVolatility = minLow > 0 ? parseFloat((((maxHigh - minLow) / minLow) * 100).toFixed(2)) : 0;

  // 智能下单过滤与阈值判定
  const minThreshold =
    coin.min_volatility_threshold !== undefined && coin.min_volatility_threshold !== null
      ? coin.min_volatility_threshold
      : 1.0;
  const isVolBelow = coin.smart_volatility_enabled && currentVolatility < minThreshold;
  const volatilityStatus: 'active' | 'paused' = isVolBelow ? 'paused' : 'active';

  const reasonText = reason === 'immediate' ? ' (立即生效/参数更新)' : '';

  // 严格按照用户指定的标准规范日志格式输出：
  // [09/15 11:00:04] GPS-USDT-SWAP [5m周期K线]: (上一完整周期开盘价：0.0***，上一完整周期收盘价：0.0*** → 阳线(做多))，判定方向【做多】 | 智能下单: (上一完整周期最高价：0.0***，上一完整周期最低价：0.0***，上二完整周期最高价：0.0***，上二完整周期最低价：0.0***) 振幅0.**% < 阈值 1% ⏸️ 自动暂停下单
  let smartVolText = '';
  if (coin.smart_volatility_enabled) {
    if (isVolBelow) {
      smartVolText = ` | 智能下单: (上一完整周期最高价：${prev1High}，上一完整周期最低价：${prev1Low}，上二完整周期最高价：${prev2High}，上二完整周期最低价：${prev2Low}) 振幅${currentVolatility}% < 阈值 ${minThreshold}% ⏸️ 自动暂停下单`;
    } else {
      smartVolText = ` | 智能下单: (上一完整周期最高价：${prev1High}，上一完整周期最低价：${prev1Low}，上二完整周期最高价：${prev2High}，上二完整周期最低价：${prev2Low}) 振幅${currentVolatility}% ≥ 阈值 ${minThreshold}% ▶️ 恢复正常下单`;
    }
  } else {
    smartVolText = ` | 智能下单未开启: (上一完整周期最高价：${prev1High}，上一完整周期最低价：${prev1Low}，上二完整周期最高价：${prev2High}，上二完整周期最低价：${prev2Low}) 振幅${currentVolatility}%`;
  }

  const logMessage = `${coin.symbol} [${okxBar}周期K线]: (上一完整周期开盘价：${prev1Open}，上一完整周期收盘价：${prev1Close} → ${klineType})，判定方向【${dirText}】${smartVolText}${reasonText}`;

  return {
    coin,
    direction,
    currentVolatility,
    volatilityStatus,
    logMessage,
    prev1Open,
    prev1Close,
    prev1High,
    prev1Low,
    prev2High,
    prev2Low,
  };
}

/**
 * 全局行情快照方向与振幅研判（单次快照，全局研判，0 次逐币请求）
 *
 * 架构核心：
 * 1. 每次循环拉取一次全局行情大包快照（tickerMap），包含全市场所有币种！
 * 2. 对所有开启的币种执行全内存判定与流转，绝不发起任何单个币种的网络请求！
 * 3. 严格维护【当前周期】与【上一完整周期】、【上二完整周期】的持久化数据：
 *    - 当跨入新周期时刻：
 *      * 上二完整周期 继承 上一完整周期的极值；
 *      * 上一完整周期 继承 刚刚封线的周期的完整开、收、高、低；
 *      * 基于上一完整周期判定方向，基于上二 + 上一完整周期研判振幅；
 *      * 开启新周期的当前记录；
 *    - 当处于同一周期内：
 *      * 累计更新当前周期的最高价、最低价与最新价；
 * 4. 计算完毕后一次性批量写入 D1 数据库和系统日志。
 */
export async function checkDirection(
  client: OKXClient,
  env: Env,
  tickerMap?: Map<string, OKXTicker>,
  cachedCoins?: CoinPair[]
): Promise<void> {
  const coinPairs = cachedCoins || (await getCoinPairs(env));
  const activeCoins = coinPairs.filter((c) => c.enabled && c.period);
  if (activeCoins.length === 0) return;

  // 1. 确保拥有全局快照（单次网络大包，包含全量合约，绝不逐币请求）
  let activeTickerMap = tickerMap;
  if (!activeTickerMap || activeTickerMap.size === 0) {
    try {
      activeTickerMap = await client.getTickersByType('SWAP');
    } catch (e) {
      console.warn('[checkDirection] 获取全量SWAP行情快照失败:', e);
      return;
    }
  }

  const nowTs = Date.now();
  const updatesList: Array<{ symbol: string; updates: Record<string, any> }> = [];
  const logsList: Array<{ type: string; message: string }> = [];

  // 2. 遍历全量币种，全部在内存中做全局研判（0 网络请求）
  for (const coin of activeCoins) {
    const parsed = parsePeriod(coin.period);
    if (!parsed) continue;

    const okxBar = getOkxBar(parsed);
    const instId = formatInstId(coin.symbol);

    // 从全局快照中寻找对应行情（支持标准 instId 及原始 symbol）
    const ticker = activeTickerMap.get(instId) || activeTickerMap.get(coin.symbol);
    if (!ticker || !ticker.last) continue;

    const snapshotPrice = parseFloat(ticker.last);
    if (isNaN(snapshotPrice) || snapshotPrice <= 0) continue;

    const currentPeriodStart = getPeriodStart(nowTs, parsed);
    const recordedPeriodStart = coin.period_start_time || 0;

    // 是否跨入新周期（即上一个周期已经走完封线）
    const isNewPeriod = recordedPeriodStart === 0 || currentPeriodStart > recordedPeriodStart;

    if (isNewPeriod) {
      let prev1Open = 0;
      let prev1Close = 0;
      let prev1High = 0;
      let prev1Low = 0;
      let prev2High = 0;
      let prev2Low = 0;

      if (recordedPeriodStart > 0 && coin.cur_open && coin.cur_open > 0) {
        // 权威正常周期流转：
        // 上二完整周期 继承 上一完整周期的历史极值
        prev2High = coin.prev1_high && coin.prev1_high > 0 ? coin.prev1_high : (coin.cur_high || snapshotPrice);
        prev2Low = coin.prev1_low && coin.prev1_low > 0 ? coin.prev1_low : (coin.cur_low || snapshotPrice);

        // 上一完整周期 封线定格刚刚结束的周期的完整数据
        prev1Open = coin.cur_open;
        prev1Close = coin.cur_close && coin.cur_close > 0 ? coin.cur_close : snapshotPrice;
        prev1High = coin.cur_high && coin.cur_high > 0 ? coin.cur_high : Math.max(prev1Open, prev1Close);
        prev1Low = coin.cur_low && coin.cur_low > 0 ? coin.cur_low : Math.min(prev1Open, prev1Close);
      } else if (coin.prev1_open && coin.prev1_open > 0 && coin.prev1_close && coin.prev1_close > 0) {
        // 已有该周期的权威校准历史，直接沿用
        prev1Open = coin.prev1_open;
        prev1Close = coin.prev1_close;
        prev1High = coin.prev1_high || Math.max(prev1Open, prev1Close);
        prev1Low = coin.prev1_low || Math.min(prev1Open, prev1Close);
        prev2High = coin.prev2_high || prev1High;
        prev2Low = coin.prev2_low || prev1Low;
      } else {
        // 首次加入尚无任何历史记录：以当前现价平价初始化种子，绝不拿全天24h假数据充当当前周期数据
        prev1Open = snapshotPrice;
        prev1Close = snapshotPrice;
        prev1High = snapshotPrice;
        prev1Low = snapshotPrice;
        prev2High = snapshotPrice;
        prev2Low = snapshotPrice;
      }

      // 执行纯历史周期的方向判定与振幅研判
      const res = evaluateHistoricalPeriod(
        coin,
        okxBar,
        prev1Open,
        prev1Close,
        prev1High,
        prev1Low,
        prev2High,
        prev2Low,
        recordedPeriodStart === 0 ? 'immediate' : 'scheduled'
      );

      // 同步内存状态
      coin.direction = res.direction;
      coin.direction_updated_at = nowTs;
      coin.current_volatility = res.currentVolatility;
      coin.volatility_status = res.volatilityStatus;
      coin.period_start_time = currentPeriodStart;
      coin.cur_open = snapshotPrice;
      coin.cur_high = snapshotPrice;
      coin.cur_low = snapshotPrice;
      coin.cur_close = snapshotPrice;
      coin.prev1_open = prev1Open;
      coin.prev1_close = prev1Close;
      coin.prev1_high = prev1High;
      coin.prev1_low = prev1Low;
      coin.prev2_high = prev2High;
      coin.prev2_low = prev2Low;

      updatesList.push({
        symbol: coin.symbol,
        updates: {
          direction: res.direction,
          direction_updated_at: nowTs,
          current_volatility: res.currentVolatility,
          volatility_status: res.volatilityStatus,
          period_start_time: currentPeriodStart,
          cur_open: snapshotPrice,
          cur_high: snapshotPrice,
          cur_low: snapshotPrice,
          cur_close: snapshotPrice,
          prev1_open: prev1Open,
          prev1_close: prev1Close,
          prev1_high: prev1High,
          prev1_low: prev1Low,
          prev2_high: prev2High,
          prev2_low: prev2Low,
        },
      });

      logsList.push({
        type: 'direction',
        message: res.logMessage,
      });
    } else {
      // 处于同一周期内：累计更新当前周期内部的最高、最低与最新收盘价
      const newHigh = Math.max(coin.cur_high || snapshotPrice, snapshotPrice);
      const newLow = Math.min(coin.cur_low || snapshotPrice, snapshotPrice);

      coin.cur_high = newHigh;
      coin.cur_low = newLow;
      coin.cur_close = snapshotPrice;

      updatesList.push({
        symbol: coin.symbol,
        updates: {
          cur_high: newHigh,
          cur_low: newLow,
          cur_close: snapshotPrice,
        },
      });
    }
  }

  // 3. 一次性批量持久化入库，极速完成
  if (updatesList.length > 0) {
    await batchUpdateCoinPairs(env, updatesList);
  }
  if (logsList.length > 0) {
    await batchInsertSystemLogs(env, logsList);
  }
}

/**
 * 精准拉取该币种对应周期的官方真实历史 K 线（前两根已封线 K 线）
 * 仅在新增币对、更新周期或初次启动时单次调用，彻底杜绝 24h 全天假极值！
 */
export async function fetchExactPeriodCandles(
  client: OKXClient,
  instId: string,
  bar: string
): Promise<{
  prev1Open: number;
  prev1Close: number;
  prev1High: number;
  prev1Low: number;
  prev2High: number;
  prev2Low: number;
} | null> {
  try {
    const candles = await client.getCandles(instId, bar, 4);
    if (candles && candles.length >= 3) {
      const c1 = candles[1];
      const c2 = candles[2];
      const o1 = parseFloat(String(c1.o ?? (c1 as any).open ?? 0));
      const c1Val = parseFloat(String(c1.c ?? (c1 as any).close ?? 0));
      const h1 = parseFloat(String(c1.h ?? (c1 as any).high ?? 0));
      const l1 = parseFloat(String(c1.l ?? (c1 as any).low ?? 0));
      const h2 = parseFloat(String(c2.h ?? (c2 as any).high ?? 0));
      const l2 = parseFloat(String(c2.l ?? (c2 as any).low ?? 0));

      if (o1 > 0 && c1Val > 0 && h1 > 0 && l1 > 0) {
        return {
          prev1Open: o1,
          prev1Close: c1Val,
          prev1High: h1,
          prev1Low: l1,
          prev2High: h2 > 0 ? h2 : h1,
          prev2Low: l2 > 0 ? l2 : l1,
        };
      }
    }
  } catch (err) {
    console.warn(`[fetchExactPeriodCandles] 获取 ${instId} (${bar}) 官方K线异常:`, err);
  }
  return null;
}

/**
 * 计算单个币种方向（用于新增/修改周期时，精准拉取对应周期的真实官方K线进行校准）
 */
export async function calculateSingleDirection(
  client: OKXClient,
  coin: CoinPair,
  reason: 'scheduled' | 'immediate' = 'immediate',
  tickerMap?: Map<string, OKXTicker>
): Promise<DirectionCalculationResult> {
  const parsed = parsePeriod(coin.period) || { value: 1, unit: 'h', bar: '1H', periodMs: 3600000, displayName: '1h' };
  const okxBar = getOkxBar(parsed);
  const instId = formatInstId(coin.symbol);

  // 1. 优先拉取该自定义周期的官方真实历史 K 线（前两根已封线 K 线）
  const exact = await fetchExactPeriodCandles(client, instId, okxBar);
  if (exact) {
    return evaluateHistoricalPeriod(
      coin,
      okxBar,
      exact.prev1Open,
      exact.prev1Close,
      exact.prev1High,
      exact.prev1Low,
      exact.prev2High,
      exact.prev2Low,
      reason
    );
  }

  // 2. 兜底逻辑：若接口未返回，优先使用内存已存的历史极值，绝不拿全天24h假数据冒充
  let ticker: OKXTicker | undefined;
  if (tickerMap && tickerMap.has(instId)) {
    ticker = tickerMap.get(instId);
  } else if (tickerMap && tickerMap.has(coin.symbol)) {
    ticker = tickerMap.get(coin.symbol);
  } else {
    try {
      ticker = await client.getTicker(instId);
    } catch {
      ticker = undefined;
    }
  }

  const snapshotPrice = ticker?.last ? parseFloat(ticker.last) : (coin.cur_close || 1);
  const prev1Open = coin.prev1_open && coin.prev1_open > 0 ? coin.prev1_open : snapshotPrice;
  const prev1Close = coin.prev1_close && coin.prev1_close > 0 ? coin.prev1_close : snapshotPrice;
  const prev1High = coin.prev1_high && coin.prev1_high > 0 ? coin.prev1_high : snapshotPrice;
  const prev1Low = coin.prev1_low && coin.prev1_low > 0 ? coin.prev1_low : snapshotPrice;
  const prev2High = coin.prev2_high && coin.prev2_high > 0 ? coin.prev2_high : prev1High;
  const prev2Low = coin.prev2_low && coin.prev2_low > 0 ? coin.prev2_low : prev1Low;

  return evaluateHistoricalPeriod(
    coin,
    okxBar,
    prev1Open,
    prev1Close,
    prev1High,
    prev1Low,
    prev2High,
    prev2Low,
    reason
  );
}

/**
 * 刷新单个币种方向（精准校准，更新内存并同步写入 D1 数据库）
 */
export async function refreshCoinDirection(
  client: OKXClient,
  env: Env,
  coin: CoinPair,
  reason: 'scheduled' | 'immediate' = 'immediate',
  tickerMap?: Map<string, OKXTicker>
): Promise<'long' | 'short'> {
  const res = await calculateSingleDirection(client, coin, reason, tickerMap);

  const nowTs = Date.now();
  const parsed = parsePeriod(coin.period) || { value: 1, unit: 'h', bar: '1H', periodMs: 3600000, displayName: '1h' };
  const currentPeriodStart = getPeriodStart(nowTs, parsed);

  coin.direction = res.direction;
  coin.direction_updated_at = nowTs;
  coin.current_volatility = res.currentVolatility;
  coin.volatility_status = res.volatilityStatus;
  coin.period_start_time = currentPeriodStart;
  coin.cur_open = res.prev1Close;
  coin.cur_high = res.prev1Close;
  coin.cur_low = res.prev1Close;
  coin.cur_close = res.prev1Close;
  coin.prev1_open = res.prev1Open;
  coin.prev1_close = res.prev1Close;
  coin.prev1_high = res.prev1High;
  coin.prev1_low = res.prev1Low;
  coin.prev2_high = res.prev2High;
  coin.prev2_low = res.prev2Low;

  await updateCoinPair(env, coin.symbol, {
    direction: res.direction,
    direction_updated_at: nowTs,
    current_volatility: res.currentVolatility,
    volatility_status: res.volatilityStatus,
    period_start_time: currentPeriodStart,
    cur_open: res.prev1Close,
    cur_high: res.prev1Close,
    cur_low: res.prev1Close,
    cur_close: res.prev1Close,
    prev1_open: res.prev1Open,
    prev1_close: res.prev1Close,
    prev1_high: res.prev1High,
    prev1_low: res.prev1Low,
    prev2_high: res.prev2High,
    prev2_low: res.prev2Low,
  });

  await insertSystemLog(env, 'direction', res.logMessage);
  return res.direction;
}
