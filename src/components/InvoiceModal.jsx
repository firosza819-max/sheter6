import { useRef } from 'react';
import { Printer, X, Store } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';

export function InvoiceModal({ invoice, onClose }) {
  const ref = useRef(null);

  function handlePrint() {
    const content = ref.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=420,height=700');
    if (!win) return;
    win.document.write(`
      <html dir="rtl"><head><meta charset="utf-8"><title>${invoice.invoice_number ?? 'فاتورة'}</title>
      <style>
        *{font-family:'Tajawal','Cairo',sans-serif;box-sizing:border-box}
        body{padding:24px;color:#1e293b}
        .h{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #4f46e5;padding-bottom:12px;margin-bottom:16px}
        .logo{display:flex;align-items:center;gap:8px}
        .badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700}
        table{width:100%;border-collapse:collapse;margin:12px 0}
        th,td{padding:8px;text-align:right;border-bottom:1px solid #e2e8f0;font-size:13px}
        th{background:#f1f5f9}
        .tot{display:flex;justify-content:space-between;margin:4px 0;font-size:14px}
        .grand{font-size:18px;font-weight:800;border-top:2px solid #4f46e5;padding-top:8px;margin-top:8px}
        .qr{margin-top:16px;text-align:center}
        .meta{color:#64748b;font-size:12px}
      </style></head><body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  const subtotal = invoice.items.reduce((s, i) => s + Number(i.subtotal), 0);
  const tax = Number(invoice.tax_amount) || 0;
  const isSale = invoice.type === 'SALE';

  return (
    <div>
      <div ref={ref}>
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-indigo-600 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-extrabold text-lg">شاطر</div>
              <div className="text-xs text-slate-500">نظام إدارة المتجر</div>
            </div>
          </div>
          <span className={`badge ${isSale ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
            {isSale ? 'فاتورة بيع' : 'فاتورة شراء'}
          </span>
        </div>

        {/* Meta */}
        <div className="flex justify-between text-sm mb-3">
          <div>
            <div className="text-slate-500 text-xs">رقم الفاتورة</div>
            <div className="font-mono font-bold" dir="ltr">{invoice.invoice_number}</div>
          </div>
          <div className="text-left">
            <div className="text-slate-500 text-xs">التاريخ</div>
            <div className="font-semibold">{formatDate(invoice.created_at)}</div>
          </div>
        </div>

        {/* Items */}
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800 text-right">
              <th className="p-2 font-semibold">الصنف</th>
              <th className="p-2 font-semibold">الكمية</th>
              <th className="p-2 font-semibold">السعر</th>
              <th className="p-2 font-semibold text-left">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it) => (
              <tr key={it.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="p-2">{it.product_name || it.product?.name || '—'}</td>
                <td className="p-2">{it.quantity}</td>
                <td className="p-2">{formatCurrency(Number(it.unit_price))}</td>
                <td className="p-2 text-left font-semibold">{formatCurrency(Number(it.subtotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-sm"><span className="text-slate-500">المجموع الفرعي</span><span>{formatCurrency(subtotal)}</span></div>
          {tax > 0 && <div className="flex justify-between text-sm"><span className="text-slate-500">الضريبة</span><span>{formatCurrency(tax)}</span></div>}
          <div className="flex justify-between text-lg font-extrabold border-t-2 border-indigo-600 pt-2">
            <span>الإجمالي</span>
            <span className="text-indigo-600">{formatCurrency(Number(invoice.total_amount))}</span>
          </div>
        </div>

        {/* QR mock */}
        <div className="mt-5 flex flex-col items-center">
          <div className="w-24 h-24 grid grid-cols-8 grid-rows-8 gap-px bg-white p-1 border border-slate-200 rounded">
            {Array.from({ length: 64 }).map((_, i) => {
              const seed = (invoice.invoice_number || '').charCodeAt(i % (invoice.invoice_number?.length ?? 1)) ?? i;
              const on = (seed + i) % 2 === 0;
              return <div key={i} className={on ? 'bg-slate-900' : 'bg-white'} />;
            })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">رمز الفاتورة</div>
        </div>

        <div className="mt-4 text-center text-xs text-slate-400">
          شاطر — شكراً لتعاملكم معنا
        </div>
      </div>

      <div className="flex gap-2 mt-5">
        <button onClick={handlePrint} className="btn-primary flex-1">
          <Printer className="w-5 h-5" /> طباعة / تحميل
        </button>
        <button onClick={onClose} className="btn-secondary">
          <X className="w-5 h-5" /> إغلاق
        </button>
      </div>
    </div>
  );
}
