import { createRouter } from './api/router';
import { mainLoop } from './engine/main-loop';
import DASHBOARD_HTML from './ui/dashboard';

let router: ReturnType<typeof createRouter>;

function getRouter() {
  if (!router) {
    router = createRouter();
  }
  return router;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/test') {
      return new Response('pong');
    }

    if (url.pathname === '/proxy') {
      const target = url.searchParams.get('url');
      if (!target) return new Response('missing url', { status: 400 });
      try {
        const body = request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.arrayBuffer()
          : undefined;
        const resp = await fetch(target, {
          method: request.method,
          headers: request.headers,
          body,
        });
        return new Response(resp.body, resp);
      } catch (e: any) {
        return new Response(`proxy error: ${e.message}`, { status: 502 });
      }
    }

    if (url.pathname === '/') {
      return new Response(DASHBOARD_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (url.pathname.startsWith('/api/')) {
      return getRouter().fetch(request, { env }, ctx);
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const SCHEDULED_TIMEOUT_MS = 58000;
    let timeoutHandle: any;

    const timeoutPromise = new Promise<void>((resolve) => {
      timeoutHandle = setTimeout(() => {
        console.warn(`[Scheduled Guard] 定时任务达到硬性上限 (${SCHEDULED_TIMEOUT_MS}ms)，强制释放退出以保障下一周期纯净启动`);
        resolve();
      }, SCHEDULED_TIMEOUT_MS);
    });

    const executionPromise = (async () => {
      try {
        await mainLoop(env);
      } catch (e: any) {
        console.error('[Scheduled Error] 定时任务执行异常:', e);
        try {
          const { insertSystemLog } = await import('./db/queries');
          await insertSystemLog(env, 'error', `定时主循环异常: ${e?.message ?? String(e)}`);
        } catch (logErr) {
          console.error('[Scheduled Log Error] 无法写入异常日志:', logErr);
        }
      } finally {
        clearTimeout(timeoutHandle);
      }
    })();

    const runner = Promise.race([executionPromise, timeoutPromise]);
    ctx.waitUntil(runner);
    await runner;
  },
};
