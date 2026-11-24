import { loadEnv } from './config/env.js';
import { createApp } from './handler/app.js';
import { PgDatabase } from './repository/database.js';
import { PgUnitOfWork } from './repository/pg-unit-of-work.js';
import { createServices } from './service/services.js';

const env = loadEnv();
const database = new PgDatabase(env.DATABASE_URL);
const uow = new PgUnitOfWork(database);
const services = createServices(uow);
const app = createApp(services, env);

export { app, database, env };
