import { Hono } from 'hono';
import { getStatus } from './status';
import { getConfigHandler, updateConfigHandler } from './config';
import {
  getCoinsHandler,
  updateCoinHandler,
  retryCoinHandler,
  addCoinHandler,
  deleteCoinHandler,
  syncOkxCoinsHandler,
  startAllCoinsHandler,
  stopAllCoinsHandler,
  getGlobalParamsHandler,
  saveGlobalParamsHandler,
  batchUpdateCoinParamsHandler,
  previewSmartCoinsHandler,
  importSmartCoinsHandler,
  getSmartConfigHandler,
  saveSmartConfigHandler,
  runSmartImportNowHandler,
  getOverviewHandler,
} from './coins';
import { getPositionsHandler, syncPositionsHandler, closePositionHandler, closeAllPositionsHandler } from './positions';
import { getTradesHandler, clearTradesHandler } from './trades';
import { getLogsHandler, clearLogsHandler } from './logs';
import { startHandler, stopHandler, triggerLoopHandler } from './control';
import { resetSystemHandler } from './reset';
import {
  checkAuthHandler,
  loginHandler,
  setupHandler,
  changePasswordHandler,
  extractToken,
  verifyAuthToken,
} from './auth';

type Bindings = { env: Env };

export function createRouter(): Hono<{ Bindings: Bindings }> {
  const app = new Hono<{ Bindings: Bindings }>();

  // Global Error Handler to guarantee JSON responses
  app.onError((err, c) => {
    console.error('[API Error Caught]:', err);
    return c.json({ success: false, error: err?.message || '服务器处理异常' }, 500);
  });

  app.notFound((c) => {
    return c.json({ success: false, error: '请求的接口不存在 (404)' }, 404);
  });

  // Public authentication routes
  app.get('/api/auth/check', async (c) => {
    const token = extractToken(c);
    return c.json(await checkAuthHandler(c.env.env, token));
  });

  app.post('/api/auth/login', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const res = await loginHandler(c.env.env, body);
    if (res.success && res.token) {
      c.header('Set-Cookie', `auth_token=${res.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
    }
    return c.json(res);
  });

  app.post('/api/auth/setup', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const res = await setupHandler(c.env.env, body);
    if (res.success && res.token) {
      c.header('Set-Cookie', `auth_token=${res.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
    }
    return c.json(res);
  });

  app.post('/api/auth/logout', async (c) => {
    c.header('Set-Cookie', 'auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    return c.json({ success: true, message: '已安全退出' });
  });

  // Middleware: Protect all other /api/* endpoints
  app.use('/api/*', async (c, next) => {
    const path = c.req.path;
    if (
      path === '/api/auth/check' ||
      path === '/api/auth/login' ||
      path === '/api/auth/setup' ||
      path === '/api/auth/logout'
    ) {
      return next();
    }

    const token = extractToken(c);
    const isValid = await verifyAuthToken(c.env.env, token);
    if (!isValid) {
      return c.json({ success: false, error: '未登录或登录已失效，请重新登录', code: 401 }, 401);
    }
    await next();
  });

  // Protected auth route
  app.post('/api/auth/change-password', async (c) => {
    const token = extractToken(c);
    const body = await c.req.json().catch(() => ({}));
    const res = await changePasswordHandler(c.env.env, token, body);
    if (res.success && res.token) {
      c.header('Set-Cookie', `auth_token=${res.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
    }
    return c.json(res);
  });

  // Protected business routes
  app.get('/api/overview', async (c) => c.json(await getOverviewHandler(c.env.env)));
  app.get('/api/account/balance', async (c) => c.json(await getOverviewHandler(c.env.env)));
  app.get('/api/status', async (c) => c.json(await getStatus(c.env.env)));
  app.get('/api/config', async (c) => c.json(await getConfigHandler(c.env.env)));
  app.post('/api/config', async (c) => c.json(await updateConfigHandler(c.env.env, await c.req.json())));
  app.get('/api/coins', async (c) => c.json(await getCoinsHandler(c.env.env)));
  app.post('/api/coins', async (c) => c.json(await updateCoinHandler(c.env.env, await c.req.json())));
  app.get('/api/coins/global-params', async (c) => c.json(await getGlobalParamsHandler(c.env.env)));
  app.post('/api/coins/global-params', async (c) => c.json(await saveGlobalParamsHandler(c.env.env, await c.req.json())));
  app.post('/api/coins/batch-update', async (c) => c.json(await batchUpdateCoinParamsHandler(c.env.env, await c.req.json())));
  app.get('/api/coins/smart-config', async (c) => c.json(await getSmartConfigHandler(c.env.env)));
  app.post('/api/coins/smart-config', async (c) => c.json(await saveSmartConfigHandler(c.env.env, await c.req.json())));
  app.post('/api/coins/smart-preview', async (c) => c.json(await previewSmartCoinsHandler(c.env.env, await c.req.json())));
  app.post('/api/coins/smart-import', async (c) => c.json(await importSmartCoinsHandler(c.env.env, await c.req.json(), c.executionCtx)));
  app.post('/api/coins/smart-run-now', async (c) => c.json(await runSmartImportNowHandler(c.env.env, c.executionCtx)));
  app.post('/api/coins/start-all', async (c) => c.json(await startAllCoinsHandler(c.env.env, c.executionCtx)));
  app.post('/api/coins/stop-all', async (c) => c.json(await stopAllCoinsHandler(c.env.env)));
  app.post('/api/coins/retry', async (c) => c.json(await retryCoinHandler(c.env.env, await c.req.json())));
  app.post('/api/coins/sync-okx', async (c) => c.json(await syncOkxCoinsHandler(c.env.env)));
  app.patch('/api/coins', async (c) => c.json(await addCoinHandler(c.env.env, await c.req.json())));
  
  const handleCoinsDelete = async (c: any) => {
    let body: any = {};
    try {
      body = await c.req.json();
    } catch (_) {
      body = {};
    }
    const querySymbol = c.req.query('symbol');
    if (querySymbol && !body.symbol && !body.symbols) {
      body.symbol = querySymbol;
    }
    return c.json(await deleteCoinHandler(c.env.env, body));
  };

  app.delete('/api/coins', handleCoinsDelete);
  app.post('/api/coins/delete', handleCoinsDelete);
  app.post('/api/coins/batch-delete', handleCoinsDelete);
  app.get('/api/positions', async (c) => c.json(await getPositionsHandler(c.env.env)));
  app.post('/api/positions/sync', async (c) => c.json(await syncPositionsHandler(c.env.env)));
  app.post('/api/close-position', async (c) => c.json(await closePositionHandler(c.env.env, await c.req.json())));
  app.post('/api/close-all', async (c) => c.json(await closeAllPositionsHandler(c.env.env, await c.req.json())));
  app.get('/api/trades', async (c) => {
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    return c.json(await getTradesHandler(c.env.env, limit, offset));
  });
  app.delete('/api/trades', async (c) => c.json(await clearTradesHandler(c.env.env)));
  app.get('/api/logs', async (c) => {
    const limit = parseInt(c.req.query('limit') || '50', 10);
    return c.json(await getLogsHandler(c.env.env, limit));
  });
  app.delete('/api/logs', async (c) => c.json(await clearLogsHandler(c.env.env)));
  app.post('/api/start', async (c) => c.json(await startHandler(c.env.env, c.executionCtx)));
  app.post('/api/stop', async (c) => c.json(await stopHandler(c.env.env)));
  app.post('/api/trigger-loop', async (c) => c.json(await triggerLoopHandler(c.env.env)));
  app.post('/api/system/reset', async (c) => {
    const token = extractToken(c);
    const body = await c.req.json().catch(() => ({}));
    return c.json(await resetSystemHandler(c.env.env, token, body));
  });

  return app;
}
