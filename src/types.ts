export type TimeoutUnit = 'day' | 'hour' | 'minute' | 'second';

export interface Config {
  enabled: boolean;
  okx_api_key: string;
  okx_secret_key: string;
  okx_passphrase: string;
}

export interface CoinPair {
  symbol: string;
  period: string;
  direction: 'long' | 'short' | null;
  direction_updated_at: number;
  enabled: boolean;
  pause_open?: boolean;
  funding_amount: number;
  funding_slices?: number | null;
  last_open_time?: number;
  next_jitter_ms?: number;
  
  leverage?: number | null;
  tp_ratio?: number | null;
  sl_ratio?: number | null;
  open_interval_value?: number | null;
  open_interval_unit?: TimeoutUnit | string | null;
  margin_mode?: 'isolated' | 'cross' | string | null;
  profit_transfer_ratio?: number | null;
  smart_volatility_enabled?: boolean;
  min_volatility_threshold?: number;
  current_volatility?: number;
  volatility_status?: 'active' | 'paused' | string;
  add_pos_ratio?: number | null;
  last_price?: number;
  period_start_time?: number | null;
  cur_open?: number | null;
  cur_high?: number | null;
  cur_low?: number | null;
  cur_close?: number | null;
  prev1_open?: number | null;
  prev1_close?: number | null;
  prev1_high?: number | null;
  prev1_low?: number | null;
  prev2_high?: number | null;
  prev2_low?: number | null;
}

export interface Position {
  id: number;
  symbol: string;
  direction: 'long' | 'short';
  leverage: number;
  entry_price: number;
  quantity: number;
  margin: number;
  okx_order_id?: string;
  open_time: number;
  tp_price: number;
  sl_price: number;
  unrealized_pnl: number;
  last_price: number;
  tp_algo_id: string;
  sl_algo_id: string;
  status: 'open' | 'closed';
  close_reason?: 'tp' | 'sl' | 'manual';
  close_price?: number;
  close_pnl?: number;
  close_time?: number;
}

export interface TradeLog {
  id: number;
  symbol: string;
  direction: 'long' | 'short';
  entry_price: number;
  exit_price: number;
  quantity: number;
  margin: number;
  pnl: number;
  pnl_percent: number;
  close_reason: string;
  profit_transferred: number;
  open_time: number;
  close_time: number;
  position_id?: number;
}

export interface SystemLog {
  id: number;
  type: string;
  message: string;
  created_at: number;
}

export interface OKXCandle {
  ts: string;
  o: string;
  h: string;
  l: string;
  c: string;
  vol: string;
  volCcy: string;
}

export interface OKXTicker {
  instId: string;
  last: string;
  bidPx?: string;
  askPx?: string;
  high24h?: string;
  low24h?: string;
  vol24h?: string;
  open24h?: string;
  sodUtc0?: string;
  sodUtc8?: string;
}

export interface OKXBalance {
  ccy: string;
  availBal: string;
  frozenBal: string;
  eq: string;
}

export interface OKXOrderResult {
  ordId: string;
  clOrdId: string;
  tag: string;
  sCode: string;
  sMsg: string;
}

export interface BatchOrderResultItem {
  ordId: string;
  clOrdId: string;
  sCode: string;
  sMsg: string;
  tag?: string;
}

