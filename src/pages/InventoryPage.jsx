import { useEffect, useMemo, useState } from 'react';
import { Package, Search, Plus, Pencil, Trash2, Loader2, X, Save, AlertTriangle, CheckCircle2, XCircle, Tag, Layers, Hash } from 'lucide-react';
import * as dbService from '@/services/dbService';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, formatNumber } from '@/lib/format';

export function InventoryPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await dbService.fetchInventory();
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      toast('تعذّر تحميل المخزون', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDeleteProduct(product) {
    if (!window.confirm(`هل أنت تأكد من حذف المنتج "${product.name}"؟`)) {
      return;
    }

    setDeletingId(product.id);
    try {
      if (typeof dbService.deleteProduct === 'function') {
        await dbService.deleteProduct(product.id);
      } else if (typeof dbService.deleteInvoice === 'function') {
        // في حال تم استخدام دالة الحذف العامة بنفس المسار
        await dbService.deleteInvoice(product.id);
      } else {
        throw new Error('دالة الحذف غير معرفة في dbService');
      }

      toast('تم حذف المنتج بنجاح', 'success');
      load();
    } catch (e) {
      toast('تعذّر حذف المنتج: ' + (e.message || 'حدث خطأ غير معروف'), 'error');
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchSearch =
        !q ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q));

      const low = p.quantity <= p.low_stock_threshold;
      const matchFilter =
        filter === 'all' ? true :
        filter === 'in' ? p.quantity > p.low_stock_threshold :
        filter === 'low' ? low && p.quantity > 0 :
        filter === 'out' ? p.quantity <= 0 : true;

      return matchSearch && matchFilter;
    });
  }, [products, search, filter]);

  function statusOf(p) {
    if (p.quantity <= 0) return { label: 'نفد المخزون', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300', icon: XCircle };
    if (p.quantity <= p.low_stock_threshold) return { label: 'مخزون منخفض', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon: AlertTriangle };
    return { label: 'متوفر', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon: CheckCircle2 };
  }

  return (
    <div className="space-y-6 animate-fadein">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" /> صفحة المخزن
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">عرض وتعديل المخزون لحظياً</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="w-5 h-5" /> صنف جديد
        </button>
      </div>

      <div className="card p-5">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pr-10" placeholder="بحث عن صنف..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {[
              ['all', 'الكل'],
              ['in', 'متوفر'],
              ['low', 'منخفض'],
              ['out', 'نفد'],
            ].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                  filter === val ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-3 font-semibold">الصنف</th>
                  <th className="py-3 px-3 font-semibold">الرمز</th>
                  <th className="py-3 px-3 font-semibold">الفئة</th>
                  <th className="py-3 px-3 font-semibold">الكمية</th>
                  <th className="py-3 px-3 font-semibold">سعر التكلفة</th>
                  <th className="py-3 px-3 font-semibold">سعر البيع</th>
                  <th className="py-3 px-3 font-semibold">الحالة</th>
                  <th className="py-3 px-3 font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const st = statusOf(p);
                  return (
                    <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-semibold">{p.name}</td>
                      <td className="py-3 px-3 text-slate-500" dir="ltr">{p.sku || '—'}</td>
                      <td className="py-3 px-3 text-slate-500">{p.category}</td>
                      <td className="py-3 px-3 font-bold">{formatNumber(p.quantity)}</td>
                      <td className="py-3 px-3 text-slate-500">{formatCurrency(Number(p.cost_price))}</td>
                      <td className="py-3 px-3 font-semibold">{formatCurrency(Number(p.selling_price))}</td>
                      <td className="py-3 px-3">
                        <span className={`badge ${st.cls}`}><st.icon className="w-3.5 h-3.5" /> {st.label}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditing(p)} className="btn-ghost p-2" title="تعديل">
                            <Pencil className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(p)} 
                            disabled={deletingId === p.id}
                            className="btn-ghost p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50" 
                            title="حذف"
                          >
                            {deletingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-slate-400 py-8">لا توجد أصناف</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(editing || showAdd) && (
        <ProductEditModal
          product={editing}
          onClose={() => { setEditing(null); setShowAdd(false); }}
          onSaved={() => { setEditing(null); setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}

function ProductEditModal({ product, onClose, onSaved }) {
  const { toast } = useToast();
  const isEdit = !!product;
  const [form, setForm] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    category: product?.category ?? 'عام',
    quantity: product?.quantity ?? '',
    cost_price: product?.cost_price ?? '',
    selling_price: product?.selling_price ?? '',
    low_stock_threshold: product?.low_stock_threshold ?? 5,
  });
  const [saving, setSaving] = useState(false);

  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleFocus = (field) => {
    if (form[field] === 0 || form[field] === '0') {
      setForm(prev => ({ ...prev, [field]: '' }));
    }
  };

  async function handleSaveProduct() {
    if (!form.name.trim()) {
      toast('اسم المنتج مطلوب', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || 'SKU-' + Date.now(),
        category: form.category.trim() || 'عام',
        quantity: Number(form.quantity) || 0,
        cost_price: Number(form.cost_price) || 0,
        selling_price: Number(form.selling_price) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
      };

      if (isEdit && product) {
        if (typeof dbService.updateProduct === 'function') {
          await dbService.updateProduct(product.id, payload);
        } else {
          await dbService.createProduct(payload);
        }
        toast('تم تحديث الصنف', 'success');
      } else {
        await dbService.createProduct(payload);
        toast('تمت إضافة الصنف', 'success');
      }
      onSaved();
    } catch (e) {
      toast('تعذّر الحفظ: ' + (e.message || 'حدث خطأ غير معروف'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300 ease-out animate-in fade-in">
      {/* Dynamic Slide & Zoom Card Container */}
      <div className="card max-w-xl w-full p-6 bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto transition-all duration-300 transform ease-out animate-in zoom-in-95 slide-in-from-bottom-4">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-white">
              {isEdit ? 'تعديل بيانات الصنف' : 'إضافة صنف جديد'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Inputs */}
        <div className="space-y-4">
          {/* اسم المنتج */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">اسم المنتج <span className="text-rose-500">*</span></label>
            <div className="relative">
              <Tag className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                className="input pr-9 w-full font-medium" 
                placeholder="مثال: آيفون 15 برومكس"
                value={form.name} 
                onChange={(e) => handleInputChange('name', e.target.value)} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* SKU */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">الرمز (SKU)</label>
              <div className="relative">
                <Hash className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  className="input pr-9 w-full" 
                  dir="ltr" 
                  placeholder="تلقائي عند الترك"
                  value={form.sku} 
                  onChange={(e) => handleInputChange('sku', e.target.value)} 
                />
              </div>
            </div>

            {/* الفئة */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">الفئة</label>
              <div className="relative">
                <Layers className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  className="input pr-9 w-full" 
                  placeholder="عام"
                  value={form.category} 
                  onChange={(e) => handleInputChange('category', e.target.value)} 
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-3">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block mb-1">بيانات المخزون والأسعار</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* الكمية */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">الكمية</label>
                <input 
                  type="number" 
                  min="0"
                  className="input text-center font-bold" 
                  value={form.quantity} 
                  onFocus={() => handleFocus('quantity')}
                  onChange={(e) => handleInputChange('quantity', e.target.value)} 
                />
              </div>

              {/* حد التنبيه */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">حد التنبيه</label>
                <input 
                  type="number" 
                  min="0"
                  className="input text-center" 
                  value={form.low_stock_threshold} 
                  onFocus={() => handleFocus('low_stock_threshold')}
                  onChange={(e) => handleInputChange('low_stock_threshold', e.target.value)} 
                />
              </div>

              {/* سعر التكلفة */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">سعر التكلفة</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  className="input text-center font-medium" 
                  value={form.cost_price} 
                  onFocus={() => handleFocus('cost_price')}
                  onChange={(e) => handleInputChange('cost_price', e.target.value)} 
                />
              </div>

              {/* سعر البيع */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">سعر البيع</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  className="input text-center font-bold text-emerald-600 dark:text-emerald-400" 
                  value={form.selling_price} 
                  onFocus={() => handleFocus('selling_price')}
                  onChange={(e) => handleInputChange('selling_price', e.target.value)} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900 z-10">
          <button onClick={handleSaveProduct} disabled={saving} className="btn-primary flex-1 py-2.5 justify-center">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            حفظ البيانات
          </button>
          <button onClick={onClose} className="btn-secondary py-2.5">إلغاء</button>
        </div>

      </div>
    </div>
  );
}
