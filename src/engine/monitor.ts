import {
  getCoinPairs,
  getOpenPositions,
  closePositionRecord,
  insertSystemLog,
  batchInsertSystemLogs,
  updatePositionUnrealizedPnl,
  batchUpdatePositionUnrealizedPnl,
  batchUpdateCoinPairsFunding,
  batchClosePositionsAndTradeLogs,
  insertTradeLog,
  insertPosition,
  getConfig,
  getConfigValue,
  setConfigValue,
  updateCoinPair,
} from '../db/queries';
import { getInstrumentInfoCached, syncFullPositionAlgoOrder, syncFixedRoiFullPositionAlgoOrders, clearAlgoStateCache } from './scheduler';
import { isCycleTimeout, isSubrequestLimitReached } from '../okx/signer';
export type OKXClientType = ReturnType<typeof import('../okx/live-client').createLiveClient>;
import type { Position, CoinPair, TradeLog, OKXPosition } from '../types';
import { OKX_FEE_RATE } from '../constants';

export function getCleanSymbol(sym: string): string {
  if (!sym) return '';
  return sym
    .toUpperCase()
    .trim()
    .replace(/-SWAP$/, '')
    .replace(/[\/\-_]/g, '')
    .replace(/USDT$/, '');
}

function computePnL(position: Position, exitPrice: number): number {
  if (position.entry_price <= 0 || position.margin <= 0) return 0;
  const priceChangeRate = position.direction === 'long'
    ? (exitPrice - position.entry_price) / position.entry_price
    : (position.entry_price - exitPrice) / position.entry_price;
  const leverage = position.leverage || 10;
  return position.margin * priceChangeRate * leverage;
}

function resolveCloseReason(position: Position, exitPrice: number, coinConfig?: CoinPair): string {
  if (position.entry_price <= 0 || exitPrice <= 0) return 'manual';

  const leverage = position.leverage || coinConfig?.leverage || 10;
  const pnlRate = position.direction === 'long'
    ? (exitPrice - position.entry_price) / position.entry_price
    : (position.entry_price - exitPrice) / position.entry_price;
  const actualRoiPct = pnlRate * leverage * 100; // 实际全仓收益率百分比 (例如 +10%)

  // 1. 基于持仓实际设置的止盈价格或全仓止盈收益率判断
  const tpPx = position.tp_price > 0 ? position.tp_price : 0;
  const targetTpRoi = coinConfig?.tp_ratio !== undefined && coinConfig?.tp_ratio !== null ? Number(coinConfig.tp_ratio) : 0;

  if (tpPx > 0) {
    if (position.direction === 'long' && exitPrice >= tpPx * 0.998) return 'tp';
    if (position.direction === 'short' && exitPrice <= tpPx * 1.002) return 'tp';
  }
  if (targetTpRoi > 0 && actualRoiPct >= targetTpRoi * 0.98) {
    return 'tp';
  }

  // 2. 基于持仓实际设置的止损价格或全仓止损收益率判断
  const slPx = position.sl_price > 0 ? position.sl_price : 0;
  const targetSlRoi = coinConfig?.sl_ratio !== undefined && coinConfig?.sl_ratio !== null ? Number(coinConfig.sl_ratio) : 0;

  if (slPx > 0) {
    if (position.direction === 'long' && exitPrice <= slPx * 1.002) return 'sl';
    if (position.direction === 'short' && exitPrice >= slPx * 0.998) return 'sl';
  }
  if (targetSlRoi > 0 && actualRoiPct <= -targetSlRoi * 0.98) {
    return 'sl';
  }

  return 'manual';
}

function recalcFundingInMemory(
  coin: CoinPair | undefined,
  symbol: string,
  pnl: number,
  profitTransferRatio: number,
  fundingUpdatesBuffer: Map<string, number>,
  estimatedFee: number = 0
) {
  if (!coin) return;
  const retainedPnl = pnl > 0 ? pnl * (1 - (profitTransferRatio / 100)) : pnl;
  const actualPnlDiff = retainedPnl - estimatedFee;
  
  const currentBuffer = fundingUpdatesBuffer.get(symbol) !== undefined ? fundingUpdatesBuffer.get(symbol)! : coin.funding_amount;
  const newFunding = Math.max(0, currentBuffer + actualPnlDiff);
  if (Math.abs(newFunding - currentBuffer) > 0.001) {
    fundingUpdatesBuffer.set(symbol, newFunding);
  }
}

