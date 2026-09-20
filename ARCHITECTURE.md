# OKX 合约自动交易系统 - 架构文档

---

## 一、项目概述

基于 Cloudflare Workers 的 OKX 加密货币永续合约自动交易系统。通过 Cron 定时触发，根据 K 线方向判定做多/做空，定时市价开仓，超时自动平仓，止盈止损由 OKX 服务端算法单执行。

**技术栈**: TypeScript + Hono + D1(SQLite) + Web Crypto API
**部署**: GitHub Actions → Cloudflare Workers

---

## 二、系统分层

| 层级 | 目录 | 职责 |
|------|------|------|
| 入口 | `src/index.ts` | HTTP 请求 (Dashboard/API) + Cron 定时任务 |
| 路由 | `src/api/` | 11 个 REST API，基于 Hono 框架 |
| 引擎 | `src/engine/` | 交易主循环、方向判定、开单、监控、利润划转 |
| 客户端 | `src/okx/` | OKX API V5 封装 (签名/限流/重试/代理) |
| 数据库 | `src/db/` | D1 CRUD 操作 (5 张表) |
| 前端 | `src/ui/` | 单文件 Dashboard (原生 HTML/CSS/JS) |

---

## 三、Worker 入口

`src/index.ts` 导出两个处理器：

- `fetch(request, env, ctx)` — HTTP 请求
  - `GET /` → Dashboard HTML
  - `GET /test` → `"pong"` 健康检查
  - `/api/*` → Hono 路由分发
  - 其他 → 404

- `scheduled(_event, env, ctx)` — Cron 定时任务
  - 每分钟触发一次 (`* * * * *`)
  - 调用 `mainLoop(env)` 执行完整交易流程

---

## 四、交易引擎主循环

`src/engine/main-loop.ts` `mainLoop()` 每分钟执行：

1. 获取分布式锁 (`cron_lock`, D1 乐观锁, 60s 超时)，未获取到则跳过
2. 读取 `enabled` 配置，`false` 则返回
3. 验证 8 项必填配置，不完整则自动 disabled + 记录错误
4. 获取 OKX 凭据 (优先 Worker Secrets，回退 D1 config 表)
5. 创建 `LiveClient`
6. 检查持仓模式，强制切换为 `long_short_mode`
7. 顺序执行三个子流程 (单步失败不影响后续)：
   - `monitorPositions()` — 超时平仓检查
   - `checkDirection()` — K 线方向判定 (带节流)
   - `openPosition()` — 定时开单
8. 释放锁

方向判定节流：`currentTime - last_direction_check >= minPeriod * 60000` 时才执行。

---

## 五、方向判定

`src/engine/direction.ts`

**触发条件**: 方向为 null (立即判定) 或 当前分钟=0 且处于周期边界且同小时未判定过。

**周期边界** (UTC 时间，分钟=0 时):

| 周期 | 判定的小时 | bar 参数 |
|------|-----------|----------|
| 1H | 0,1,2,...,23 | `1H` |
| 2H | 0,2,4,...,22 | `2H` |
| 4H | 0,4,8,12,16,20 | `4H` |
| 6H | 0,6,12,18 | `6H` |
| 12H | 0,12 | `12H` |
| 24H | 每天 0 点 | `1D` |
| 48H | 每天 0 点, daysSinceEpoch 为偶数 | `2D` |

**判定逻辑**:
1. 拉取最近 2 根 K 线 (`getCandles`)
2. 取倒数第二根 (已完成): `close >= open` → `long` (做多); `close < open` → `short` (做空)
3. 写入 `coin_pairs` 表 + 记录 `system_logs`

---

## 六、开单调度

`src/engine/scheduler.ts`

**触发条件**: 当前分钟能被 `open_interval_minutes` 整除。

对每个 `enabled=true` 且 `direction IS NOT NULL` 的币种:

1. 防重复: 同一分钟同币种已开仓则跳过
2. 获取当前价 (`getTicker`)
3. 获取余额 (`getBalance`), `margin = trade_account * amount_ratio / 100`
4. 余额不足则跳过
5. 设置杠杆 (`setLeverage`)
6. 获取合约信息 (`getInstrumentInfo`): `ctVal` 面值, `lotSz` 步进, `minSz` 最小量
7. 计算下单量: `contracts = floor((margin * leverage) / (ctVal * price) / lotSz) * lotSz`
8. `contracts < minSz` 则跳过
9. 计算止盈止损价格 (严格按平台全部仓位“固定模式”收益率 ROI% 计算触发价：`tpTriggerPx = entryPrice * (1 + (tpRatioPct / leverage))`, `slTriggerPx = entryPrice * (1 - (slRatioPct / leverage))`)
10. 市价下单 + 挂载平台“全部仓位”“固定模式”止盈止损：
    - `ordType: 'conditional' | 'oco'`（严格指向平台“固定模式”，非 move_order_stop 移动止损）
    - `closeFraction: '1'`（严格对应平台“全部仓位” 100% 比例，禁止传具体数量 `sz`）
    - `cxlOnClosePos: true`（平台原生深度绑定持仓，持仓平仓时平台自动注销策略单）
    - `reduceOnly: true`（严格只减仓模式）
    - `tpTriggerPxType: 'mark'`, `slTriggerPxType: 'mark'`（标记价格防插针触发）
    - `tpOrdPx: '-1'`, `slOrdPx: '-1'`（市价全平）
    - 挂载后由 OKX 交易所撮合系统常驻全量托管生效，后续加仓无需逐个币种改单/撤单重挂，0 网络开销避免消耗 API 请求配额。
