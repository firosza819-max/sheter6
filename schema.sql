-- ============================================================================
-- شاطر (Shatir) — Store Management System
-- Complete Neon PostgreSQL initialization schema (Updated & Fully Synced)
-- Execute this entire file inside the Neon SQL console to provision the database.
-- ============================================================================

-- ---------- Extensions ----------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- Drop (clean slate for fresh Neon project) ----------
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     VARCHAR NOT NULL,
  email         VARCHAR UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active     BOOLEAN DEFAULT FALSE,  -- Default FALSE: admin must approve new accounts
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role  ON users (role);

-- ============================================================================
-- 2. PRODUCTS TABLE (Inventory)
-- ============================================================================
CREATE TABLE products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                 VARCHAR UNIQUE NOT NULL,
  name                VARCHAR NOT NULL,
  quantity            INT DEFAULT 0 CHECK (quantity >= 0),
  cost_price          NUMERIC(10, 2) DEFAULT 0.00,
  selling_price       NUMERIC(10, 2) DEFAULT 0.00,
  category            VARCHAR,
  low_stock_threshold INT DEFAULT 5,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_sku      ON products (sku);
CREATE INDEX idx_products_category ON products (category);
CREATE INDEX idx_products_name     ON products (name);

-- ============================================================================
-- 3. INVOICES TABLE
-- ============================================================================
CREATE TABLE invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   VARCHAR UNIQUE NOT NULL,
  type             VARCHAR CHECK (type IN ('PURCHASE', 'SALE')),
  party_name       VARCHAR DEFAULT 'عميل/مورد نقدي',  -- اسم العميل أو المورد
  subtotal_amount  NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- المجموع قبل الضريبة
  tax_amount       NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- قيمة الضريبة
  total_amount     NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- الإجمالي الكلي
  paid_amount      NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- المبلغ المدفوع
  remaining_amount NUMERIC(10, 2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED, -- المتبقي/الدين (يحسب تلقائياً)
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_type        ON invoices (type);
CREATE INDEX idx_invoices_party_name  ON invoices (party_name);
CREATE INDEX idx_invoices_created_at  ON invoices (created_at);
CREATE INDEX idx_invoices_created_by  ON invoices (created_by);

-- ============================================================================
-- 4. INVOICE_ITEMS TABLE
-- ============================================================================
CREATE TABLE invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID REFERENCES invoices(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id),
  quantity    INT NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(10, 2) NOT NULL,
  subtotal    NUMERIC(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED -- المجموع الفرعي يحسب آلياً
);

CREATE INDEX idx_items_invoice_id ON invoice_items (invoice_id);
CREATE INDEX idx_items_product_id ON invoice_items (product_id);

-- ============================================================================
-- 5. SMART POSTGRESQL TRIGGERS & FUNCTIONS
-- ============================================================================

-- ---------- 5.1 Auto-generate sequential invoice numbers ----------
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  prefix   TEXT;
  next_num INT;
BEGIN
  prefix := CASE WHEN NEW.type = 'PURCHASE' THEN 'INV-PUR-' ELSE 'INV-SAL-' END;
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM LENGTH(prefix) + 1) AS INT)), 1000) + 1
    INTO next_num
    FROM invoices
    WHERE type = NEW.type AND invoice_number LIKE prefix || '%';
  NEW.invoice_number := prefix || next_num::text;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
  EXECUTE FUNCTION generate_invoice_number();

-- ---------- 5.2 Auto update products.updated_at ----------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_products_updated
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------- 5.3 Purchase stock increment trigger ----------
CREATE OR REPLACE FUNCTION update_stock_on_purchase()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  inv_type TEXT;
BEGIN
  SELECT type INTO inv_type FROM invoices WHERE id = NEW.invoice_id;
  IF inv_type = 'PURCHASE' THEN
    UPDATE products
      SET quantity   = quantity + NEW.quantity,
          cost_price = NEW.unit_price,
          updated_at = NOW()
      WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_purchase
  AFTER INSERT ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_purchase();

-- ---------- 5.4 Sale stock decrement trigger ----------
CREATE OR REPLACE FUNCTION update_stock_on_sale()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  inv_type    TEXT;
  current_qty INT;
