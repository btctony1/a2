import type { OKXClient, CoinPair, OKXTicker } from '../types';
import { getCoinPairs, updateCoinPair, insertSystemLog, batchUpdateCoinPairs, batchInsertSystemLogs } from '../db/queries';
import { isCycleTimeout, isSubrequestLimitReached } from '../okx/signer';

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

export async function calculateSingleDirection(
  client: OKXClient,
  coin: CoinPair,
  reason: 'scheduled' | 'immediate' = 'scheduled',
  tickerMap?: Map<string, OKXTicker>
): Promise<DirectionCalculationResult> {
  const parsed = parsePeriod(coin.period) || { value: 1, unit: 'h', bar: '1H', periodMs: 3600000, displayName: '1h' };

  const instId = coin.symbol.endsWith('-SWAP')
    ? coin.symbol
    : (coin.symbol.includes('-') ? (coin.symbol.endsWith('-USDT') ? `${coin.symbol}-SWAP` : coin.symbol) : `${coin.symbol}-USDT-SWAP`);

  const nowTs = Date.now();
  // 拉取最近 6 根 K 线，保证获得充足且连续的历史数据
  const rawCandles = await client.getCandles(instId, parsed.bar, 6);
  if (!rawCandles || rawCandles.length === 0) {
    throw new Error(`OKX 未返回 K 线数据`);
  }

  // 严格过滤有效数据（排除开高低收为 0 的异常脏数据）
  const validCandles = rawCandles.filter((c) => {
    const o = parseFloat(c.o || '0');
    const h = parseFloat(c.h || '0');
    const l = parseFloat(c.l || '0');
    const cp = parseFloat(c.c || '0');
    const ts = Number(c.ts || '0');
    return ts > 0 && o > 0 && h > 0 && l > 0 && cp > 0;
  });

  if (validCandles.length === 0) {
    throw new Error(`K 线数据中无有效报价 (开/收/高/低均为 0)`);
  }

  // 按时间戳从近到远（最新在前）严格排序
  validCandles.sort((a, b) => Number(b.ts) - Number(a.ts));

  // 核心筛选：严格基于时间戳筛选已经完全收盘定型的完结 K 线（开始时间戳 + 周期跨度 <= 当前时间戳）
  const completedCandles = validCandles.filter((c) => {
    const startTs = Number(c.ts);
    return !isNaN(startTs) && (startTs + parsed.periodMs <= nowTs);
  });

  // 兜底保护：若因服务器时钟微小偏差未能直接通过时间戳匹配出完结 K 线，则剔除第 0 根正在生成的未完结 K 线
  if (completedCandles.length === 0) {
    if (validCandles.length > 1) {
      completedCandles.push(...validCandles.slice(1));
    } else {
      completedCandles.push(validCandles[0]);
    }
  }

  // 1. 最近 1 根已完结 K 线 (最靠近当前时间点、收盘价已物理固定的 K 线)
  const prev1 = completedCandles[0];
  const open1 = parseFloat(prev1.o || '0');
  const close1 = parseFloat(prev1.c || '0');
  const high1 = parseFloat(prev1.h || prev1.c || '0');
  const low1 = parseFloat(prev1.l || prev1.c || '0');
  const ts1 = Number(prev1.ts);

  if (open1 <= 0 || close1 <= 0 || high1 <= 0 || low1 <= 0) {
    throw new Error(`完结 K 线数值异常 (开${open1} 收${close1} 高${high1} 低${low1})`);
  }

  // 核心方向研判：严格按照完结 K 线判定（收盘 >= 开盘 为阳线做多，收盘 < 开盘 为阴线做空）
  const isBullish = close1 >= open1;
  const direction: 'long' | 'short' = isBullish ? 'long' : 'short';
  const klineText = isBullish ? '阳线/上涨' : '阴线/下跌';
  const dirText = direction === 'long' ? '做多' : '做空';

  // 2. 智能下单振幅研判：严格基于临近完结的 2 根真实 K 线 (completedCandles[0] 和 completedCandles[1])
  let currentVolatility = 0;
  let volSummaryText = '';
  if (completedCandles.length >= 2) {
    const prev2 = completedCandles[1];
    const high2 = parseFloat(prev2.h || prev2.c || '0');
    const low2 = parseFloat(prev2.l || prev2.c || '0');

    if (high2 > 0 && low2 > 0) {
      const maxHigh = Math.max(high1, high2);
      const minLow = Math.min(low1, low2);
      const basePrice = minLow > 0 ? minLow : open1;
      if (basePrice > 0 && maxHigh >= minLow) {
        currentVolatility = parseFloat((((maxHigh - minLow) / basePrice) * 100).toFixed(2));
        volSummaryText = `当前振幅 ${currentVolatility}% (近2根完结K线: 最高${maxHigh} 最低${minLow})`;
      }
    }
  }

  if (!volSummaryText) {
    // 仅有 1 根完结 K 线时的单根振幅计算
    const basePrice = low1 > 0 ? low1 : open1;
    currentVolatility = parseFloat((((high1 - low1) / basePrice) * 100).toFixed(2));
    volSummaryText = `当前振幅 ${currentVolatility}% (近1根完结K线: 最高${high1} 最低${low1})`;
  }

  // 智能波动过滤与阈值判定
  const minThreshold = (coin.min_volatility_threshold !== undefined && coin.min_volatility_threshold !== null) ? coin.min_volatility_threshold : 1.0;
  const isVolBelow = coin.smart_volatility_enabled && (currentVolatility < minThreshold);
  const volatilityStatus = isVolBelow ? 'paused' : 'active';

  let candleTimeInfo = '';
  if (ts1 > 0) {
    const d = new Date(ts1);
    const iso = d.toISOString().replace('T', ' ').substring(0, 16);
    candleTimeInfo = ` (完结K线: ${iso} UTC)`;
  }

  const reasonText = reason === 'immediate' ? ' (立即生效/参数更新)' : '';
  let smartVolText = '';
  if (coin.smart_volatility_enabled) {
    if (isVolBelow) {
      smartVolText = ` | 智能波动: ${volSummaryText} < 阈值 ${minThreshold}% ⏸️ 自动暂停下单`;
    } else {
      smartVolText = ` | 智能波动: ${volSummaryText} ≥ 阈值 ${minThreshold}% ▶️ 恢复正常下单`;
    }
  }

  const logMessage = `${coin.symbol} [${parsed.bar}周期${candleTimeInfo}]: 最近1根完结K线(${klineText}: 开${open1} 收${close1} 高${high1} 低${low1}) → 判定方向【${dirText}】${reasonText}${smartVolText}`;

  return {
    coin,
    direction,
    currentVolatility,
    volatilityStatus,
    logMessage,
  };
}

