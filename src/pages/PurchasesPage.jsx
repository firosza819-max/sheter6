      import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Plus, Trash2, Loader2, PackagePlus, Search, CheckCircle2 } from 'lucide-react';
import { fetchInventory, createProduct, processPurchaseInvoice } from '@/services/dbService';
import { useToast } from '@/context/ToastContext';
import { formatCurrency } from '@/lib/format';

export function PurchasesPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // حقول بيانات المورد والحساب الخاصة بالفاتورة
  const [supplierName, setSupplierName] = useState('');
  const [previousBalance, setPreviousBalance] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState([{ product_id: '', category: '', quantity: 1, unit_price: 0, subtotal: 0 }]);
  const [search, setSearch] = useState('');
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', sku: '', cost_price: '', selling_price: '', category: '' });

  const filteredProducts = useMemo(() => {
    const q = search.trim();
    if (!q) return products;
    return products.filter((p) => 
      p.name.toLowerCase().includes(q.toLowerCase()) || 
      (p.sku ?? '').toLowerCase().includes(q.toLowerCase()) || 
      (p.category ?? '').toLowerCase().includes(q.toLowerCase())
    );
  }, [products, search]);

  const loadProducts = async () => {
    try {
      const data = await fetchInventory();
      setProducts(data || []);
    } catch (e) {
      toast('تعذّر تحميل المنتجات', 'error');
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  function updateLine(idx, patch) {
    setLines((ls) =>
      ls.map((l, i) => {
        if (i !== idx) return l;
        const updated = { ...l, ...patch };
        updated.subtotal = (Number(updated.quantity) || 0) * (Number(updated.unit_price) || 0);
        return updated;
      })
    );
  }

  function addLine() {
    setLines((ls) => [...ls, { product_id: '', category: '', quantity: 1, unit_price: 0, subtotal: 0 }]);
  }

  function removeLine(idx) {
    setLines((ls) => (ls.length > 1 ? ls.filter((_, i) => i !== idx) : ls));
  }

  function selectProduct(idx, productId) {
    const p = products.find((x) => x.id === productId);
    updateLine(idx, { 
      product_id: productId, 
      unit_price: p ? Number(p.cost_price) : 0,
      name: p ? p.name : '',
      category: p ? (p.category || 'عام') : ''
    });
  }

  // الحسابات المجمعة
  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) * Number(l.unit_price) || 0), 0);
  const remaining = subtotal - Number(paidAmount);
  const totalBalance = Number(previousBalance) + remaining;

  async function addProduct() {
    if (!newProduct.name.trim()) {
      toast('اسم المنتج مطلوب', 'error');
      return;
    }
    try {
      const created = await createProduct({
        name: newProduct.name.trim(),
        sku: newProduct.sku.trim() || 'SKU-' + Date.now(),
        cost_price: Number(newProduct.cost_price) || 0,
        selling_price: Number(newProduct.selling_price) || 0,
        category: newProduct.category.trim() || 'عام',
        quantity: 0,
      });
      setProducts((p) => [...p, created]);
      toast('تمت إضافة المنتج بنجاح', 'success');
      setNewProduct({ name: '', sku: '', cost_price: '', selling_price: '', category: '' });
      setShowNewProduct(false);
    } catch (e) {
      toast('تعذّر إضافة المنتج: ' + e.message, 'error');
    }
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    const valid = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
    if (valid.length === 0) {
      toast('أضف صنفاً واحداً على الأقل', 'error');
      return;
    }

    setSubmitting(true);
    setShowSuccess(false);

    try {
      // إرفاق اسم المنتج والفئة/التصنيف مع العناصر
      const items = valid.map((l) => {
        const prod = products.find((p) => p.id === l.product_id);
        return {
          product_id: l.product_id,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          name: l.name || (prod ? prod.name : ''),
          category: l.category || (prod ? prod.category : 'عام')
        };
      });

      // تجهيز الكائن المتوافق مع الفاتورة و dbService
      const payload = {
        type: 'PURCHASE',
        party_name: supplierName.trim() || 'مورد نقدي',
        customer_name: supplierName.trim() || 'مورد نقدي',
        name: items[0]?.name || '',        // اسم الصنف الأول
        category: items[0]?.category || '',// نوع الصنف الأول
        items,
        total_amount: subtotal,
        paid_amount: Number(paidAmount),
        previous_balance: Number(previousBalance),
        notes: notes.trim(),
      };

      await processPurchaseInvoice(payload);
      
      setShowSuccess(true);
      toast('تم تسجيل فاتورة الشراء وتحديث المخزون بنجاح', 'success');

      // إعادة التعيين بعد الحفظ
      setTimeout(() => {
        setLines([{ product_id: '', category: '', quantity: 1, unit_price: 0, subtotal: 0 }]);
        setSupplierName('');
        setPreviousBalance(0);
        setPaidAmount(0);
        setNotes('');
        setShowSuccess(false);
        loadProducts();
      }, 1000);

    } catch (e) {
      toast('تعذّر حفظ الفاتورة: ' + e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 animate-fadein">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-indigo-600" /> تسجيل فاتورة شراء
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          سجّل بيانات المورد والأصناف — يُحدّث كميات التكلفة والمخزون تلقائياً
        </p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* قسم بيانات المورد والبيانات المالية */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
            <div>
              <label className="label font-bold">اسم المورد</label>
              <input
                className="input"
                placeholder="أدخل اسم المورد (أو اتركه فارغاً لمورد نقدي)..."
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
              />
            </div>
            <div>
              <label className="label font-bold">الرصيد السابق للمورد</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input"
                value={previousBalance}
                onChange={(e) => setPreviousBalance(e.target.value)}
              />
            </div>
          </div>

          {/* قسم الأصناف والبحث */}
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-bold text-slate-800 dark:text-white">أصناف الفاتورة</h2>
              <button
                type="button"
                onClick={() => setShowNewProduct((s) => !s)}
                className="btn-secondary text-sm"
              >
                <PackagePlus className="w-4 h-4" /> إضافة صنف جديد للمخزون
              </button>
            </div>

            {/* نموذج إضافة منتج جديد غير مدرج بالجدول */}
            {showNewProduct && (
              <div className="mb-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold mb-3 text-sm">تعريف منتج جديد</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <input className="input" placeholder="اسم المنتج *" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
                  <input className="input" placeholder="رمز SKU (اختياري)" value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} dir="ltr" />
                  <input type="number" className="input" placeholder="سعر الشراء (التكلفة)" value={newProduct.cost_price} onChange={(e) => setNewProduct({ ...newProduct, cost_price: e.target.value })} />
                  <input type="number" className="input" placeholder="سعر البيع" value={newProduct.selling_price} onChange={(e) => setNewProduct({ ...newProduct, selling_price: e.target.value })} />
                  <input className="input" placeholder="الفئة / التصنيف" value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} />
                </div>
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={addProduct} className="btn-primary text-sm">حفظ المنتج</button>
                  <button type="button" onClick={() => setShowNewProduct(false)} className="btn-ghost text-sm">إلغاء</button>
                </div>
              </div>
            )}

            <div className="mb-4 relative max-w-sm">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pr-10 text-sm" placeholder="تصفية الأصناف بالمشروع..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {loadingProducts ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
            ) : (
              <div className="space-y-3">
                {lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    {/* اسم الصنف */}
                    <div className="sm:col-span-4">
                      <label className="label font-bold text-slate-700 dark:text-slate-300">الصنف</label>
                      <select className="input" value={line.product_id} onChange={(e) => selectProduct(idx, e.target.value)} required>
                        <option value="">اختر صنفاً...</option>
                        {filteredProducts.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''} — [المتاح: {p.quantity}]</option>
                        ))}
                      </select>
                    </div>

                    {/* خانة الفئة / التصنيف البارزة */}
                    <div className="sm:col-span-2">
                      <label className="label font-bold text-slate-700 dark:text-slate-300">الفئة / التصنيف</label>
                      <input 
                        type="text" 
                        className="input bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900/50 focus:border-indigo-500 font-medium" 
                        placeholder="الفئة" 
                        value={line.category || ''} 
                        onChange={(e) => updateLine(idx, { category: e.target.value })} 
                      />
                    </div>

                    {/* الكمية */}
                    <div className="sm:col-span-2">
                      <label className="label font-bold text-slate-700 dark:text-slate-300">الكمية</label>
                      <input type="number" min={1} className="input" value={line.quantity} onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })} />
                    </div>

                    {/* سعر الشراء */}
                    <div className="sm:col-span-2">
                      <label className="label font-bold text-slate-700 dark:text-slate-300">سعر الشراء</label>
                      <input type="number" min={0} step="0.01" className="input" value={line.unit_price} onChange={(e) => updateLine(idx, { unit_price: Number(e.target.value) })} />
                    </div>

                    {/* الإجمالي */}
                    <div className="sm:col-span-1 text-left font-bold text-sm py-2">
                      <span className="text-xs text-slate-400 block font-normal">الإجمالي</span>
                      {formatCurrency(line.subtotal || 0)}
                    </div>

                    {/* زر الإلغاء */}
                    <div className="sm:col-span-1 text-center">
                      <button type="button" onClick={() => removeLine(idx)} className="btn-ghost text-rose-600 p-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addLine} className="btn-secondary text-sm">
                  <Plus className="w-4 h-4" /> إضافة صنف آخر
                </button>
              </div>
            )}
          </div>

          {/* المدفوع والملاحظات */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-800 pt-5">
            <div>
              <label className="label font-bold">المبلغ المدفوع</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="label font-bold">ملاحظات الفاتورة</label>
              <input
                className="input"
                placeholder="أي ملاحظات إضافية..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* ملخص المبالغ المالي */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 space-y-2 text-sm max-w-xl mr-auto">
            <div className="flex justify-between"><span className="text-slate-500">إجمالي فاتورة الشراء:</span><span className="font-bold">{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">المدفوع للمورد:</span><span className="font-bold text-emerald-600">{formatCurrency(Number(paidAmount))}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">المتبقي من الفاتورة:</span><span className="font-bold text-rose-600">{formatCurrency(remaining)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">الرصيد السابق للمورد:</span><span className="font-bold">{formatCurrency(Number(previousBalance))}</span></div>
            <div className="flex justify-between pt-2 border-t border-slate-300 dark:border-slate-700 font-extrabold text-base">
              <span>صافي حساب المورد النهائي:</span>
              <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(totalBalance)}</span>
            </div>
          </div>

          {/* زر التقديم */}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3.5 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
              showSuccess ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20'
            } disabled:opacity-50`}
          >
            {submitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> جاري حفظ الفاتورة وتحديث المخزون...</>
            ) : showSuccess ? (
              <><CheckCircle2 className="w-5 h-5" /> تم الحفظ بنجاح</>
            ) : (
              <><ShoppingCart className="w-5 h-5" /> حفظ فاتورة الشراء</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}  