BEGIN
  SELECT type INTO inv_type FROM invoices WHERE id = NEW.invoice_id;
  IF inv_type = 'SALE' THEN
    SELECT quantity INTO current_qty FROM products WHERE id = NEW.product_id FOR UPDATE;
    IF current_qty IS NULL OR current_qty < NEW.quantity THEN
      RAISE EXCEPTION 'الكمية المطلوبة غير متوفرة في المخزون (متاح: %)', current_qty;
    END IF;
    UPDATE products
      SET quantity   = quantity - NEW.quantity,
          updated_at = NOW()
      WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_sale
  AFTER INSERT ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_sale();

-- ============================================================================
-- 6. SEED DATA
-- ============================================================================

-- ---------- 6.1 Super Admin account ----------
INSERT INTO users (full_name, email, password_hash, role, is_active)
VALUES (
  'المدير العام',
  'admin@shatir.com',
  crypt('admin123', gen_salt('bf')),
  'admin',
  TRUE
)
ON CONFLICT (email) DO NOTHING;

-- ---------- 6.2 Sample products ----------
INSERT INTO products (sku, name, quantity, cost_price, selling_price, category, low_stock_threshold) VALUES
  ('SKU-1001', 'أرز بسمتي 5كجم',       20, 45.00, 60.00, 'مواد غذائية', 10),
  ('SKU-1002', 'زيت دوار الشمس 1.5ل',  20, 18.00, 25.00, 'مواد غذائية',  8),
  ('SKU-1003', 'سكر أبيض 1كجم',        80,  7.00, 10.00, 'مواد غذائية', 15),
  ('SKU-1004', 'صابون غسيل 3كجم',      10, 22.00, 32.00, 'منظفات',       6),
  ('SKU-1005', 'شاي أحمر 250جم',        8, 15.00, 22.00, 'مواد غذائية',  5),
  ('SKU-1006', 'ماء معدني 6×1.5ل',     16,  6.00,  9.00, 'مشروبات',     12)
ON CONFLICT (sku) DO NOTHING;

-- ---------- 6.3 Sample invoices & items ----------
-- Purchase invoice (مشتريات مع تحديد اسم المورد والمدفوع والديون)
DO $$
DECLARE
  pur1 UUID;
  p1 UUID; p2 UUID; p5 UUID;
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM users WHERE email = 'admin@shatir.com';
  SELECT id INTO p1 FROM products WHERE sku = 'SKU-1001';
  SELECT id INTO p2 FROM products WHERE sku = 'SKU-1002';
  SELECT id INTO p5 FROM products WHERE sku = 'SKU-1005';

  INSERT INTO invoices (type, party_name, subtotal_amount, tax_amount, total_amount, paid_amount, created_by)
  VALUES ('PURCHASE', 'شركة البركة للتوريدات', 1380.00, 0.00, 1380.00, 1000.00, admin_id)
  RETURNING id INTO pur1;

  INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price) VALUES
    (pur1, p1, 20, 45.00),
    (pur1, p2, 20, 18.00),
    (pur1, p5,  8, 15.00);
END $$;

-- Sale invoice (مبيعات مع تحديد اسم العميل والمدفوع والديون)
DO $$
DECLARE
  sal1 UUID;
  p1 UUID; p2 UUID; p6 UUID;
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM users WHERE email = 'admin@shatir.com';
  SELECT id INTO p1 FROM products WHERE sku = 'SKU-1001';
  SELECT id INTO p2 FROM products WHERE sku = 'SKU-1002';
  SELECT id INTO p6 FROM products WHERE sku = 'SKU-1006';

  INSERT INTO invoices (type, party_name, subtotal_amount, tax_amount, total_amount, paid_amount, created_by)
  VALUES ('SALE', 'مؤسسة الأمل التجارية', 357.00, 0.00, 357.00, 357.00, admin_id)
  RETURNING id INTO sal1;

  INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price) VALUES
    (sal1, p1, 3, 60.00),
    (sal1, p2, 6, 25.00),
    (sal1, p6, 3,  9.00);
END $$;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
