# OKX Auto Trader (Cloudflare Workers + D1)

基于 Cloudflare Workers + D1 (SQLite) + Hono 构建的轻量级 OKX 自动化合约交易与多周期对冲系统。

---

## 核心架构特性

1. **零服务器 / Serverless 部署**：
   - 运行于 Cloudflare 全球边缘网络，内置 `1分钟/次` 的 Cron 定时触发器（`* * * * *`）。
   - 数据持久化采用 Cloudflare D1 边缘数据库。
2. **全周期智能行情判定**：
   - 支持多时间级别（1m、5m、15m、1h、4h、1d 等）K线周期判定与方向对齐。
   - 内置 **0 ~ 10,000ms 随机延时抖动**，错开整点 K 线请求高峰。
3. **聚合止盈止损 (Aggregate OCO)**：
   - 针对单个币种方向始终维持 1 笔 OCO 动态加权止盈止损单，彻底突破 OKX 100 笔策略挂单上限。
4. **资金等分分批建仓与亏损加仓控制**：
   - 支持资金灵活等分（如 10 份），结合加仓幅度限制（如盈利自动加仓，亏损需达指定负百分比才允许加仓）。
5. **全局/批量参数配置与 OKX 智能优选币种**：
   - 支持单币独立配置与全局批量应用双模式；支持根据账户资金与杠杆自动筛选可开张数充足的合约标的。
6. **OKX API 严格串行流控**：
   - 全局串行请求队列调度，保证每一个 API 调用完全返回且经过 200ms+50ms 冷却后才执行下一次调用，杜绝 50011 (Too Many Requests) 错误。

---

## GitHub Actions 自动部署流程

仓库内置了 `.github/workflows/deploy.yml` 自动化 CI/CD 工作流，每次推送到 `main` 分支会自动完成：
1. 依赖安装与 TypeScript 类型检查。
2. 自动获取 Cloudflare Account ID，并在 D1 中创建数据库。
3. 自动执行 `schema.sql` 完成数据库建表与索引初始化。
4. 动态写入配置并部署 Cloudflare Worker。

### 需要在 GitHub 仓库中配置的 Secrets：

在 GitHub 仓库的 **Settings -> Secrets and variables -> Actions** 中添加以下密钥：

| Secret 名称 | 说明 | 示例 |
| :--- | :--- | :--- |
| `API` | Cloudflare API Token（需具备 Workers、D1、DNS 编辑权限） | `v4-token-xxx` |
| `QZ` | 项目名称前缀 / Subdomain | `my-okx-bot` |
| `YUM` | *(可选)* 自定义域名顶级域（如无需自定义域名可留空或填默认） | `example.com` |
| `OKX_API_KEY` | *(可选)* OKX 交易账户 API Key（也可在部署后 Web 控制台配置） | `xxx` |
| `OKX_SECRET_KEY` | *(可选)* OKX 交易账户 Secret Key | `xxx` |
| `OKX_PASSPHRASE` | *(可选)* OKX API Passphrase | `xxx` |

---

## 本地开发与测试

```bash
# 1. 安装依赖
npm install

# 2. 类型检查
npm run typecheck

# 3. 本地启动 Wrangler 开发服务器
npm run dev
```

---

## 项目结构

```
├── .github/workflows/deploy.yml   # GitHub Actions 自动化部署工作流
├── schema.sql                     # Cloudflare D1 数据库建表与索引脚本
├── wrangler.toml                  # Cloudflare Worker 配置文件
├── package.json                   # 项目依赖与构建脚本
├── tsconfig.json                  # TypeScript 编译配置
└── src/
    ├── index.ts                   # Worker 主入口（处理 HTTP 请求与 Cron 调度）
    ├── constants.ts               # 系统常量与流控阈值
    ├── types.ts                   # TypeScript 类型定义
    ├── api/                       # RESTful API 接口路由 (Hono)
    ├── db/                        # D1 数据库查询与连接封装
    ├── engine/                    # 核心交易引擎 (方向判定 / 调度开仓 / 仓位监控)
    ├── okx/                       # OKX HMAC-SHA256 签名器与客户端
    └── ui/                        # Web 控制台单文件前端 (HTML/CSS/JS)
```
