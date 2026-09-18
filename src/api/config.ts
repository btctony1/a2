import type { ApiResponse, Config, TimeoutUnit } from '../types';
import { getConfig, setConfigValue, setConfigValues } from '../db/queries';

export async function getConfigHandler(env: Env): Promise<ApiResponse<Config>> {
  const config = await getConfig(env);
  return { success: true, data: config };
}

export async function updateConfigHandler(env: Env, body: Record<string, string>): Promise<ApiResponse<null>> {
  try {
    if (body.key && body.value) {
      await setConfigValue(env, body.key, body.value);
    } else {
      await setConfigValues(env, body);
    }
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
