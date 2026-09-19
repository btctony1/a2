import type { OKXClient, TimeoutUnit, CoinPair, OKXTicker, OKXPosition, Position } from '../types';
import {
  getConfig,
  getCoinPairs,
  getOpenPositions,
  getOpenPositionsBySymbol,
  hasPositionInRecentMs,
  insertPosition,
  insertSystemLog,
  setConfigValue,
  updateCoinPair,
  getConfigValue,
  batchUpdateCoinPairs,
  batchInsertPositions,
  batchInsertSystemLogs,
} from '../db/queries';
import { getCleanSymbol } from './monitor';
import { refreshCoinDirection } from './direction';
import { triggerCircuitBreak, isCycleTimeout, isSubrequestLimitReached } from '../okx/signer';
import { OPEN_POSITION_JITTER_MS, MARGIN_JITTER_PERCENT, MAX_ORDER_RETRIES, ORDER_FAILURE_CIRCUIT_BREAK_MS } from '../constants';

function intervalToMs(value: number, unit: any): number {
  const v = typeof value === 'number' && !isNaN(value) && value > 0 ? value : 1;
  if (!unit) return v * 3600000;
  const u = String(unit).toLowerCase().trim();
  if (u === 'd' || u === 'day' || u === 'days') return v * 86400000;
  if (u === 'h' || u === 'hour' || u === 'hours') return v * 3600000;
  if (u === 'm' || u === 'min' || u === 'minute' || u === 'minutes') return v * 60000;
  if (u === 's' || u === 'sec' || u === 'second' || u === 'seconds') return v * 1000;
  return v * 3600000;
}

function computeFundingSlices(
  timeoutValue?: number | null,
  timeoutUnit?: any,
  intervalValue?: number | null,
  intervalUnit?: any
): number {
  if (!timeoutValue || !intervalValue) return 1;
  const timeoutMs = intervalToMs(timeoutValue, timeoutUnit);
  const intervalMs = intervalToMs(intervalValue, intervalUnit);
  if (intervalMs <= 0) return 1;
  return Math.max(1, Math.floor(timeoutMs / intervalMs));
}

function getTickDecimals(tickSz: string): number {
  if (!tickSz) return 4;
  const num = parseFloat(tickSz);
  if (isNaN(num) || num <= 0) return 4;
  const str = tickSz.includes('e-') ? num.toFixed(10).replace(/0+$/, '') : tickSz;
  const parts = str.split('.');
  return parts.length > 1 ? parts[1].length : 0;
}

export function formatPriceToTick(
  value: number,
  tickSz: string,
  direction: 'up' | 'down' | 'nearest' = 'nearest'
): string {
  const tickNum = parseFloat(tickSz);
  if (!tickNum || isNaN(tickNum) || tickNum <= 0 || !value || value <= 0) {
    return value > 0 ? value.toString() : '0';
  }
  const decimals = getTickDecimals(tickSz);
  const multiplier = Math.pow(10, decimals);
  const stepInt = Math.round(tickNum * multiplier);
  const priceInt = Math.round(value * multiplier);

  if (stepInt <= 0) {
    return value.toFixed(decimals);
  }

  let targetInt: number;
  if (direction === 'up') {
    targetInt = Math.ceil(priceInt / stepInt) * stepInt;
  } else if (direction === 'down') {
    targetInt = Math.floor(priceInt / stepInt) * stepInt;
  } else {
    targetInt = Math.round(priceInt / stepInt) * stepInt;
  }

  const result = targetInt / multiplier;
  return result.toFixed(decimals);
}

function alignPrice(value: number, tickSz: string, direction: 'up' | 'down'): number {
  return parseFloat(formatPriceToTick(value, tickSz, direction));
}

const memoryInstCache = new Map<string, any>();
let cachedAllInstrumentsMap: Map<string, any> | null = null;
let lastInstrumentsPreloadTime = 0;
const INSTRUMENTS_CACHE_TTL_MS = 24 * 3600 * 1000; // 24小时内存缓存

const memoryLeverageVerifiedMap = new Map<string, string>();
const memoryVolPauseLoggedMap = new Map<string, string>();
const memoryAddPosSkipLoggedMap = new Map<string, string>();
const memoryAlgoStateCache = new Map<string, { algoId?: string; tpTriggerPx?: string; slTriggerPx?: string }>();

export function clearAlgoStateCache(algoStateKey: string): void {
  memoryAlgoStateCache.delete(algoStateKey);
}

/**
 * 统一发起 1 次批量请求，预加载 OKX 全部 SWAP 合约的交易规则（ctVal, lotSz, minSz, tickSz）
 * 24 小时内存缓存，避免每分钟循环重复请求 OKX 接口消耗子请求
 */
export async function preloadAllInstruments(client: OKXClient): Promise<Map<string, any>> {
  const now = Date.now();
  if (cachedAllInstrumentsMap && cachedAllInstrumentsMap.size > 0 && (now - lastInstrumentsPreloadTime < INSTRUMENTS_CACHE_TTL_MS)) {
    return cachedAllInstrumentsMap;
  }
  try {
    const map = await client.getInstruments('SWAP');
    if (map && map.size > 0) {
      cachedAllInstrumentsMap = map;
      lastInstrumentsPreloadTime = now;
      for (const [sym, info] of map.entries()) {
        memoryInstCache.set(sym, info);
      }
      return map;
    }
  } catch (err) {
    console.warn(`[InstrumentInfo] 批量预拉取全量合约规则失败:`, err);
  }
  return cachedAllInstrumentsMap || new Map();
}

