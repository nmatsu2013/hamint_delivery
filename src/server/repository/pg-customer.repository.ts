import type {
  CustomerAddressEntity,
  CustomerEntity,
} from '../domain/entities/customer.entity';
import type { ICustomerRepository } from '../domain/repositories/customer.repository.interface';
import { type Queryable } from './database';

interface CustomerRow {
  id: string;
  customer_code: string;
  clinic_name: string;
  clinic_name_kana: string | null;
  postal_code: string;
  address: string;
  tel: string | null;
  fax: string | null;
  email: string | null;
  closing_day: number | null;
  payment_terms: string | null;
  license_info: string | null;
  note: string | null;
  is_active: boolean;
}

interface AddressRow {
  id: string;
  customer_id: string;
  ship_to_name: string;
  postal_code: string;
  address: string;
  recipient: string | null;
  tel: string;
  delivery_note: string | null;
  is_default: boolean;
  is_active: boolean;
}

function mapCustomer(row: CustomerRow): CustomerEntity {
  return {
    id: row.id,
    customerCode: row.customer_code,
    clinicName: row.clinic_name,
    clinicNameKana: row.clinic_name_kana,
    postalCode: row.postal_code,
    address: row.address,
    tel: row.tel,
    fax: row.fax,
    email: row.email,
    closingDay: row.closing_day,
    paymentTerms: row.payment_terms,
    licenseInfo: row.license_info,
    note: row.note,
    isActive: row.is_active,
  };
}

function mapAddress(row: AddressRow): CustomerAddressEntity {
  return {
    id: row.id,
    customerId: row.customer_id,
    shipToName: row.ship_to_name,
    postalCode: row.postal_code,
    address: row.address,
    recipient: row.recipient,
    tel: row.tel,
    deliveryNote: row.delivery_note,
    isDefault: row.is_default,
    isActive: row.is_active,
  };
}

export class PgCustomerRepository implements ICustomerRepository {
  constructor(private readonly db: Queryable) {}

  async list(): Promise<CustomerEntity[]> {
    const result = await this.db.query<CustomerRow>(
      `select * from customers where is_active order by customer_code asc`,
    );
    return result.rows.map(mapCustomer);
  }

  async findById(id: string): Promise<CustomerEntity | null> {
    const result = await this.db.query<CustomerRow>(
      `select * from customers where id = $1 and is_active`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapCustomer(row) : null;
  }

  async findByCode(customerCode: string): Promise<CustomerEntity | null> {
    const result = await this.db.query<CustomerRow>(
      `select * from customers where customer_code = $1 and is_active`,
      [customerCode],
    );
    const row = result.rows[0];
    return row ? mapCustomer(row) : null;
  }

  async listAddresses(customerId: string): Promise<CustomerAddressEntity[]> {
    const result = await this.db.query<AddressRow>(
      `select * from customer_addresses
       where customer_id = $1 and is_active
       order by is_default desc, ship_to_name asc`,
      [customerId],
    );
    return result.rows.map(mapAddress);
  }

  async findAddress(id: string): Promise<CustomerAddressEntity | null> {
    const result = await this.db.query<AddressRow>(
      `select * from customer_addresses where id = $1 and is_active`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapAddress(row) : null;
  }
}
