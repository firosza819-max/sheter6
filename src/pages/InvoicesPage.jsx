import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { 
  FileText, 
  Search, 
  Loader2, 
  Download, 
  Users, 
  List, 
  ChevronDown, 
  ChevronUp,
  Eye,
  Trash2,
  X
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  fetchInvoices, 
  fetchInvoiceItems, 
  fetchInventory,
  deleteInvoice 
} from '@/services/dbService';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, formatDateShort } from '@/lib/format';

export function InvoicesPage() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [expandedRows, setExpandedRows] = useState({});
  const [viewMode, setViewMode] = useState('grouped');

  const [pdfModalData, setPdfModalData] = useState(null);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const printRef = useRef(null);

  const productMap = useMemo(() => {
    const map = new Map();
    (products || []).forEach((p) => {
      if (p.id) map.set(String(p.id), p);
      if (p.sku) map.set(String(p.sku), p);
    });
    return map;
  }, [products]);

  // دالة استخراج اسم الطرف
  const getPartyName = useCallback((inv) => {
    if (!inv) return null;

    const candidates = [
      inv.party_name,
      inv.partyName,
      inv.customer_name,
      inv.customerName,
      inv.client_name,
      inv.supplier_name,
      inv.party,
      inv.customer,
      inv.supplier,
      inv.client
    ];

    for (const val of candidates) {
      if (
        val !== null && 
        val !== undefined && 
        String(val).trim() !== '' && 
        String(val).trim().toLowerCase() !== 'null' &&
        String(val).trim().toLowerCase() !== 'undefined'
      ) {
        return String(val).trim();
      }
    }

    return null;
  }, []);

  // دالة استخراج العملة الخاصة بالفاتورة
  const getInvoiceCurrency = useCallback((inv) => {
    if (!inv) return undefined;
    return inv.currency || inv.currency_code || inv.currency_symbol || inv.currencySymbol || undefined;
  }, []);

  const extractItems = useCallback((data) => {
    if (!data) return [];
    let parsedData = data;
    if (typeof parsedData === 'string') {
      try {
        parsedData = JSON.parse(parsedData);
      } catch (e) {
        return [];
      }
    }
    if (Array.isArray(parsedData)) return parsedData;
    if (Array.isArray(parsedData.data)) return parsedData.data;
    if (Array.isArray(parsedData.items)) return parsedData.items;
    if (Array.isArray(parsedData.invoice_items)) return parsedData.invoice_items;
    return [];
  }, []);

  const resolveItemDetails = useCallback((item, parentInv) => {
    const prodId = item.product_id || item.item_id || item.id;
    const matchedProd = productMap.get(String(prodId));

    const name = item.product_name || item.item_name || item.name || matchedProd?.name || parentInv?.name || item.description || 'صنف غير مسمى';
    const category = item.category || matchedProd?.category || parentInv?.category || 'عام';
    
    return {
      ...item,
      resolvedName: name,
      resolvedCategory: category,
      resolvedProductId: item.product_sku || item.sku || matchedProd?.sku || (prodId ? `PROD-${prodId}` : '-')
    };
  }, [productMap]);

  const ensureInvoiceItems = useCallback(async (inv) => {
    let currentItems = extractItems(inv.items || inv.invoice_items);
    if (currentItems.length === 0 && inv.id) {
      try {
        const fetched = await fetchInvoiceItems(inv.id);
        currentItems = extractItems(fetched);
      } catch (e) {
        currentItems = [];
      }
    }
    return { ...inv, items: currentItems };
  }, [extractItems]);

  async function loadData() {
    setLoading(true);
    try {
      const [invRes, prodRes] = await Promise.all([
        fetchInvoices(), 
        fetchInventory()
      ]);

      const rawInvoices = extractItems(invRes);
      setProducts(prodRes || []);

      const resolvedInvoices = await Promise.all(
        rawInvoices.map((inv) => ensureInvoiceItems(inv))
      );

      setInvoices(resolvedInvoices);
    } catch (e) {
      toast('تعذّر تحميل البيانات', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteInvoice = async (invId) => {
    if (!window.confirm('هل أنت تأكد من رغبتك في حذف هذه الفاتورة؟')) return;
    
    setDeletingId(invId);
    try {
      await deleteInvoice(invId);
      setInvoices((prev) => prev.filter((inv) => inv.id !== invId));
      toast('تم حذف الفاتورة بنجاح', 'success');
    } catch (e) {
      toast('تعذّر حذف الفاتورة', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleRow = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (typeFilter !== 'all' && inv.type !== typeFilter) return false;
      const partyName = getPartyName(inv) || '';
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const invNum = String(inv.invoice_number ?? `INV-${inv.id}`).toLowerCase();
        const itemsList = extractItems(inv.items);
        const hasMatchingProduct = itemsList.some((item) => {
          const resolved = resolveItemDetails(item, inv);
          return resolved.resolvedName.toLowerCase().includes(query);
        });
        if (!invNum.includes(query) && !partyName.toLowerCase().includes(query) && !hasMatchingProduct) return false;
      }
      const d = inv.created_at ? new Date(inv.created_at).getTime() : 0;
      if (dateFrom && d < new Date(dateFrom).getTime()) return false;
      if (dateTo && d > new Date(dateTo).getTime() + 86400000) return false;
      return true;
    });
  }, [invoices, typeFilter, search, dateFrom, dateTo, getPartyName, extractItems, resolveItemDetails]);

  const groupedByParty = useMemo(() => {
    const groups = {};

    filteredInvoices.forEach((inv) => {
      const rawName = getPartyName(inv) || 'بدون اسم';
      const key = rawName.toLowerCase();
      const invCurrency = getInvoiceCurrency(inv);

      if (!groups[key]) {
        groups[key] = {
          key,
          party_name: rawName,
          currency: invCurrency,
          invoice_count: 0,
          invoices: [],
          total_sum: 0,
          tax_sum: 0,
          paid_sum: 0,
          remaining_sum: 0,
        };
      }

      const invTotal = Number(inv.total_amount || 0);
      const invTax = Number(inv.tax_amount || 0);
      const invPaid = Number(inv.paid_amount || 0);
      const invRemaining = Number(inv.remaining_amount ?? (invTotal - invPaid));

      groups[key].invoice_count += 1;
      groups[key].invoices.push(inv);
      groups[key].total_sum += invTotal;
      groups[key].tax_sum += invTax;
      groups[key].paid_sum += invPaid;
      groups[key].remaining_sum += invRemaining;
    });

    return Object.values(groups);
  }, [filteredInvoices, getPartyName, getInvoiceCurrency]);

  const preparePdfData = async (target, type) => {
    setIsPreparingPdf(true);
    try {
      if (type === 'group') {
        const fullInvoices = await Promise.all(
          target.invoices.map((inv) => ensureInvoiceItems(inv))
        );

        const rows = [];
        fullInvoices.forEach((inv) => {
          const items = extractItems(inv.items);
          const invCurr = getInvoiceCurrency(inv) || target.currency;

          if (items.length > 0) {
            items.forEach((item) => {
              const details = resolveItemDetails(item, inv);
              const qty = Number(item.quantity || item.qty || 1);
              const unitPrice = Number(item.unit_price || item.price || 0);
              rows.push({
                invNum: inv.invoice_number || `INV-${inv.id}`,
                type: (inv.type === 'PURCHASE' || inv.type === 'شراء') ? 'مشتريات' : 'مبيعات',
                date: formatDateShort(inv.created_at),
                code: details.resolvedProductId,
                name: details.resolvedName,
                category: details.resolvedCategory,
                qty,
                unitPrice: formatCurrency(unitPrice, invCurr),
                subtotal: formatCurrency(qty * unitPrice, invCurr),
              });
            });
          } else {
            rows.push({
              invNum: inv.invoice_number || `INV-${inv.id}`,
              type: (inv.type === 'PURCHASE' || inv.type === 'شراء') ? 'مشتريات' : 'مبيعات',
              date: formatDateShort(inv.created_at),
              code: '-',
              name: inv.name || 'فاتورة إجمالية',
              category: inv.category || 'عام',
              qty: 1,
              unitPrice: formatCurrency(inv.total_amount || 0, invCurr),
              subtotal: formatCurrency(inv.total_amount || 0, invCurr),
            });
          }
        });

        setPdfModalData({
          title: `كشف حساب مجمع - ${target.party_name}`,
          fileName: `كشف_حساب_${target.party_name}`,
          summary: [
            { label: 'إجمالي الفواتير', value: formatCurrency(target.total_sum, target.currency) },
            { label: 'إجمالي المدفوع', value: formatCurrency(target.paid_sum, target.currency) },
            { label: 'إجمالي المتبقي / الديون', value: formatCurrency(target.remaining_sum, target.currency) },
          ],
          headers: ['رقم الفاتورة', 'النوع', 'التاريخ', 'اسم الصنف', 'التصنيف', 'الكمية', 'السعر', 'الإجمالي'],
          rows: rows.map(r => [r.invNum, r.type, r.date, r.name, r.category, r.qty, r.unitPrice, r.subtotal])
        });
      } else {
        const targetInv = await ensureInvoiceItems(target);
        const items = extractItems(targetInv.items);
        const invCurr = getInvoiceCurrency(targetInv);
        const rows = [];

        if (items.length > 0) {
          items.forEach((item, idx) => {
            const details = resolveItemDetails(item, targetInv);
            const qty = Number(item.quantity || item.qty || 1);
            const unitPrice = Number(item.unit_price || item.price || 0);
            rows.push([
              idx + 1,
              details.resolvedProductId,
              details.resolvedName,
              details.resolvedCategory,
              qty,
              formatCurrency(unitPrice, invCurr),
              formatCurrency(qty * unitPrice, invCurr)
            ]);
          });
        } else {
          rows.push([1, '-', targetInv.name || 'فاتورة بدون عناصر', targetInv.category || 'عام', 1, formatCurrency(targetInv.total_amount || 0, invCurr), formatCurrency(targetInv.total_amount || 0, invCurr)]);
        }

        const total = Number(targetInv.total_amount || 0);
        const paid = Number(targetInv.paid_amount || 0);
        const remaining = Number(targetInv.remaining_amount ?? (total - paid));
        const partyName = getPartyName(targetInv);

        setPdfModalData({
          title: `فاتورة رقم ${targetInv.invoice_number || targetInv.id}${partyName ? ` - ${partyName}` : ''}`,
          fileName: `فاتورة_${targetInv.invoice_number || targetInv.id}`,
          summary: [
            { label: 'إجمالي الفاتورة', value: formatCurrency(total, invCurr) },
            { label: 'المبلغ المدفوع', value: formatCurrency(paid, invCurr) },
            { label: 'المتبقي / الديون', value: formatCurrency(remaining, invCurr) },
          ],
          headers: ['م', 'الكود', 'الصنف', 'التصنيف', 'الكمية', 'السعر', 'الإجمالي'],
          rows
        });
      }
    } catch (e) {
      toast('تعذر إعداد بيانات التقرير', 'error');
    } finally {
      setIsPreparingPdf(false);
    }
  };

  const downloadPDF = async () => {
    if (!printRef.current || !pdfModalData) return;
    setIsDownloading(true);

    try {
      const element = printRef.current;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          const el = clonedDoc.querySelector('[data-pdf-content]');
          if (el) {
            el.style.direction = 'rtl';
            el.style.fontFamily = 'Arial, sans-serif';
          }
          const allTextElements = clonedDoc.querySelectorAll('h1, h2, h3, p, span, td, th');
          allTextElements.forEach((node) => {
            node.style.letterSpacing = 'normal';
          });
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // إضافة الصفحة الأولى
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // التعامل مع متعدد الصفحات تلقائياً إذا كان كشف الحساب طويلاً
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const fileName = `${pdfModalData.fileName}.pdf`;

      // التوافق مع الهواتف المحمولة والمتصفحات العادية
      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // فتح الملف مباشرة في لسان جديد للهواتف لضمان التنزيل/المعاينة
      setTimeout(() => {
        window.open(blobUrl, '_blank');
      }, 100);

      toast('تم تنزيل ملف PDF بنجاح', 'success');
    } catch (e) {
      toast('حدث خطأ أثناء تحميل ملف PDF', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 bg-gray-50 min-h-screen" dir="rtl">
      <div className="text-center mb-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h1 className="text-3xl font-bold text-emerald-700 flex items-center justify-center gap-2">
          <FileText className="w-8 h-8 text-emerald-600" /> شاطر
        </h1>
        <p className="text-gray-500 mt-1 text-xs">نظام معاينة وتصدير تقارير الفواتير والحسابات</p>

        <div className="flex items-center justify-between flex-wrap gap-3 mt-6 pt-4 border-t border-gray-100">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grouped')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                viewMode === 'grouped' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600'
              }`}
            >
              <Users className="w-4 h-4" /> سجل الحسابات المجمع
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                viewMode === 'list' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600'
              }`}
            >
              <List className="w-4 h-4" /> الفواتير المنفردة
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg p-5 border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              className="w-full pl-3 pr-10 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" 
              placeholder="بحث بالاسم أو رقم الفاتورة..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          <div className="flex p-1 bg-gray-100 rounded-lg">
            {[
              ['all', 'الكل'],
              ['PURCHASE', 'المشتريات'],
              ['SALE', 'المبيعات'],
            ].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setTypeFilter(val)}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  typeFilter === val ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div>
            <input 
              type="date" 
              className="w-full px-3 py-2 border rounded-lg text-sm text-gray-600" 
              value={dateFrom} 
              onChange={(e) => setDateFrom(e.target.value)} 
            />
          </div>
          <div>
            <input 
              type="date" 
              className="w-full px-3 py-2 border rounded-lg text-sm text-gray-600" 
              value={dateTo} 
              onChange={(e) => setDateTo(e.target.value)} 
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
        ) : viewMode === 'grouped' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-emerald-700 text-white text-sm">
                  <th className="p-3 whitespace-nowrap">الاسم</th>
                  <th className="p-3 text-center whitespace-nowrap">عدد الفواتير</th>
                  <th className="p-3 whitespace-nowrap">إجمالي الفواتير</th>
                  <th className="p-3 whitespace-nowrap">المدفوع</th>
                  <th className="p-3 whitespace-nowrap">المتبقي</th>
                  <th className="p-3 text-center whitespace-nowrap">الخيارات</th>
                </tr>
              </thead>
              <tbody>
                {groupedByParty.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-500">لا توجد بيانات مطابقة للبحث</td>
                  </tr>
                ) : (
                  groupedByParty.map((group) => (
                    <React.Fragment key={group.key}>
                      <tr className="border-b hover:bg-emerald-50/50 text-sm">
                        <td className="p-3 font-bold text-gray-800 whitespace-nowrap">{group.party_name}</td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-bold">
                            {group.invoice_count}
                          </span>
                        </td>
                        <td className="p-3 font-bold whitespace-nowrap">{formatCurrency(group.total_sum, group.currency)}</td>
                        <td className="p-3 text-emerald-600 font-semibold whitespace-nowrap">{formatCurrency(group.paid_sum, group.currency)}</td>
                        <td className="p-3 text-red-600 font-semibold whitespace-nowrap">{formatCurrency(group.remaining_sum, group.currency)}</td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => preparePdfData(group, 'group')}
                              disabled={isPreparingPdf}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-sm disabled:opacity-50 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" /> عرض PDF
                            </button>
                            <button onClick={() => toggleRow(group.key)} className="p-1 text-gray-500 hover:text-emerald-700">
                              {expandedRows[group.key] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedRows[group.key] && (
                        <tr>
                          <td colSpan={6} className="bg-gray-50 p-4 border-b">
                            <div className="space-y-2">
                              {group.invoices.map((inv) => (
                                <div key={inv.id} className="flex justify-between items-center bg-white p-2.5 rounded border text-xs flex-wrap gap-2">
                                  <span className="font-bold text-gray-700">{inv.invoice_number || `INV-${inv.id}`}</span>
                                  <span className="text-gray-500">{formatDateShort(inv.created_at)}</span>
                                  <span className="font-bold">{formatCurrency(inv.total_amount, getInvoiceCurrency(inv))}</span>
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => preparePdfData(inv, 'single')}
                                      className="text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1"
                                    >
                                      <Eye className="w-3 h-3" /> معاينة
                                    </button>
                                    <button
                                      onClick={() => handleDeleteInvoice(inv.id)}
                                      disabled={deletingId === inv.id}
                                      className="text-red-600 hover:text-red-800 font-bold flex items-center gap-1 disabled:opacity-50"
                                    >
                                      {deletingId === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                      حذف
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-sm">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="p-3 whitespace-nowrap">رقم الفاتورة</th>
                  <th className="p-3 whitespace-nowrap">اسم الطرف</th>
                  <th className="p-3 whitespace-nowrap">التاريخ</th>
                  <th className="p-3 whitespace-nowrap">الإجمالي</th>
                  <th className="p-3 text-center whitespace-nowrap">الخيارات</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-500">لا توجد فواتير مطابقة</td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-bold whitespace-nowrap">{inv.invoice_number || `INV-${inv.id}`}</td>
                      <td className="p-3 font-semibold whitespace-nowrap">{getPartyName(inv) || '-'}</td>
                      <td className="p-3 text-xs text-gray-500 whitespace-nowrap">{formatDateShort(inv.created_at)}</td>
                      <td className="p-3 font-bold whitespace-nowrap">{formatCurrency(inv.total_amount, getInvoiceCurrency(inv))}</td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => preparePdfData(inv, 'single')}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="معاينة"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(inv.id)}
                            disabled={deletingId === inv.id}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="حذف الفاتورة"
                          >
                            {deletingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pdfModalData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden dir-rtl">
            
            <div className="flex justify-between items-center p-4 bg-emerald-700 text-white shrink-0">
              <h2 className="text-base sm:text-lg font-bold">{pdfModalData.title}</h2>
              <button 
                onClick={() => setPdfModalData(null)}
                className="p-1 hover:bg-emerald-800 rounded-lg text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-white">
              <div className="w-full overflow-x-auto" ref={printRef}>
                <div data-pdf-content className="min-w-[700px] p-4 bg-white border rounded-lg" style={{ direction: 'rtl' }}>
                  
                  <div className="border-b-2 border-emerald-600 pb-4 mb-4 text-center">
                    <h1 className="text-3xl font-extrabold text-emerald-700 mb-1">شاطر</h1>
                    <h2 className="text-xl font-bold text-gray-800">{pdfModalData.title}</h2>
                    <p className="text-xs text-gray-500 mt-1">تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
                  </div>

                  <table className="w-full text-right border-collapse border border-gray-300 text-xs mb-6">
                    <thead>
                      <tr className="bg-emerald-700 text-white">
                        {pdfModalData.headers.map((h, i) => (
                          <th key={i} className="p-2.5 border border-emerald-600 font-bold text-center whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pdfModalData.rows.map((row, rIdx) => (
                        <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="p-2 border border-gray-200 text-center text-gray-800 font-medium whitespace-nowrap">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="grid grid-cols-3 gap-4 mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    {pdfModalData.summary.map((item, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border border-emerald-100 text-center shadow-sm">
                        <span className="block text-xs text-gray-600 font-semibold">{item.label}</span>
                        <span className="block text-base font-bold text-emerald-800 mt-1">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-8 pt-4 border-t border-gray-300 mt-6 text-sm">
                    <div className="text-center font-bold text-gray-700 space-y-8">
                      <p>توقيع المحاسب: ....................................</p>
                    </div>
                    <div className="text-center font-bold text-gray-700 space-y-8">
                      <p>توقيع المستلم: ....................................</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 shrink-0">
              <button
                onClick={() => setPdfModalData(null)}
                className="px-4 py-2 border rounded-lg text-gray-600 text-sm font-semibold hover:bg-gray-100"
              >
                إغلاق
              </button>
              <button
                onClick={downloadPDF}
                disabled={isDownloading}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                تحميل PDF
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