interface CleanOKXPos {
  instId: string;
  cleanSymbol: string;
  direction: 'long' | 'short';
  quantity: number;
  avgPx: number;
  lever: number;
  lastPx: number;
  raw: any;
}

export async function syncAndSettlePositions(
  client: any,
  env: Env,
  fundingUpdatesBuffer: Map<string, number>,
  isManualSync: boolean = false,
  tickerMap?: Map<string, any>,
  prefetchedPositions?: OKXPosition[],
  cachedCoins?: CoinPair[]
): Promise<{ activePositions: Position[]; affectedPairs: Set<string> }> {
  const dbPositions = await getOpenPositions(env);
  const coins = cachedCoins || await getCoinPairs(env);
  const coinMap = new Map<string, CoinPair>();
  for (const c of coins) {
    coinMap.set(c.symbol, c);
    coinMap.set(getCleanSymbol(c.symbol), c);
  }
  const now = Date.now();
  const affectedPairs = new Set<string>();

  let rawOkxPositions: OKXPosition[] = [];
  let queryError: string | null = null;
  if (prefetchedPositions === null) {
    // 预拉取持仓失败，严禁对账以防误判平仓
    return { activePositions: dbPositions, affectedPairs };
  } else if (prefetchedPositions !== undefined) {
    rawOkxPositions = prefetchedPositions;
  } else {
    try {
      rawOkxPositions = await client.getPositions();
    } catch (err: any) {
      queryError = String(err?.message || err);
      await insertSystemLog(env, 'warn', `[对账警告] 获取OKX持仓失败，暂缓本轮对账: ${queryError}`);
    }
  }

  if (queryError !== null) {
    return { activePositions: dbPositions, affectedPairs };
  }

  // 0. 准备实时行情缓存（若未传入则主动拉取 SWAP 全合约批量行情）
  const tickerCache = new Map<string, any>();
  if (tickerMap && tickerMap.size > 0) {
    for (const [k, v] of tickerMap.entries()) {
      tickerCache.set(k, v);
      tickerCache.set(getCleanSymbol(k), v);
    }
  } else {
    try {
      const neededSymbols = new Set<string>();
      for (const p of dbPositions) {
        if (p.symbol) neededSymbols.add(p.symbol);
      }
      if (neededSymbols.size > 0) {
        const fetchedTickers = await client.getTickersForSymbols(Array.from(neededSymbols));
        if (fetchedTickers && fetchedTickers.size > 0) {
          for (const [k, v] of fetchedTickers.entries()) {
            tickerCache.set(k, v);
            tickerCache.set(getCleanSymbol(k), v);
          }
        }
      }
    } catch {}
  }

  // 1. 结构化清洗 OKX 所有活跃仓位（覆盖所有账户模式与单向/双向持仓）
  const cleanOkxList: CleanOKXPos[] = [];
  const okxByCleanKey = new Map<string, CleanOKXPos>();

  for (const op of rawOkxPositions) {
    const posSz = op.pos ? parseFloat(op.pos) : 0;
    if (Math.abs(posSz) <= 0.000001) continue;

    let dir: 'long' | 'short' = 'long';
    if (op.posSide === 'short') {
      dir = 'short';
    } else if (op.posSide === 'long') {
      dir = 'long';
    } else {
      dir = posSz < 0 ? 'short' : 'long';
    }

    const cleanSym = getCleanSymbol(op.instId);
    const avgPx = parseFloat(op.avgPx || '0');
    const lever = parseFloat(op.lever || '10');
    const markPx = parseFloat(op.markPx || '0');
    const rawLast = parseFloat(op.last || '0');
    const tickerItem = tickerCache.get(op.instId) || tickerCache.get(cleanSym);
    const tickerPx = tickerItem?.last ? parseFloat(tickerItem.last) : 0;
    const lastPx = tickerPx > 0 ? tickerPx : (rawLast > 0 ? rawLast : (markPx > 0 ? markPx : avgPx));

    const clean: CleanOKXPos = {
      instId: op.instId,
      cleanSymbol: cleanSym,
      direction: dir,
      quantity: Math.abs(posSz),
      avgPx,
      lever,
      lastPx,
      raw: op,
    };

    cleanOkxList.push(clean);
    const cleanKey = `${cleanSym}:${dir}`;
    // 如果同一币种同一方向存在多条记录，累加张数并计算加权价格
    if (okxByCleanKey.has(cleanKey)) {
      const exist = okxByCleanKey.get(cleanKey)!;
      const totalQty = exist.quantity + clean.quantity;
      if (totalQty > 0) {
        exist.avgPx = (exist.avgPx * exist.quantity + clean.avgPx * clean.quantity) / totalQty;
        exist.quantity = totalQty;
      }
    } else {
      okxByCleanKey.set(cleanKey, { ...clean });
    }
  }

  // 2. 获取相关币种的合约面值（优先读取内存/D1缓存，零API开销）
  const uniqueSymbols = new Set<string>();
  for (const p of dbPositions) {
    uniqueSymbols.add(p.symbol);
  }
  for (const o of cleanOkxList) {
    uniqueSymbols.add(o.instId);
  }

  const ctValMap = new Map<string, number>();
  const fillsCache = new Map<string, any[]>();

  for (const sym of uniqueSymbols) {
    const clean = getCleanSymbol(sym);
    try {
      const info = await getInstrumentInfoCached(env, client, sym).catch(() => null);
      const ctVal = parseFloat(info?.ctVal || '1');
      ctValMap.set(sym, ctVal);
      ctValMap.set(clean, ctVal);
    } catch {
      ctValMap.set(sym, 1);
      ctValMap.set(clean, 1);
    }
  }

  const activePositions: Position[] = [];
  const settleItems: Array<{
    positionId: number;
    closeReason: string;
    closePrice: number;
    closePnl: number;
    closeTime: number;
    tradeLog: Omit<TradeLog, 'id'>;
  }> = [];

  let totalProfitToTransfer = 0;
  let tpCount = 0;
  let slCount = 0;
  let manualCount = 0;
  let totalSettledPnl = 0;

  // 3. 对系统 DB 内的持仓按 (CleanSymbol:Direction) 进行先进先出 FIFO 对账
  const dbGroupMap = new Map<string, Position[]>();
  for (const pos of dbPositions) {
    const cleanKey = `${getCleanSymbol(pos.symbol)}:${pos.direction}`;
    if (!dbGroupMap.has(cleanKey)) dbGroupMap.set(cleanKey, []);
    dbGroupMap.get(cleanKey)!.push(pos);
  }

  const processedOkxKeys = new Set<string>();

  // 保护性拦截：如果本地有持仓，但交易所单次查询返回 0 条，采用 2 周期确认防抖机制，防止网络瞬态抖动误平，同时确保真实全平后能准时结算
  let isOkxEmptyAnomaly = false;
  if (dbPositions.length > 0 && cleanOkxList.length === 0) {
    if (isManualSync) {
      isOkxEmptyAnomaly = false;
      await setConfigValue(env, 'okx_empty_anomaly_count', '0').catch(() => {});
    } else {
      const anomalyCountStr = await getConfigValue(env, 'okx_empty_anomaly_count');
      const anomalyCount = parseInt(anomalyCountStr || '0', 10);
      if (anomalyCount < 1) {
        // 第 1 次返回 0 条，启动防抖暂缓 1 轮
        isOkxEmptyAnomaly = true;
        await setConfigValue(env, 'okx_empty_anomaly_count', String(anomalyCount + 1)).catch(() => {});
      } else {
        // 连续 2 次确认交易所确已为 0 条持仓，判定为真实全平，放行进入结算
        isOkxEmptyAnomaly = false;
        await setConfigValue(env, 'okx_empty_anomaly_count', '0').catch(() => {});
      }
    }
  } else {
    await setConfigValue(env, 'okx_empty_anomaly_count', '0').catch(() => {});
  }

  if (isOkxEmptyAnomaly) {
    console.warn(`[对账保护] 交易所返回0条持仓，本地存在 ${dbPositions.length} 笔持仓(第1次检测)。启动防抖保护，暂缓结算，下轮二次确认。`);
    for (const pos of dbPositions) {
      const cleanSym = getCleanSymbol(pos.symbol);
      const ticker = tickerCache.get(pos.symbol) || tickerCache.get(cleanSym);
      let livePrice = pos.last_price;
      if (ticker?.last) livePrice = parseFloat(ticker.last);
      if (livePrice <= 0) livePrice = pos.entry_price;

      const pnl = computePnL(pos, livePrice);
      pos.last_price = livePrice;
      pos.unrealized_pnl = pnl;
      activePositions.push(pos);
    }
  } else {
    for (const [cleanKey, positions] of dbGroupMap.entries()) {
      const [cleanSym, direction] = cleanKey.split(':') as [string, 'long' | 'short'];
      const coinConfig = coinMap.get(cleanSym);
      const okxPos = okxByCleanKey.get(cleanKey);

      if (okxPos) {
        processedOkxKeys.add(cleanKey);
      }

      const okxAvailableContracts = okxPos ? okxPos.quantity : 0;
      
      // 按照开仓时间升序（先进先出 FIFO 结算已平仓的历史单）
      positions.sort((a, b) => a.open_time - b.open_time);

      let remainingOkxContracts = okxAvailableContracts;

      for (const position of positions) {
        const isTooNew = (now - position.open_time < 5000);
        let isClosed = false;

        if (remainingOkxContracts >= position.quantity - 0.0001) {
          // OKX 平台依然保有该笔订单对应的持仓张数 -> 保持活跃持仓
          remainingOkxContracts -= position.quantity;
          isClosed = false;
        } else if (remainingOkxContracts > 0.0001) {
          // OKX 平台持仓张数不足（发生部分平仓） -> 超出部分且不在新建保护期视为已平仓
          remainingOkxContracts = 0;
          isClosed = !isTooNew;
        } else {
          // OKX 平台该方向持仓为0且不在新建保护期 -> 确认已平仓
          isClosed = !isTooNew;
        }

        if (isClosed) {
          let exitPrice = 0;
          const closingSide = position.direction === 'long' ? 'sell' : 'buy';
          const fills = fillsCache.get(position.symbol) || fillsCache.get(cleanSym) || [];
          const closingFills = fills.filter((f: any) =>
            (f.posSide === position.direction || !f.posSide) &&
            f.side === closingSide &&
            parseInt(f.fillTime, 10) >= position.open_time - 5000
          );

          if (closingFills.length > 0) {
            exitPrice = parseFloat(closingFills[0].fillPx);
          }

          if (exitPrice <= 0) {
            const ticker = tickerCache.get(position.symbol) || tickerCache.get(cleanSym);
            if (ticker?.last) {
              exitPrice = parseFloat(ticker.last);
            } else {
              exitPrice = position.last_price || position.entry_price;
            }
          }

          const closeReason = resolveCloseReason(position, exitPrice, coinConfig);
          const pnl = computePnL(position, exitPrice);
          const profitTransferRatio = coinConfig?.profit_transfer_ratio !== undefined && coinConfig?.profit_transfer_ratio !== null ? coinConfig.profit_transfer_ratio : 0;
          const transferred = pnl > 0 ? pnl * (profitTransferRatio / 100) : 0;

          if (closeReason === 'tp') tpCount++;
          else if (closeReason === 'sl') slCount++;
          else manualCount++;

          totalSettledPnl += pnl;
          totalProfitToTransfer += transferred;

          settleItems.push({
            positionId: position.id,
            closeReason,
            closePrice: exitPrice,
            closePnl: pnl,
            closeTime: now,
            tradeLog: {
              position_id: position.id,
              symbol: position.symbol,
              direction: position.direction,
              entry_price: position.entry_price,
              exit_price: exitPrice,
              quantity: position.quantity,
              margin: position.margin,
              pnl,
              pnl_percent: position.margin > 0 ? (pnl / position.margin) * 100 : 0,
              close_reason: closeReason,
              profit_transferred: transferred,
              open_time: position.open_time,
              close_time: now,
            }
          });

          const estFee = position.margin * (position.leverage || coinConfig?.leverage || 10) * OKX_FEE_RATE;
          recalcFundingInMemory(
            coinConfig,
            position.symbol,
            pnl,
            profitTransferRatio,
            fundingUpdatesBuffer,
            estFee
          );
        } else {
          // 仓位仍在持仓中：优先从实时行情缓存获取真实最新价格
          const ticker = tickerCache.get(position.symbol) || tickerCache.get(cleanSym);
          let livePrice = 0;
          if (ticker?.last && parseFloat(ticker.last) > 0) {
            livePrice = parseFloat(ticker.last);
          } else if (okxPos && okxPos.lastPx > 0 && Math.abs(okxPos.lastPx - position.entry_price) > 0.0000001) {
            livePrice = okxPos.lastPx;
          } else if (position.last_price && position.last_price > 0 && Math.abs(position.last_price - position.entry_price) > 0.0000001) {
            livePrice = position.last_price;
          } else if (okxPos && okxPos.lastPx > 0) {
            livePrice = okxPos.lastPx;
          } else {
            livePrice = position.last_price || position.entry_price;
          }
          if (livePrice <= 0) livePrice = position.entry_price;

          let updatedMargin: number | undefined;
          const ctVal = ctValMap.get(position.symbol) || ctValMap.get(cleanSym) || 1;
          const platformMargin = (position.quantity * ctVal * position.entry_price) / (position.leverage || 10);
          if (platformMargin > 0 && Math.abs(position.margin - platformMargin) > 0.01) {
            position.margin = platformMargin;
            updatedMargin = platformMargin;
          }

          const pnl = computePnL(position, livePrice);
          position.last_price = livePrice;
          position.unrealized_pnl = pnl;
          activePositions.push(position);
        }
      }
    }
  }

  // 4. 双向一致性纳管：如果 OKX 平台有持仓但本地 DB 中完全缺失（如外部手动开仓/历史仓位），自动导入系统
  let adoptedCount = 0;
  for (const okxPos of cleanOkxList) {
    const cleanKey = `${okxPos.cleanSymbol}:${okxPos.direction}`;
    if (!processedOkxKeys.has(cleanKey)) {
      const coinConfig = coinMap.get(okxPos.cleanSymbol) || coinMap.get(okxPos.instId);
      const ctVal = ctValMap.get(okxPos.instId) || ctValMap.get(okxPos.cleanSymbol) || 1;
      const entryPx = okxPos.avgPx > 0 ? okxPos.avgPx : (okxPos.lastPx > 0 ? okxPos.lastPx : 1);
      const lever = okxPos.lever > 0 ? okxPos.lever : (coinConfig?.leverage || 10);
      const margin = (okxPos.quantity * ctVal * entryPx) / lever;
      
      const ticker = tickerCache.get(okxPos.instId) || tickerCache.get(okxPos.cleanSymbol);
      const currentLivePx = (ticker?.last && parseFloat(ticker.last) > 0)
        ? parseFloat(ticker.last)
        : (okxPos.lastPx > 0 ? okxPos.lastPx : entryPx);

      const pnl = (okxPos.direction === 'long' ? (currentLivePx - entryPx) : (entryPx - currentLivePx)) / entryPx * margin * lever;

      try {
        const newPosId = await insertPosition(env, {
          symbol: okxPos.instId,
          direction: okxPos.direction,
          leverage: lever,
          entry_price: entryPx,
          quantity: okxPos.quantity,
          margin,
          okx_order_id: '',
          open_time: now,
          tp_price: 0,
          sl_price: 0,
          tp_algo_id: '',
          sl_algo_id: '',
          unrealized_pnl: pnl,
          last_price: currentLivePx,
          status: 'open',
        });

        activePositions.push({
          id: newPosId,
          symbol: okxPos.instId,
          direction: okxPos.direction,
          leverage: lever,
          entry_price: entryPx,
          quantity: okxPos.quantity,
          margin,
          okx_order_id: '',
          open_time: now,
          tp_price: 0,
          sl_price: 0,
          tp_algo_id: '',
          sl_algo_id: '',
          unrealized_pnl: pnl,
          last_price: currentLivePx,
          status: 'open',
        });

        adoptedCount++;
        processedOkxKeys.add(cleanKey);
      } catch (err) {
        await insertSystemLog(env, 'warn', `自动纳管外部持仓失败 [${okxPos.instId}]: ${String(err)}`);
      }
    }
  }

  // 5. 批量提交平仓结算与交易日志
  if (settleItems.length > 0) {
    try {
      await batchClosePositionsAndTradeLogs(env, settleItems);
    } catch (err) {
      await insertSystemLog(env, 'error', `批量对账平仓落库失败: ${String(err)}`);
    }

    // 聚合利润划转
    if (totalProfitToTransfer > 0.01) {
      try {
        await client.transfer({
          ccy: 'USDT',
          amt: totalProfitToTransfer.toFixed(8),
          from: '18',
          to: '6',
          type: '0',
        });
      } catch (err: any) {
        await insertSystemLog(env, 'warn', `对账聚合利润划转失败 (${totalProfitToTransfer.toFixed(4)} USDT): ${err?.message || String(err)}`);
      }
    }
  }

  // 6. 持仓浮动盈亏（PnL）纯内存计算，不落库 D1（彻底消除高频 D1 写操作）

  // 7. 收集变动币种方向并重置已清平仓位的挂单缓存状态
  for (const item of settleItems) {
    const pairKey = `${item.tradeLog.symbol}:${item.tradeLog.direction}`;
    affectedPairs.add(pairKey);
    const cleanSym = getCleanSymbol(item.tradeLog.symbol);
    const algoStateKey = `agg_algo_${cleanSym}_${item.tradeLog.direction}`;
    // 内存与异步清除旧的挂单缓存记录，确保下一轮开单时可以全新建立
    clearAlgoStateCache(algoStateKey);
    setConfigValue(env, algoStateKey, '').catch(() => {});
  }
  if (adoptedCount > 0) {
    for (const pos of activePositions) {
      affectedPairs.add(`${pos.symbol}:${pos.direction}`);
    }
  }

  if (isManualSync || settleItems.length > 0 || adoptedCount > 0) {
    const summaryMsg = `【步骤1: 持仓监控】对账同步完成: 交易所持仓 ${cleanOkxList.length} 条, 数据库持仓 ${dbPositions.length} 条, 平仓结算 ${settleItems.length} 笔 (止盈:${tpCount}, 止损:${slCount}, 手动/全平:${manualCount}), 自动纳管 ${adoptedCount} 笔, 活跃持仓 ${activePositions.length} 笔, 净盈亏: ${totalSettledPnl >= 0 ? '+' : ''}${totalSettledPnl.toFixed(2)} USDT`;
    await insertSystemLog(env, 'info', summaryMsg);
  }

  return { activePositions, affectedPairs };
}

