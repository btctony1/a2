import type { ApiResponse } from '../types';
import { hashString, verifyAuthToken } from './auth';
import { getDB } from '../db/connection';
import { getConfigValue, ensureDbSchema, resetEntireDatabase, invalidateConfigCache } from '../db/queries';
import { invalidateAuthCache } from './auth';

export async function resetSystemHandler(
  env: Env,
  reqToken: string | null,
  body: { password?: string; keepPassword?: boolean }
): Promise<ApiResponse<{ reset: boolean }>> {
  try {
    await ensureDbSchema(env);
    
    // 1. 验证登录 Token
    const isTokenValid = await verifyAuthToken(env, reqToken);
    if (!isTokenValid) {
      return { success: false, error: '未登录或登录已失效，请重新登录后再试' };
    }

    // 2. 验证二次确认密码
    const inputPassword = body?.password;
    if (!inputPassword) {
      return { success: false, error: '请输入登录密码进行重置确认' };
    }

    const storedHash = await getConfigValue(env, 'dashboard_password');
    if (!storedHash) {
      return { success: false, error: '系统尚未设置密码' };
    }

    const inputHash = await hashString(inputPassword);
    if (inputHash !== storedHash) {
      return { success: false, error: '确认密码错误，重置已取消' };
    }

    // 3. 执行 D1 数据库彻底删除与重置
    const keepPassword = body?.keepPassword !== false; // 默认保留当前密码以便重置后无需重新初化，也可重新登录
    await resetEntireDatabase(env, keepPassword ? storedHash : undefined);

    // 4. 清理内存缓存
    invalidateConfigCache();
    invalidateAuthCache();

    return {
      success: true,
      data: { reset: true },
      message: '系统数据与D1数据库已彻底重置清空！',
    };
  } catch (err: any) {
    console.error('[Reset Error] resetSystemHandler error:', err);
    return { success: false, error: '重置系统失败: ' + (err?.message || String(err)) };
  }
}
