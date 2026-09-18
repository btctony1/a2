import type { ApiResponse, Position, TimeoutUnit } from '../types';
import {
  getConfig,
  getOpenPositions,
  getPositionById,
  closePositionRecord,
  insertTradeLog,
  insertSystemLog,
  updateCoinPair,
  getCoinPairs,
  batchClosePositionsAndTradeLogs,
  batchUpdateCoinPairsFunding,
  setConfigValue,
  setConfigValues,
} from '../db/queries';
import { createLiveClient } from '../okx/live-client';
import { OKX_FEE_RATE } from '../constants';
import { syncAndSettlePositions, getCleanSymbol } from '../engine/monitor';

function intervalToMs(value: number, unit: TimeoutUnit): number {
  switch (unit) {
    case 'day': return value * 86400000;
    case 'hour': return value * 3600000;
    case 'minute': return value * 60000;
    case 'second': return value * 1000;
  }
}

async function recalcFundingAfterClose(
  env: Env,
  symbol: string,
  pnl: number,
  transferred: number,
  coinConfig: any,
  reason: string,
  posId: number,
  fee: number,
): Promise<void> {
  const timeoutValue = coinConfig?.timeout_value || 4;
  const timeoutUnit = coinConfig?.timeout_unit || 'hour';
  const intervalValue = coinConfig?.open_interval_value || 1;
  const intervalUnit = coinConfig?.open_interval_unit || 'hour';
  
  if (timeoutValue <= 0 || intervalValue <= 0) return Promise.resolve();
  const timeoutMs = intervalToMs(timeoutValue, timeoutUnit);
  const intervalMs = intervalToMs(intervalValue, intervalUnit);
  if (intervalMs <= 0) return Promise.resolve();
  const fundingSlices = Math.max(1, Math.floor(timeoutMs / intervalMs));

  return getCoinPairs(env).then(async (pairs) => {
    const pair = pairs.find(c => c.symbol === symbol);
    if (!pair) return;
    const currentFunding = pair.funding_amount;

    const netPnl = pnl - transferred;
    const newFunding = Math.max(0, currentFunding + netPnl - fee);

    await updateCoinPair(env, symbol, { funding_amount: newFunding });
    await insertSystemLog(env, 'info',
      `${symbol} #${posId} ${reason}后重算：原总额=${currentFunding.toFixed(2)} 净盈亏=${netPnl.toFixed(2)}(全额=${pnl.toFixed(2)} 划转=${transferred.toFixed(2)}) 手续费=${fee.toFixed(2)} 新总额=${newFunding.toFixed(2)}`
    );
  });
}

let cachedLivePriceMap: Map<string, number> | null = null;
let cachedLivePriceMapTimestamp = 0;
const LIVE_PRICE_CACHE_TTL_MS = 3000; // 3秒内存防刷共享缓存，避免短时间内并发重复拉取行情大包且0写D1

export async function getLivePriceMapCached(env: Env): Promise<Map<string, number>> {
  const livePriceMap = new Map<string, number>();
  const now = Date.now();
  if (cachedLivePriceMap && now - cachedLivePriceMapTimestamp < LIVE_PRICE_CACHE_TTL_MS) {
    for (const [k, v] of cachedLivePriceMap.entries()) {
      livePriceMap.set(k, v);
    }
    return livePriceMap;
  }

  try {
    const config = await getConfig(env);
    const apiKey = env.OKX_API_KEY || config.okx_api_key || '';
    const secretKey = env.OKX_SECRET_KEY || config.okx_secret_key || '';
    const passphrase = env.OKX_PASSPHRASE || config.okx_passphrase || '';
    if (apiKey && secretKey && passphrase) {
      const client = createLiveClient(apiKey, secretKey, passphrase, env.OKX_PROXY_URL);
      const coins = await getCoinPairs(env);
      const positions = await getOpenPositions(env);
      const symbols = new Set<string>();
      for (const c of coins) if (c.symbol) symbols.add(c.symbol);
      for (const p of positions) if (p.symbol) symbols.add(p.symbol);

      if (symbols.size > 0) {
        const tickers = await client.getTickersForSymbols(Array.from(symbols));
        if (tickers && tickers.size > 0) {
          for (const [k, v] of tickers.entries()) {
            if (v?.last) {
              const p = parseFloat(v.last);
              if (p > 0) {
                const clean = getCleanSymbol(k);
                livePriceMap.set(k, p);
                livePriceMap.set(clean, p);
                livePriceMap.set(`${clean}-USDT-SWAP`, p);
                livePriceMap.set(`${clean}-USDT`, p);
                livePriceMap.set(`${clean}/USDT`, p);
              }
            }
          }
          cachedLivePriceMap = new Map(livePriceMap);
          cachedLivePriceMapTimestamp = now;
        }
      }
    }
  } catch (err) {
    // 忽略异常，降级使用已有缓存
  }
  return livePriceMap;
}

