import type { ApiResponse, SystemLog } from '../types';
import { getRecentSystemLogs, clearSystemLogs } from '../db/queries';

export async function getLogsHandler(env: Env, limit: number): Promise<ApiResponse<SystemLog[]>> {
  const logs = await getRecentSystemLogs(env, limit);
  return { success: true, data: logs };
}

export async function clearLogsHandler(env: Env): Promise<ApiResponse<null>> {
  await clearSystemLogs(env);
  return { success: true, data: null };
}
