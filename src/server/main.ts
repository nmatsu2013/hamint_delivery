import { serve } from '@hono/node-server';
import { app, database, env } from './runtime.js';

const server = serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`受発注システム API を起動しました: http://localhost:${info.port}`);
  },
);

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} を受信しました。サーバーを停止します。`);
  server.close(async () => {
    await database.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

export { app };
