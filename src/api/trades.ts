import type { ApiResponse, TradeLog } from '../types';
import { getRecentTradeLogs, clearTradeLogs } from '../db/queries';

export async function getTradesHandler(env: Env, limit: number, offset: number): Promise<ApiResponse<TradeLog[]>> {
  const trades = await getRecentTradeLogs(env, limit, offset);
  return { success: true, data: trades };
}

export async function clearTradesHandler(env: Env): Promise<ApiResponse<{ deleted: number }>> {
  const deleted = await clearTradeLogs(env);
  return { success: true, data: { deleted } };
}
