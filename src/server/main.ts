import { serve } from '@hono/node-server';
import { loadEnv } from './config/env';
import { PgDatabase } from './repository/database';
import { PgUnitOfWork } from './repository/pg-unit-of-work';
import { createServices } from './service/services';
import { createApp } from './handler/app';

const env = loadEnv();
const database = new PgDatabase(env.DATABASE_URL);
const uow = new PgUnitOfWork(database);
const services = createServices(uow);
const app = createApp(services, env);

const server = serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`受発注システム API を起動しました: http://localhost:${info.port}`);
    if (env.ALLOW_DEV_AUTH) {
      console.log('開発用ログインが有効です（本番環境では ALLOW_DEV_AUTH=false にしてください）');
    }
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
