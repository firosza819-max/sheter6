import { useEffect, useMemo, useState } from 'react';
import {
  Receipt,
  Search,
  Plus,
  Minus,
  Trash2,
  Loader2,
  ShoppingCart,
  CheckCircle2,
  X,
  Banknote,
  CreditCard,
  ArrowLeftRight,
  Tag,
  Sparkles,
  User,
} from 'lucide-react';
import { fetchInventory, processSalesInvoice } from '@/services/dbService';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, formatDate } from '@/lib/format';
import { InvoiceModal } from '@/components/InvoiceModal';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'نقداً', icon: Banknote, gradient: 'from-emerald-500 to-green-600' },
  { id: 'card', label: 'بطاقة', icon: CreditCard, gradient: 'from-blue-500 to-indigo-600' },
  { id: 'transfer', label: 'تحويل', icon: ArrowLeftRight, gradient: 'from-amber-500 to-orange-600' },
];

export function SalesPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);

  // حقول بيانات العميل والحسابات الخاصة بالفاتورة
  const [customerName, setCustomerName] = useState('');
  const [previousBalance, setPreviousBalance] = useState(0);
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');

  // POS checkout state
  const [discountPct, setDiscountPct] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showSuccess, setShowSuccess] = useState(false);

  const loadProducts = async () => {
    try {
      const data = await fetchInventory();
      setProducts(data || []);
    } catch (e) {
      toast('تعذّر تحميل المنتجات', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        (p.sku ?? '').toLowerCase().includes(q.toLowerCase()) ||
        (p.category ?? '').toLowerCase().includes(q.toLowerCase())
    );
  }, [products, search]);

  function addToCart(p) {
    if (p.quantity <= 0) {
      toast('هذا الصنف غير متوفر في المخزون', 'error');
      return;
    }
    setCart((c) => {
      const found = c.find((x) => x.product.id === p.id);
      if (found) {
        if (found.quantity + 1 > p.quantity) {
          toast('الكمية المطلوبة تتجاوز المخزون المتاح', 'error');
          return c;
        }
        return c.map((x) => (x.product.id === p.id ? { ...x, quantity: x.quantity + 1 } : x));
      }
      return [...c, { product: p, quantity: 1 }];
    });
  }

  function setQty(productId, qty) {
    setCart((c) =>
      c.map((x) => {
        if (x.product.id !== productId) return x;
        const clamped = Math.max(1, Math.min(qty, x.product.quantity));
        return { ...x, quantity: clamped };
      })
    );
  }

  function removeLine(productId) {
    setCart((c) => c.filter((x) => x.product.id !== productId));
  }

  function clearCart() {
    setCart([]);
    setDiscountPct(0);
    setCustomerName('');
    setPreviousBalance(0);
    setPaidAmount('');
    setNotes('');
  }

  // ---- POS calculations ----
  const totalItemsCount = cart.reduce((s, l) => s + Number(l.quantity), 0); // إجمالي عدد الوحدات المباعة
  const subtotal = cart.reduce((s, l) => s + l.quantity * Number(l.product.selling_price), 0);
  const discountAmount = Math.round(subtotal * (discountPct / 100) * 100) / 100;
  const afterDiscount = subtotal - discountAmount;
  const tax = Math.round(afterDiscount * 0.15 * 100) / 100;
  const total = afterDiscount + tax;

  // الحسابات المالية بالنسبة للعميل
  const actualPaid = paidAmount === '' ? total : Number(paidAmount);
  const remaining = total - actualPaid;
  const finalBalance = Number(previousBalance) + remaining;

  async function handleCheckout() {
    if (cart.length === 0) {
      toast('السلة فارغة', 'error');
      return;
    }
    setSubmitting(true);
    setShowSuccess(false);

    try {
      const items = cart.map((l) => ({
        product_id: l.product.id,
        quantity: Number(l.quantity),
        unit_price: Number(l.product.selling_price),
        subtotal: l.quantity * Number(l.product.selling_price),
      }));

      // التأكد من استخلاص وحفظ اسم العميل إذا تم إدخاله وإلا اعتماد الفراغ
      const trimmedName = customerName.trim();
      const finalCustomerName = trimmedName !== '' ? trimmedName : 'عميل نقدي';

      const payload = {
        type: 'SALE',
        customer_name: finalCustomerName,
        party_name: finalCustomerName,
        customerName: finalCustomerName,
        items,
        subtotal_amount: subtotal,
        discount_amount: discountAmount,
        tax_amount: tax,
        total_amount: total,
        paid_amount: actualPaid,
        previous_balance: Number(previousBalance),
        payment_method: paymentMethod,
        notes: notes.trim(),
      };

      const invoice = await processSalesInvoice(payload);

      const built = {
        ...invoice,
        customer_name: finalCustomerName,
        party_name: finalCustomerName,
        tax_amount: tax,
        discount_amount: discountAmount,
        total_units_sold: totalItemsCount,
        items: cart.map((l) => ({
          id: l.product.id,
          invoice_id: invoice.id,
          product_id: l.product.id,
          quantity: l.quantity,
          unit_price: Number(l.product.selling_price),
          subtotal: l.quantity * Number(l.product.selling_price),
          product_name: l.product.name,
          product_sku: l.product.sku,
        })),
      };

      toast('تمت عملية البيع بنجاح', 'success');
      setLastInvoice(built);
      setShowSuccess(true);
      clearCart();
      await loadProducts();
    } catch (e) {
      toast('تعذّر إتمام البيع: ' + e.message, 'error');
    } finally {
      setSubmitting(false);
      setTimeout(() => setShowSuccess(false), 2200);
    }
  }

  return (
    <div className="space-y-6 animate-fadein">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
          <Receipt className="w-6 h-6 text-indigo-600" /> صفحة المبيعات
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          نقطة بيع سريعة — اختر الأصناف وحدد عدد الوحدات لتجهيز الفاتورة
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product grid */}
        <div className="lg:col-span-2 card p-5 space-y-4">
          {/* بيانات العميل */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <div>
              <label className="label font-bold flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-500" /> اسم العميل
              </label>
              <input
                className="input text-sm"
                placeholder="اسم العميل (أو اتركه فارغاً لعميل نقدي)..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div>
              <label className="label font-bold">الرصيد السابق للعميل</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input text-sm"
                value={previousBalance}
                onChange={(e) => setPreviousBalance(e.target.value)}
              />
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pr-10"
              placeholder="بحث بالاسم أو الرمز..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((p, i) => {
                const out = p.quantity <= 0;
                const low = p.quantity <= (p.low_stock_threshold || 5) && !out;
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={out}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className={`text-right p-3 rounded-xl border transition-all duration-200 card-mount ${
                      out
                        ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:shadow-md hover:-translate-y-1 active:scale-95'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400" dir="ltr">{p.sku || '—'}</span>
                      {out ? (
                        <span className="badge bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">نفد</span>
                      ) : low ? (
                        <span className="badge bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">منخفض</span>
                      ) : (
                        <span className="badge bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">متوفر</span>
                      )}
                    </div>
                    <div className="font-semibold text-sm leading-tight mb-1 line-clamp-2 h-9">{p.name}</div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                        {formatCurrency(Number(p.selling_price))}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                        المتاح: {p.quantity}
                      </span>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full text-center text-slate-400 py-8 text-sm">لا توجد أصناف</div>
              )}
            </div>
          )}
        </div>

        {/* ===== POS Quick Checkout Card ===== */}
        <div className="card p-5 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-l from-indigo-500 via-blue-500 to-emerald-500" />

          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" /> سلة المبيعات
            </h2>
            {cart.length > 0 && (
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-1 rounded-full">
                إجمالي القطع المباعة: {totalItemsCount}
              </span>
            )}
          </div>

          {/* Cart lines */}
          <div className="flex-1 space-y-2 min-h-[140px] max-h-[260px] overflow-y-auto pl-1">
            {cart.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-10">
                السلة فارغة — اختر أصنافاً للبيع
              </p>
            ) : (
              cart.map((l) => (
                <div
                  key={l.product.id}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{l.product.name}</div>
                    <div className="text-xs text-slate-400">
                      {formatCurrency(Number(l.product.selling_price))} × {l.quantity} وحدة = <span className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(l.quantity * Number(l.product.selling_price))}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQty(l.product.id, l.quantity - 1)}
                      className="btn-ghost p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold bg-white dark:bg-slate-700 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                      {l.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(l.product.id, l.quantity + 1)}
                      className="btn-ghost p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(l.product.id)}
                    className="btn-ghost p-1.5 text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Discount */}
          <div className="mt-4">
            <label className="label flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-500" /> الخصم (%)
            </label>
            <div className="flex gap-1.5">
              {[0, 5, 10, 15].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDiscountPct(d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 ${
                    discountPct === d
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {d === 0 ? 'بدون' : `${d}%`}
                </button>
              ))}
              <input
                type="number"
                min={0}
                max={100}
                value={discountPct}
                onChange={(e) => setDiscountPct(Math.max(0, Math.min(100, Number(e.target.value))))}
                className="input w-16 text-center px-1"
              />
            </div>
          </div>

          {/* Totals */}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">عدد القطع المباعة</span>
              <span className="font-bold text-indigo-600">{totalItemsCount} قطعة</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">المجموع الفرعي</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-rose-600 dark:text-rose-400">
                <span>الخصم ({discountPct}%)</span>
                <span className="font-semibold">- {formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">الضريبة (15%)</span>
              <span className="font-semibold">{formatCurrency(tax)}</span>
            </div>

            {/* Paid & Remaining Fields */}
            <div className="pt-2 grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-slate-500 block mb-1">المبلغ المدفوع</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={total.toString()}
                  className="input py-1 text-sm"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                />
              </div>
              <div>
                <span className="text-xs text-slate-500 block mb-1">ملاحظات</span>
                <input
                  type="text"
                  placeholder="ملاحظات..."
                  className="input py-1 text-sm"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-between text-xs text-slate-500 pt-1">
              <span>صافي حساب العميل النهائي:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(finalBalance)}</span>
            </div>

            {/* Highlighted total */}
            <div className="flex justify-between items-center mt-3 p-3 rounded-xl bg-gradient-to-l from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 border border-indigo-200 dark:border-indigo-800">
              <span className="font-bold text-slate-700 dark:text-slate-200">إجمالي الفاتورة</span>
              <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 value-pulse">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* Payment methods */}
          <div className="mt-4">
            <label className="label">وسيلة الدفع</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => {
                const active = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`relative p-3 rounded-xl border-2 transition-all duration-200 active:scale-95 ${
                      active
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 pay-select'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg bg-gradient-to-br ${m.gradient} flex items-center justify-center mx-auto mb-1.5 ${
                        active ? 'shadow-md' : 'opacity-60'
                      }`}
                    >
                      <m.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className={`text-xs font-semibold ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                      {m.label}
                    </div>
                    {active && (
                      <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Checkout button */}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={submitting || cart.length === 0}
            className={`mt-5 py-3.5 w-full rounded-xl font-bold text-white transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden ${
              showSuccess
                ? 'bg-emerald-600'
                : 'bg-gradient-to-l from-indigo-600 to-blue-600 hover:shadow-lg hover:shadow-indigo-500/30'
            } disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> جارٍ المعالجة...
              </>
            ) : showSuccess ? (
              <>
                <CheckCircle2 className="w-5 h-5 success-pop" /> تم البيع بنجاح
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5" /> إتمام البيع ({totalItemsCount} قطعة) — {formatCurrency(total)}
              </>
            )}
          </button>
        </div>
      </div>

      {lastInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fadein">
          <div className="card max-w-md w-full p-6 relative">
            <button
              onClick={() => setLastInvoice(null)}
              className="absolute top-3 left-3 btn-ghost p-2"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 success-pop" />
              </div>
              <h3 className="text-lg font-extrabold">تم البيع بنجاح</h3>
              <p className="text-sm text-slate-500 mt-1">
                رقم الفاتورة: <span dir="ltr" className="font-mono font-bold">{lastInvoice.invoice_number}</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">{formatDate(lastInvoice.created_at)}</p>
            </div>
            <InvoiceModal invoice={lastInvoice} onClose={() => setLastInvoice(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
