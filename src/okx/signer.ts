import {
  MAX_OKX_RETRIES,
  OKX_BASE_URL,
  OKX_RATE_LIMIT_MS,
  OKX_RATE_LIMIT_JITTER_MS,
  OKX_TRADE_PACING_MIN_MS,
  OKX_TRADE_PACING_MAX_MS,
  OKX_REQUEST_TIMEOUT_MS,
  OKX_429_COOLDOWN_MS,
  MAX_SUBREQUESTS_PER_CYCLE,
} from '../constants';

let currentInvocationSubrequests = 0;
let currentInvocationAlgoSyncCount = 0;

export function resetSubrequestCount(): void {
  currentInvocationSubrequests = 0;
  currentInvocationAlgoSyncCount = 0;
}

export function getSubrequestCount(): number {
  return currentInvocationSubrequests;
}

export function getAlgoSyncCount(): number {
  return currentInvocationAlgoSyncCount;
}

export function incrementAlgoSyncCount(n: number = 1): void {
  currentInvocationAlgoSyncCount += n;
}

/**
 * 检查是否已达到最大子请求上限（48次）
 * 仅在主循环周期内（currentCycleDeadline > 0）进行限制，外部 API/面板请求不被累加计数字段卡死
 */
export function isSubrequestLimitReached(): boolean {
  if (currentCycleDeadline <= 0) return false;
  return currentInvocationSubrequests >= MAX_SUBREQUESTS_PER_CYCLE;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 严格遵循 OKX 官方标准限频（20 次 / 2 秒，安全间隔 100ms）
let lastRequestEndTime = 0;
let globalPauseUntil = 0;

// 当前主循环周期的熔断截止时间戳
let currentCycleDeadline = 0;

/**
 * 触发指定时长的接口/网络熔断冷却（例如下单重试2次失败后触发 2500ms 熔断）
 */
export function triggerCircuitBreak(cooldownMs: number): void {
  globalPauseUntil = Math.max(globalPauseUntil, Date.now() + cooldownMs);
}

/**
 * 启动新一轮主循环时设置硬熔断时间戳，并重置子请求计数
 */
export function setCycleDeadline(deadlineMs: number): void {
  currentCycleDeadline = deadlineMs;
  resetSubrequestCount();
}

/**
 * 主循环收尾时彻底清除熔断时间戳，防止遗留时间戳卡死外部接口
 */
export function clearCycleDeadline(): void {
  currentCycleDeadline = 0;
  resetRequestQueue();
}

/**
 * 清空重置请求限流状态，确保容器复用时完全无状态
 */
export function resetRequestQueue(): void {
  globalPauseUntil = 0;
  lastRequestEndTime = 0;
  currentInvocationSubrequests = 0;
}

/**
 * 检查当前请求是否已超过主循环熔断时间
 */
export function isCycleTimeout(): boolean {
  if (currentCycleDeadline <= 0) return false;
  if (Date.now() - currentCycleDeadline > 10000) {
    // 历史过期遗留，自动重置清除
    currentCycleDeadline = 0;
    return false;
  }
  return Date.now() >= currentCycleDeadline;
}

async function enqueueRequest<T>(fn: () => Promise<T>, allowAfterTimeout: boolean = false): Promise<T> {
  // 硬上限熔断拦截：达到 58 秒或 48 次子请求时彻底拒绝执行，终止本轮全部任务
  if (!allowAfterTimeout && isCycleTimeout()) {
    throw new Error(`[主循环硬熔断] 已达到本轮最大执行时间窗口(58s)，自动终结未完成请求，确保下一轮全新启动`);
  }
  if (!allowAfterTimeout && isSubrequestLimitReached()) {
    throw new Error(`[主循环硬熔断] 已达到本轮子请求上限(${currentInvocationSubrequests}/${MAX_SUBREQUESTS_PER_CYCLE})，自动终结未完成请求，确保下一轮全新启动`);
  }

  const now = Date.now();
  if (globalPauseUntil > now) {
    const waitMs = Math.min(globalPauseUntil - now, OKX_429_COOLDOWN_MS);
    await delay(waitMs);
  }

  // 再次检测熔断
  if (!allowAfterTimeout && isCycleTimeout()) {
    throw new Error(`[主循环硬熔断] 已达到本轮最大执行时间窗口(58s)，自动终结未完成请求，确保下一轮全新启动`);
  }
  if (!allowAfterTimeout && isSubrequestLimitReached()) {
    throw new Error(`[主循环硬熔断] 已达到本轮子请求上限(${currentInvocationSubrequests}/${MAX_SUBREQUESTS_PER_CYCLE})，自动终结未完成请求，确保下一轮全新启动`);
  }

  // 确保每个请求之间保持物理间隔 (100ms)
  const elapsed = Date.now() - lastRequestEndTime;
  const minInterval = OKX_RATE_LIMIT_MS + Math.floor(Math.random() * OKX_RATE_LIMIT_JITTER_MS);
  if (elapsed < minInterval) {
    await delay(minInterval - elapsed);
  }

  try {
    const res = await fn();
    return res;
  } finally {
    lastRequestEndTime = Date.now();
  }
}

async function isRateLimited(resp: Response): Promise<boolean> {
  if (resp.status === 429) return true;

  const text = await resp.clone().text().catch(() => '');
  if (!text) return false;

  try {
    const json = JSON.parse(text) as {
      code?: string;
      msg?: string;
      data?: Array<{ sCode?: string; sMsg?: string }>;
    };
    if (json.code === '50011' || json.msg?.toLowerCase().includes('too many requests') || json.msg?.includes('请求过于频繁')) {
      return true;
    }
    if (json.data && Array.isArray(json.data) && json.data.length > 0) {
      for (const item of json.data) {
        if (item.sCode === '50011' || item.sMsg?.toLowerCase().includes('too many requests') || item.sMsg?.includes('请求过于频繁')) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return text.includes('50011') || text.includes('Too Many Requests') || text.includes('请求过于频繁');
  }
}

async function okxFetch(fetcher: () => Promise<Response>, allowAfterTimeout: boolean = false): Promise<Response> {
  return enqueueRequest(async () => {
    let lastResp: Response | null = null;

    for (let attempt = 0; attempt <= MAX_OKX_RETRIES; attempt++) {
      currentInvocationSubrequests++;
      lastResp = await fetcher();

      const rateLimitHit = await isRateLimited(lastResp);
      if (rateLimitHit) {
        // 429/50011 局部冷却熔断 3 秒，覆盖 OKX 2秒限流重置窗口
        const silenceCooldownMs = OKX_429_COOLDOWN_MS;
        globalPauseUntil = Math.max(globalPauseUntil, Date.now() + silenceCooldownMs);
        
        if (attempt < MAX_OKX_RETRIES) {
          await delay(silenceCooldownMs);
          continue;
        }
        throw new Error('OKX API 频次超限 (50011 Too Many Requests)，触发3秒局部冷却熔断，本轮已果断跳过，绝不顺延');
      }

      return lastResp;
    }

    return lastResp!;
  }, allowAfterTimeout);
}

export function generateOKXSignature(
  timestamp: string,
  method: string,
  path: string,
  body: string,
  secretKey: string
): Promise<string> {
  const signStr = timestamp + method + path + body;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(signStr);

  return crypto.subtle
    .importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then((key) => crypto.subtle.sign('HMAC', key, messageData))
    .then((signature) => btoa(String.fromCharCode(...new Uint8Array(signature))));
}

export async function okxRequest(
  method: string,
  path: string,
  body: string,
  apiKey: string,
  secretKey: string,
  passphrase: string,
  proxyUrl?: string
): Promise<Response> {
  const targetUrl = `${OKX_BASE_URL}${path}`;
  const url = proxyUrl ? `${proxyUrl}?url=${encodeURIComponent(targetUrl)}` : targetUrl;

  // 判断是否属于豁免主循环熔断拦截的请求（K线行情、行情大包、合约规格大包、资产查询等）
  const isExempt =
    path.includes('/market/candles') ||
    path.includes('/market/history-candles') ||
    path.includes('/market/tickers') ||
    path.includes('/market/ticker') ||
    path.includes('/public/instruments') ||
    path.includes('/account/balance') ||
    path.includes('/account/config');

  return okxFetch(async () => {
    // 对交易/委托类写操作（POST 下单、撤单、策略单）强制执行 10ms ~ 20ms 的底层微量防抖间隔
    if (method === 'POST' || path.includes('/trade/')) {
      const tradeInterval = Math.floor(
        Math.random() * (OKX_TRADE_PACING_MAX_MS - OKX_TRADE_PACING_MIN_MS + 1)
      ) + OKX_TRADE_PACING_MIN_MS;
      await delay(tradeInterval);
    }

    // 标准 OKX API 请求头 (仅在配置了有效密钥时附带签名，公共行情接口免鉴权)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey && secretKey && passphrase) {
      const timestamp = new Date().toISOString();
      const sign = await generateOKXSignature(timestamp, method, path, body, secretKey);
      headers['OK-ACCESS-KEY'] = apiKey;
      headers['OK-ACCESS-SIGN'] = sign;
      headers['OK-ACCESS-TIMESTAMP'] = timestamp;
      headers['OK-ACCESS-PASSPHRASE'] = passphrase;
    }

    // 为单次网络请求挂载 5 秒严格超时控制器 AbortController
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, OKX_REQUEST_TIMEOUT_MS);

    const init: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };
    if (body && method !== 'GET') {
      init.body = body;
    }

    try {
      const resp = await fetch(url, init);
      return resp;
    } catch (fetchErr: any) {
      if (fetchErr?.name === 'AbortError' || String(fetchErr).includes('abort')) {
        throw new Error(`[网络请求5秒超时] ${path} 未在 ${OKX_REQUEST_TIMEOUT_MS}ms 内响应，已果断熔断释放连接`);
      }
      throw fetchErr;
    } finally {
      clearTimeout(timer);
    }
  }, isExempt);
}