/**
 * 重置调度器短期状态缓存（保留稳定合约规则与杠杆缓存，防止每分钟重复请求）
 */
export function resetSchedulerMemoryState(): void {
  const now = Date.now();
  if (now - lastInstrumentsPreloadTime > INSTRUMENTS_CACHE_TTL_MS) {
    cachedAllInstrumentsMap = null;
    memoryInstCache.clear();
  }
}

export async function getInstrumentInfoCached(env: Env, client: OKXClient, symbol: string, forceRefresh = false) {
  if (!forceRefresh && memoryInstCache.has(symbol)) {
    const cachedMem = memoryInstCache.get(symbol);
    if (cachedMem && parseFloat(cachedMem.ctVal) > 0 && parseFloat(cachedMem.minSz) > 0) {
      return cachedMem;
    }
  }
  try {
    const info = await client.getInstrumentInfo(symbol, true);
    if (info && parseFloat(info.ctVal) > 0 && parseFloat(info.minSz) > 0) {
      memoryInstCache.set(symbol, info);
      return info;
    }
  } catch (err) {
    console.warn(`[InstrumentInfo] 获取 ${symbol} 合约面值信息失败，本次使用临时兜底:`, err);
  }
  // 临时兜底
  return { ctVal: "1", lotSz: "1", minSz: "1", tickSz: "0.0001" };
}

interface PreparedOrder {
  coin: CoinPair;
  direction: 'long' | 'short';
  isFirstOrder: boolean;
  currentPrice: number;
  actualMargin: number;
  leverage: number;
  marginMode: string;
  side: 'buy' | 'sell';
  ctVal: number;
  minSz: number;
  lotSz: number;
  tickSz: string;
  sz: string;
  executedContracts: number;
  tpRatioPct: number;
  slRatioPct: number;
  orderParam: import('../types').OrderParams;
}

