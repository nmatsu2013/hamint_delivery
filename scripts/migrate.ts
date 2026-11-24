import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { createPgConfig } from '../src/server/config/pg';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL が設定されていません');
  }
  const client = new Client(createPgConfig(connectionString));
  await client.connect();
  try {
    await client.query(
      `create table if not exists schema_migrations (
         version text primary key,
         applied_at timestamptz not null default now()
       )`,
    );
    const migrationDir = path.resolve(process.cwd(), 'migration');
    const files = (await readdir(migrationDir))
      .filter((file) => file.endsWith('.sql') && !file.includes('seed'))
      // 初期スキーマ（create.sql）を必ず最初に適用し、その後はファイル名順。
      .sort((a, b) => {
        const rank = (file: string) => (file === 'create.sql' ? -1 : 0);
        return rank(a) - rank(b) || a.localeCompare(b);
      });
    const applied = new Set(
      (await client.query<{ version: string }>('select version from schema_migrations')).rows.map(
        (row) => row.version,
      ),
    );

    // 既存DB（Supabaseでcreate.sqlを手動適用済み等）をベースライン化する。
    // schema_migrations が空でも主要テーブルが存在する場合は create.sql を再実行しない。
    const base = await client.query<{ sales_orders: string | null; products: string | null }>(
      `select to_regclass('public.sales_orders') as sales_orders,
              to_regclass('public.products') as products`,
    );
    const hasBaseTables = Boolean(base.rows[0]?.sales_orders && base.rows[0]?.products);
    if (hasBaseTables && !applied.has('create.sql')) {
      await client.query(
        `insert into schema_migrations (version) values ('create.sql')
         on conflict (version) do nothing`,
      );
      applied.add('create.sql');
      console.log('baseline create.sql（既存テーブルを検出したため適用済みとして記録）');
    }

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip   ${file} (already applied)`);
        continue;
      }
      const sql = await readFile(path.join(migrationDir, file), 'utf8');
      console.log(`apply  ${file}`);
      await client.query(sql);
      await client.query('insert into schema_migrations (version) values ($1)', [file]);
    }
    console.log('マイグレーションが完了しました');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
