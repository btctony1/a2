import type { ApiResponse } from '../types';
import { setConfigValue, insertSystemLog } from '../db/queries';
import { mainLoop } from '../engine/main-loop';

export async function startHandler(env: Env, ctx?: { waitUntil?: (p: Promise<any>) => void } | any): Promise<ApiResponse<null>> {
  await setConfigValue(env, 'enabled', 'true');
  await insertSystemLog(env, 'info', '手动启动交易');
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(mainLoop(env));
  } else {
    mainLoop(env).catch((e: any) => console.error('[StartHandler] mainLoop error:', e));
  }
  return { success: true, data: null };
}

export async function stopHandler(env: Env): Promise<ApiResponse<null>> {
  await setConfigValue(env, 'enabled', 'false');
  await insertSystemLog(env, 'info', '手动停止交易');
  return { success: true, data: null };
}

export async function triggerLoopHandler(env: Env): Promise<ApiResponse<{ message: string }>> {
  try {
    await mainLoop(env);
    return { success: true, data: { message: '主循环执行完成' } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

