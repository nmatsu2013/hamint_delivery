import type { IPriceRepository } from '../domain/repositories/price.repository.interface.js';
import { toNumber, type Queryable } from './database.js';

export class PgPriceRepository implements IPriceRepository {
  constructor(private readonly db: Queryable) {}

  async resolveCustomerUnitPrice(
    customerId: string,
    productId: string,
    targetDate: string,
  ): Promise<number | null> {
    const result = await this.db.query<{ unit_price: string }>(
      `select unit_price from customer_prices
       where customer_id = $1 and product_id = $2
         and valid_from <= $3::date and valid_to >= $3::date and is_active
       order by valid_from desc limit 1`,
      [customerId, productId, targetDate],
    );
    const row = result.rows[0];
    return row ? toNumber(row.unit_price) : null;
  }

  async resolveStandardUnitPrice(productId: string, targetDate: string): Promise<number | null> {
    const result = await this.db.query<{ unit_price: string }>(
      `select unit_price from customer_prices
       where customer_id is null and product_id = $1
         and valid_from <= $2::date and valid_to >= $2::date and is_active
       order by valid_from desc limit 1`,
      [productId, targetDate],
    );
    const row = result.rows[0];
    return row ? toNumber(row.unit_price) : null;
  }

  async resolveSupplierCost(
    productId: string,
    targetDate: string,
  ): Promise<{ cost: number; currency: string } | null> {
    const result = await this.db.query<{ unit_cost: string; currency: string }>(
      `select unit_cost, currency from supplier_prices
       where product_id = $1
         and valid_from <= $2::date and valid_to >= $2::date and is_active
       order by valid_from desc limit 1`,
      [productId, targetDate],
    );
    const row = result.rows[0];
    return row ? { cost: toNumber(row.unit_cost), currency: row.currency } : null;
  }
}
