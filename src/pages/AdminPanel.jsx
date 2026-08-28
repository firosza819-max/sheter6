import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  Wallet,
  ArrowRightLeft,
  Loader2,
  ShoppingCart,
  FileText,
  BarChart3,
  ChevronLeft,
  Bot,
  Send,
  X,
  Sparkles,
} from 'lucide-react';
import { fetchStats } from '@/services/dbService';
import { formatCurrency, formatNumber } from '@/lib/format';
import { useToast } from '@/context/ToastContext';

export function AdminPanel() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // حالة الشات الذكي
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'مرحباً بك! أنا مستشارك الذكي المالي والإداري والتسويقي. كيف يمكنني مساعدتك اليوم في تحليل وتطوير أعمال متجرك؟',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // رابط نقطة الـ API المعتمد على Vercel
  const API_ENDPOINT = 'https://raqa-1zhm.vercel.app/api/chatController';

  async function loadAll() {
    setLoading(true);
    try {
      const s = await fetchStats();
      setStats(s);
    } catch (e) {
      toast('تعذّر تحميل البيانات', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const handleSendMessage = async (customPrompt) => {
    const messageToSend = customPrompt || inputMessage;
    if (!messageToSend.trim() || chatLoading) return;

    const newMessages = [...messages, { role: 'user', content: messageToSend }];
    setMessages(newMessages);
    if (!customPrompt) setInputMessage('');
    setChatLoading(true);

    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          // إرسال الإحصائيات الحالية المتوفرة بالنظام للمستشار للتحليل
          storeData: {
            contextType: 'FULL_STORE_BUSINESS_AUDIT',
            stats: stats || {},
            scope: ['sales', 'purchases', 'inventory', 'invoices', 'marketing', 'finance', 'management'],
          },
        }),
      });

      const data = await res.json();
      if (data.reply) {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
      } else {
        throw new Error(data.error || 'فشل الحصول على رد من السيرفر');
      }
    } catch (err) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `عذراً، تعذر الاتصال بالمستشار الذكي: ${err.message}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  const statCards = [
    {
      label: 'إجمالي المبيعات',
      value: formatCurrency(stats.totalRevenue),
      icon: TrendingUp,
      color: 'from-emerald-500 to-green-600',
      ring: 'bg-emerald-50 dark:bg-emerald-950/40',
      accent: 'from-emerald-400 to-green-500',
    },
    {
      label: 'إجمالي المشتريات',
      value: formatCurrency(stats.totalPurchases),
      icon: TrendingDown,
      color: 'from-blue-500 to-indigo-600',
      ring: 'bg-blue-50 dark:bg-blue-950/40',
      accent: 'from-blue-400 to-indigo-500',
    },
    {
      label: 'قيمة المخزون',
      value: formatCurrency(stats.inventoryValue),
      icon: Wallet,
      color: 'from-amber-500 to-orange-600',
      ring: 'bg-amber-50 dark:bg-amber-950/40',
      accent: 'from-amber-400 to-orange-500',
    },
    {
      label: 'تنبيهات نقص المخزون',
      value: formatNumber(stats.lowStock) + ' صنف',
      icon: AlertTriangle,
      color: 'from-rose-500 to-red-600',
      ring: 'bg-rose-50 dark:bg-rose-950/40',
      accent: 'from-rose-400 to-red-500',
    },
  ];

  const sectionCards = [
    {
      title: 'المبيعات',
      desc: 'نقطة بيع سريعة وإصدار فواتير',
      icon: ShoppingCart,
      to: '/sales',
      gradient: 'from-emerald-500 to-teal-600',
      badge: 'POS',
    },
    {
      title: 'المشتريات',
      desc: 'تسجيل فواتير الموردين',
      icon: ArrowRightLeft,
      to: '/purchases',
      gradient: 'from-blue-500 to-indigo-600',
      badge: 'شراء',
    },
    {
      title: 'المخزن',
      desc: 'إدارة الأصناف والكميات',
      icon: Package,
      to: '/inventory',
      gradient: 'from-amber-500 to-orange-600',
      badge: 'مخزون',
    },
    {
      title: 'الفواتير',
      desc: 'سجل جميع المعاملات',
      icon: FileText,
      to: '/invoices',
      gradient: 'from-violet-500 to-purple-600',
      badge: 'سجل',
    },
    {
      title: 'التقارير',
      desc: 'تحليلات وإحصائيات الأداء',
      icon: BarChart3,
      to: '/admin',
      gradient: 'from-cyan-500 to-blue-600',
      badge: 'تحليل',
    },
  ];

  return (
    <div className="space-y-8 relative">
      {/* Header مع زر الشات الذكي الأعلى */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 card-mount" style={{ animationDelay: '0ms' }}>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">لوحة التحكم</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            نظرة عامة على أداء متجرك وإدارته
          </p>
        </div>

        {/* زرار الشات الذكي */}
        <button
          onClick={() => setIsChatOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all duration-300 self-start sm:self-auto"
        >
          <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          <span>المستشار الذكي (إدارة وتسويق)</span>
        </button>
      </div>

      {/* Stat cards — staggered mount + hover lift */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((c, i) => (
          <div
            key={c.label}
            className="card p-5 relative overflow-hidden stat-card card-mount"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className={`absolute -top-8 -left-8 w-24 h-24 rounded-full ${c.ring}`} />
            <div
              className={`absolute bottom-0 right-0 left-0 h-1 bg-gradient-to-l ${c.accent} opacity-70`}
            />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">{c.label}</div>
                <div className="text-2xl font-extrabold mt-2 text-slate-800 dark:text-white">{c.value}</div>
              </div>
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center shadow-md`}
              >
                <c.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Section cards grid — the main navigation grid */}
      <div>
        <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 card-mount" style={{ animationDelay: '320ms' }}>
          أقسام النظام
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sectionCards.map((s, i) => (
            <button
              key={s.title}
              onClick={() => navigate(s.to)}
              className="card section-card p-6 text-right relative overflow-hidden card-mount group"
              style={{ animationDelay: `${360 + i * 80}ms` }}
            >
              {/* gradient accent line top */}
              <div className={`absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-l ${s.gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />
              {/* glow blob */}
              <div className={`absolute -top-12 -left-12 w-32 h-32 rounded-full bg-gradient-to-br ${s.gradient} opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500`} />

              <div className="relative flex items-start gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-lg shrink-0 group-hover:scale-110 transition-transform duration-300`}
                >
                  <s.icon className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">{s.title}</h3>
                    <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px]">
                      {s.badge}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
                <ChevronLeft className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:-translate-x-1 transition-all duration-300 shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Inventory summary */}
      <div className="card p-5 card-mount" style={{ animationDelay: '840ms' }}>
        <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-indigo-600" /> ملخص المخزون
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between text-sm"><span className="text-slate-500">عدد الأصناف</span><span className="font-bold">{formatNumber(stats.productCount)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">أصناف منخفضة</span><span className="font-bold text-rose-600 dark:text-rose-400">{formatNumber(stats.lowStock)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">قيمة المخزون</span><span className="font-bold">{formatCurrency(stats.inventoryValue)}</span></div>
        </div>
      </div>

      {/* AI Chat Drawer / Modal */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col justify-between border-r border-slate-200 dark:border-slate-800">
            {/* Chat Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-6 h-6 text-amber-300" />
                <div>
                  <h3 className="font-bold text-base">مستشار شاطر للإدارة والماليات</h3>
                  <p className="text-xs text-indigo-100">مبيعات، مشتريات، مخازن، تسويق واقتصاد</p>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="p-3 bg-indigo-50 dark:bg-slate-800/50 flex gap-2 overflow-x-auto">
              <button
                onClick={() =>
                  handleSendMessage('حلل لي إحصائيات النظام الحالية وأعطني تقريراً شاملاً لتطوير الأداء وزيادة الأرباح.')
                }
                className="text-xs bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-full border border-indigo-200 dark:border-slate-600 flex items-center gap-1 whitespace-nowrap hover:bg-indigo-100 transition-colors"
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                تحليل أداء النظام وإصدار تقرير
              </button>
              <button
                onClick={() =>
                  handleSendMessage('كيف يمكنني تنظيم إدارة المخزون وتفادي النقص أو الراكد والتسويق لمنتجاتي بشكل أفضل؟')
                }
                className="text-xs bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-full border border-indigo-200 dark:border-slate-600 flex items-center gap-1 whitespace-nowrap hover:bg-indigo-100 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                خطة إدارة وتكبير المبيعات
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 p-3 rounded-2xl flex items-center gap-2 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    جاري تحليل البيانات وإعداد التوصيات الإدارية...
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="اسأل المستشار المالي، التسويقي أو الإداري..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={chatLoading || !inputMessage.trim()}
                className="p-2.5 rounded-xl bg-indigo-600 text-white disabled:opacity-50 hover:bg-indigo-700 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
