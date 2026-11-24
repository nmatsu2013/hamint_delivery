-- master-definitions.md に基づく初期スキーマ（PostgreSQL）
-- RLS は有効化するが、ロールとアクセス要件が未確定のためポリシーは別途定義する。

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code text NOT NULL UNIQUE,
    clinic_name text NOT NULL,
    clinic_name_kana text,
    postal_code text NOT NULL,
    address text NOT NULL,
    tel text,
    fax text,
    email text,
    closing_day integer CHECK (closing_day BETWEEN 1 AND 31),
    payment_terms text,
    license_info text,
    note text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid
);

CREATE TABLE customer_addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES customers(id),
    ship_to_name text NOT NULL,
    postal_code text NOT NULL,
    address text NOT NULL,
    recipient text,
    tel text NOT NULL,
    delivery_note text,
    is_default boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid
);

CREATE UNIQUE INDEX customer_addresses_one_default_per_customer
    ON customer_addresses (customer_id)
    WHERE is_default AND is_active;

CREATE TABLE suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_code text NOT NULL UNIQUE,
    supplier_name text NOT NULL,
    supplier_name_kr text,
    supplier_name_en text,
    country text NOT NULL DEFAULT 'KR',
    address text,
    currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    payment_terms text,
    language text,
    note text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid
);

CREATE TABLE supplier_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id uuid NOT NULL REFERENCES suppliers(id),
    contact_name text NOT NULL,
    department text,
    title text,
    email text,
    tel text,
    messenger_id text,
    is_primary boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid
);

CREATE UNIQUE INDEX supplier_contacts_one_primary_per_supplier
    ON supplier_contacts (supplier_id)
    WHERE is_primary AND is_active;

CREATE TABLE products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code text NOT NULL UNIQUE,
    product_name text NOT NULL,
    product_name_kr text,
    product_name_en text,
    model_no text NOT NULL,
    supplier_id uuid NOT NULL REFERENCES suppliers(id),
    category text,
    material text,
    thickness text,
    length_mm numeric CHECK (length_mm > 0),
    pack_qty integer NOT NULL CHECK (pack_qty > 0),
    unit text NOT NULL,
    is_lot_managed boolean NOT NULL DEFAULT true,
    is_expiry_managed boolean NOT NULL DEFAULT true,
    hs_code text,
    regulatory_info text,
    storage_condition text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT products_supplier_model_no_unique UNIQUE (supplier_id, model_no)
);

CREATE TABLE supplier_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES products(id),
    unit_cost numeric NOT NULL CHECK (unit_cost >= 0),
    currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    valid_from date NOT NULL,
    valid_to date NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT supplier_prices_valid_period CHECK (valid_to >= valid_from),
    CONSTRAINT supplier_prices_no_overlapping_periods
        EXCLUDE USING gist (
            product_id WITH =,
            daterange(valid_from, valid_to, '[]') WITH &&
        )
);

CREATE TABLE import_fees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid REFERENCES products(id),
    fee_type text NOT NULL,
    amount numeric CHECK (amount >= 0),
    rate numeric CHECK (rate >= 0),
    currency char(3) NOT NULL DEFAULT 'JPY' CHECK (currency ~ '^[A-Z]{3}$'),
    valid_from date NOT NULL,
    valid_to date NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT import_fees_amount_or_rate CHECK (
        (amount IS NOT NULL AND rate IS NULL)
        OR (amount IS NULL AND rate IS NOT NULL)
    ),
    CONSTRAINT import_fees_valid_period CHECK (valid_to >= valid_from),
    CONSTRAINT import_fees_no_overlapping_periods
        EXCLUDE USING gist (
            (COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
            fee_type WITH =,
            daterange(valid_from, valid_to, '[]') WITH &&
        )
);

CREATE TABLE customer_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES customers(id),
    product_id uuid NOT NULL REFERENCES products(id),
    unit_price numeric NOT NULL CHECK (unit_price >= 0),
    currency char(3) NOT NULL DEFAULT 'JPY' CHECK (currency ~ '^[A-Z]{3}$'),
    tax_type text NOT NULL,
    valid_from date NOT NULL,
    valid_to date NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT customer_prices_valid_period CHECK (valid_to >= valid_from),
    CONSTRAINT customer_prices_no_overlapping_periods
        EXCLUDE USING gist (
            (COALESCE(customer_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
            product_id WITH =,
            daterange(valid_from, valid_to, '[]') WITH &&
        )
);

CREATE TABLE sales_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_no text NOT NULL UNIQUE,
    order_date date NOT NULL,
    customer_id uuid NOT NULL REFERENCES customers(id),
    ship_to_id uuid NOT NULL REFERENCES customer_addresses(id),
    requested_date date,
    status text NOT NULL,
    total_amount numeric NOT NULL CHECK (total_amount >= 0),
    currency char(3) NOT NULL DEFAULT 'JPY' CHECK (currency ~ '^[A-Z]{3}$'),
    note text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid
);