export async function executeSingleDirectionCalculation(
  client: OKXClient,
  env: Env,
  coin: CoinPair,
  reason: 'scheduled' | 'immediate' = 'scheduled',
  tickerMap?: Map<string, OKXTicker>
): Promise<'long' | 'short'> {
  const res = await calculateSingleDirection(client, coin, reason, tickerMap);
  const now = Date.now();
  coin.direction = res.direction;
  coin.direction_updated_at = now;
  coin.current_volatility = res.currentVolatility;
  coin.volatility_status = res.volatilityStatus;

  await updateCoinPair(env, coin.symbol, {
    direction: res.direction,
    direction_updated_at: now,
    current_volatility: res.currentVolatility,
    volatility_status: res.volatilityStatus,
  });

  await insertSystemLog(env, 'direction', res.logMessage);
  return res.direction;
}

export async function refreshCoinDirection(
  client: OKXClient,
  env: Env,
  coin: CoinPair,
  reason: 'scheduled' | 'immediate' = 'scheduled',
  tickerMap?: Map<string, OKXTicker>
): Promise<'long' | 'short'> {
  const parsed = parsePeriod(coin.period) || { value: 1, unit: 'h', bar: '1H', periodMs: 3600000, displayName: '1h' };

  try {
    return await executeSingleDirectionCalculation(client, env, coin, reason, tickerMap);
  } catch (firstErr: any) {
    // 首次失败，等待 2200ms 后重试一次
    await new Promise((r) => setTimeout(r, 2200));

    try {
      return await executeSingleDirectionCalculation(client, env, coin, reason, tickerMap);
    } catch (retryErr: any) {
      const errMsg = retryErr?.message || String(retryErr);
      console.warn(`[${coin.symbol}] 获取K线判定方向/波动率重试后仍失败:`, errMsg);

      const fallbackDir = coin.direction || 'long';
      const fallbackDirText = fallbackDir === 'long' ? '做多' : '做空';
      const fallbackVol = coin.current_volatility !== undefined && coin.current_volatility !== null ? coin.current_volatility : 0;

      // 铁律：重试后仍失败绝不更新 direction_updated_at，以便延续到下一个主循环继续执行，直到全部成功！
      await insertSystemLog(
        env,
        'warn',
        `${coin.symbol} [${parsed.bar}周期]: 获取K线判定失败 (2200ms重试后仍失败: ${errMsg})，保持原方向【${fallbackDirText}】与原振幅 ${fallbackVol}%，延续至下一主循环继续执行`
      );

      return fallbackDir;
    }
  }
}

