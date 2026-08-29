import { pool } from './db.js';

// ---------- 1. جلب الفواتير (دعم طلبات GET) ----------
export const getInvoices = async (req, res) => {
  try {
    const { id } = req.query;

    // إذا تم إرسال id في طلب GET، نجلب فاتورة واحدة مع بنودها
    if (id) {
      const invoiceRes = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
      if (invoiceRes.rows.length === 0) {
        return res.status(404).json({ message: 'الفاتورة غير موجودة' });
      }

      const itemsRes = await pool.query(`
        SELECT ii.*, p.name as product_name 
        FROM invoice_items ii 
        LEFT JOIN products p ON ii.product_id = p.id 
        WHERE ii.invoice_id = $1
      `, [id]);

      return res.status(200).json({
        ...invoiceRes.rows[0],
        items: itemsRes.rows
      });
    }

    // جلب جميع الفواتير مرتبة من الأحدث إلى الأقدم
    const invoicesRes = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC');
    return res.status(200).json(invoicesRes.rows);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ---------- 2. إنشاء فاتورة جديدة ----------
export const createInvoice = async (req, res, userId = null) => {
  const { 
    type, 
    tax_amount = 0, 
    paid_amount = 0,
    invoice_number = null,
    items, 
    party_name, 
    supplierName, 
    customerName, 
    client_name
  } = req.body || {};

  // استخراج واسم الطرف بشكل صريح ومباشر
  const resolvedPartyName = party_name || supplierName || customerName || client_name || 'عميل/مورد نقدي';

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'الفاتورة يجب أن تحتوي على منتج واحد على الأقل' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // حساب الحسابات الإجمالية
    const subtotalAmount = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);
    const calculatedTotal = subtotalAmount + Number(tax_amount);

    // إدراج الفاتورة الأم في جدول invoices
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
      calculatedTotal, 
      Number(paid_amount),
      userId
    ]);
    
    const newInvoice = invoiceRes.rows[0];

    // إدراج عناصر الفاتورة في جدول invoice_items
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

    if (error.message && error.message.includes('الكمية المطلوبة غير متوفرة')) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

// ---------- 3. التصدير الافتراضي (Default Handler) ----------
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return await getInvoices(req, res);
  }

  if (req.method === 'POST') {
    const userId = req.user?.id || req.headers['x-user-id'] || null;
    return await createInvoice(req, res, userId);
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