export interface OKXClient {
  getCandles(symbol: string, bar: string, limit: number): Promise<OKXCandle[]>;
  getTicker(symbol: string): Promise<OKXTicker>;
  getTickersByType(instType?: string): Promise<Map<string, OKXTicker>>;
  getTickersForSymbols(symbols: string[]): Promise<Map<string, OKXTicker>>;
  getBalance(): Promise<{ trade_account: number; fund_account: number }>;
  getPosMode(): Promise<'net_mode' | 'long_short_mode'>;
  setPosMode(mode: 'long_short_mode'): Promise<void>;
  placeOrder(params: OrderParams): Promise<OrderResult>;
  placeBatchOrders(orders: OrderParams[]): Promise<BatchOrderResultItem[]>;
  closePosition(symbol: string, marginMode: string, posSide?: string, sz?: string): Promise<void>;
  setLeverage(symbol: string, leverage: number, marginMode: string, posSide?: string): Promise<void>;
  getInstrumentInfo(symbol: string, forceRefresh?: boolean): Promise<OKXInstrumentInfo>;
  getInstruments(instType?: string): Promise<Map<string, OKXInstrumentInfo>>;
  transfer(params: TransferParams): Promise<void>;
  attachAlgoOrder(params: AlgoOrderParams): Promise<AlgoOrderResult>;
  amendAlgoOrder(params: AmendAlgoOrderParams): Promise<boolean>;
  cancelAlgoOrders(symbol: string, algoClOrdId?: string, algoId?: string): Promise<void>;
  cancelAlgoOrdersBatch(orders: Array<{ instId: string; algoId?: string; algoClOrdId?: string }>): Promise<void>;
  getPendingAlgoOrders(symbol?: string, ordType?: string): Promise<any[]>;
  getAllPendingAlgoOrders(ordType?: string): Promise<any[]>;
  cancelAllAlgoOrdersForInst(symbol: string, posSide?: string): Promise<void>;
  getPositions(instId?: string): Promise<OKXPosition[]>;
  getFills(symbol: string, limit?: number): Promise<OKXFill[]>;
  getAlgoOrderHistory(symbol: string, algoClOrdId: string): Promise<OKXAlgoOrder[]>;
}

export interface OKXPosition {
  instId: string;
  posSide: string;
  pos: string;
  avgPx: string;
  lever: string;
  upl: string;
  markPx?: string;
  last?: string;
  mgnMode?: string;
}

export interface OKXFill {
  instId: string;
  fillPx: string;
  fillSz: string;
  side: string;
  posSide: string;
  fillTime: string;
  ordId: string;
}

export interface OKXAlgoOrder {
  algoId: string;
  clOrdId: string;
  instId: string;
  ordType: string;
  state: string;
  tpTriggerPx: string;
  slTriggerPx: string;
  actualPx: string;
  cTime: string;
  uTime: string;
}

export interface OKXInstrumentInfo {
  ctVal: string;
  lotSz: string;
  minSz: string;
  tickSz: string;
}

export interface OrderParams {
  instId: string;
  tdMode: string;
  side: 'buy' | 'sell';
  posSide?: 'long' | 'short';
  ordType: 'market' | 'limit';
  sz: string;
  curPrice?: number;
  px?: string;
  reduceOnly?: boolean | string;
  tpTriggerPx?: string;
  tpOrdPx?: string;
  slTriggerPx?: string;
  slOrdPx?: string;
  attachAlgoOrds?: Array<{
    attachAlgoClOrdId?: string;
    tpTriggerPx?: string;
    tpTriggerPxType?: string;
    tpOrdPx?: string;
    slTriggerPx?: string;
    slTriggerPxType?: string;
    slOrdPx?: string;
  }>;
}

export interface OrderResult {
  orderId: string;
  entryPrice: number;
  quantity: number;
  margin: number;
}

export interface AlgoOrderParams {
  instId: string;
  tdMode: string;
  side: 'buy' | 'sell';
  posSide?: 'long' | 'short';
  ordType: 'conditional' | 'oco' | 'trigger' | 'move_order_stop';
  sz?: string;
  closeFraction?: string;
  tpTriggerPx?: string;
  tpTriggerPxType?: 'last' | 'mark' | 'index';
  tpOrdPx?: string;
  slTriggerPx?: string;
  slTriggerPxType?: 'last' | 'mark' | 'index';
  slOrdPx?: string;
  cxlOnClosePos?: boolean;
  reduceOnly?: boolean;
  algoClOrdId?: string;
}

export interface AlgoOrderResult {
  algoId: string;
  clOrdId: string;
}

export interface AmendAlgoOrderParams {
  instId: string;
  algoId?: string;
  algoClOrdId?: string;
  newSz?: string;
  newTpTriggerPx?: string;
  newTpOrdPx?: string;
  newSlTriggerPx?: string;
  newSlOrdPx?: string;
  newTpTriggerPxType?: string;
  newSlTriggerPxType?: string;
}

export interface TransferParams {
  ccy: string;
  amt: string;
  from: string;
  to: string;
  type: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