export async function openPosition(
  client: OKXClient,
  env: Env,
  tickerMap?: Map<string, OKXTicker>,
  prefetchedPositions?: OKXPosition[],
  cachedCoins?: CoinPair[]
): Promise<Set<string>> {
  const affectedPairs = new Set<string>();
  const coinPairs = cachedCoins || (await getCoinPairs(env));
  const candidateCoins = coinPairs.filter((c) => c.enabled && !c.pause_open);
  if (candidateCoins.length === 0) return affectedPairs;

  const allOpenDbPositions = await getOpenPositions(env);
  const now = Date.now();

  // 1. 下单前准备：发起 1 次统一批量请求预加载全量 SWAP 合约面值与交易规则
  const instrumentsMap = await preloadAllInstruments(client);

  // 确保批量行情数据就绪（若未传入则单次批量获取全量 SWAP 行情）
  let activeTickerMap = tickerMap;
  if (!activeTickerMap || activeTickerMap.size === 0) {
    try {
      activeTickerMap = await client.getTickersByType('SWAP');
    } catch (e) {
      console.warn('[openPosition] 批量获取行情失败:', e);
      activeTickerMap = new Map();
    }
  }

  // 确保持仓数据就绪（若未传入则单次批量获取全量持仓）
  let activePositions = prefetchedPositions;
  if (!activePositions) {
    try {
      activePositions = await client.getPositions();
    } catch (e) {
      console.warn('[openPosition] 批量预拉取持仓失败:', e);
      activePositions = [];
    }
  }

  // 2. 批量并发预设/校验杠杆（仅针对杠杆发生变更的币种执行，内存缓存校验，0 D1写入）
  const leverageTasks: Array<Promise<void>> = [];
  for (const coin of candidateCoins) {
    if (coin.direction && coin.leverage && coin.leverage > 0) {
      const marginMode = coin.margin_mode || 'isolated';
      const levKey = `lev_${coin.symbol}_${marginMode}_${coin.direction}`;
      const targetLev = String(coin.leverage);
      if (memoryLeverageVerifiedMap.get(levKey) !== targetLev) {
        leverageTasks.push(
          (async () => {
            try {
              await client.setLeverage(coin.symbol, coin.leverage!, marginMode, coin.direction || undefined);
              memoryLeverageVerifiedMap.set(levKey, targetLev);
            } catch (levErr) {
              console.warn(`[Leverage] setLeverage failed for ${coin.symbol}:`, levErr);
            }
          })()
        );
      }
    }
  }
  if (leverageTasks.length > 0) {
    await Promise.all(leverageTasks);
  }

  const readyToOrder: PreparedOrder[] = [];

  // 3. 内存中批量并发/极速遍历所有候选币种完成纯计算（0 额外网络开销）
  for (const coin of candidateCoins) {
    try {
      // 兜底保障：若该币种方向为空或尚未成功判定，立即补充触发一次方向判定
      if (!coin.direction && coin.period) {
        try {
          const dir = await refreshCoinDirection(client, env, coin, 'immediate', activeTickerMap);
          coin.direction = dir;
        } catch (dirErr: any) {
          await insertSystemLog(
            env,
            'warn',
            `[${coin.symbol}] 缺少有效方向且即时补充判定未成功 (${dirErr?.message || String(dirErr)})，将在下一分钟自动补充触发判定并下单`
          );
          continue;
        }
      }

      if (!coin.direction) {
        continue;
      }

      // 智能波动过滤拦截：仅当明确开启智能下单时才检查波动状态；未开启时一律忽略历史 paused 状态
      if (coin.smart_volatility_enabled) {
        const threshold = (coin.min_volatility_threshold !== undefined && coin.min_volatility_threshold !== null) ? coin.min_volatility_threshold : 1.0;
        const currentVol = coin.current_volatility || 0;
        if (coin.volatility_status === 'paused' || currentVol < threshold) {
          const minuteBucket = String(Math.floor(now / 600000)); // 每10分钟至多提示一次
          const lastLogged = memoryVolPauseLoggedMap.get(coin.symbol);
          if (lastLogged !== minuteBucket) {
            memoryVolPauseLoggedMap.set(coin.symbol, minuteBucket);
            await insertSystemLog(
              env,
              'info',
              `[${coin.symbol}] 智能下单过滤：当前振幅(${currentVol.toFixed(2)}%) < 阈值(${threshold.toFixed(2)}%)，已自动暂停下单等待行情波动`
            );
          }
          continue;
        }
      }

      if (!coin.funding_amount || coin.funding_amount <= 0) {
        await insertSystemLog(env, 'warn', `${coin.symbol} 未设定初始金额，跳过本轮开单`);
        continue;
      }

      if (!coin.leverage || coin.leverage <= 0 || !coin.open_interval_value || !coin.open_interval_unit || !coin.timeout_value || !coin.timeout_unit) {
        await insertSystemLog(env, 'warn', `${coin.symbol} 交易参数未完整配置(杠杆/持仓时间/下单间隔)，跳过本轮开单`);
        continue;
      }

      const intervalValue = coin.open_interval_value;
      const intervalUnit = coin.open_interval_unit as TimeoutUnit;
      const intervalMs = intervalToMs(intervalValue, intervalUnit);
      if (intervalMs <= 0) continue;

      let lastOpenTime = coin.last_open_time || 0;
      if (lastOpenTime > now) {
        lastOpenTime = 0; // 防御未来时间戳导致的跳过
      }
      const isFirstOrder = lastOpenTime === 0;

      if (!isFirstOrder) {
        // 针对1分钟高频下单（或间隔 <= 65秒），采用基于分钟桶 + 弹性时间差（>=35秒）的精准判定，彻底消除时间漂移导致的隔分钟漏单
        if (intervalMs <= 65000) {
          const lastOpenMinuteBucket = Math.floor(lastOpenTime / 60000);
          const currentMinuteBucket = Math.floor(now / 60000);
          const elapsedSinceLastOpen = now - lastOpenTime;
          // 若在当前分钟桶内已开过单，且距上次开单不足 35 秒，则跳过；跨分钟桶或已满35秒则坚定开单
          if (currentMinuteBucket <= lastOpenMinuteBucket && elapsedSinceLastOpen < 35000) {
            continue;
          }
        } else {
          // 常规多分钟/小时/天级间隔：保留充足的调度容差（自适应为 intervalMs 的 25% 或最多 25 秒），防止 Cron 秒级波动导致漏单
          const adaptiveTolerance = Math.min(25000, Math.floor(intervalMs * 0.25));
          const targetNextTime = lastOpenTime + intervalMs;
          if (now < targetNextTime - adaptiveTolerance) {
            continue;
          }
          // 防止同一极短时间窗口（10秒内）重复并发触发
          if (now - lastOpenTime < 10000) {
            continue;
          }
        }
      }

      // 从批量预拉取的行情映射中读取最新价格
      const ticker = activeTickerMap?.get(coin.symbol);
      let currentPrice = ticker?.last ? parseFloat(ticker.last) : 0;

      if (!currentPrice || isNaN(currentPrice) || currentPrice <= 0) {
        await insertSystemLog(env, 'warn', `${coin.symbol} 获取当前行情价格失败，跳过本轮开单`);
        continue;
      }

      // 加仓幅度判断逻辑：
      // 当到达下单时间间隔时，在自动下单前针对该持仓盈亏进行判断：
      // 1. 若无持仓（首次开单），正常下单；
      // 2. 若有持仓且盈利 (收益率 >= 0%)，自动顺势加仓；
      // 3. 若有持仓且亏损 (收益率 < 0%)：
      //    - 若未设置加仓幅度 (<= 0 或 null)，正常下单；
      //    - 若设置了加仓幅度 (如 2%)，需达到设定的亏损幅度后 (浮亏 >= 2%) 才允许下单加仓；未达到则跳过本次下单。
      const cleanSym = getCleanSymbol(coin.symbol);
      const matchingDbPos = allOpenDbPositions.filter(
        (p) => (p.symbol === coin.symbol || getCleanSymbol(p.symbol) === cleanSym) && p.direction === coin.direction
      );
      
      let hasPosition = matchingDbPos.length > 0;
      let posAvgPrice = 0;
      let totalPosQty = 0;

      if (hasPosition) {
        let totalCost = 0;
        for (const p of matchingDbPos) {
          const qty = p.quantity || 0;
          totalPosQty += qty;
          totalCost += (p.entry_price || 0) * qty;
        }
        posAvgPrice = totalPosQty > 0 ? (totalCost / totalPosQty) : (matchingDbPos[0].entry_price || currentPrice);
      }

      // 结合 OKX 批量预拉取持仓获得更精准的实时均价
      if (activePositions && activePositions.length > 0) {
        const matchingOkx = activePositions.filter((op) => {
          const opClean = getCleanSymbol(op.instId);
          let opDir = op.posSide === 'short' ? 'short' : op.posSide === 'long' ? 'long' : (parseFloat(op.pos || '0') < 0 ? 'short' : 'long');
          return (opClean === cleanSym || op.instId === coin.symbol) && opDir === coin.direction && Math.abs(parseFloat(op.pos || '0')) > 0.000001;
        });
        if (matchingOkx.length > 0) {
          hasPosition = true;
          const okxPos = matchingOkx[0];
          const okxAvg = parseFloat(okxPos.avgPx || '0');
          if (okxAvg > 0) {
            posAvgPrice = okxAvg;
          }
        }
      }

      if (hasPosition && posAvgPrice > 0) {
        const leverage = coin.leverage || 10;
        const priceDiffRate = coin.direction === 'long'
          ? (currentPrice - posAvgPrice) / posAvgPrice
          : (posAvgPrice - currentPrice) / posAvgPrice;
        const pnlRatioPct = priceDiffRate * leverage * 100; // 收益率百分比 (e.g. +2.5% or -1.8%)

        const addPosRatio = (coin.add_pos_ratio !== undefined && coin.add_pos_ratio !== null) ? Number(coin.add_pos_ratio) : 0;

        if (pnlRatioPct < 0 && addPosRatio > 0) {
          const currentLossPct = Math.abs(pnlRatioPct);
          if (currentLossPct < addPosRatio) {
            // 亏损幅度未达到设定阈值，跳过本次加仓下单
            const logBucket = String(Math.floor(now / 300000)); // 5分钟日志防刷
            const logged = memoryAddPosSkipLoggedMap.get(coin.symbol);
            if (logged !== logBucket) {
              memoryAddPosSkipLoggedMap.set(coin.symbol, logBucket);
              await insertSystemLog(
                env,
                'info',
                `[${coin.symbol}] 加仓幅度拦截：当前持仓浮亏(${pnlRatioPct.toFixed(2)}%) 未达设定的加仓亏损幅度(-${addPosRatio.toFixed(2)}%)，暂不下单加仓`
              );
            }
            continue;
          }
        }
      }

      let totalInitialAmount = coin.funding_amount;

      const fundingSlices = computeFundingSlices(
        coin.timeout_value,
        coin.timeout_unit as TimeoutUnit,
        intervalValue,
        intervalUnit
      ) || 1;

      let margin = totalInitialAmount / fundingSlices;

      if (margin <= 0) {
        await insertSystemLog(env, 'warn', `${coin.symbol} 计算下单金额为 0，跳过本轮开单`);
        continue;
      }

      const actualMargin = margin;
      const leverage = coin.leverage;
      const marginMode = coin.margin_mode || "isolated";
      const side = coin.direction === 'long' ? 'buy' : 'sell';

      // 从单次批量预拉取的合约元数据中获取面值与步长
      const info = instrumentsMap.get(coin.symbol) || await getInstrumentInfoCached(env, client, coin.symbol);
      let ctVal = parseFloat(info.ctVal) || 1;
      let minSz = parseFloat(info.minSz) || 1;
      let lotSz = parseFloat(info.lotSz) || 1;
      const contractsRaw = (actualMargin * leverage) / (ctVal * currentPrice);
      
      let contracts: number;
      if (contractsRaw < minSz) {
        contracts = minSz;
        await insertSystemLog(
          env,
          'info',
          `${coin.symbol} 计算金额(${actualMargin.toFixed(2)}U)小于OKX最小下单量(${minSz}张)，已按OKX平台最小下单量(${minSz}张)执行，最终保证金以平台实际为准`
        );
      } else {
        contracts = Math.floor(contractsRaw / lotSz) * lotSz;
        if (contracts < minSz) {
          contracts = minSz;
        }
      }
      const szDecimals = Math.max(0, String(lotSz).split('.')[1]?.length || 0);
      let sz = contracts.toFixed(szDecimals);

      const coinTp = (coin.tp_ratio !== undefined && coin.tp_ratio !== null) ? Number(coin.tp_ratio) : 0;
      const coinSl = (coin.sl_ratio !== undefined && coin.sl_ratio !== null) ? Number(coin.sl_ratio) : 0;
      const tpRatioPct = coinTp > 0 ? coinTp / 100 : 0;
      const slRatioPct = coinSl > 0 ? coinSl / 100 : 0;

      readyToOrder.push({
        coin,
        direction: coin.direction as 'long' | 'short',
        isFirstOrder,
        currentPrice,
        actualMargin,
        leverage,
        marginMode,
        side,
        ctVal,
        minSz,
        lotSz,
        tickSz: info.tickSz || '0.1',
        sz,
        executedContracts: contracts,
        tpRatioPct,
        slRatioPct,
        orderParam: {
          instId: coin.symbol,
          tdMode: marginMode,
          side,
          posSide: coin.direction as 'long' | 'short',
          ordType: 'market',
          sz,
          curPrice: currentPrice,
        },
      });
    } catch (prepErr: any) {
      await insertSystemLog(env, 'warn', `[下单准备] ${coin.symbol} 准备下单异常: ${prepErr?.message || String(prepErr)}`);
    }
  }

  if (readyToOrder.length === 0) {
    return affectedPairs;
  }

  // 1. 所有自动下单均严格统一调用批量下单接口 (OKX /api/v5/trade/batch-orders)
  let failedOrders: PreparedOrder[] = [];

  try {
    const batchResults = await client.placeBatchOrders(readyToOrder.map((r) => r.orderParam));
    const successfulRecords: Array<{
      item: PreparedOrder;
      orderId: string;
      entryPrice: number;
      executedContracts: number;
    }> = [];

    for (let i = 0; i < readyToOrder.length; i++) {
      const item = readyToOrder[i];
      const res = batchResults[i];
      if (res && res.ordId && (res.sCode === '0' || res.sCode === '')) {
        successfulRecords.push({
          item,
          orderId: res.ordId,
          entryPrice: item.currentPrice,
          executedContracts: item.executedContracts,
        });
      } else {
        const errDetail = res?.sMsg ? ` [${res.sCode}]: ${res.sMsg}` : (res?.sCode ? ` [${res.sCode}]` : '');
        await insertSystemLog(env, 'warn', `[批量下单提示] ${item.coin.symbol} 首次下单未成功${errDetail}，将在2500ms熔断后重试`);
        failedOrders.push(item);
      }
    }

    if (successfulRecords.length > 0) {
      await batchHandleOrderSuccess(env, successfulRecords, affectedPairs);
    }
  } catch (batchErr: any) {
    await insertSystemLog(env, 'warn', `[批量下单异常] 批量下单失败: ${batchErr?.message || String(batchErr)}，将在2500ms熔断后重试`);
    failedOrders = [...readyToOrder];
  }

  // 若存在未成功下单的币种，在当前主循环内等待 2500ms 熔断冷却后单次重试
  if (failedOrders.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, ORDER_FAILURE_CIRCUIT_BREAK_MS));
    await insertSystemLog(
      env,
      'info',
      `[下单熔断重试] 检测到 ${failedOrders.length} 笔订单未成功，已等待2500ms熔断冷却，正在执行本轮批量重试...`
    );

    let stillFailedOrders: PreparedOrder[] = [];
    try {
      const retryResults = await client.placeBatchOrders(failedOrders.map((r) => r.orderParam));
      const retrySuccessfulRecords: Array<{
        item: PreparedOrder;
        orderId: string;
        entryPrice: number;
        executedContracts: number;
      }> = [];

      for (let i = 0; i < failedOrders.length; i++) {
        const item = failedOrders[i];
        const res = retryResults[i];
        if (res && res.ordId && (res.sCode === '0' || res.sCode === '')) {
          retrySuccessfulRecords.push({
            item,
            orderId: res.ordId,
            entryPrice: item.currentPrice,
            executedContracts: item.executedContracts,
          });
        } else {
          const errDetail = res?.sMsg ? ` [${res.sCode}]: ${res.sMsg}` : (res?.sCode ? ` [${res.sCode}]` : '');
          await insertSystemLog(env, 'warn', `[批量下单重试失败] ${item.coin.symbol} 重试下单仍未成功${errDetail}，本轮结束，下轮主循环全新检测`);
          stillFailedOrders.push(item);
        }
      }

      if (retrySuccessfulRecords.length > 0) {
        await batchHandleOrderSuccess(env, retrySuccessfulRecords, affectedPairs);
        await insertSystemLog(env, 'info', `[批量下单重试成功] ${retrySuccessfulRecords.length} 笔订单熔断重试下单成功`);
      }
    } catch (retryBatchErr: any) {
      await insertSystemLog(env, 'warn', `[批量下单重试异常] 重试批量下单失败: ${retryBatchErr?.message || String(retryBatchErr)}，本轮结束，下轮主循环全新检测`);
      stillFailedOrders = [...failedOrders];
    }

    // 若重试后依然失败，同样等待 2500ms 熔断冷却后才能进行队列继续
    if (stillFailedOrders.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, ORDER_FAILURE_CIRCUIT_BREAK_MS));
      await insertSystemLog(
        env,
        'info',
        `[下单熔断保护] 仍有 ${stillFailedOrders.length} 笔订单未成功，已执行2500ms熔断隔离保护，继续后续队列`
      );
    }
  }

  // 开仓完毕后，针对所有发生仓位变动的币种方向，通过轻量化批量同步器更新全仓 100% 比例聚合止盈止损
  if (affectedPairs.size > 0) {
    try {
      await batchSyncFullPositionAlgoOrders(
        client,
        env,
        Array.from(affectedPairs),
        undefined,
        tickerMap,
        coinPairs
      );
    } catch (syncErr) {
      console.warn(`[AlgoOrder] 批量同步全仓止盈止损异常:`, syncErr);
    }
  }

  return affectedPairs;
}