11. 轮询成交价 (最多 3 次, 间隔 500ms)，回退到 `ticker.last`
12. 写入 `positions` 表 + 记录 `system_logs`

---

## 七、持仓监控

`src/engine/monitor.ts`

遍历所有 `status='open'` 的持仓，仅检查超时:

- `elapsedHours >= timeout_hours` → 调用 OKX `closePosition()` 平仓
- 更新 `positions` 表: `status='closed'`, `close_reason='timeout'`
- 写入 `trade_logs` (exit_price=0, pnl=0, pnl_percent=0)
- 记录 `system_logs`

止盈止损由 OKX 算法单在服务端执行，Worker 不轮询价格。

---

## 八、手动平仓

`src/api/positions.ts` `closeAllPositionsHandler()`

POST `/api/close-all` 触发，对每个 open 持仓:

1. `getTicker` 获取最新价 → 计算 PnL: `margin * change% * leverage`
2. OKX `closePosition()` 平仓
3. 更新 `positions` + 写入 `trade_logs` (含实际 PnL)
4. PnL > 0 → 自动划转利润到资金账户

---

## 九、利润划转

`src/engine/transfer.ts`

仅在手动平仓有盈利时触发:
- `amount = pnl * profit_transfer_ratio / 100`
- OKX `POST /api/v5/asset/transfer`: `from=18`(交易账户), `to=6`(资金账户), `type=0`(账户内)
- 更新 `trade_logs.profit_transferred`

---

## 十、OKX API 集成

### 签名 (`src/okx/signer.ts`)

1. `timestamp = new Date().toISOString()`
2. `signStr = timestamp + method + path + body`
3. `signature = base64(HMAC-SHA256(secretKey, signStr))` (Web Crypto API)
4. 请求头: `OK-ACCESS-KEY`, `OK-ACCESS-SIGN`, `OK-ACCESS-TIMESTAMP`, `OK-ACCESS-PASSPHRASE`

### 限流

- 本地内存限流，请求间最小间隔 400ms
- 遇 429 或 `code=50011` 最多重试 1 次

### 代理

设置 `OKX_PROXY_URL` 环境变量后，URL 变为 `{proxyUrl}?url={encodedOKXUrl}`。

---

## 十一、数据库

`schema.sql` 定义 5 张表:

**config** — 键值对配置 + 分布式锁

| key | 说明 |
|-----|------|
| enabled | 启停 |
| leverage | 杠杆倍数 |
| amount_ratio | 资金比例 (%) |
| tp_ratio | 止盈比例 (%) |
| sl_ratio | 止损比例 (%) |
| timeout_hours | 超时小时 |
| margin_mode | isolated / cross |
| profit_transfer_ratio | 划转比例 (%) |
| open_interval_minutes | 开单间隔 (分钟) |
| last_direction_check | 上次方向检查时间戳 |
| okx_api_key / okx_secret_key / okx_passphrase | OKX 凭据 |
| cron_lock | 并发锁 0/1 |

**coin_pairs** — 币种配置

| 字段 | 类型 |
|------|------|
| symbol | TEXT PK, "BTC-USDT-SWAP" |
| period | TEXT, "1"~"48" |
| direction | TEXT, "long"/"short"/null |
| direction_updated_at | INTEGER |
| enabled | INTEGER 0/1 |

**positions** — 持仓记录 (symbol, direction, leverage, entry_price, quantity, margin, okx_order_id, tp_price, sl_price, unrealized_pnl, last_price, status, close_reason, close_price, close_pnl, close_time)

**trade_logs** — 已平仓交易日志 (symbol, direction, entry_price, exit_price, quantity, margin, pnl, pnl_percent, close_reason, profit_transferred, open_time, close_time)

**system_logs** — 系统日志 (type, message, created_at)

索引: `idx_positions_status`, `idx_positions_symbol_status`, `idx_trade_logs_close_time`, `idx_system_logs_created_at`

---

## 十二、API 路由