export async function getPositionsHandler(env: Env): Promise<ApiResponse<Position[]>> {
  // 从 D1 读取当前活跃持仓（纯读取，0 D1写入）
  const positions = await getOpenPositions(env);
  if (!positions || positions.length === 0) {
    return { success: true, data: [] };
  }

  // 批量获取 OKX 全合约真实最新行情价格，用于实时高精度计算全量活跃持仓 PnL（1.5秒内存防刷共享缓存）
  const livePriceMap = await getLivePriceMapCached(env);

  const coins = await getCoinPairs(env);
  const coinPriceMap = new Map<string, number>();
  for (const c of coins) {
    if (c.last_price && c.last_price > 0) {
      const clean = getCleanSymbol(c.symbol);
      coinPriceMap.set(c.symbol, c.last_price);
      coinPriceMap.set(clean, c.last_price);
      coinPriceMap.set(`${clean}-USDT-SWAP`, c.last_price);
      coinPriceMap.set(`${clean}-USDT`, c.last_price);
    }
  }

  for (const pos of positions) {
    const cleanSym = getCleanSymbol(pos.symbol);
    const price = livePriceMap.get(pos.symbol)
      || livePriceMap.get(cleanSym)
      || livePriceMap.get(`${cleanSym}-USDT-SWAP`)
      || livePriceMap.get(`${cleanSym}-USDT`)
      || coinPriceMap.get(pos.symbol)
      || coinPriceMap.get(cleanSym)
      || coinPriceMap.get(`${cleanSym}-USDT-SWAP`)
      || pos.last_price
      || pos.entry_price;
    pos.last_price = price;
    if (price > 0 && pos.entry_price > 0 && pos.margin > 0) {
      const priceChangeRate = pos.direction === 'long'
        ? (price - pos.entry_price) / pos.entry_price
        : (pos.entry_price - price) / pos.entry_price;
      pos.unrealized_pnl = pos.margin * priceChangeRate * (pos.leverage || 10);
    }
  }

  return { success: true, data: positions };
}

export async function syncPositionsHandler(env: Env): Promise<ApiResponse<Position[]>> {
  try {
    const config = await getConfig(env);
    const apiKey = env.OKX_API_KEY || config.okx_api_key;
    const secretKey = env.OKX_SECRET_KEY || config.okx_secret_key;
    const passphrase = env.OKX_PASSPHRASE || config.okx_passphrase;

    if (!apiKey || !secretKey || !passphrase) {
      const msg = '未配置 OKX API Key/Secret/Passphrase，无法连接交易所进行持仓对账';
      await insertSystemLog(env, 'warn', `[对账提示] ${msg}`);
      return { success: false, error: msg };
    }

    const client = createLiveClient(apiKey, secretKey, passphrase, env.OKX_PROXY_URL);
    const fundingUpdatesBuffer = new Map<string, number>();
    const currentPositions = await getOpenPositions(env);
    const syms = Array.from(new Set(currentPositions.map((p) => p.symbol).filter(Boolean)));
    const tickerMap = syms.length > 0 ? await client.getTickersForSymbols(syms).catch(() => new Map()) : new Map();
    const { activePositions } = await syncAndSettlePositions(client, env, fundingUpdatesBuffer, true, tickerMap);
    return { success: true, data: activePositions };
  } catch (err: any) {
    const errMsg = String(err?.message || err);
    await insertSystemLog(env, 'error', `[对账同步异常] ${errMsg}`);
    return { success: false, error: errMsg };
  }
}

