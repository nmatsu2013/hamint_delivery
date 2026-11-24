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
  const reset = process.argv.includes('--reset');
  const client = new Client(createPgConfig(connectionString));
  await client.connect();
  try {
    if (reset) {
      console.log('既存のサンプルデータを削除します（--reset）');
      await client.query(
        `truncate table
           audit_logs, payments, invoice_lines, invoices,
           lot_movements, shipment_lines, shipments, lots,
           import_documents, import_applications,
           purchase_order_lines, purchase_orders,
           sales_order_lines, sales_orders,
           customer_prices, supplier_prices, import_fees,
           customer_addresses, customers, products,
           supplier_contacts, suppliers
         restart identity cascade`,
      );
    }
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
