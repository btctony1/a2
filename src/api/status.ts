import type { ApiResponse } from '../types';
import { getConfig, getConfigValue } from '../db/queries';

export async function getStatus(env: Env): Promise<ApiResponse<Record<string, unknown>>> {
  const config = await getConfig(env);
  const lastLoopStr = await getConfigValue(env, 'last_loop_time');
  const lastLoopTime = lastLoopStr ? parseInt(lastLoopStr, 10) : 0;

  return {
    success: true,
    data: {
      enabled: config.enabled,
      last_loop_time: lastLoopTime,
    },
  };
}