export async function closePositionHandler(
  env: Env,
  body: { position_id: number }
): Promise<ApiResponse<null>> {
  try {
    const config = await getConfig(env);
    const position = await getPositionById(env, body.position_id);
    if (!position) {
      return { success: false, error: 'Position not found' };
    }

    const apiKey = env.OKX_API_KEY || config.okx_api_key;
    const secretKey = env.OKX_SECRET_KEY || config.okx_secret_key;
    const passphrase = env.OKX_PASSPHRASE || config.okx_passphrase;
    const client = createLiveClient(apiKey, secretKey, passphrase, env.OKX_PROXY_URL);

    const ticker = await client.getTicker(position.symbol);
    const exitPrice = parseFloat(ticker.last);

    let priceChangeRate = position.direction === 'long'
      ? (exitPrice - position.entry_price) / position.entry_price
      : (position.entry_price - exitPrice) / position.entry_price;
    const pnl = position.margin * priceChangeRate * position.leverage;

    const pairs = await getCoinPairs(env);
    const coinConfig = pairs.find(c => c.symbol === position.symbol);
    const marginMode = coinConfig?.margin_mode || 'isolated';

    await client.cancelAlgoOrders(position.symbol, position.tp_algo_id).catch(() => {});
    await client.closePosition(position.symbol, marginMode, position.direction, position.quantity.toString());

    const dbUpdated = await closePositionRecord(env, body.position_id, 'manual', exitPrice, pnl);
    if (!dbUpdated) return { success: true, data: null }; // Already closed

    const pnlPercent = position.margin > 0 ? (pnl / position.margin) * 100 : 0;
    const transferRatio = (coinConfig?.profit_transfer_ratio !== undefined && coinConfig?.profit_transfer_ratio !== null) ? coinConfig.profit_transfer_ratio : 0;
    const transferred = pnl > 0 ? pnl * (transferRatio / 100) : 0;
    await insertTradeLog(env, {
      position_id: body.position_id,
      symbol: position.symbol,
      direction: position.direction,
      entry_price: position.entry_price,
      exit_price: exitPrice,
      quantity: position.quantity,
      margin: position.margin,
      pnl,
      pnl_percent: pnlPercent,
      close_reason: 'manual',
      profit_transferred: transferred,
      open_time: position.open_time,
      close_time: Date.now(),
    });

    if (transferred > 0) {
      await client.transfer({
        ccy: 'USDT',
        amt: transferred.toFixed(8),
        from: '18',
        to: '6',
        type: '0',
      }).catch(() => {});
    }

    if (coinConfig) await recalcFundingAfterClose(env, position.symbol, pnl, transferred, coinConfig, '手动', position.id,
      position.margin * position.leverage * OKX_FEE_RATE);

    await insertSystemLog(env, 'close', `${position.symbol} #${position.id} 手动平仓 PnL=${pnl.toFixed(2)}`);
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function closeAllPositionsHandler(
  env: Env,
  body: { symbols?: string[] }
): Promise<ApiResponse<{ closed: number }>> {
  try {
    const config = await getConfig(env);
    const dbPositions = await getOpenPositions(env);
    const targetSymbols = body.symbols && body.symbols.length > 0
      ? new Set(body.symbols)
      : null;

    const toClose = targetSymbols
      ? dbPositions.filter((p) => targetSymbols.has(p.symbol))
      : dbPositions;

    const apiKey = env.OKX_API_KEY || config.okx_api_key;
    const secretKey = env.OKX_SECRET_KEY || config.okx_secret_key;
    const passphrase = env.OKX_PASSPHRASE || config.okx_passphrase;

    if (!apiKey || !secretKey || !passphrase) {
      return { success: false, error: '未配置 OKX API 密钥，无法执行平仓' };
    }

    const client = createLiveClient(apiKey, secretKey, passphrase, env.OKX_PROXY_URL);
    const pairs = await getCoinPairs(env);
    const coinMap = new Map<string, any>();
    for (const c of pairs) {
      coinMap.set(c.symbol, c);
      coinMap.set(getCleanSymbol(c.symbol), c);
    }

    // 1. 严格按照平台级一键平仓执行：先向 OKX 交易所清空所有目标合约持仓并撤销全部策略单
    // 获取 OKX 交易所实际所有持仓
    const okxPositions = await client.getPositions().catch(() => []);
    
    // 收集所有需要平仓的 (symbol, direction) 组合（来自 DB 待平记录 + OKX 实际持仓）
    const closeTargets = new Set<string>();
    for (const p of toClose) {
      closeTargets.add(`${p.symbol}:${p.direction}`);
    }
    for (const op of okxPositions) {
      if (Math.abs(parseFloat(op.pos)) > 0.000001) {
        if (!targetSymbols || targetSymbols.has(op.instId)) {
          const dir = op.posSide === 'short' ? 'short' : 'long';
          closeTargets.add(`${op.instId}:${dir}`);
        }
      }
    }

    if (closeTargets.size === 0 && toClose.length === 0) {
      return { success: true, data: { closed: 0 } };
    }

    // 第一步：在 OKX 交易所平台级市价全平各个币种持仓，并撤销挂单 (真并发执行，彻底消除逐个串行阻塞)
    const aggAlgoKeysToClear: Record<string, string> = {};
    await Promise.all(
      Array.from(closeTargets).map(async (targetKey) => {
        const [sym, dir] = targetKey.split(':') as [string, 'long' | 'short'];
        const coinConfig = coinMap.get(sym) || coinMap.get(getCleanSymbol(sym));
        const marginMode = coinConfig?.margin_mode || 'isolated';

        try {
          // 并发撤销该币种在该方向的全部挂单/止盈止损单
          await client.cancelAllAlgoOrdersForInst(sym, dir).catch(() => {});
          const cleanSym = getCleanSymbol(sym);
          aggAlgoKeysToClear[`agg_algo_${cleanSym}_${dir}`] = '';

          // 并发执行 OKX 平台级一键市价全平（不传 sz，直接市价平掉该币种方向所有持仓）
          await client.closePosition(sym, marginMode, dir).catch((err) => {
            const errStr = String(err);
            if (!errStr.includes('51006') && !errStr.includes('51008') && !errStr.includes('not exist') && !errStr.includes('0')) {
              console.warn(`[CloseAll] OKX closePosition warning [${sym} ${dir}]:`, err);
            }
          });
        } catch (err) {
          console.warn(`[CloseAll] 平台平仓操作异常 [${sym} ${dir}]:`, err);
        }
      })
    );

    // 批量清理聚合挂单配置缓存状态（单次事务提交）
    if (Object.keys(aggAlgoKeysToClear).length > 0) {
      await setConfigValues(env, aggAlgoKeysToClear).catch(() => {});
    }

    // 第二步：批量获取所有待平仓币种的最新市场行情价格作为结算基准 (恒定 1 次子请求打包拉取全合约大包行情，杜绝逐个币种网络请求)
    const tickerCache = new Map<string, number>();
    const neededSymbols = Array.from(new Set(toClose.map((p) => p.symbol)));
    if (neededSymbols.length > 0) {
      try {
        const batchTickers = await client.getTickersForSymbols(neededSymbols);
        for (const sym of neededSymbols) {
          const t = batchTickers.get(sym)
            || batchTickers.get(getCleanSymbol(sym))
            || batchTickers.get(`${getCleanSymbol(sym)}-USDT-SWAP`);
          if (t?.last && parseFloat(t.last) > 0) {
            tickerCache.set(sym, parseFloat(t.last));
          }
        }
      } catch (e) {
        console.warn('[CloseAll] 批量获取行情异常，降级使用持仓已有价格:', e);
      }
    }

    // 第三步：执行平台清空所有仓位后再统一次核算（统一计算盈亏、批量结算入库、聚合利润划转、批量更新资金）
    const now = Date.now();
    const settleItems: any[] = [];
    let totalProfitToTransfer = 0;
    let totalPnl = 0;
    const fundingChanges = new Map<string, { netPnl: number; fee: number }>();

    for (const pos of toClose) {
      const coinConfig = coinMap.get(pos.symbol) || coinMap.get(getCleanSymbol(pos.symbol));
      const exitPrice = tickerCache.get(pos.symbol) || pos.last_price || pos.entry_price;

      const priceChangeRate = pos.direction === 'long'
        ? (exitPrice - pos.entry_price) / pos.entry_price
        : (pos.entry_price - exitPrice) / pos.entry_price;
      const pnl = pos.margin * priceChangeRate * (pos.leverage || 10);
      const pnlPercent = pos.margin > 0 ? (pnl / pos.margin) * 100 : 0;

      const transferRatio = (coinConfig?.profit_transfer_ratio !== undefined && coinConfig?.profit_transfer_ratio !== null) ? coinConfig.profit_transfer_ratio : 0;
      const transferred = pnl > 0 ? pnl * (transferRatio / 100) : 0;

      totalPnl += pnl;
      totalProfitToTransfer += transferred;

      settleItems.push({
        positionId: pos.id,
        closeReason: 'manual',
        closePrice: exitPrice,
        closePnl: pnl,
        closeTime: now,
        tradeLog: {
          position_id: pos.id,
          symbol: pos.symbol,
          direction: pos.direction,
          entry_price: pos.entry_price,
          exit_price: exitPrice,
          quantity: pos.quantity,
          margin: pos.margin,
          pnl,
          pnl_percent: pnlPercent,
          close_reason: 'manual',
          profit_transferred: transferred,
          open_time: pos.open_time,
          close_time: now,
        },
      });

      const estFee = pos.margin * (pos.leverage || coinConfig?.leverage || 10) * OKX_FEE_RATE;
      const prevChange = fundingChanges.get(pos.symbol) || { netPnl: 0, fee: 0 };
      fundingChanges.set(pos.symbol, {
        netPnl: prevChange.netPnl + (pnl - transferred),
        fee: prevChange.fee + estFee,
      });
    }

    // 批量执行数据库平仓与交易日志记录（单次原子批量事务）
    if (settleItems.length > 0) {
      await batchClosePositionsAndTradeLogs(env, settleItems);
    }

    // 统一次批量更新各个币种的 funding_amount
    const fundingUpdates: Array<{ symbol: string; fundingAmount: number }> = [];
    for (const [sym, change] of fundingChanges.entries()) {
      const pair = pairs.find(c => c.symbol === sym);
      if (pair) {
        const newFunding = Math.max(0, pair.funding_amount + change.netPnl - change.fee);
        fundingUpdates.push({ symbol: sym, fundingAmount: newFunding });
      }
    }
    if (fundingUpdates.length > 0) {
      await batchUpdateCoinPairsFunding(env, fundingUpdates);
    }

    // 统一次聚合利润划转
    if (totalProfitToTransfer > 0.01) {
      try {
        await client.transfer({
          ccy: 'USDT',
          amt: totalProfitToTransfer.toFixed(8),
          from: '18',
          to: '6',
          type: '0',
        });
      } catch (tErr) {
        console.warn('[CloseAll] 统一次利润划转异常:', tErr);
      }
    }

    // 写入统一次核算系统日志
    const pnlSign = totalPnl >= 0 ? '+' : '';
    await insertSystemLog(
      env,
      'close',
      `[一键平仓完成] 交易所已执行市价全平，统一次核算完成 ${settleItems.length} 笔持仓，总盈亏: ${pnlSign}${totalPnl.toFixed(2)} USDT (利润划转: ${totalProfitToTransfer.toFixed(2)} USDT)`
    );

    return { success: true, data: { closed: settleItems.length } };
  } catch (err: any) {
    const errMsg = String(err?.message || err);
    await insertSystemLog(env, 'error', `一键平仓异常: ${errMsg}`);
    return { success: false, error: errMsg };
  }
}
