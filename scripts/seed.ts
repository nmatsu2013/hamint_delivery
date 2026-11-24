import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { createPgConfig } from '../src/server/config/pg';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL が設定されていません');
  }
  const force = process.argv.includes('--force');
  const client = new Client(createPgConfig(connectionString));
  await client.connect();
  try {
    const countResult = await client.query<{ count: string }>(
      'select count(*) as count from products',
    );
    const existing = Number(countResult.rows[0]?.count ?? 0);
    if (existing > 0 && !force) {
      console.log(
        `products に既に ${existing} 件のデータがあります。再投入する場合は --force を付けてください。`,
      );
      return;
    }
    const sql = await readFile(path.resolve(process.cwd(), 'migration/products-seed.sql'), 'utf8');
    await client.query(sql);
    console.log('シードデータを投入しました');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