export async function monitorPositions(
  client: any,
  env: Env,
  tickerMap?: Map<string, any>,
  prefetchedPositions?: OKXPosition[],
  cachedCoins?: CoinPair[]
): Promise<Set<string>> {
  const affectedPairs = new Set<string>();
  const fundingUpdatesBuffer = new Map<string, number>();
  const { activePositions, affectedPairs: syncAffected } = await syncAndSettlePositions(
    client,
    env,
    fundingUpdatesBuffer,
    false,
    tickerMap,
    prefetchedPositions,
    cachedCoins
  );
  for (const p of syncAffected) affectedPairs.add(p);

  if (fundingUpdatesBuffer.size > 0) {
    try {
      const updates = Array.from(fundingUpdatesBuffer.entries()).map(([symbol, fundingAmount]) => ({ symbol, fundingAmount }));
      await batchUpdateCoinPairsFunding(env, updates);
    } catch (err) {
      await insertSystemLog(env, 'error', `批量更新资金变动失败: ${String(err)}`);
    }
  }

  // 对账若有新增纳管持仓，针对变动的币种更新全仓固定收益率止盈止损挂单
  if (affectedPairs.size > 0) {
    try {
      await syncFixedRoiFullPositionAlgoOrders(
        client,
        env,
        Array.from(affectedPairs),
        activePositions,
        tickerMap
      );
    } catch (syncErr) {
      console.warn(`[Monitor] 固定收益率全仓止盈止损同步异常:`, syncErr);
    }
  }

  return affectedPairs;
}