/**
 * 内部辅助函数：批量处理成功订单的数据库落库与系统日志（单次 D1 batch）
 */
async function batchHandleOrderSuccess(
  env: Env,
  successfulRecords: Array<{
    item: PreparedOrder;
    orderId: string;
    entryPrice: number;
    executedContracts: number;
  }>,
  affectedPairs: Set<string>
): Promise<void> {
  if (successfulRecords.length === 0) return;

  const now = Date.now();
  const coinUpdates: Array<{ symbol: string; updates: Partial<CoinPair> }> = [];
  const positionsToInsert: Array<Omit<Position, 'id'>> = [];
  const logsToInsert: Array<{ type: string; message: string }> = [];

  for (const { item, orderId, entryPrice, executedContracts } of successfulRecords) {
    const { coin, direction, isFirstOrder, leverage, ctVal, tickSz, tpRatioPct, slRatioPct } = item;

    const nextJitter = Math.floor(Math.random() * 200) - 100;
    coin.last_open_time = now;
    coin.next_jitter_ms = nextJitter;

    coinUpdates.push({
      symbol: coin.symbol,
      updates: {
        last_open_time: now,
        next_jitter_ms: nextJitter,
      },
    });

    const exactMargin = (executedContracts * ctVal * entryPrice) / leverage;

    let initTpPx = 0;
    let initSlPx = 0;
    if (entryPrice > 0) {
      if (tpRatioPct > 0) {
        initTpPx = parseFloat(
          formatPriceToTick(
            direction === 'long' ? entryPrice * (1 + tpRatioPct) : entryPrice * (1 - tpRatioPct),
            tickSz,
            direction === 'long' ? 'up' : 'down'
          )
        );
      }
      if (slRatioPct > 0) {
        initSlPx = parseFloat(
          formatPriceToTick(
            direction === 'long' ? entryPrice * (1 - slRatioPct) : entryPrice * (1 + slRatioPct),
            tickSz,
            direction === 'long' ? 'down' : 'up'
          )
        );
      }
    }

    positionsToInsert.push({
      symbol: coin.symbol,
      direction,
      leverage,
      entry_price: entryPrice,
      quantity: executedContracts,
      margin: exactMargin,
      okx_order_id: orderId,
      open_time: now,
      tp_price: initTpPx,
      sl_price: initSlPx,
      tp_algo_id: '',
      sl_algo_id: '',
      unrealized_pnl: 0,
      last_price: entryPrice,
      status: 'open',
    });

    affectedPairs.add(`${coin.symbol}:${direction}`);

    const dirText = direction === 'long' ? '做多' : '做空';
    const orderSeqText = isFirstOrder ? '首笔即时' : '按间隔下单';
    const marginFormatted = exactMargin >= 0.01 ? exactMargin.toFixed(2) : exactMargin.toFixed(4);
    logsToInsert.push({
      type: 'open',
      message: `${coin.symbol} 开仓${dirText}(${orderSeqText}) 入场${entryPrice} 保证金${marginFormatted}USDT(合约${executedContracts}张)`,
    });
  }

  await Promise.all([
    batchUpdateCoinPairs(env, coinUpdates),
    batchInsertPositions(env, positionsToInsert),
    batchInsertSystemLogs(env, logsToInsert),
  ]);
}