export async function checkDirection(
  client: OKXClient,
  env: Env,
  tickerMap?: Map<string, OKXTicker>,
  cachedCoins?: CoinPair[]
): Promise<void> {
  const coinPairs = cachedCoins || (await getCoinPairs(env));
  const nowTs = Date.now();

  const toRefresh: Array<{ coin: CoinPair; immediate: boolean; parsed: ParsedPeriod }> = [];

  for (const coin of coinPairs) {
    if (!coin.enabled) continue;

    const parsed = parsePeriod(coin.period);
    if (!parsed) continue;

    const lastUpdatedTs = coin.direction_updated_at || 0;
    const needsImmediate = coin.direction === null || lastUpdatedTs === 0;

    // 核心守卫：如果已有有效方向且尚未跨入新的周期边界，100% 走纯内存/数据库命中，0 网络开销
    // 若此前拉取失败未更新 direction_updated_at，此处将持续命中并自动延续到当前主循环执行，直到全部成功
    if (needsImmediate || isPeriodBoundary(nowTs, parsed, lastUpdatedTs)) {
      toRefresh.push({ coin, immediate: needsImmediate, parsed });
    }
  }

  // 绝大部分分钟轮次，没有跨周期的币种，0ms 直接极速返回
  if (toRefresh.length === 0) return;

  // 优先处理从未判定方向的币种
  toRefresh.sort((a, b) => (a.immediate === b.immediate ? 0 : a.immediate ? -1 : 1));

  // 第一轮：批量并发拉取到达周期判定点的所有币种进行判断与研判（纯内存计算，不逐个写库）
  const successfulResults: DirectionCalculationResult[] = [];
  const failedItems: Array<{ coin: CoinPair; immediate: boolean; parsed: ParsedPeriod; firstError: string }> = [];

  await Promise.all(
    toRefresh.map(async (item) => {
      try {
        const res = await calculateSingleDirection(client, item.coin, item.immediate ? 'immediate' : 'scheduled', tickerMap);
        successfulResults.push(res);
      } catch (err: any) {
        failedItems.push({
          ...item,
          firstError: err?.message || String(err),
        });
      }
    })
  );

  // 如果有失败项，在未达到熔断限制时精确等待 2200ms 后对失败币种进行批量重试
  if (failedItems.length > 0 && !isCycleTimeout() && !isSubrequestLimitReached()) {
    await new Promise((r) => setTimeout(r, 2200));

    if (isCycleTimeout() || isSubrequestLimitReached()) {
      return;
    }

    const warnLogs: Array<{ type: string; message: string }> = [];

    await Promise.all(
      failedItems.map(async ({ coin, immediate, parsed, firstError }) => {
        try {
          const res = await calculateSingleDirection(client, coin, immediate ? 'immediate' : 'scheduled', tickerMap);
          successfulResults.push(res);
        } catch (retryErr: any) {
          const errMsg = retryErr?.message || String(retryErr);
          console.warn(`[${coin.symbol}] 批量周期判定2200ms重试后仍失败:`, errMsg);

          const fallbackDir = coin.direction || 'long';
          const fallbackDirText = fallbackDir === 'long' ? '做多' : '做空';
          const fallbackVol = coin.current_volatility !== undefined && coin.current_volatility !== null ? coin.current_volatility : 0;

          // 铁律：重试后仍失败绝不更新 direction_updated_at，以便延续到下一个主循环继续执行，直到全部成功！
          warnLogs.push({
            type: 'warn',
            message: `${coin.symbol} [${parsed.bar}周期]: 获取K线判定失败 (2200ms重试后仍失败: ${errMsg})，保持原方向【${fallbackDirText}】与原振幅 ${fallbackVol}%，延续至下一主循环继续执行`
          });
        }
      })
    );

    if (warnLogs.length > 0) {
      await batchInsertSystemLogs(env, warnLogs);
    }
  }

  // 全局轻量批量写入：所有成功币种合并为 1 次 D1 batch 更新，1 次 D1 batch 插入系统日志
  if (successfulResults.length > 0) {
    const now = Date.now();
    const updatesList = successfulResults.map((res) => {
      // 内存中即时同步，供后续开仓阶段零延迟复用，无需重读 D1
      res.coin.direction = res.direction;
      res.coin.direction_updated_at = now;
      res.coin.current_volatility = res.currentVolatility;
      res.coin.volatility_status = res.volatilityStatus;

      return {
        symbol: res.coin.symbol,
        updates: {
          direction: res.direction,
          direction_updated_at: now,
          current_volatility: res.currentVolatility,
          volatility_status: res.volatilityStatus,
        },
      };
    });

    const logsList = successfulResults.map((res) => ({
      type: 'direction',
      message: res.logMessage,
    }));

    await Promise.all([
      batchUpdateCoinPairs(env, updatesList),
      batchInsertSystemLogs(env, logsList),
    ]);
  }
}

function getPeriodStart(ts: number, parsed: ParsedPeriod): number {
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

function isPeriodBoundary(nowTs: number, parsed: ParsedPeriod, lastUpdatedTs: number): boolean {
  if (lastUpdatedTs === 0) return true;
  const currentPeriodStart = getPeriodStart(nowTs, parsed);
  const lastUpdatedPeriodStart = getPeriodStart(lastUpdatedTs, parsed);
  return currentPeriodStart > lastUpdatedPeriodStart;
}
