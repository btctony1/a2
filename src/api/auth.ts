import type { Context } from 'hono';
import { getConfigValue, setConfigValues, ensureDbSchema } from '../db/queries';

export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function extractToken(c: Context): string | null {
  const headerToken = c.req.header('X-Auth-Token') || c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  if (headerToken) return headerToken.trim();

  const cookieHeader = c.req.header('Cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]*)/);
    if (match) return match[1].trim();
  }
  return null;
}

let cachedAuthInfo: { hasPassword: boolean; token: string; timestamp: number } | null = null;
const AUTH_CACHE_TTL_MS = 60 * 1000; // 缓存 60 秒，大幅降低 D1 row read

export function invalidateAuthCache(): void {
  cachedAuthInfo = null;
}

export async function getExpectedToken(env: Env): Promise<{ hasPassword: boolean; token: string }> {
  const now = Date.now();
  if (cachedAuthInfo && (now - cachedAuthInfo.timestamp < AUTH_CACHE_TTL_MS)) {
    return { hasPassword: cachedAuthInfo.hasPassword, token: cachedAuthInfo.token };
  }

  await ensureDbSchema(env);
  const storedHash = await getConfigValue(env, 'dashboard_password');
  if (!storedHash) {
    cachedAuthInfo = { hasPassword: false, token: '', timestamp: now };
    return { hasPassword: false, token: '' };
  }
  let secret = await getConfigValue(env, 'auth_session_secret');
  if (!secret) {
    secret = crypto.randomUUID();
    await setConfigValues(env, { auth_session_secret: secret });
  }
  const token = await hashString(storedHash + secret);
  cachedAuthInfo = { hasPassword: true, token, timestamp: now };
  return { hasPassword: true, token };
}

export async function verifyAuthToken(env: Env, reqToken: string | null): Promise<boolean> {
  try {
    const { hasPassword, token } = await getExpectedToken(env);
    if (!hasPassword || !reqToken) {
      return false;
    }
    return reqToken === token;
  } catch (err) {
    console.error('[Auth Error] verifyAuthToken error:', err);
    return false;
  }
}

export async function checkAuthHandler(env: Env, reqToken: string | null) {
  try {
    const { hasPassword, token } = await getExpectedToken(env);
    const authenticated = hasPassword && !!reqToken && reqToken === token;
    return { success: true, authenticated, hasPassword };
  } catch (err: any) {
    console.error('[Auth Error] checkAuthHandler error:', err);
    return { success: false, error: err?.message || '检查身份认证失败', authenticated: false, hasPassword: true };
  }
}

export async function loginHandler(env: Env, body: { password?: string }) {
  try {
    await ensureDbSchema(env);
    const storedHash = await getConfigValue(env, 'dashboard_password');
    if (!storedHash) {
      return { success: false, error: '系统尚未设置密码，请先初始化设置密码', needSetup: true, hasPassword: false };
    }
    if (!body?.password) {
      return { success: false, error: '请输入密码' };
    }
    const inputHash = await hashString(body.password);
    if (inputHash !== storedHash) {
      return { success: false, error: '密码错误，请重试' };
    }
    let secret = await getConfigValue(env, 'auth_session_secret');
    if (!secret) {
      secret = crypto.randomUUID();
      await setConfigValues(env, { auth_session_secret: secret });
    }
    const token = await hashString(storedHash + secret);
    return { success: true, token, message: '登录成功' };
  } catch (err: any) {
    console.error('[Auth Error] loginHandler error:', err);
    return { success: false, error: '登录处理异常: ' + (err?.message || String(err)) };
  }
}

export async function setupHandler(env: Env, body: { newPassword?: string }) {
  try {
    await ensureDbSchema(env);
    const storedHash = await getConfigValue(env, 'dashboard_password');
    if (storedHash) {
      return { success: false, error: '密码已存在，请直接登录；如需修改请登录后使用修改密码功能', hasPassword: true };
    }
    const newPassword = body?.newPassword?.trim();
    if (!newPassword || newPassword.length < 1) {
      return { success: false, error: '密码不能为空' };
    }
    const newHash = await hashString(newPassword);
    const newSecret = crypto.randomUUID();
    await setConfigValues(env, {
      dashboard_password: newHash,
      auth_session_secret: newSecret,
    });
    const token = await hashString(newHash + newSecret);
    invalidateAuthCache();
    return { success: true, token, message: '密码设置成功并已登录' };
  } catch (err: any) {
    console.error('[Auth Error] setupHandler error:', err);
    return { success: false, error: '密码初始化异常: ' + (err?.message || String(err)) };
  }
}

export async function changePasswordHandler(
  env: Env,
  reqToken: string | null,
  body: { oldPassword?: string; newPassword?: string }
) {
  try {
    await ensureDbSchema(env);
    const isValid = await verifyAuthToken(env, reqToken);
    if (!isValid) {
      return { success: false, error: '未授权或登录已失效' };
    }
    const oldPassword = body?.oldPassword;
    const newPassword = body?.newPassword?.trim();
    if (!oldPassword) {
      return { success: false, error: '请输入原密码' };
    }
    if (!newPassword || newPassword.length < 1) {
      return { success: false, error: '新密码不能为空' };
    }
    const storedHash = await getConfigValue(env, 'dashboard_password');
    const oldHash = await hashString(oldPassword);
    if (oldHash !== storedHash) {
      return { success: false, error: '原密码错误' };
    }
    const newHash = await hashString(newPassword);
    const newSecret = crypto.randomUUID();
    await setConfigValues(env, {
      dashboard_password: newHash,
      auth_session_secret: newSecret,
    });
    const newToken = await hashString(newHash + newSecret);
    invalidateAuthCache();
    return { success: true, token: newToken, message: '密码修改成功' };
  } catch (err: any) {
    console.error('[Auth Error] changePasswordHandler error:', err);
    return { success: false, error: '修改密码异常: ' + (err?.message || String(err)) };
  }
}

