import { getConfig, getCoinPairs, getOpenPositions, insertSystemLog, setConfigValue, getConfigValue, cleanupOldRecords } from '../db/queries';
import { createLiveClient } from '../okx/live-client';
import { resetSubrequestCount, getSubrequestCount, setCycleDeadline, clearCycleDeadline, resetRequestQueue, isCycleTimeout, isSubrequestLimitReached } from '../okx/signer';
import { checkDirection } from './direction';
import { openPosition, resetSchedulerMemoryState, preloadAllInstruments } from './scheduler';
import { monitorPositions } from './monitor';
import { PHASE_COOLDOWN_MS, MAIN_LOOP_MAX_EXEC_MS, MAX_SUBREQUESTS_PER_CYCLE } from '../constants';
import type { Config, OKXTicker, OKXPosition } from '../types';

async function cooldown(ms: number): Promise<void> {
  if (ms <= 0) return;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mainLoop(env: Env): Promise<void> {
  const loopStart = Date.now();
  // 1. 设置本轮主循环 58 秒硬熔断截止时间戳，彻底清空请求队列与请求计数
  setCycleDeadline(loopStart + MAIN_LOOP_MAX_EXEC_MS);
  resetRequestQueue();
  resetSchedulerMemoryState();

  try {
    await setConfigValue(env, 'last_loop_time', String(loopStart)).catch(() => {});

    const config = await getConfig(env);
    const coinPairs = await getCoinPairs(env);

    // 检查是否有定时自动优选导入任务需要触发
    try {
      const { executeSmartAutoImport } = await import('../api/coins');
      await executeSmartAutoImport(env, false);
    } catch (autoErr) {
      console.warn('[MainLoop] 自动优选调度检查异常:', autoErr);
    }

    const activePairs = coinPairs.filter(c => c.enabled && c.period);

    if (!config.enabled && activePairs.length === 0) {
      return;
    }

    const apiKey = env.OKX_API_KEY || config.okx_api_key;
    const secretKey = env.OKX_SECRET_KEY || config.okx_secret_key;
    const passphrase = env.OKX_PASSPHRASE || config.okx_passphrase;

    if (!apiKey || !secretKey || !passphrase) {
      return;
    }

    const client = createLiveClient(apiKey, secretKey, passphrase, env.OKX_PROXY_URL);

    // 严密检查硬上限：若已达 48 次或 58 秒，彻底终结本轮任务
    if (isCycleTimeout() || isSubrequestLimitReached()) {
      await insertSystemLog(env, 'warn', `[MainLoop] 触发硬熔断限制，彻底终结本轮任务，等待下一轮全新执行`);
      return;
    }

    const posModeChecked = await getConfigValue(env, 'pos_mode_checked');
    if (posModeChecked !== 'true') {
      try {
        const posMode = await client.getPosMode();
        if (posMode !== 'long_short_mode') {
          await client.setPosMode('long_short_mode');
          await insertSystemLog(env, 'info', `持仓模式已从 ${posMode} 切换为 long_short_mode（多空双开）`);
        }
        await setConfigValue(env, 'pos_mode_checked', 'true');
      } catch (e) {
        await insertSystemLog(env, 'warn', `持仓模式检查/设置提示: ${String(e)}`);
        await setConfigValue(env, 'pos_mode_checked', 'true');
      }
    }

    if (isCycleTimeout() || isSubrequestLimitReached()) {
      return;
    }

    // 收集当前主循环真正需要行情的币种：
    // 1. 所有参与自动交易或配置周期的币种 (用于持仓监控、开仓、周期方向与振幅研判)
    // 2. 本地数据库中正在持仓的币种 (用于持仓监控与浮盈计算)
    const neededSymbols = new Set<string>();
    for (const c of coinPairs) {
      if (c.enabled || c.period) {
        if (c.symbol) neededSymbols.add(c.symbol);
      }
    }
    try {
      const dbPositions = await getOpenPositions(env);
      for (const p of dbPositions) {
        if (p.symbol) neededSymbols.add(p.symbol);
      }
    } catch {}

    // 方案A：使用全合约行情大包与全量合约规则预加载（单次全量大包拉取，绝不逐个币种发起请求）
    await preloadAllInstruments(client).catch(() => {});

    let tickerMap: Map<string, OKXTicker> = new Map();
    if (neededSymbols.size > 0) {
      try {
        tickerMap = await client.getTickersForSymbols(Array.from(neededSymbols));
      } catch (e) {
        console.warn('[MainLoop] 批量获取目标币种行情失败:', e);
      }
    }

    if (isCycleTimeout() || isSubrequestLimitReached()) {
      return;
    }

    // 单次批量获取全账户持仓（仅消耗 1 个子请求，供后续对账共享）
    let prefetchedPositions: OKXPosition[] | null = null;
    try {
      prefetchedPositions = await client.getPositions();
    } catch (e) {
      console.warn('[MainLoop] 预拉取持仓失败:', e);
      prefetchedPositions = null;
    }

    // 1. 监控持仓与对账平仓（结算已止盈/止损/平仓的历史仓位，确保持仓状态100%纯净）
    if (!isCycleTimeout() && !isSubrequestLimitReached() && prefetchedPositions !== null) {
      await runStep(env, 'monitor', async () => {
        await monitorPositions(client, env, tickerMap, prefetchedPositions, coinPairs);
      });
    }

    // 2. 检查多周期行情方向（仅在周期边界或未有时计算，极度轻量化）
    await cooldown(PHASE_COOLDOWN_MS);
    const currentActive = coinPairs.filter(c => c.enabled && c.period);
    if (currentActive.length > 0 && !isCycleTimeout() && !isSubrequestLimitReached()) {
      await runStep(env, 'direction', () => checkDirection(client, env, tickerMap, coinPairs));
    }

    // 3. 调度自动开仓（严格按设定的间隔触发，加仓或首次开单成交后精准更新固定收益率全仓止盈止损）
    await cooldown(PHASE_COOLDOWN_MS);
    if (!isCycleTimeout() && !isSubrequestLimitReached()) {
      await runStep(env, 'open', async () => {
        await openPosition(client, env, tickerMap, prefetchedPositions || undefined, coinPairs);
      });
    }

    const elapsed = Date.now() - loopStart;
    const subreqs = getSubrequestCount();
    if (elapsed >= MAIN_LOOP_MAX_EXEC_MS || subreqs >= MAX_SUBREQUESTS_PER_CYCLE) {
      await insertSystemLog(env, 'warn', `[MainLoop] 本轮耗时(${elapsed}ms)子请求(${subreqs}/${MAX_SUBREQUESTS_PER_CYCLE})触及硬上限，彻底终结本轮全部任务`);
    } else {
      await insertSystemLog(env, 'info', `【主循环周期完结】本轮任务执行完成，耗时: ${(elapsed / 1000).toFixed(2)}s，子请求: ${subreqs}/${MAX_SUBREQUESTS_PER_CYCLE}次`);
    }

    // 数据库清理低频执行，避免每分钟全表扫描
    if (Math.random() < 0.02) {
      try {
        await cleanupOldRecords(env);
      } catch {}
    }

  } catch (err) {
    await insertSystemLog(env, 'error', `MainLoop异常: ${String(err)}`);
  } finally {
    // 必须彻底清除本轮截止时间、重置请求队列、清理所有内存缓存，确保下一次主循环 100% 全新开始，绝不残留旧队列
    clearCycleDeadline();
    resetRequestQueue();
    resetSchedulerMemoryState();
  }
}

async function runStep(env: Env, name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err: any) {
    await insertSystemLog(env, 'error', `[${name}] 步骤异常: ${err?.message || String(err)}`);
  }
}