| 方法 | 路由 | 用途 |
|------|------|------|
| GET | `/` | Dashboard HTML |
| GET | `/test` | 健康检查 → pong |
| GET | `/api/status` | 系统状态 (启停/配置/下次 Cron) |
| GET | `/api/config` | 读取配置 |
| POST | `/api/config` | 更新配置 (单键或批量) |
| GET | `/api/coins` | 币种列表含方向 |
| POST | `/api/coins` | 更新币种开关/周期 (触发方向重判) |
| PATCH | `/api/coins` | 添加币种 (自动补全 -USDT-SWAP) |
| DELETE | `/api/coins` | 删除币种 |
| GET | `/api/positions` | 活跃持仓 |
| POST | `/api/close-position` | 手动平单仓 |
| POST | `/api/close-all` | 全部平仓 (含 PnL + 利润划转) |
| GET | `/api/trades` | 交易记录 (分页: ?limit=50&offset=0) |
| GET | `/api/logs` | 系统日志 (?limit=50) |
| POST | `/api/start` | 启动 (enabled=true) |
| POST | `/api/stop` | 停止 (enabled=false) |

---

## 十三、Dashboard 前端

`src/ui/dashboard.ts` 导出内嵌 HTML 字符串。原生实现，无框架依赖。

- 暗色主题 (GitHub 风格)
- 10 秒自动轮询刷新
- 面板: 控制栏 / 交易参数 / OKX API 配�置 / 币种选择 / 活跃持仓 / 交易记录 / 系统日志

> 注: `dashboard.ts` 所有输入框初始为空 (`placeholder="请设置"`)。`dashboard.html` 是独立版本，带默认参数值，`index.ts` 引用的是 `dashboard.ts`。

---

## 十四、部署流程

`.github/workflows/deploy.yml`，push main 时触发:

1. Checkout + Node 20 + npm install
2. Type check (`npm run typecheck`)
3. 获取 Cloudflare Account ID
4. 启用 workers.dev subdomain
5. 创建 D1 数据库 (幂等)
6. 注入数据库名称/ID 到 `wrangler.toml`
7. 初始化 Schema + 种子数据
8. `wrangler deploy`
9. 设置 Worker Secrets (OKX_API_KEY 等)
10. 绑定自定义域名路由
11. 验证部署

---

## 十五、文件清单

```
/workspace/
├── wrangler.toml
├── package.json
├── tsconfig.json
├── schema.sql                  # D1 DDL (5 张表 + 索引)
├── seed.sql                    # 种子数据 (仅 config 默认值)
├── ARCHITECTURE.md
├── src/
│   ├── index.ts                # Worker 入口 (fetch + scheduled)
│   ├── types.ts                # 全局类型 (Config/CoiPair/Position/TradeLog/OKX*)
│   ├── constants.ts            # 常量 (限流/锁超时/OKX账户编码)
│   ├── env.d.ts                # Env 类型 (D1 binding + Secrets)
│   ├── okx/
│   │   ├── live-client.ts      # OKX 实盘 Client
│   │   └── signer.ts           # 签名 + 限流 + 代理
│   ├── engine/
│   │   ├── main-loop.ts        # 主循环 (锁 + 验证 + 分发)
│   │   ├── direction.ts        # 方向判定
│   │   ├── scheduler.ts        # 开单调度
│   │   ├── monitor.ts          # 超时平仓监控
│   │   └── transfer.ts         # 利润划转
│   ├── db/
│   │   ├── connection.ts       # D1 连接
│   │   └── queries.ts          # CRUD 操作
│   ├── api/
│   │   ├── router.ts           # Hono 路由
│   │   ├── status.ts           # 状态
│   │   ├── config.ts           # 配置
│   │   ├── coins.ts            # 币种管理
│   │   ├── positions.ts        # 持仓 + 平仓
│   │   ├── trades.ts           # 交易记录
│   │   ├── logs.ts             # 系统日志
│   │   ├── balance.ts          # 余额 (stub)
│   │   └── control.ts          # 启停
│   └── ui/
│       ├── dashboard.html      # 独立 HTML (带默认值)
│       └── dashboard.ts        # HTML 字符串导出
└── .github/
    └── workflows/
        └── deploy.yml
```

---

## 十六、异常处理

| 场景 | 策略 |
|------|------|
| Cron 前次未完成 | D1 乐观锁, 60s 超时自动抢占 |
| 配置不完整 | 自动 disabled |
| 方向为 null (首次启动) | 立即判定 |
| 余额不足 | skip + 记录日志 |
| 合约张数 < minSz | skip + 记录日志 |
| OKX API 异常 | try-catch, 不中断其他处理 |
| 成交价查询失败 | 回退到 ticker.last |

---

## 十七、当前局限

1. 无模拟模式 (仅实盘 LiveClient)
2. 止盈/止损完全依赖 OKX 算法单，Worker 不轮询
3. 余额查询 API 为 stub，路由未注册
4. `dashboard.ts` 与 `dashboard.html` 默认值不一致
5. 系统日志无自动清理
6. 超时平仓 `exit_price=0`
7. `seed.sql` 缺少 coin_pairs 种子数据
