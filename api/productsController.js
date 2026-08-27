import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'shatir_secret_key_123';

// ---------- Middleware قراءة التوكن الاختيارية ----------
const getUserFromReq = (req) => {
  let token = req.cookies?.token;

  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!token && authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      token = authHeader.trim();
    }
  }

  if (!token || token === 'undefined' || token === 'null' || typeof token !== 'string') {
    return null;
  }

  if (token.split('.').length !== 3) {
    return null;
  }

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// ---------- 1. إضافة منتج جديد للمخزن ----------
export const createProduct = async (req, res) => {
  const { sku, name, cost_price, selling_price, category, low_stock_threshold, quantity } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'اسم المنتج مطلوب' });
  }

  try {
    const query = `
      INSERT INTO products (sku, name, quantity, cost_price, selling_price, category, low_stock_threshold)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [
      sku && sku.trim() ? sku.trim() : 'SKU-' + Date.now(),
      name.trim(),
      Number(quantity) || 0,
      Number(cost_price) || 0,
      Number(selling_price) || 0,
      category && category.trim() ? category.trim() : 'عام',
      Number(low_stock_threshold) || 5
    ];
    const result = await pool.query(query, values);

    return res.status(201).json({ message: 'تم إضافة المنتج بنجاح', product: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ message: 'رمز المنتج (SKU) مستخدم بالفعل' });
    }
    return res.status(500).json({ error: error.message });
  }
};

// ---------- 2. جلب المنتجات ----------
export const getProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY updated_at DESC');
    return res.status(200).json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ---------- 3. جلب الفواتير (متوافق بالكامل مع السكيما) ----------
export const getInvoices = async (req, res) => {
  try {
    const query = `
      SELECT 
        i.id,
        i.invoice_number,
        i.type,
        i.party_name,
        i.subtotal_amount,
        i.tax_amount,
        i.total_amount,
        i.paid_amount,
        i.remaining_amount,
        i.created_by,
        i.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ii.id,
              'product_id', ii.product_id,
              'quantity', ii.quantity,
              'unit_price', ii.unit_price,
              'subtotal', ii.subtotal,
              'item_name', p.name,
              'category', p.category,
              'sku', p.sku
            )
          ) FILTER (WHERE ii.id IS NOT NULL), '[]'
        ) AS items
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      LEFT JOIN products p ON ii.product_id = p.id
      GROUP BY i.id
      ORDER BY i.created_at DESC;
    `;
    
    const result = await pool.query(query);
    return res.status(200).json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ---------- 4. حفظ ومعالجة الفواتير ----------
export const processInvoice = async (req, res, user) => {
  const { 
    type = 'SALE', 
    tax_amount = 0, 
    paid_amount = 0,
    invoice_number = null,
    items, 
    party_name, 
    supplierName, 
    customerName, 
    client_name
  } = req.body || {};

  const rawParty = party_name || customerName || supplierName || client_name || '';
  const resolvedPartyName = typeof rawParty === 'string' && rawParty.trim() !== '' 
    ? rawParty.trim() 
    : 'عميل/مورد نقدي';

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'الفاتورة يجب أن تحتوي على منتج واحد على الأقل' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const subtotalAmount = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);
    const totalAmount = subtotalAmount + Number(tax_amount);

    const invoiceQuery = `
      INSERT INTO invoices (
        invoice_number,
        type, 
        party_name, 
        subtotal_amount, 
        tax_amount, 
        total_amount, 
        paid_amount, 
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const invoiceRes = await client.query(invoiceQuery, [
      invoice_number || null,
      type, 
      resolvedPartyName,
      subtotalAmount,
      Number(tax_amount), 
      totalAmount, 
      Number(paid_amount),
      user?.id || null
    ]);
    const newInvoice = invoiceRes.rows[0];

    const itemQuery = `
      INSERT INTO invoice_items (
        invoice_id, 
        product_id, 
        quantity, 
        unit_price
      )
      VALUES ($1, $2, $3, $4);
    `;

    for (const item of items) {
      const productId = item.product_id || item.id;

      if (!productId) {
        throw new Error('معرف المنتج (product_id) مفقود في إحدى البنود');
      }

      await client.query(itemQuery, [
        newInvoice.id, 
        productId, 
        Number(item.quantity), 
        Number(item.unit_price)
      ]);
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'تم حفظ الفاتورة وبنودها بنجاح',
      invoice: newInvoice
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Invoice Processing Error:', error);

    if (error.message && (error.message.includes('غير متوفرة') || error.message.includes('الكمية المطلوبة'))) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

// ---------- 5. المشغل الرئيسي (Serverless Handler) ----------
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user = getUserFromReq(req);

  if (req.method === 'GET') {
    if (req.query?.resource === 'invoices') {
      return await getInvoices(req, res);
    }
    return await getProducts(req, res);
  } else if (req.method === 'POST') {
    if (req.body?.items) {
      return await processInvoice(req, res, user);
    } else {
      return await createProduct(req, res);
    }
  } else {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
}
