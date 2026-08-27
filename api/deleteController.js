import { pool } from './db.js';

// ---------- 1. حذف فاتورة بالكامل ----------
export const deleteInvoice = async (req, res) => {
  // دمج الحقول من Query و Body لضمان وصول المعرف
  const id = req.query?.id || req.body?.id;

  if (!id) {
    return res.status(400).json({ message: 'يرجى تزويد معرف الفاتورة (id) المطلوب حذفها' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // التأكد من وجود الفاتورة أولاً
    const checkRes = await client.query('SELECT id FROM invoices WHERE id = $1', [id]);
    if (checkRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    }

    // حذف الفاتورة
    const deleteQuery = 'DELETE FROM invoices WHERE id = $1 RETURNING *;';
    const deleteRes = await client.query(deleteQuery, [id]);

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'تم حذف الفاتورة بنجاح',
      deletedInvoice: deleteRes.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'تعذّر حذف الفاتورة', error: error.message });
  } finally {
    client.release();
  }
};

// ---------- 2. حذف منتج من المخزن (جدول products) ----------
export const deleteProduct = async (req, res) => {
  // دمج الحقول من Query و Body
  const id = req.query?.id || req.body?.id;

  if (!id) {
    return res.status(400).json({ message: 'يرجى تزويد معرف المنتج (id) المطلوب حذفه' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // التحقق مما إذا كان المنتج مستخدماً في فواتير سابقة
    const checkItems = await client.query('SELECT 1 FROM invoice_items WHERE product_id = $1 LIMIT 1', [id]);
    if (checkItems.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'لا يمكن حذف هذا المنتج من المخزن لأنه مرتبط بفواتير ومبيعات مسجلة مسبقاً'
      });
    }

    // الحذف من جدول products
    const deleteQuery = 'DELETE FROM products WHERE id = $1 RETURNING *;';
    const deleteRes = await client.query(deleteQuery, [id]);

    if (deleteRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'المنتج غير موجود في المخزن' });
    }

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'تم حذف المنتج من المخزن بنجاح',
      deletedProduct: deleteRes.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'تعذّر حذف المنتج', error: error.message });
  } finally {
    client.release();
  }
};

// ---------- 3. التصدير الافتراضي (Default Export Handler) ----------
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'DELETE') {
    // جلب target من query أولاً ثم من body
    const target = req.query?.target || req.body?.target;

    // توجيه الطلب بحسب الهدف
    if (target === 'product') {
      return await deleteProduct(req, res);
    }

    if (target === 'invoice') {
      return await deleteInvoice(req, res);
    }

    // إذا لم يتحدد target أو أُرسلت قيمة غير معروفة
    // (يمكنك إلغاء هذا الشرط وإرجاع deleteInvoice لو أردت الحفاظ على السلوك القديم)
    return await deleteInvoice(req, res);
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