CREATE TABLE sales_order_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id uuid NOT NULL REFERENCES sales_orders(id),
    product_id uuid NOT NULL REFERENCES products(id),
    quantity integer NOT NULL CHECK (quantity > 0),
    unit_price numeric NOT NULL CHECK (unit_price >= 0),
    currency char(3) NOT NULL DEFAULT 'JPY' CHECK (currency ~ '^[A-Z]{3}$'),
    line_status text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid
);

CREATE TABLE purchase_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    po_no text NOT NULL UNIQUE,
    supplier_id uuid NOT NULL REFERENCES suppliers(id),
    ordered_date date NOT NULL,
    promised_date date,
    currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    total_amount numeric NOT NULL CHECK (total_amount >= 0),
    status text NOT NULL,
    note text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid
);

CREATE TABLE purchase_order_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
    product_id uuid NOT NULL REFERENCES products(id),
    quantity integer NOT NULL CHECK (quantity > 0),
    unit_cost numeric NOT NULL CHECK (unit_cost >= 0),
    currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    sales_order_line_id uuid REFERENCES sales_order_lines(id),
    applied_hs_code text,
    duty_rate numeric CHECK (duty_rate >= 0),
    duty_amount numeric CHECK (duty_amount >= 0),
    duty_currency char(3) NOT NULL DEFAULT 'JPY' CHECK (duty_currency ~ '^[A-Z]{3}$'),
    received_date date,
    inspector_id uuid,
    good_qty integer CHECK (good_qty >= 0),
    defect_qty integer CHECK (defect_qty >= 0),
    damaged_qty integer CHECK (damaged_qty >= 0),
    claim_status text,
    claim_note text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid
);

CREATE TABLE invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_no text NOT NULL UNIQUE,
    customer_id uuid NOT NULL REFERENCES customers(id),
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    amount numeric NOT NULL CHECK (amount >= 0),
    currency char(3) NOT NULL DEFAULT 'JPY' CHECK (currency ~ '^[A-Z]{3}$'),
    status text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid
);

CREATE TABLE invoice_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id),
    sales_order_line_id uuid REFERENCES sales_order_lines(id),
    shipment_line_id uuid,
    amount numeric NOT NULL CHECK (amount >= 0),
    currency char(3) NOT NULL DEFAULT 'JPY' CHECK (currency ~ '^[A-Z]{3}$'),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT invoice_lines_one_source CHECK (
        (sales_order_line_id IS NOT NULL AND shipment_line_id IS NULL)
        OR (sales_order_line_id IS NULL AND shipment_line_id IS NOT NULL)
    )
);

CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id),
    paid_date date NOT NULL,
    paid_amount numeric NOT NULL CHECK (paid_amount > 0),
    currency char(3) NOT NULL DEFAULT 'JPY' CHECK (currency ~ '^[A-Z]{3}$'),
    method text,
    fee numeric CHECK (fee >= 0),
    fee_currency char(3) NOT NULL DEFAULT 'JPY' CHECK (fee_currency ~ '^[A-Z]{3}$'),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid
);

CREATE TABLE import_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_no text NOT NULL UNIQUE,
    purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
    application_type text NOT NULL,
    applied_date date,
    status text NOT NULL,
    confirmed_date date,
    assignee_id uuid,
    note text,
    customs_broker text,
    import_permit_date date,
    declaration_no text,
    taxable_value numeric CHECK (taxable_value >= 0),
    duty_total numeric CHECK (duty_total >= 0),
    import_consumption_tax numeric CHECK (import_consumption_tax >= 0),
    customs_fee numeric CHECK (customs_fee >= 0),
    other_costs numeric CHECK (other_costs >= 0),
    currency char(3) NOT NULL DEFAULT 'JPY' CHECK (currency ~ '^[A-Z]{3}$'),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid
);

CREATE TABLE import_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES import_applications(id),
    document_name text NOT NULL,
    file_path text,
    submitted_date date,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid
);

CREATE TABLE shipments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_no text NOT NULL UNIQUE,
    direction text NOT NULL CHECK (direction IN ('domestic', 'international')),
    sales_order_id uuid REFERENCES sales_orders(id),
    ship_to_id uuid REFERENCES customer_addresses(id),
    purchase_order_id uuid REFERENCES purchase_orders(id),
    shipped_date date,
    carrier text,
    tracking_no text,
    delivered_date date,
    status text NOT NULL,
    transport_mode text,
    bl_awb_no text,
    etd date,
    eta date,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT shipments_direction_reference CHECK (
        (direction = 'domestic'
            AND sales_order_id IS NOT NULL
            AND ship_to_id IS NOT NULL
            AND purchase_order_id IS NULL)
        OR
        (direction = 'international'
            AND purchase_order_id IS NOT NULL
            AND sales_order_id IS NULL
            AND ship_to_id IS NULL)
    )
);

