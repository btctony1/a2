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
  setConfigValues,
  batchUpdateCoinPairs,
  batchInsertPositions,
  batchUpsertAggregatedPositions,
  batchInsertSystemLogs,
} from '../db/queries';
import { getCleanSymbol } from './monitor';
import { refreshCoinDirection } from './direction';
import { triggerCircuitBreak, isCycleTimeout, isSubrequestLimitReached } from '../okx/signer';
import {
  OPEN_POSITION_JITTER_MS,
  MARGIN_JITTER_PERCENT,
  MAX_ORDER_RETRIES,
  ORDER_FAILURE_CIRCUIT_BREAK_MS,
} from '../constants';

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
  coin: CoinPair,
  intervalValue?: number | null,
  intervalUnit?: any
): number {
  if (coin.funding_slices && coin.funding_slices > 0) {
    return Math.max(1, Math.floor(coin.funding_slices));
  }
  return 10;
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

/**
 * 严格按平台全部仓位收益率（ROI%）计算止盈止损触发价格
 * 规则：
 * 收益率 ROI = (价格变动率) * 杠杆
 * 价格变动率 = 收益率 / 杠杆
 * 做多（long）：
 *   tpTriggerPx = entryPrice * (1 + (tpRatioPct / leverage))
 *   slTriggerPx = entryPrice * (1 - (slRatioPct / leverage))
 * 做空（short）：
 *   tpTriggerPx = entryPrice * (1 - (tpRatioPct / leverage))
 *   slTriggerPx = entryPrice * (1 + (slRatioPct / leverage))
 */
export function calculateRoiTpSlPrices(
  entryPrice: number,
  direction: 'long' | 'short',
  leverage: number,
  tpRatioPct: number,
  slRatioPct: number,
  tickSz: string
): { tpTriggerPx?: string; slTriggerPx?: string } {
  if (entryPrice <= 0) return {};
  const lev = leverage > 0 ? leverage : 10;
  let tpTriggerPx: string | undefined;
  let slTriggerPx: string | undefined;

  if (tpRatioPct > 0) {
    const priceRate = tpRatioPct / lev;
    const targetPx = direction === 'long'
      ? entryPrice * (1 + priceRate)
      : entryPrice * (1 - priceRate);
    if (targetPx > 0) {
      tpTriggerPx = formatPriceToTick(targetPx, tickSz, direction === 'long' ? 'up' : 'down');
    }
  }

  if (slRatioPct > 0) {
    const priceRate = slRatioPct / lev;
    const targetPx = direction === 'long'
      ? entryPrice * (1 - priceRate)
      : entryPrice * (1 + priceRate);
    if (targetPx > 0) {
      slTriggerPx = formatPriceToTick(targetPx, tickSz, direction === 'long' ? 'down' : 'up');
    }
  }

  return { tpTriggerPx, slTriggerPx };
}

const memoryInstCache = new Map<string, any>();
let cachedAllInstrumentsMap: Map<string, any> | null = null;
let lastInstrumentsPreloadTime = 0;
const INSTRUMENTS_CACHE_TTL_MS = 24 * 3600 * 1000; // 24小时内存缓存

const memoryLeverageVerifiedMap = new Map<string, string>();
const memoryVolPauseLoggedMap = new Map<string, string>();
const memoryAddPosSkipLoggedMap = new Map<string, string>();
const memoryAlgoStateCache = new Map<string, { algoId?: string; tpTriggerPx?: string; slTriggerPx?: string }>();
let globalVolPauseLogBucket = '';
let globalUnconfiguredLogBucket = '';
let globalAddPosInterceptLogBucket = '';

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

  // 核心优化：若缓存中未命中，优先通过 1 次性全量合约大包接口预拉取并填充全量内存（杜绝按币种逐一发起网络请求）
  if (!forceRefresh && (!cachedAllInstrumentsMap || cachedAllInstrumentsMap.size === 0)) {
    await preloadAllInstruments(client);
    if (memoryInstCache.has(symbol)) {
      return memoryInstCache.get(symbol);
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

  // 确保批量行情数据就绪（若未传入或存在缺失，则统一批量定向获取并执行批量重试，绝不逐个币种处理）
  let activeTickerMap = tickerMap;
  if (!activeTickerMap) {
    activeTickerMap = new Map();
  }

  // 统一检查所有候选币种是否在 activeTickerMap 中具有有效行情
  const candidateSymbols = candidateCoins.map((c) => c.symbol);
  const missingCandidateSymbols = candidateSymbols.filter((sym) => {
    const clean = getCleanSymbol(sym);
    const t = activeTickerMap!.get(sym) || activeTickerMap!.get(clean);
    return !t?.last || parseFloat(t.last) <= 0;
  });

  // 若有缺失币种，一次性统一批量拉取并批量重试（绝不进入逐个币种轮询与重试）
  if (missingCandidateSymbols.length > 0) {
    try {
      const fetched = await client.getTickersForSymbols(missingCandidateSymbols);
      for (const [k, v] of fetched.entries()) {
        activeTickerMap.set(k, v);
      }
    } catch (e) {
      console.warn('[openPosition] 批量补齐候选币种行情失败:', e);
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
  const volPausedCoins: Array<{ symbol: string; vol: number; threshold: number }> = [];
  const unconfiguredCoins: string[] = [];
  const interceptedAddPosCoins: Array<{ symbol: string; pnlRatioPct: number; addPosRatio: number }> = [];

  // 3. 内存中批量并发/极速遍历所有候选币种完成纯计算（0 额外网络开销）
  for (const coin of candidateCoins) {
    try {
      // 兜底保障：若该币种方向为空或尚未成功判定，立即补充触发一次基于历史K线的方向判定
      if (!coin.direction && coin.period) {
        try {
          const dir = await refreshCoinDirection(client, env, coin, 'immediate');
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
          volPausedCoins.push({ symbol: coin.symbol, vol: currentVol, threshold });
          continue;
        }
      }

      if (!coin.funding_amount || coin.funding_amount <= 0) {
        unconfiguredCoins.push(`${coin.symbol}(未设金额)`);
        continue;
      }

      if (!coin.leverage || coin.leverage <= 0 || !coin.open_interval_value || !coin.open_interval_unit) {
        unconfiguredCoins.push(`${coin.symbol}(未配杠杆/间隔)`);
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

      // 从预拉取的批量行情映射中读取最新价格（已在前序阶段完成统一批量拉取与批量重试）
      const cleanSym = getCleanSymbol(coin.symbol);
      const ticker = activeTickerMap?.get(coin.symbol) || activeTickerMap?.get(cleanSym);
      let currentPrice = ticker?.last ? parseFloat(ticker.last) : 0;

      // 如果在批量预拉取与批量重试后仍未获取到，兜底尝试读取数据库已存的最新行情作为最后防线
      if ((!currentPrice || isNaN(currentPrice) || currentPrice <= 0) && coin.last_price && coin.last_price > 0) {
        currentPrice = coin.last_price;
      }

      if (!currentPrice || isNaN(currentPrice) || currentPrice <= 0) {
        await insertSystemLog(env, 'warn', `${coin.symbol} 批量获取行情价格失败(已批量重试2次)，跳过本轮开单`);
        continue;
      }

      // 加仓幅度判断逻辑：
      // 当到达下单时间间隔时，在自动下单前针对该持仓盈亏进行判断：
      // 1. 若无持仓（首次开单），正常下单；
      // 2. 若有持仓且盈利 (收益率 >= 0%)，自动顺势加仓；
      // 3. 若有持仓且亏损 (收益率 < 0%)：
      //    - 若未设置加仓幅度 (<= 0 或 null)，正常下单；
      //    - 若设置了加仓幅度 (如 2%)，需达到设定的亏损幅度后 (浮亏 >= 2%) 才允许下单加仓；未达到则跳过本次下单。
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
            // 亏损幅度未达到设定阈值，收集以便统一输出聚合日志，跳过本次加仓下单
            interceptedAddPosCoins.push({
              symbol: coin.symbol,
              pnlRatioPct,
              addPosRatio,
            });
            continue;
          }
        }
      }

      let totalInitialAmount = coin.funding_amount;

      const fundingSlices = computeFundingSlices(
        coin,
        intervalValue,
        intervalUnit
      );

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

  // 统一输出智能波动过滤汇总日志（每10分钟至多1条，极度轻量化写入 D1）
  if (volPausedCoins.length > 0) {
    const bucket = String(Math.floor(now / 600000));
    if (globalVolPauseLogBucket !== bucket) {
      globalVolPauseLogBucket = bucket;
      const details = volPausedCoins.map(p => `${p.symbol}(${p.vol.toFixed(2)}%<${p.threshold}%)`).join(', ');
      await insertSystemLog(
        env,
        'info',
        `【步骤3: 智能下单过滤】${volPausedCoins.length} 个币种振幅低于阈值暂缓下单: ${details}`
      );
    }
  }

  // 统一输出加仓幅度拦截汇总日志（每5分钟至多1条，杜绝逐币刷屏与D1写爆）
  if (interceptedAddPosCoins.length > 0) {
    const bucket = String(Math.floor(now / 300000));
    if (globalAddPosInterceptLogBucket !== bucket) {
      globalAddPosInterceptLogBucket = bucket;
      const sample = interceptedAddPosCoins.slice(0, 8).map(
        c => `${getCleanSymbol(c.symbol)}(${c.pnlRatioPct.toFixed(2)}%)`
      ).join(', ');
      const etcText = interceptedAddPosCoins.length > 8 ? ` 等共 ${interceptedAddPosCoins.length} 个币种` : '';
      const refThreshold = interceptedAddPosCoins[0].addPosRatio.toFixed(2);
      await insertSystemLog(
        env,
        'info',
        `【步骤3: 加仓巡检拦截】${interceptedAddPosCoins.length} 个持仓浮亏未达设定的加仓亏损幅度(-${refThreshold}%)，暂不下单加仓: ${sample}${etcText}`
      );
    }
  }

  // 统一输出交易参数缺失汇总提示（每15分钟至多1条）
  if (unconfiguredCoins.length > 0) {
    const bucket = String(Math.floor(now / 900000));
    if (globalUnconfiguredLogBucket !== bucket) {
      globalUnconfiguredLogBucket = bucket;
      await insertSystemLog(
        env,
        'warn',
        `【步骤3: 参数提示】${unconfiguredCoins.length} 个币种交易参数未完整配置，跳过开单: ${unconfiguredCoins.join(', ')}`
      );
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

  // 开仓完毕后，针对所有实际发生成交变动的币种方向，按最新均价立即更新固定收益率全仓止盈止损
  if (affectedPairs.size > 0) {
    try {
      await syncFixedRoiFullPositionAlgoOrders(
        client,
        env,
        Array.from(affectedPairs),
        undefined,
        tickerMap,
        coinPairs
      );
    } catch (syncErr) {
      console.warn(`[AlgoOrder] 同步全仓固定收益率止盈止损异常:`, syncErr);
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
      const { tpTriggerPx, slTriggerPx } = calculateRoiTpSlPrices(
        entryPrice,
        direction,
        leverage,
        tpRatioPct,
        slRatioPct,
        tickSz
      );
      if (tpTriggerPx) initTpPx = parseFloat(tpTriggerPx);
      if (slTriggerPx) initSlPx = parseFloat(slTriggerPx);
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

  const consolidatedOpenLogs: Array<{ type: string; message: string }> = [];
  if (logsToInsert.length === 1) {
    consolidatedOpenLogs.push({
      type: 'open',
      message: `【步骤3: 开仓执行】${logsToInsert[0].message}`,
    });
  } else if (logsToInsert.length > 1) {
    const totalMargin = positionsToInsert.reduce((sum, p) => sum + (p.margin || 0), 0);
    const summaryHeader = `【步骤3: 批量开仓完成】共执行 ${logsToInsert.length} 笔开仓 (总保证金约 ${totalMargin.toFixed(2)} USDT):`;
    const details = logsToInsert.map(l => `• ${l.message}`).join('\n');
    consolidatedOpenLogs.push({
      type: 'open',
      message: `${summaryHeader}\n${details}`,
    });
  }

  await Promise.all([
    batchUpdateCoinPairs(env, coinUpdates),
    batchUpsertAggregatedPositions(env, positionsToInsert),
    batchInsertSystemLogs(env, consolidatedOpenLogs),
  ]);
}

/**
 * 固定模式全仓止盈止损同步器 (OKX closeFraction: "1" 全部仓位 100% 比例平仓委托)
 * 核心逻辑（严格对齐平台固定模式与铁律）：
 * 1. 严格按平台全部仓位的止盈止损固定模式收益率（ROI%）进行挂单；
 * 2. 挂单成功后（closeFraction: "1"），交易所原生全仓托管，后续加仓自动全仓继承，
 *    无需每一个币种每次下单都重复挂单、撤单或改单，彻底避免海量无效网络请求与频控超限；
 * 3. 仅在仓位首次建仓或前次全平后重新开仓时，批量并发执行平台挂单，真正实现纯API批量极速处理。
 */
export async function syncFixedRoiFullPositionAlgoOrders(
  client: OKXClient,
  env: Env,
  affectedPairs: string[],
  activePositions?: Position[],
  tickerMap?: Map<string, any>,
  cachedCoins?: CoinPair[],
  prefetchedAlgoOrders?: any[]
): Promise<void> {
  const uniquePairs = Array.from(new Set(affectedPairs.filter((p) => typeof p === 'string' && !!p)));
  if (uniquePairs.length === 0) return;

  const allOpenPositions = activePositions || await getOpenPositions(env);
  const coins = cachedCoins || await getCoinPairs(env);
  const coinMap = new Map<string, CoinPair>();
  for (const c of coins) {
    coinMap.set(c.symbol, c);
    coinMap.set(getCleanSymbol(c.symbol), c);
  }

  // 1. 单次批量获取全量待生效策略单与 OKX 持仓（避免逐个币种网络请求消耗配额）
  let pendingAlgos = prefetchedAlgoOrders;
  if (!pendingAlgos) {
    try {
      pendingAlgos = await client.getAllPendingAlgoOrders().catch(() => []);
    } catch {
      pendingAlgos = [];
    }
  }

  const pendingAlgoMap = new Map<string, any>();
  if (Array.isArray(pendingAlgos)) {
    for (const algo of pendingAlgos) {
      const sym = algo.instId;
      const clean = getCleanSymbol(sym);
      const side = algo.posSide === 'short' ? 'short' : algo.posSide === 'long' ? 'long' : (algo.side === 'sell' ? 'long' : 'short');
      pendingAlgoMap.set(`${sym}:${side}`, algo);
      pendingAlgoMap.set(`${clean}:${side}`, algo);
      if (algo.posSide === 'net') {
        pendingAlgoMap.set(`${sym}:net`, algo);
        pendingAlgoMap.set(`${clean}:net`, algo);
      }
    }
  }

  let livePositions: OKXPosition[] = [];
  try {
    livePositions = await client.getPositions().catch(() => []);
  } catch {
    livePositions = [];
  }
  const livePosMap = new Map<string, OKXPosition>();
  for (const lp of livePositions) {
    const sym = lp.instId;
    const clean = getCleanSymbol(sym);
    const side = lp.posSide === 'short' ? 'short' : lp.posSide === 'long' ? 'long' : (parseFloat(lp.pos || '0') < 0 ? 'short' : 'long');
    if (Math.abs(parseFloat(lp.pos || '0')) > 0.000001) {
      livePosMap.set(`${sym}:${side}`, lp);
      livePosMap.set(`${clean}:${side}`, lp);
      if (lp.posSide === 'net') {
        livePosMap.set(`${sym}:net`, lp);
        livePosMap.set(`${clean}:net`, lp);
      }
    }
  }

  // 2. 逐个核对并分析需要 改单(amend) 还是 首单挂单(attach)
  interface AlgoTask {
    symbol: string;
    direction: 'long' | 'short';
    coin: CoinPair;
    avgEntryPrice: number;
    leverage: number;
    tdMode: string;
    targetOrdType: 'oco' | 'conditional';
    targetTpTriggerPx?: string;
    targetSlTriggerPx?: string;
    algoStateKey: string;
    existingAlgoId?: string;
  }

  const toAmendList: AlgoTask[] = [];
  const toAttachList: AlgoTask[] = [];
  const toCancelZombieList: Array<{ instId: string; algoId?: string }> = [];
  const toCancelForReattachList: Array<{ instId: string; algoId?: string }> = [];

  let unchangedCount = 0;
  let noPosSkippedCount = 0;

  for (const pairKey of uniquePairs) {
    const [symbol, direction] = pairKey.split(':') as [string, 'long' | 'short'];
    if (!symbol || !direction) continue;

    const cleanSym = getCleanSymbol(symbol);
    const algoStateKey = `agg_algo_${cleanSym}_${direction}`;

    const coin = coinMap.get(symbol) || coinMap.get(cleanSym);
    if (!coin) continue;

    const coinTp = coin.tp_ratio !== undefined && coin.tp_ratio !== null ? Number(coin.tp_ratio) : 0;
    const coinSl = coin.sl_ratio !== undefined && coin.sl_ratio !== null ? Number(coin.sl_ratio) : 0;
    const tpRatioPct = coinTp > 0 ? coinTp / 100 : 0;
    const slRatioPct = coinSl > 0 ? coinSl / 100 : 0;

    // 核心铁律：只有在 OKX 交易所存在真实持仓时，才去同步或修改全仓止盈止损！
    const livePos = livePosMap.get(`${symbol}:${direction}`) ||
                    livePosMap.get(`${cleanSym}:${direction}`) ||
                    livePosMap.get(`${symbol}:net`) ||
                    livePosMap.get(`${cleanSym}:net`);
    const posAmount = livePos ? Math.abs(parseFloat(livePos.pos || '0')) : 0;

    // 若 OKX 端明确没有活跃持仓，严禁向交易所发送平仓委托单，清理僵尸单后安全跳过
    if (!livePos || posAmount <= 0) {
      const platformAlgo = pendingAlgoMap.get(`${symbol}:${direction}`) ||
                           pendingAlgoMap.get(`${cleanSym}:${direction}`) ||
                           pendingAlgoMap.get(`${symbol}:net`) ||
                           pendingAlgoMap.get(`${cleanSym}:net`);
      if (platformAlgo?.algoId) {
        toCancelZombieList.push({ instId: symbol, algoId: String(platformAlgo.algoId) });
      }
      memoryAlgoStateCache.delete(algoStateKey);
      noPosSkippedCount++;
      continue;
    }

    // 若真实存在持仓，但未设置任何止盈止损参数（tpRatioPct <= 0 && slRatioPct <= 0），则撤销已有的策略单
    if (tpRatioPct <= 0 && slRatioPct <= 0) {
      const platformAlgo = pendingAlgoMap.get(`${symbol}:${direction}`) ||
                           pendingAlgoMap.get(`${cleanSym}:${direction}`) ||
                           pendingAlgoMap.get(`${symbol}:net`) ||
                           pendingAlgoMap.get(`${cleanSym}:net`);
      if (platformAlgo?.algoId) {
        toCancelZombieList.push({ instId: symbol, algoId: String(platformAlgo.algoId) });
      }
      memoryAlgoStateCache.delete(algoStateKey);
      continue;
    }

    let avgEntryPrice = parseFloat(livePos.avgPx) || 0;
    let leverage = parseFloat(livePos.lever) || coin.leverage || 10;
    const tdMode = livePos.mgnMode || coin.margin_mode || 'isolated';

    if (avgEntryPrice <= 0) {
      const matchingPositions = allOpenPositions.filter(
        (p) => (p.symbol === symbol || getCleanSymbol(p.symbol) === cleanSym) && p.direction === direction
      );
      if (matchingPositions.length > 0) {
        avgEntryPrice = matchingPositions[0].entry_price || 0;
        leverage = matchingPositions[0].leverage || leverage;
      }
    }

    if (avgEntryPrice <= 0) {
      noPosSkippedCount++;
      continue;
    }

    const info = await getInstrumentInfoCached(env, client, symbol);
    const tickSz = info?.tickSz || '0.1';

    // 核心铁律：严格按平台全部仓位“固定模式”收益率（ROI%）计算触发价格（非涨跌幅%）
    const { tpTriggerPx: targetTpTriggerPx, slTriggerPx: targetSlTriggerPx } = calculateRoiTpSlPrices(
      avgEntryPrice,
      direction,
      leverage,
      tpRatioPct,
      slRatioPct,
      tickSz
    );

    if (!targetTpTriggerPx && !targetSlTriggerPx) continue;

    const targetOrdType: 'oco' | 'conditional' = (targetTpTriggerPx && targetSlTriggerPx) ? 'oco' : 'conditional';

    // 核对平台上的待生效策略单
    const platformAlgo = pendingAlgoMap.get(`${symbol}:${direction}`) ||
                         pendingAlgoMap.get(`${cleanSym}:${direction}`) ||
                         pendingAlgoMap.get(`${symbol}:net`) ||
                         pendingAlgoMap.get(`${cleanSym}:net`);

    if (platformAlgo?.algoId) {
      const existingOrdType = platformAlgo.ordType;
      const existingAlgoId = String(platformAlgo.algoId);
      const curTp = platformAlgo.tpTriggerPx ? String(platformAlgo.tpTriggerPx) : '';
      const curSl = platformAlgo.slTriggerPx ? String(platformAlgo.slTriggerPx) : '';

      // 价格和类型均完全匹配 -> 0开销保持
      if (
        existingOrdType === targetOrdType &&
        curTp === (targetTpTriggerPx || '') &&
        curSl === (targetSlTriggerPx || '')
      ) {
        unchangedCount++;
        continue;
      }

      // 订单类型相同，直接批量 amend 改单
      if (existingOrdType === targetOrdType) {
        toAmendList.push({
          symbol,
          direction,
          coin,
          avgEntryPrice,
          leverage,
          tdMode,
          targetOrdType,
          targetTpTriggerPx,
          targetSlTriggerPx,
          algoStateKey,
          existingAlgoId,
        });
      } else {
        // 订单类型不同（如由 conditional 变为 oco），OKX 不支持跨类型修改，直接加入批量撤单 + 批量新挂单
        toCancelForReattachList.push({ instId: symbol, algoId: existingAlgoId });
        toAttachList.push({
          symbol,
          direction,
          coin,
          avgEntryPrice,
          leverage,
          tdMode,
          targetOrdType,
          targetTpTriggerPx,
          targetSlTriggerPx,
          algoStateKey,
        });
      }
    } else {
      // 平台上无对应挂单 -> 加入批量挂单列表
      toAttachList.push({
        symbol,
        direction,
        coin,
        avgEntryPrice,
        leverage,
        tdMode,
        targetOrdType,
        targetTpTriggerPx,
        targetSlTriggerPx,
        algoStateKey,
      });
    }
  }

  const logsToInsert: Array<{ type: string; message: string }> = [];
  let successAmendCount = 0;
  let successAttachCount = 0;
  const failedAmendItems: AlgoTask[] = [];

  // 3. 执行直接改单逻辑（真实批量化处理，无串行阻塞）
  if (toAmendList.length > 0) {
    const amendParamsList = toAmendList.map((item) => ({
      instId: item.symbol,
      algoId: item.existingAlgoId,
      newTpTriggerPx: item.targetTpTriggerPx || undefined,
      newTpOrdPx: item.targetTpTriggerPx ? '-1' : undefined,
      newTpTriggerPxType: item.targetTpTriggerPx ? ('last' as const) : undefined,
      newSlTriggerPx: item.targetSlTriggerPx || undefined,
      newSlOrdPx: item.targetSlTriggerPx ? '-1' : undefined,
      newSlTriggerPxType: item.targetSlTriggerPx ? ('last' as const) : undefined,
    }));

    const amendResults = await client.amendAlgoOrdersBatch(amendParamsList);
    for (let i = 0; i < toAmendList.length; i++) {
      const item = toAmendList[i];
      const res = amendResults[i];
      if (res && res.success) {
        successAmendCount++;
        const stateObj = {
          algoId: item.existingAlgoId,
          tpTriggerPx: item.targetTpTriggerPx || '',
          slTriggerPx: item.targetSlTriggerPx || '',
          avgEntryPrice: item.avgEntryPrice,
          leverage: item.leverage,
          updateTime: Date.now(),
        };
        memoryAlgoStateCache.set(item.algoStateKey, stateObj);
        setConfigValue(env, item.algoStateKey, JSON.stringify(stateObj)).catch(() => {});
      } else {
        // 改单失败转入批量撤单重挂单流程
        failedAmendItems.push(item);
      }
    }
  }

  // 4. 执行批量撤单逻辑（合并僵尸单、改单失败旧单、跨类型需要重建的旧单）
  const allCancelOrders: Array<{ instId: string; algoId?: string }> = [
    ...toCancelZombieList,
    ...toCancelForReattachList,
    ...failedAmendItems.filter(it => !!it.existingAlgoId).map(it => ({ instId: it.symbol, algoId: it.existingAlgoId })),
  ];
  if (allCancelOrders.length > 0) {
    try {
      await client.cancelAlgoOrdersBatch(allCancelOrders);
    } catch (cancelErr) {
      console.warn('[syncAlgoOrders] 批量撤单异常:', cancelErr);
    }
  }

  // 5. 执行批量挂单逻辑（合并全新挂单与改单失败转重挂单）
  const allAttachTasks: AlgoTask[] = [
    ...toAttachList,
    ...failedAmendItems,
  ];

  const realFailedList: Array<{ symbol: string; direction: string; errMsg: string }> = [];

  if (allAttachTasks.length > 0) {
    const attachParamsList = allAttachTasks.map((item) => {
      const closeSide: 'buy' | 'sell' = item.direction === 'long' ? 'sell' : 'buy';
      return {
        instId: item.symbol,
        tdMode: item.tdMode,
        side: closeSide,
        posSide: item.direction,
        ordType: item.targetOrdType,
        closeFraction: '1',
        cxlOnClosePos: true,
        reduceOnly: true,
        tpTriggerPx: item.targetTpTriggerPx || undefined,
        tpTriggerPxType: item.targetTpTriggerPx ? ('last' as const) : undefined,
        tpOrdPx: item.targetTpTriggerPx ? '-1' : undefined,
        slTriggerPx: item.targetSlTriggerPx || undefined,
        slTriggerPxType: item.targetSlTriggerPx ? ('last' as const) : undefined,
        slOrdPx: item.targetSlTriggerPx ? '-1' : undefined,
      };
    });

    const attachResults = await client.attachAlgoOrdersBatch(attachParamsList);
    const failedIndices: number[] = [];

    for (let i = 0; i < allAttachTasks.length; i++) {
      const item = allAttachTasks[i];
      const res = attachResults[i];
      if (res && res.algoId) {
        successAttachCount++;
        const newAlgoId = String(res.algoId);
        const stateObj = {
          algoId: newAlgoId,
          tpTriggerPx: item.targetTpTriggerPx || '',
          slTriggerPx: item.targetSlTriggerPx || '',
          avgEntryPrice: item.avgEntryPrice,
          leverage: item.leverage,
          updateTime: Date.now(),
        };
        memoryAlgoStateCache.set(item.algoStateKey, stateObj);
        setConfigValue(env, item.algoStateKey, JSON.stringify(stateObj)).catch(() => {});
      } else {
        failedIndices.push(i);
      }
    }

    // 若有初次失败项，冷却 500ms 批量重试一次
    if (failedIndices.length > 0) {
      await new Promise((r) => setTimeout(r, 500));
      const retryParamsList = failedIndices.map(idx => attachParamsList[idx]);
      const retryResults = await client.attachAlgoOrdersBatch(retryParamsList);

      for (let k = 0; k < failedIndices.length; k++) {
        const origIdx = failedIndices[k];
        const item = allAttachTasks[origIdx];
        const res = retryResults[k];
        if (res && res.algoId) {
          successAttachCount++;
          const newAlgoId = String(res.algoId);
          const stateObj = {
            algoId: newAlgoId,
            tpTriggerPx: item.targetTpTriggerPx || '',
            slTriggerPx: item.targetSlTriggerPx || '',
            avgEntryPrice: item.avgEntryPrice,
            leverage: item.leverage,
            updateTime: Date.now(),
          };
          memoryAlgoStateCache.set(item.algoStateKey, stateObj);
          setConfigValue(env, item.algoStateKey, JSON.stringify(stateObj)).catch(() => {});
        } else {
          realFailedList.push({
            symbol: item.symbol,
            direction: item.direction,
            errMsg: 'OKX拒绝全仓止盈止损委托挂单',
          });
        }
      }
    }
  }

  // 6. 汇总生成高信息量、聚合清晰的系统日志，单次批量写入 D1
  const totalUpdated = successAmendCount + successAttachCount;
  if (totalUpdated > 0 || realFailedList.length > 0 || unchangedCount > 0) {
    logsToInsert.push({
      type: realFailedList.length > 0 ? 'warn' : 'info',
      message: `【策略单批量同步完成】共处理 ${uniquePairs.length} 项: 成功同步 ${totalUpdated} 笔(改单${successAmendCount}/新挂单${successAttachCount})，价格未变保持 ${unchangedCount} 笔，无持仓安全跳过 ${noPosSkippedCount} 笔，异常 ${realFailedList.length} 笔`,
    });
  }

  if (realFailedList.length > 0) {
    logsToInsert.push({
      type: 'error',
      message: `【策略单挂单异常警告】以下 ${realFailedList.length} 个真实持仓挂单未成功: ${realFailedList.map(f => `${f.symbol}(${f.direction === 'long' ? '多' : '空'}: ${f.errMsg})`).join('; ')}`,
    });
  }

  if (logsToInsert.length > 0) {
    await batchInsertSystemLogs(env, logsToInsert).catch(() => {});
  }
}

/**
 * 兼容导出：单币种全仓固定收益率止盈止损同步器
 */
export async function syncFullPositionAlgoOrder(
  client: OKXClient,
  env: Env,
  symbol: string,
  direction: 'long' | 'short',
  coinConfig?: CoinPair,
  tickerMap?: Map<string, any>
): Promise<void> {
  await syncFixedRoiFullPositionAlgoOrders(
    client,
    env,
    [`${symbol}:${direction}`],
    undefined,
    tickerMap
  );
}
