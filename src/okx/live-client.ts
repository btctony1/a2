import type { OKXClient, OKXCandle, OKXTicker, OKXInstrumentInfo, OKXPosition, OKXFill, OKXAlgoOrder, OrderParams, OrderResult, BatchOrderResultItem, BatchAlgoOrderResultItem, BatchAmendAlgoResultItem, TransferParams, AlgoOrderParams, AlgoOrderResult, AmendAlgoOrderParams } from '../types';
import { okxRequest, isCycleTimeout, isSubrequestLimitReached, getSubrequestCount } from './signer';

type OKXRawCandle = [string, string, string, string, string, string, string, ...string[]] | OKXCandle;

function normalizeCandle(candle: OKXRawCandle): OKXCandle {
  if (Array.isArray(candle)) {
    return {
      ts: candle[0],
      o: candle[1],
      h: candle[2],
      l: candle[3],
      c: candle[4],
      vol: candle[5],
      volCcy: candle[6],
    };
  }
  return candle;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface OKXOrderDetail {
  ordId: string;
  instId: string;
  fillPx: string;
  fillSz: string;
  state: string;
  sz: string;
}


const cachedInstrumentInfo: Record<string, OKXInstrumentInfo> = {};
export function createLiveClient(apiKey: string, secretKey: string, passphrase: string, proxyUrl?: string): OKXClient {
  async function request(method: string, path: string, body: string = ''): Promise<Response> {
    return okxRequest(method, path, body, apiKey, secretKey, passphrase, proxyUrl);
  }

  let cachedPosMode: 'net_mode' | 'long_short_mode' | null = 'long_short_mode';

  async function getPosMode(): Promise<'net_mode' | 'long_short_mode'> {
    if (cachedPosMode) return cachedPosMode;
    const resp = await request('GET', '/api/v5/account/config');
    const json = await resp.json() as { data: Array<{ posMode: string }> };
    if (json.data && json.data.length > 0) {
      const mode = json.data[0].posMode;
      if (mode === 'long_short_mode' || mode === 'net_mode') {
        cachedPosMode = mode;
        return mode;
      }
    }
    throw new Error(`Unexpected posMode response: ${JSON.stringify(json)}`);
  }

  return {
    async getCandles(symbol: string, bar: string, limit: number): Promise<OKXCandle[]> {
      let lastErr: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const resp = await request('GET', `/api/v5/market/candles?instId=${symbol}&bar=${bar}&limit=${limit}`);
          const json = await resp.json() as { code?: string; msg?: string; data?: OKXRawCandle[] };
          if (json.code === '0' && Array.isArray(json.data) && json.data.length > 0) {
            return json.data.map(normalizeCandle);
          }
          if (Array.isArray(json.data) && json.data.length > 0) {
            return json.data.map(normalizeCandle);
          }
          if (json.code && json.code !== '0') {
            throw new Error(`OKX K线接口错误 [${json.code}]: ${json.msg || '未知错误'}`);
          }
        } catch (err) {
          lastErr = err;
          if (attempt === 0) {
            await delay(150);
          }
        }
      }
      throw lastErr || new Error(`未能获取到 ${symbol} 的 ${bar} 周期K线数据`);
    },

    async getTicker(symbol: string): Promise<OKXTicker> {
      const resp = await request('GET', `/api/v5/market/ticker?instId=${symbol}`);
      const json = await resp.json() as { data: OKXTicker[] };
      if (json.data && json.data.length > 0) {
        return json.data[0];
      }
      throw new Error(`Failed to get ticker: ${JSON.stringify(json)}`);
    },

    async getTickersByType(instType = 'SWAP'): Promise<Map<string, OKXTicker>> {
      const map = new Map<string, OKXTicker>();
      try {
        const resp = await request('GET', `/api/v5/market/tickers?instType=${instType}`);
        const json = await resp.json() as { code?: string; data?: OKXTicker[] };
        if (json.code === '0' && Array.isArray(json.data)) {
          for (const t of json.data) {
            map.set(t.instId, t);
            const withoutSwap = t.instId.replace(/-SWAP$/, '');
            map.set(withoutSwap, t);
            const clean = withoutSwap.replace(/[\/\-_]/g, '').replace(/USDT$/, '');
            map.set(clean, t);
            map.set(`${clean}-USDT-SWAP`, t);
            map.set(`${clean}-USDT`, t);
          }
        }
      } catch (e) {
        console.warn(`[OKX] getTickersByType warning:`, e);
      }
      return map;
    },

    async getTickersForSymbols(symbols: string[]): Promise<Map<string, OKXTicker>> {
      const map = new Map<string, OKXTicker>();
      const rawSymbols = Array.from(new Set(symbols.filter(Boolean)));
      if (rawSymbols.length === 0) return map;

      // 建立标准化 instId -> 原始输入符号别名的映射
      const instIdToOriginals = new Map<string, string[]>();
      for (const rawSym of rawSymbols) {
        const sym = rawSym.trim().toUpperCase();
        const instId = sym.endsWith('-SWAP')
          ? sym
          : (sym.includes('-') ? (sym.endsWith('-USDT') ? `${sym}-SWAP` : sym) : `${sym}-USDT-SWAP`);
        if (!instIdToOriginals.has(instId)) {
          instIdToOriginals.set(instId, []);
        }
        instIdToOriginals.get(instId)!.push(rawSym);
        instIdToOriginals.get(instId)!.push(sym);
      }

      const saveTickerToMap = (instId: string, ticker: OKXTicker) => {
        if (!ticker?.last || parseFloat(ticker.last) <= 0) return;
        map.set(instId, ticker);
        const withoutSwap = instId.replace(/-SWAP$/, '');
        map.set(withoutSwap, ticker);
        const clean = withoutSwap.replace(/[\/\-_]/g, '').replace(/USDT$/, '');
        map.set(clean, ticker);
        map.set(`${clean}-USDT-SWAP`, ticker);
        map.set(`${clean}-USDT`, ticker);
        map.set(`${clean}/USDT`, ticker);
        const originals = instIdToOriginals.get(instId) || [];
        for (const orig of originals) {
          map.set(orig, ticker);
        }
      };

      // 方案A：使用 OKX 全合约大包端点 (/api/v5/market/tickers?instType=SWAP)
      // 坚决不逐个币种发起请求！恒定 1 次子请求打包拉取全量合约行情。
      // 单次网络超时已升至 5 秒（OKX_REQUEST_TIMEOUT_MS = 5000），适应大包传输。
      // 若遇网络波动，整批统一等待 5000ms（5秒）后重试大包，最多重试 2 次。
      const targetInstIds = Array.from(instIdToOriginals.keys());
      const maxBatchRetries = 2;

      for (let attempt = 0; attempt <= maxBatchRetries; attempt++) {
        if (isCycleTimeout() || isSubrequestLimitReached()) break;

        // 如果是重试轮次（attempt > 0），统一等待 5000ms（5秒）
        if (attempt > 0) {
          await delay(5000);
          if (isCycleTimeout() || isSubrequestLimitReached()) break;
        }

        try {
          const resp = await request('GET', `/api/v5/market/tickers?instType=SWAP`);
          const json = (await resp.json()) as { code?: string; data?: OKXTicker[] };
          if (json.code === '0' && Array.isArray(json.data) && json.data.length > 0) {
            for (const t of json.data) {
              saveTickerToMap(t.instId, t);
            }
            break;
          }
        } catch (err) {
          console.warn(`[OKX] 全量SWAP行情大包拉取第 ${attempt + 1} 次未成功，将在5秒后重试:`, err);
        }
      }

      // 若有目标币种未在 SWAP 中解析（例如配置了现货 SPOT 币种），同样采用单次大包处理，绝不逐币发包
      const unresolved = targetInstIds.filter((id) => !map.has(id));
      if (unresolved.length > 0 && !isCycleTimeout() && !isSubrequestLimitReached()) {
        try {
          const respSpot = await request('GET', `/api/v5/market/tickers?instType=SPOT`);
          const jsonSpot = (await respSpot.json()) as { code?: string; data?: OKXTicker[] };
          if (jsonSpot.code === '0' && Array.isArray(jsonSpot.data)) {
            for (const t of jsonSpot.data) {
              saveTickerToMap(t.instId, t);
            }
          }
        } catch (spotErr) {
          console.warn(`[OKX] 全量SPOT行情大包拉取补充失败:`, spotErr);
        }
      }

      return map;
    },

    getPosMode,

    async setPosMode(mode: 'long_short_mode'): Promise<void> {
      const body = JSON.stringify({ posMode: mode });
      const resp = await request('POST', '/api/v5/account/set-position-mode', body);
      const json = await resp.json() as { code: string };
      if (json.code && json.code !== '0') {
        throw new Error(`Set position mode failed: ${JSON.stringify(json)}`);
      }
      cachedPosMode = mode;
      console.log(`[OKX] 持仓模式已切换为 ${mode}`);
    },

    async getBalance(): Promise<{ trade_account: number; fund_account: number }> {
      const resp = await request('GET', '/api/v5/account/balance');
      const json = await resp.json() as {
        code?: string;
        msg?: string;
        data?: Array<{
          totalEq?: string;
          adjEq?: string;
          details?: Array<{
            ccy: string;
            eq?: string;
            cashBal?: string;
            availBal?: string;
            availEq?: string;
            disEq?: string;
          }>;
        }>;
      };
      if (json.code && json.code !== '0') {
        throw new Error(`OKX balance API error: [${json.code}] ${json.msg || 'unknown'}`);
      }
      if (!json.data || json.data.length === 0) {
        throw new Error(`OKX balance API returned empty data: ${JSON.stringify(json)}`);
      }

      const acc = json.data[0];
      const details = acc.details || [];

      // 1. 优先查找 USDT 币种资产
      const usdt = details.find((d) => (d.ccy || '').toUpperCase() === 'USDT');
      let usdtVal = 0;
      if (usdt) {
        usdtVal = parseFloat(usdt.availEq || usdt.availBal || usdt.cashBal || usdt.eq || '0') || 0;
      }

      // 2. 若 USDT 未持有或为0，支持读取 OKX 账户总净值 (totalEq)
      let totalEq = parseFloat(acc.totalEq || acc.adjEq || '0') || 0;

      // 3. 若依然为0，累加所有币种的折算/可用资产
      if (usdtVal <= 0 && totalEq <= 0 && details.length > 0) {
        for (const d of details) {
          const val = parseFloat(d.availEq || d.availBal || d.cashBal || d.eq || '0') || 0;
          if (val > 0) {
            totalEq += val;
          }
        }
      }

      const finalTradeAccount = usdtVal > 0 ? usdtVal : totalEq;
      if (finalTradeAccount <= 0) {
        throw new Error(`OKX 账户交易可用资金为 0 (USDT可用: ${usdt?.availBal || usdt?.cashBal || '0'}, 账户总权益: ${acc.totalEq || '0'})`);
      }

      return { trade_account: finalTradeAccount, fund_account: 0 };
    },


    async placeOrder(params: OrderParams): Promise<OrderResult> {
      const bodyObj: Record<string, unknown> = {
        instId: params.instId,
        tdMode: params.tdMode,
        side: params.side,
        ordType: params.ordType,
        sz: params.sz,
      };
      if (params.px) bodyObj.px = params.px;

      if (params.posSide) {
        const mode = await getPosMode();
        if (mode === 'long_short_mode') {
          bodyObj.posSide = params.posSide;
        }
      }

      // 附带止盈止损挂单（随单原子级生效）
      if (params.attachAlgoOrds && params.attachAlgoOrds.length > 0) {
        bodyObj.attachAlgoOrds = params.attachAlgoOrds;
      }

      const body = JSON.stringify(bodyObj);
      console.log(`[OKX] POST /api/v5/trade/order body=${body}`);

      const resp = await request('POST', '/api/v5/trade/order', body);
      const json = await resp.json() as any;

      if (json.data && json.data.length > 0 && json.data[0].sCode === '0') {
        const ordId = json.data[0].ordId;
        const entryPrice = params.curPrice != null && params.curPrice > 0 ? params.curPrice : 0;
        const quantity = parseFloat(params.sz);
        return { orderId: ordId, entryPrice, quantity, margin: 0 };
      }
      const errMsg = json.data?.[0]?.sMsg || json.msg || JSON.stringify(json);
      const finalErrCode = json.data?.[0]?.sCode || json.code || 'unknown';
      throw new Error(`OKX下单失败 [${finalErrCode}]: ${errMsg}`);
    },

    async placeBatchOrders(orders: OrderParams[]): Promise<BatchOrderResultItem[]> {
      if (!orders || orders.length === 0) return [];
      const pMode = await getPosMode().catch(() => 'long_short_mode');
      const results: BatchOrderResultItem[] = [];

      // OKX 批量下单接口每次最多支持 20 个订单
      for (let i = 0; i < orders.length; i += 20) {
        const chunk = orders.slice(i, i + 20);
        const buildBody = (items: OrderParams[]) => items.map((params) => {
          const orderObj: Record<string, any> = {
            instId: params.instId,
            tdMode: params.tdMode,
            side: params.side,
            ordType: params.ordType,
            sz: params.sz,
          };
          if (pMode === 'long_short_mode' && params.posSide) {
            orderObj.posSide = params.posSide;
          }
          if (params.px) {
            orderObj.px = params.px;
          }
          if (params.reduceOnly !== undefined) {
            orderObj.reduceOnly = params.reduceOnly === true || params.reduceOnly === 'true';
          }
          return orderObj;
        });

        const body = JSON.stringify(buildBody(chunk));
        console.log(`[OKX] POST /api/v5/trade/batch-orders body=${body}`);
        try {
          const resp = await request('POST', '/api/v5/trade/batch-orders', body);
          const json = (await resp.json()) as { code?: string; msg?: string; data?: Array<{ ordId?: string; clOrdId?: string; sCode?: string; sMsg?: string; tag?: string }> };
          if (json.data && Array.isArray(json.data)) {
            for (let j = 0; j < chunk.length; j++) {
              const d = json.data[j];
              const sCode = d?.sCode || (json.code === '0' ? '0' : json.code || 'unknown');
              results.push({
                ordId: d?.ordId || '',
                clOrdId: d?.clOrdId || '',
                sCode,
                sMsg: d?.sMsg || json.msg || '',
                tag: d?.tag || '',
              });
            }
          } else {
            const globalCode = json.code || 'unknown';
            const globalMsg = json.msg || JSON.stringify(json);
            for (let j = 0; j < chunk.length; j++) {
              results.push({
                ordId: '',
                clOrdId: '',
                sCode: globalCode,
                sMsg: globalMsg,
              });
            }
          }
        } catch (batchErr: any) {
          const errStr = batchErr?.message || String(batchErr);
          for (let j = 0; j < chunk.length; j++) {
            results.push({
              ordId: '',
              clOrdId: '',
              sCode: '-1',
              sMsg: errStr,
            });
          }
        }
      }
      return results;
    },

    async closePosition(symbol: string, marginMode: string, posSide?: string, sz?: string): Promise<void> {
      const mode = marginMode || 'isolated';
      if (sz) {
        const side = posSide === 'long' ? 'sell' : 'buy';
        const reqBody: Record<string, string> = {
          instId: symbol,
          tdMode: mode,
          side,
          ordType: 'market',
          sz,
        };
        if (posSide) {
          const pMode = await getPosMode();
          if (pMode === 'long_short_mode') {
            reqBody.posSide = posSide;
          }
        }
        const body = JSON.stringify(reqBody);
        console.log(`[OKX] Close position (order) body=${body}`);
        const resp = await request('POST', '/api/v5/trade/order', body);
        const json = await resp.json() as { code?: string; msg?: string; data?: Array<{ sCode?: string; sMsg?: string }> };
        if (json.code && json.code !== '0') {
          throw new Error(`OKX close position error [${json.code}]: ${json.msg || 'unknown'}`);
        }
        if (json.data && json.data.length > 0 && json.data[0].sCode && json.data[0].sCode !== '0') {
          throw new Error(`OKX close position error [${json.data[0].sCode}]: ${json.data[0].sMsg || 'unknown'}`);
        }
      } else {
        const reqBody: Record<string, string> = { instId: symbol, mgnMode: mode };
        if (posSide) {
          const pMode = await getPosMode();
          if (pMode === 'long_short_mode') {
            reqBody.posSide = posSide;
          }
        }
        const body = JSON.stringify(reqBody);
        console.log(`[OKX] Close position (all) body=${body}`);
        const resp = await request('POST', '/api/v5/trade/close-position', body);
        const json = await resp.json() as { code?: string; msg?: string; data?: Array<{ sCode?: string; sMsg?: string }> };
        if (json.code && json.code !== '0') {
          throw new Error(`OKX close position error [${json.code}]: ${json.msg || 'unknown'}`);
        }
        if (json.data && json.data.length > 0 && json.data[0].sCode && json.data[0].sCode !== '0') {
          throw new Error(`OKX close position error [${json.data[0].sCode}]: ${json.data[0].sMsg || 'unknown'}`);
        }
      }
    },

    async setLeverage(symbol: string, leverage: number, marginMode: string, posSide?: string): Promise<void> {
      const reqBody: Record<string, string> = { instId: symbol, lever: String(leverage), mgnMode: marginMode };
      if (posSide) {
        const mode = await getPosMode();
        if (mode === 'long_short_mode') {
          reqBody.posSide = posSide;
        }
      }
      const body = JSON.stringify(reqBody);
      console.log(`[OKX] POST /api/v5/account/set-leverage body=${body}`);
      const resp = await request('POST', '/api/v5/account/set-leverage', body);
      const json = await resp.json() as { code: string };
      if (json.code && json.code !== '0') {
        throw new Error(`Set leverage failed: ${JSON.stringify(json)}`);
      }
    },

    async getInstruments(instType: string = 'SWAP'): Promise<Map<string, OKXInstrumentInfo>> {
      const map = new Map<string, OKXInstrumentInfo>();
      try {
        const resp = await request('GET', `/api/v5/public/instruments?instType=${instType}`);
        const json = await resp.json() as { code?: string; data?: Array<{ instId: string; ctVal: string; lotSz: string; minSz: string; tickSz: string }> };
        if (json.code === '0' && Array.isArray(json.data)) {
          for (const inst of json.data) {
            if (inst.instId) {
              const info: OKXInstrumentInfo = {
                ctVal: inst.ctVal || '1',
                lotSz: inst.lotSz || '1',
                minSz: inst.minSz || '1',
                tickSz: inst.tickSz || '0.0001',
              };
              map.set(inst.instId, info);
              cachedInstrumentInfo[inst.instId] = info;
            }
          }
        }
      } catch (e) {
        console.warn(`[OKX] getInstruments (${instType}) warning:`, e);
      }
      return map;
    },

    async getInstrumentInfo(symbol: string, forceRefresh = false): Promise<OKXInstrumentInfo> {
      if (!forceRefresh && cachedInstrumentInfo[symbol]) return cachedInstrumentInfo[symbol];
      const resp = await request('GET', `/api/v5/public/instruments?instType=SWAP&instId=${symbol}`);
      const json = await resp.json() as { data: Array<{ ctVal: string; lotSz: string; minSz: string; tickSz: string }> };
      if (json.data && json.data.length > 0) {
        const inst = json.data[0];
        const info = { ctVal: inst.ctVal, lotSz: inst.lotSz, minSz: inst.minSz, tickSz: inst.tickSz };
        cachedInstrumentInfo[symbol] = info;
        return info;
      }
      throw new Error(`Failed to get instrument info: ${JSON.stringify(json)}`);
    },

    async transfer(params: TransferParams): Promise<void> {
      const body = JSON.stringify(params);
      const resp = await request('POST', '/api/v5/asset/transfer', body);
      const json = await resp.json() as { code: string };
      if (json.code && json.code !== '0') {
        throw new Error(`Transfer failed: ${JSON.stringify(json)}`);
      }
    },

    async attachAlgoOrder(params: AlgoOrderParams): Promise<AlgoOrderResult> {
      const bodyObj: Record<string, any> = {
        instId: params.instId,
        tdMode: params.tdMode,
        side: params.side,
        ordType: params.ordType,
        cxlOnClosePos: true, // 核心铁律：必须使用原生布尔值 true，使 OKX 严格将策略单与仓位绑定（平仓自动撤单，开启固定模式）
        reduceOnly: true,    // 核心铁律：必须使用原生布尔值 true，严格只减仓模式
      };

      // 核心铁律：必须对应平台“全部仓位”挂单，传递 closeFraction: '1'（100%仓位比例减仓），不传固定数量 sz
      if (params.closeFraction) {
        bodyObj.closeFraction = params.closeFraction;
      } else if (params.sz) {
        bodyObj.sz = params.sz;
      }

      const mode = await getPosMode().catch(() => 'long_short_mode');
      if (mode === 'long_short_mode' && params.posSide) {
        bodyObj.posSide = params.posSide;
      }
      if (params.tpTriggerPx) {
        bodyObj.tpTriggerPx = params.tpTriggerPx;
        bodyObj.tpOrdPx = params.tpOrdPx || '-1';
        bodyObj.tpTriggerPxType = params.tpTriggerPxType || 'last';
      }
      if (params.slTriggerPx) {
        bodyObj.slTriggerPx = params.slTriggerPx;
        bodyObj.slOrdPx = params.slOrdPx || '-1';
        bodyObj.slTriggerPxType = params.slTriggerPxType || 'last';
      }
      if (params.algoClOrdId) {
        bodyObj.algoClOrdId = params.algoClOrdId;
      }
      const body = JSON.stringify(bodyObj);
      console.log(`[OKX] POST /api/v5/trade/order-algo body=${body}`);
      const res = await request('POST', '/api/v5/trade/order-algo', body);
      const json = await res.json() as any;

      if (json.data && json.data.length > 0 && json.data[0].sCode === '0') {
        return { algoId: String(json.data[0].algoId), clOrdId: String(json.data[0].algoClOrdId || params.algoClOrdId || '') };
      }
      const errDetail = json.data?.[0]?.sMsg || json.msg || JSON.stringify(json);
      const finalErrCode = json.data?.[0]?.sCode || json.code || 'unknown';
      throw new Error(`OKX挂单失败 [${finalErrCode}]: ${errDetail}`);
    },

    async attachAlgoOrdersBatch(orders: AlgoOrderParams[]): Promise<BatchAlgoOrderResultItem[]> {
      if (!orders || orders.length === 0) return [];
      const results: BatchAlgoOrderResultItem[] = [];

      // 按照每组最多 10 个并发执行（严格在 OKX 20req/2s 限频安全阈值内）
      for (let i = 0; i < orders.length; i += 10) {
        const chunk = orders.slice(i, i + 10);
        const chunkPromises = chunk.map(async (params) => {
          try {
            const res = await this.attachAlgoOrder(params);
            return {
              instId: params.instId,
              algoId: res.algoId || '',
              clOrdId: res.clOrdId || '',
              sCode: '0',
              sMsg: '',
            };
          } catch (err: any) {
            return {
              instId: params.instId,
              algoId: '',
              clOrdId: params.algoClOrdId || '',
              sCode: '-1',
              sMsg: err?.message || String(err),
            };
          }
        });

        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);

        if (i + 10 < orders.length) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      return results;
    },

    async amendAlgoOrder(params: AmendAlgoOrderParams): Promise<{ success: boolean; sCode: string; sMsg: string }> {
      const bodyObj: Record<string, string> = {
        instId: params.instId,
      };
      if (params.algoId) bodyObj.algoId = params.algoId;
      if (params.algoClOrdId) bodyObj.algoClOrdId = params.algoClOrdId;
      // 只有在明确提供 newSz 时才传 newSz（全仓模式下修改价格无需传 newSz）
      if (params.newSz) bodyObj.newSz = params.newSz;
      if (params.newTpTriggerPx) {
        bodyObj.newTpTriggerPx = params.newTpTriggerPx;
        bodyObj.newTpOrdPx = params.newTpOrdPx || '-1';
        bodyObj.newTpTriggerPxType = params.newTpTriggerPxType || 'last';
      }
      if (params.newSlTriggerPx) {
        bodyObj.newSlTriggerPx = params.newSlTriggerPx;
        bodyObj.newSlOrdPx = params.newSlOrdPx || '-1';
        bodyObj.newSlTriggerPxType = params.newSlTriggerPxType || 'last';
      }
      const body = JSON.stringify(bodyObj);
      console.log(`[OKX] POST /api/v5/trade/amend-algos body=${body}`);
      try {
        const res = await request('POST', '/api/v5/trade/amend-algos', body);
        const json = await res.json() as any;
        const sCode = json.data?.[0]?.sCode || json.code || '-1';
        const sMsg = json.data?.[0]?.sMsg || json.msg || '';
        const success = !!(json.code === '0' && json.data && json.data.length > 0 && json.data[0].sCode === '0');
        return { success, sCode, sMsg };
      } catch (err: any) {
        console.warn(`[OKX] amend-algos error:`, err);
        return { success: false, sCode: '-1', sMsg: err?.message || String(err) };
      }
    },

    async amendAlgoOrdersBatch(orders: AmendAlgoOrderParams[]): Promise<BatchAmendAlgoResultItem[]> {
      if (!orders || orders.length === 0) return [];
      const results: BatchAmendAlgoResultItem[] = [];

      for (let i = 0; i < orders.length; i += 10) {
        const chunk = orders.slice(i, i + 10);
        const chunkPromises = chunk.map(async (params) => {
          try {
            const res = await this.amendAlgoOrder(params);
            return {
              instId: params.instId,
              algoId: params.algoId || '',
              sCode: res.sCode,
              sMsg: res.sMsg,
              success: res.success,
            };
          } catch (err: any) {
            return {
              instId: params.instId,
              algoId: params.algoId || '',
              sCode: '-1',
              sMsg: err?.message || String(err),
              success: false,
            };
          }
        });

        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);

        if (i + 10 < orders.length) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      return results;
    },

    async cancelAlgoOrders(symbol: string, algoClOrdId?: string, algoId?: string): Promise<void> {
      const cancelBody: Array<{ instId: string; algoId?: string; algoClOrdId?: string }> = [];
      if (algoId) {
        cancelBody.push({ instId: symbol, algoId });
      }
      if (algoClOrdId) {
        cancelBody.push({ instId: symbol, algoClOrdId });
      }
      if (cancelBody.length === 0) return;
      await this.cancelAlgoOrdersBatch(cancelBody);
    },

    async cancelAlgoOrdersBatch(orders: Array<{ instId: string; algoId?: string; algoClOrdId?: string }>): Promise<void> {
      if (!orders || orders.length === 0) return;
      for (let i = 0; i < orders.length; i += 10) {
        const batch = orders.slice(i, i + 10);
        try {
          const resp = await request('POST', '/api/v5/trade/cancel-algos', JSON.stringify(batch));
          const json = await resp.json() as any;
          if (json.code !== '0') {
            console.warn(`[OKX] cancel-algos batch response warning:`, json);
          }
        } catch (e) {
          console.warn(`[OKX] cancel-algos batch error:`, e);
        }
      }
    },

    async getAllPendingAlgoOrders(ordType?: string): Promise<any[]> {
      const ordTypes = ordType ? [ordType] : ['oco', 'conditional'];
      const allOrders: any[] = [];
      const promises = ordTypes.map(async (ot) => {
        try {
          const resp = await request('GET', `/api/v5/trade/orders-algo-pending?ordType=${ot}&instType=SWAP&limit=100`);
          const json = await resp.json() as any;
          if (json.code === '0' && Array.isArray(json.data)) {
            return json.data;
          }
        } catch (e) {
          console.warn(`[OKX] getAllPendingAlgoOrders (${ot}) error:`, e);
        }
        return [];
      });
      const results = await Promise.all(promises);
      for (const res of results) {
        allOrders.push(...res);
      }
      return allOrders;
    },

    async getPendingAlgoOrders(symbol?: string, ordType?: string): Promise<any[]> {
      if (!symbol) {
        return this.getAllPendingAlgoOrders(ordType);
      }
      const ordTypes = ordType ? [ordType] : ['oco', 'conditional'];
      const allOrders: any[] = [];
      for (const ot of ordTypes) {
        const url = `/api/v5/trade/orders-algo-pending?ordType=${ot}&instType=SWAP&instId=${symbol}`;
        try {
          const resp = await request('GET', url);
          const json = await resp.json() as any;
          if (json.code === '0' && Array.isArray(json.data)) {
            allOrders.push(...json.data);
          }
        } catch {
          // ignore error
        }
      }
      return allOrders;
    },

    async cancelAllAlgoOrdersForInst(symbol: string, posSide?: string): Promise<void> {
      try {
        const pending = await this.getPendingAlgoOrders(symbol);
        const toCancel = pending.filter(o => !posSide || o.posSide === posSide || !o.posSide || o.posSide === 'net');
        if (toCancel.length > 0) {
          for (let i = 0; i < toCancel.length; i += 10) {
            const batch = toCancel.slice(i, i + 10).map(o => ({ instId: symbol, algoId: o.algoId }));
            console.log(`[OKX] Cancelling ${batch.length} pending algo orders for ${symbol} (posSide: ${posSide || 'all'}):`, batch);
            await request('POST', '/api/v5/trade/cancel-algos', JSON.stringify(batch));
          }
        }
      } catch (e) {
        console.warn(`[OKX] cancelAllAlgoOrdersForInst warning:`, e);
      }
    },

    async getPositions(instId?: string): Promise<OKXPosition[]> {
      const url = instId
        ? `/api/v5/account/positions?instId=${instId}`
        : '/api/v5/account/positions';

      const resp = await request('GET', url);
      const json = await resp.json() as any;
      if (json.code !== '0') {
        throw new Error(`OKX getPositions error [${json.code}]: ${json.msg || 'unknown'}`);
      }
      if (!Array.isArray(json.data)) {
        throw new Error(`OKX getPositions returned non-array data`);
      }

      return json.data.map((p: any) => ({
        instId: p.instId,
        posSide: p.posSide,
        pos: p.pos,
        avgPx: p.avgPx,
        lever: p.lever,
        upl: p.upl,
        markPx: p.markPx,
        last: p.last,
        mgnMode: p.mgnMode,
      }));
    },

    async getFills(symbol: string, limit: number = 5): Promise<OKXFill[]> {
      const resp = await request('GET', `/api/v5/trade/fills?instId=${symbol}&limit=${limit}`);
      const json = await resp.json() as any;
      if (json.code && json.code !== '0') {
        throw new Error(`Failed to get fills: ${JSON.stringify(json)}`);
      }
      return (json.data || []).map((f: any) => ({
        instId: f.instId,
        fillPx: f.fillPx,
        fillSz: f.fillSz,
        side: f.side,
        posSide: f.posSide,
        fillTime: f.fillTime,
        ordId: f.ordId,
      }));
    },

    async getAlgoOrderHistory(symbol: string, algoClOrdId: string): Promise<OKXAlgoOrder[]> {
      const resp = await request('GET', `/api/v5/trade/orders-algo-history?instType=SWAP&instId=${symbol}&ordType=oco&clOrdId=${algoClOrdId}&limit=5`);
      const json = await resp.json() as any;
      if (json.code && json.code !== '0') {
        throw new Error(`Failed to get algo history: ${JSON.stringify(json)}`);
      }
      return (json.data || []).map((a: any) => ({
        algoId: a.algoId,
        clOrdId: a.clOrdId,
        instId: a.instId,
        ordType: a.ordType,
        state: a.state,
        tpTriggerPx: a.tpTriggerPx,
        slTriggerPx: a.slTriggerPx,
        actualPx: a.actualPx,
        cTime: a.cTime,
        uTime: a.uTime,
      }));
    },
  };
}
