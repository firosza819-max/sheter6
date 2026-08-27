import { useRef } from 'react';
import { Printer, X, Store, User } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

function formatInvoiceDate(value) {
  try {
    const d = new Date(value);
    const date = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
    const time = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
    return `${date} ${time}`;
  } catch {
    return value;
  }
}

function extractInvoiceNumber(num) {
  if (!num) return '1';
  const m = String(num).match(/(\d+)$/);
  return m ? m[1] : String(num);
}

export function InvoiceTemplate({ invoice, onClose }) {
  const ref = useRef(null);

  function handlePrint() {
    window.print();
  }

  const isSale = invoice.type === 'SALE';
  const title = isSale ? 'فاتورة بيع' : 'فاتورة شراء';
  const subtotal = invoice.items.reduce((s, i) => s + Number(i.subtotal), 0);
  const total = Number(invoice.total_amount) || subtotal;
  const paid = Number(invoice.paid_amount) || 0;
  const prevBal = Number(invoice.previous_balance) || 0;
  const remaining = total - paid;
  const totalBalance = prevBal + remaining;

  return (
    <div className="invoice-overlay">
      <div className="invoice-sheet-wrapper">
        {/* Toolbar — hidden in print */}
        <div className="invoice-toolbar no-print">
          <button onClick={handlePrint} className="btn-primary">
            <Printer className="w-5 h-5" /> طباعة / تحميل PDF
          </button>
          <button onClick={onClose} className="btn-secondary">
            <X className="w-5 h-5" /> إغلاق
          </button>
        </div>

        {/* A4 sheet */}
        <div ref={ref} className="invoice-sheet">
          {/* ===== Header ===== */}
          <div className="inv-header">
            <div className="inv-brand">
              <div className="inv-logo">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="inv-brand-name">كشكول</div>
                <div className="inv-brand-sub">نظام إدارة المتجر</div>
              </div>
            </div>

            <div className="inv-title-box">
              <span className="inv-title">{title}</span>
            </div>

            <div className="inv-user">
              <div className="inv-user-icon">
                <User className="w-4 h-4 text-slate-500" />
              </div>
              <div className="inv-user-name">{invoice.created_by_name || 'المستخدم'}</div>
            </div>
          </div>

          {/* ===== Meta row ===== */}
          <div className="inv-meta">
            <div className="inv-meta-item">
              <span className="inv-meta-label">رقم الفاتورة:</span>
              <span className="inv-meta-value">{extractInvoiceNumber(invoice.invoice_number)}</span>
            </div>
            <div className="inv-meta-item">
              <span className="inv-meta-label">التاريخ والوقت:</span>
              <span className="inv-meta-value" dir="ltr">{formatInvoiceDate(invoice.created_at)}</span>
            </div>
            <div className="inv-meta-item">
              <span className="inv-meta-label">{isSale ? 'اسم العميل:' : 'اسم المورد:'}</span>
              <span className="inv-meta-value">{invoice.customer_name || '—'}</span>
            </div>
          </div>

          {/* ===== Items table ===== */}
          <table className="inv-table">
            <thead>
              <tr>
                <th className="inv-th">اسم الصنف</th>
                <th className="inv-th inv-th-num">الكمية</th>
                <th className="inv-th inv-th-num">سعر الوحدة</th>
                <th className="inv-th inv-th-num">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it, idx) => (
                <tr key={idx} className={idx % 2 === 1 ? 'inv-row-alt' : ''}>
                  <td className="inv-td">{it.product_name || it.product?.name || '—'}</td>
                  <td className="inv-td inv-td-num">{it.quantity}</td>
                  <td className="inv-td inv-td-num">{formatCurrency(Number(it.unit_price))}</td>
                  <td className="inv-td inv-td-num inv-td-bold">{formatCurrency(Number(it.subtotal))}</td>
                </tr>
              ))}
              {/* filler rows for a full-page look */}
              {invoice.items.length < 6 &&
                Array.from({ length: 6 - invoice.items.length }).map((_, i) => (
                  <tr key={`f${i}`} className={i % 2 === 1 ? 'inv-row-alt' : ''}>
                    <td className="inv-td">&nbsp;</td>
                    <td className="inv-td inv-td-num">&nbsp;</td>
                    <td className="inv-td inv-td-num">&nbsp;</td>
                    <td className="inv-td inv-td-num">&nbsp;</td>
                  </tr>
                ))}
            </tbody>
          </table>

          {/* ===== Financial summary ===== */}
          <div className="inv-summary">
            <div className="inv-sum-box">
              <span className="inv-sum-label">الإجمالي</span>
              <span className="inv-sum-value">{formatCurrency(total)}</span>
            </div>
            <div className="inv-sum-box">
              <span className="inv-sum-label">المبلغ المدفوع</span>
              <span className="inv-sum-value">{formatCurrency(paid)}</span>
            </div>
            <div className="inv-sum-box">
              <span className="inv-sum-label">المبلغ المتبقي</span>
              <span className="inv-sum-value">{formatCurrency(remaining)}</span>
            </div>
            <div className="inv-sum-box">
              <span className="inv-sum-label">الرصيد السابق</span>
              <span className="inv-sum-value">{formatCurrency(prevBal)}</span>
            </div>
            <div className="inv-sum-box inv-sum-total">
              <span className="inv-sum-label">إجمالي الرصيد</span>
              <span className="inv-sum-value">{formatCurrency(totalBalance)}</span>
            </div>
          </div>

          {/* ===== Footer ===== */}
          <div className="inv-footer">
            <div className="inv-footer-right">
              <span className="inv-footer-label">تاريخ تحرير الفاتورة:</span>
              <span className="inv-footer-value" dir="ltr">{formatInvoiceDate(invoice.created_at)}</span>
            </div>
            <div className="inv-footer-left">
              تطوير: كشكول &copy; {new Date().getFullYear()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