CREATE TABLE shipment_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id uuid NOT NULL REFERENCES shipments(id),
    sales_order_line_id uuid REFERENCES sales_order_lines(id),
    purchase_order_line_id uuid REFERENCES purchase_order_lines(id),
    lot_id uuid,
    quantity integer NOT NULL CHECK (quantity > 0),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT shipment_lines_one_source CHECK (
        (sales_order_line_id IS NOT NULL
            AND purchase_order_line_id IS NULL
            AND lot_id IS NOT NULL)
        OR
        (sales_order_line_id IS NULL
            AND purchase_order_line_id IS NOT NULL
            AND lot_id IS NULL)
    )
);

CREATE TABLE lots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES products(id),
    lot_no text NOT NULL,
    expiry_date date NOT NULL,
    manufactured_date date,
    purchase_order_line_id uuid REFERENCES purchase_order_lines(id),
    received_qty integer NOT NULL CHECK (received_qty >= 0),
    on_hand_qty integer NOT NULL CHECK (on_hand_qty >= 0),
    status text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT lots_product_lot_no_unique UNIQUE (product_id, lot_no)
);

ALTER TABLE shipment_lines
    ADD CONSTRAINT shipment_lines_lot_id_fkey
    FOREIGN KEY (lot_id) REFERENCES lots(id);

ALTER TABLE invoice_lines
    ADD CONSTRAINT invoice_lines_shipment_line_id_fkey
    FOREIGN KEY (shipment_line_id) REFERENCES shipment_lines(id);

CREATE TABLE lot_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL REFERENCES lots(id),
    movement_type text NOT NULL CHECK (
        movement_type IN ('receipt', 'shipment', 'return', 'disposal', 'adjustment')
    ),
    quantity integer NOT NULL CHECK (quantity > 0),
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    customer_id uuid REFERENCES customers(id),
    ship_to_id uuid REFERENCES customer_addresses(id),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid
);

CREATE INDEX customer_addresses_customer_id_idx ON customer_addresses (customer_id);
CREATE INDEX supplier_contacts_supplier_id_idx ON supplier_contacts (supplier_id);
CREATE INDEX products_supplier_id_idx ON products (supplier_id);
CREATE INDEX supplier_prices_product_id_idx ON supplier_prices (product_id);
CREATE INDEX import_fees_product_id_idx ON import_fees (product_id);
CREATE INDEX customer_prices_product_id_idx ON customer_prices (product_id);
CREATE INDEX sales_orders_customer_id_idx ON sales_orders (customer_id);
CREATE INDEX sales_order_lines_order_id_idx ON sales_order_lines (sales_order_id);
CREATE INDEX sales_order_lines_product_id_idx ON sales_order_lines (product_id);
CREATE INDEX purchase_orders_supplier_id_idx ON purchase_orders (supplier_id);
CREATE INDEX purchase_order_lines_order_id_idx ON purchase_order_lines (purchase_order_id);
CREATE INDEX purchase_order_lines_product_id_idx ON purchase_order_lines (product_id);
CREATE INDEX invoices_customer_id_idx ON invoices (customer_id);
CREATE INDEX payments_invoice_id_idx ON payments (invoice_id);
CREATE INDEX import_applications_purchase_order_id_idx ON import_applications (purchase_order_id);
CREATE INDEX import_documents_application_id_idx ON import_documents (application_id);
CREATE INDEX shipments_sales_order_id_idx ON shipments (sales_order_id);
CREATE INDEX shipments_purchase_order_id_idx ON shipments (purchase_order_id);
CREATE INDEX shipment_lines_shipment_id_idx ON shipment_lines (shipment_id);
CREATE INDEX lots_product_id_idx ON lots (product_id);
CREATE INDEX lot_movements_lot_id_created_at_idx ON lot_movements (lot_id, created_at);

CREATE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'customers',
        'customer_addresses',
        'suppliers',
        'supplier_contacts',
        'products',
        'supplier_prices',
        'import_fees',
        'customer_prices',
        'sales_orders',
        'sales_order_lines',
        'purchase_orders',
        'purchase_order_lines',
        'invoices',
        'invoice_lines',
        'payments',
        'import_applications',
        'import_documents',
        'shipments',
        'shipment_lines',
        'lots',
        'lot_movements'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            table_name || '_set_updated_at',
            table_name
        );
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    END LOOP;
END;
$$;

COMMIT;