/**
 * 批量全仓聚合止盈止损同步器 (OKX closeFraction: "1" 全部仓位 100% 比例平仓委托)
 * 极端行情多币种同时触发时，统一批量计算，批量撤单与原子修改，严禁逐个订单串行消耗 API
 */
export async function batchSyncFullPositionAlgoOrders(
  client: OKXClient,
  env: Env,
  affectedPairs: string[],
  activePositions?: Position[],
  tickerMap?: Map<string, any>,
  cachedCoins?: CoinPair[]
): Promise<void> {
  if (!affectedPairs || affectedPairs.length === 0) return;

  const allOpenPositions = activePositions || await getOpenPositions(env);
  const coins = cachedCoins || await getCoinPairs(env);
  const coinMap = new Map<string, CoinPair>();
  for (const c of coins) {
    coinMap.set(c.symbol, c);
    coinMap.set(getCleanSymbol(c.symbol), c);
  }

  const keysToClear: string[] = [];

  const pairsToProcess: Array<{
    symbol: string;
    cleanSym: string;
    direction: 'long' | 'short';
    algoStateKey: string;
    matchingPositions: Position[];
    coin: CoinPair;
    tpRatioPct: number;
    slRatioPct: number;
  }> = [];

  for (const pairKey of affectedPairs) {
    const [symbol, direction] = pairKey.split(':') as [string, 'long' | 'short'];
    if (!symbol || !direction) continue;

    const cleanSym = getCleanSymbol(symbol);
    const algoStateKey = `agg_algo_${cleanSym}_${direction}`;
    const matchingPositions = allOpenPositions.filter(
      (p) => (p.symbol === symbol || getCleanSymbol(p.symbol) === cleanSym) && p.direction === direction
    );

    const coin = coinMap.get(symbol) || coinMap.get(cleanSym);

    // 仓位已平或未设止盈止损时，OKX 交易所会对全仓止盈止损(closeFraction: 1)自动完成并失效，直接清理本地状态，无需多余撤单请求
    if (matchingPositions.length === 0) {
      keysToClear.push(algoStateKey);
      continue;
    }

    if (!coin) continue;

    const coinTp = coin.tp_ratio !== undefined && coin.tp_ratio !== null ? Number(coin.tp_ratio) : 0;
    const coinSl = coin.sl_ratio !== undefined && coin.sl_ratio !== null ? Number(coin.sl_ratio) : 0;
    const tpRatioPct = coinTp > 0 ? coinTp / 100 : 0;
    const slRatioPct = coinSl > 0 ? coinSl / 100 : 0;

    if (tpRatioPct <= 0 && slRatioPct <= 0) {
      keysToClear.push(algoStateKey);
      continue;
    }

    pairsToProcess.push({
      symbol,
      cleanSym,
      direction,
      algoStateKey,
      matchingPositions,
      coin,
      tpRatioPct,
      slRatioPct,
    });
  }

  // 批量清除已平仓状态缓存（内存即时清除 + 异步轻量持久化）
  for (const k of keysToClear) {
    memoryAlgoStateCache.delete(k);
    setConfigValue(env, k, '').catch(() => {});
  }

  // 对仍有持仓的币种，在批量同步阶段统一进行内存加权均价与止盈止损计算，直接原子修改(Amend)或挂载
  const syncSinglePair = async (item: typeof pairsToProcess[0], isRetry = false): Promise<boolean> => {
    const { symbol, direction, algoStateKey, matchingPositions, coin, tpRatioPct, slRatioPct } = item;
    let info = await getInstrumentInfoCached(env, client, symbol);
    let ctVal = parseFloat(info.ctVal) || 1;
    const tickSz = info.tickSz || '0.1';

    let totalQty = 0;
    let totalCost = 0;
    for (const pos of matchingPositions) {
      const qty = pos.quantity || 0;
      const px = pos.entry_price || 0;
      totalQty += qty;
      totalCost += qty * ctVal * px;
    }

    const avgEntryPrice = (totalQty > 0 && totalCost > 0)
      ? (totalCost / (totalQty * ctVal))
      : matchingPositions[0].entry_price;

    if (avgEntryPrice <= 0) return true;

    let tpTriggerPx: string | undefined;
    let slTriggerPx: string | undefined;

    if (tpRatioPct > 0) {
      tpTriggerPx = formatPriceToTick(
        direction === 'long' ? avgEntryPrice * (1 + tpRatioPct) : avgEntryPrice * (1 - tpRatioPct),
        tickSz,
        direction === 'long' ? 'up' : 'down'
      );
    }

    if (slRatioPct > 0) {
      slTriggerPx = formatPriceToTick(
        direction === 'long' ? avgEntryPrice * (1 - slRatioPct) : avgEntryPrice * (1 + slRatioPct),
        tickSz,
        direction === 'long' ? 'down' : 'up'
      );
    }

    let parsedAlgo: { algoId?: string; tpTriggerPx?: string; slTriggerPx?: string } | null = memoryAlgoStateCache.get(algoStateKey) || null;
    if (!parsedAlgo) {
      const existingAlgoStr = await getConfigValue(env, algoStateKey);
      if (existingAlgoStr) {
        try {
          parsedAlgo = JSON.parse(existingAlgoStr);
          if (parsedAlgo) memoryAlgoStateCache.set(algoStateKey, parsedAlgo);
        } catch {}
      }
    }

    if (
      parsedAlgo &&
      parsedAlgo.algoId &&
      parsedAlgo.tpTriggerPx === tpTriggerPx &&
      parsedAlgo.slTriggerPx === slTriggerPx
    ) {
      // 价格完全一致，0 网络请求直接跳过，0 D1写入
      return true;
    }

    const dirText = direction === 'long' ? '做多' : '做空';

    // 优先直接原子修改 (Direct Amend)
    if (parsedAlgo && parsedAlgo.algoId) {
      try {
        const amendSuccess = await client.amendAlgoOrder({
          instId: symbol,
          algoId: parsedAlgo.algoId,
          newTpTriggerPx: tpTriggerPx,
          newTpOrdPx: '-1',
          newSlTriggerPx: slTriggerPx,
          newSlOrdPx: '-1',
        });

        if (amendSuccess) {
          const stateObj = {
            algoId: parsedAlgo.algoId,
            tpTriggerPx,
            slTriggerPx,
            avgEntryPrice,
            totalQty,
            updateTime: Date.now(),
          };
          memoryAlgoStateCache.set(algoStateKey, stateObj);
          await setConfigValue(env, algoStateKey, JSON.stringify(stateObj)).catch(() => {});

          await insertSystemLog(
            env,
            'info',
            `[全仓止盈止损修改] ${symbol} ${dirText}${isRetry ? '(熔断重试)' : '(直接原子修改)'}: 累计持仓${totalQty}张(加权均价${avgEntryPrice.toFixed(4)}) → 止盈${tpTriggerPx || '未设'} / 止损${slTriggerPx || '未设'}`
          );
          return true;
        }
      } catch (amendErr) {
        console.warn(`[BatchAlgo] amend-algos 失败，准备重新挂载:`, amendErr);
      }

      // 改单未成功（可能单双边类型变动或旧单已失效触发），主动安全撤销旧单释放仓位，防止下发新单时 51088 冲突
      await client.cancelAlgoOrders(symbol, undefined, parsedAlgo.algoId).catch(() => {});
    }

    // 若是重试轮次，安全确保清理可能存在的同向遗留策略单
    if (isRetry) {
      await client.cancelAllAlgoOrdersForInst(symbol, direction).catch(() => {});
    }

    // 若此前未挂载过策略单或修改失败，直接下发全新全仓止盈止损单
    const marginMode = coin.margin_mode || 'isolated';
    const closeSide = direction === 'long' ? 'sell' : 'buy';
    const ordType = (tpTriggerPx && slTriggerPx) ? 'oco' : 'conditional';

    try {
      const algoRes = await client.attachAlgoOrder({
        instId: symbol,
        tdMode: marginMode,
        side: closeSide,
        posSide: direction,
        ordType,
        closeFraction: '1',
        tpTriggerPx,
        tpOrdPx: '-1',
        slTriggerPx,
        slOrdPx: '-1',
      });

      if (algoRes && algoRes.algoId) {
        const stateObj = {
          algoId: algoRes.algoId,
          tpTriggerPx,
          slTriggerPx,
          avgEntryPrice,
          totalQty,
          updateTime: Date.now(),
        };
        memoryAlgoStateCache.set(algoStateKey, stateObj);
        await setConfigValue(env, algoStateKey, JSON.stringify(stateObj)).catch(() => {});

        await insertSystemLog(
          env,
          'info',
          `[全仓聚合止盈止损] ${symbol} ${dirText}${isRetry ? '(熔断重试挂单成功)' : '已建立挂单(100%全仓)'}: 累计持仓${totalQty}张(加权均价${avgEntryPrice.toFixed(4)}) → 止盈${tpTriggerPx || '未设'} / 止损${slTriggerPx || '未设'}`
        );
        return true;
      }
    } catch (algoErr: any) {
      console.warn(`[BatchAlgo] 挂载全仓止盈止损失败:`, algoErr);
      if (!isRetry) {
        await insertSystemLog(
          env,
          'warn',
          `[全仓止盈止损提示] ${symbol} 首次挂单未成功 (${algoErr?.message || String(algoErr)})，将在2500ms熔断后重试`
        );
      } else {
        await insertSystemLog(
          env,
          'warn',
          `[全仓止盈止损重试失败] ${symbol} 重试挂单仍未成功 (${algoErr?.message || String(algoErr)})，本轮结束，下轮主循环全新检测`
        );
      }
    }

    return false;
  };

  const results = await Promise.all(
    pairsToProcess.map(async (item) => {
      const ok = await syncSinglePair(item, false);
      return { item, ok };
    })
  );

  const failedPairs = results.filter((r) => !r.ok).map((r) => r.item);

  // 熔断 2500ms 后当前主循环内重试单次（严格受控于时间与子请求熔断）
  if (failedPairs.length > 0 && !isCycleTimeout() && !isSubrequestLimitReached()) {
    await new Promise((resolve) => setTimeout(resolve, ORDER_FAILURE_CIRCUIT_BREAK_MS));

    if (isCycleTimeout() || isSubrequestLimitReached()) {
      return;
    }

    await insertSystemLog(
      env,
      'info',
      `[全仓止盈止损熔断重试] 检测到 ${failedPairs.length} 个币种全仓止盈止损未完成，已等待2500ms熔断冷却，正在执行本轮单次重试...`
    );
    const retryResults = await Promise.all(
      failedPairs.map(async (item) => {
        const ok = await syncSinglePair(item, true);
        return { item, ok };
      })
    );

    const stillFailedPairs = retryResults.filter((r) => !r.ok).map((r) => r.item);
    // 若重试后依然未成功，同样等待 2500ms 熔断冷却后才能进行队列继续
    if (stillFailedPairs.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, ORDER_FAILURE_CIRCUIT_BREAK_MS));
      await insertSystemLog(
        env,
        'info',
        `[全仓止盈止损熔断保护] 仍有 ${stillFailedPairs.length} 个币种全仓止盈止损未完成，已执行2500ms熔断隔离保护，继续后续队列`
      );
    }
  }
}

/**
 * 单币种全仓聚合止盈止损同步器（兼容封装，调用 batchSyncFullPositionAlgoOrders）
 */
export async function syncFullPositionAlgoOrder(
  client: OKXClient,
  env: Env,
  symbol: string,
  direction: 'long' | 'short',
  coinConfig?: CoinPair,
  tickerMap?: Map<string, any>
): Promise<void> {
  await batchSyncFullPositionAlgoOrders(
    client,
    env,
    [`${symbol}:${direction}`],
    undefined,
    tickerMap
  );
}
