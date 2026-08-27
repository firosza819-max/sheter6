import { pool } from './db.js';

// ---------- 1. إنشاء فاتورة جديدة مع ضمان مطابقة الاسكيما ----------
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

  // 1. استخراج واسم الطرف بشكل صريح ومباشر
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

    // 2. إدراج الفاتورة الأم في جدول invoices
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

    // 3. إدراج عناصر الفاتورة في جدول invoice_items
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

// ---------- 2. إضافة التصدير الافتراضي (Default Export) بدون تحقق من التوكن ----------
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    // جلب رقم المستخدم اختيارياً إن وُجد
    const userId = req.user?.id || req.headers['x-user-id'] || null;
    return await createInvoice(req, res, userId);
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
