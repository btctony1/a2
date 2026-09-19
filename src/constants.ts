export const DEFAULT_CONFIG: Record<string, string> = {
  enabled: 'false',
  okx_api_key: '',
  okx_secret_key: '',
  okx_passphrase: '',
};

export const SUPPORTED_COINS = [
  'BTC-USDT-SWAP',
  'ETH-USDT-SWAP',
  'SOL-USDT-SWAP',
  'DOGE-USDT-SWAP',
  'XRP-USDT-SWAP',
  'BNB-USDT-SWAP',
];

export const OKX_BASE_URL = 'https://www.okx.com';

export const OKX_ACCOUNT_TRADE = '18';
export const OKX_ACCOUNT_FUND = '6';
export const OKX_TRANSFER_TYPE = '0';

// 主循环执行极限硬上限：Cloudflare Workers 单次调用免费版硬上限为 50 次子请求
// 我们设置安全熔断为 44 次，预留充足安全缓冲，彻底防止触发平台级 Too many subrequests 报错
export const MAIN_LOOP_MAX_EXEC_MS = 58000;
export const MAX_SUBREQUESTS_PER_CYCLE = 44;

// 单次网络请求超时 5 秒熔断（适应大包传输与网络波动）
export const OKX_REQUEST_TIMEOUT_MS = 5000;

// 429/50011 限频局部熔断冷却时间 3 秒
export const OKX_429_COOLDOWN_MS = 3000;

// 严格遵循 OKX 官方标准限频，基础请求硬性间隔 115ms + 5ms 微量抖动
export const OKX_RATE_LIMIT_MS = 115;
export const OKX_RATE_LIMIT_JITTER_MS = 5;

export const OPEN_POSITION_JITTER_MS = 50;

// OKX 交易接口底层微量间隔（10ms ~ 20ms）
export const OKX_TRADE_PACING_MIN_MS = 10;
export const OKX_TRADE_PACING_MAX_MS = 20;

// 周期判定微量毫秒级偏移（5ms ~ 15ms）
export const DIRECTION_CHECK_JITTER_MIN_MS = 5;
export const DIRECTION_CHECK_JITTER_MAX_MS = 15;

export const MARGIN_JITTER_PERCENT = 1;

// 单请求网络层 0 重试，遇到 50011/错误直接快速响应
export const MAX_OKX_RETRIES = 0;

// 自动下单铁律：取消重试 (0次)，下单失败立即触发 2500ms 熔断冷却并直接跳过，本轮绝不顺延！
export const MAX_ORDER_RETRIES = 0;
export const ORDER_FAILURE_CIRCUIT_BREAK_MS = 2500;

// 阶段间微冷却 20ms
export const PHASE_COOLDOWN_MS = 20;

export const CONFIDENCE_MULTIPLIER = 1.0;

export const MAX_POSITIONS_PER_COIN = 96;

export const OKX_FEE_RATE = 0.00015;

export const MONITOR_CONFIRM_MAX_FAILS = 3;
