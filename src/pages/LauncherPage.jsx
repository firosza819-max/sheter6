import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Receipt,
  Package,
  FileText,
  LayoutDashboard,
  ChevronLeft,
  Bot,
  Send,
  X,
  Sparkles,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import brandLogo from '@/lib/1000015757.jpg';

const tiles = [
  {
    title: 'لوحة التحكم',
    desc: 'نظرة عامة وإدارة المستخدمين',
    icon: LayoutDashboard,
    to: '/admin',
    gradient: 'from-indigo-500 to-blue-600',
    glow: 'rgba(79, 70, 229, 0.25)',
  },
  {
    title: 'المبيعات',
    desc: 'نقطة بيع سريعة وإصدار فواتير',
    icon: Receipt,
    to: '/sales',
    gradient: 'from-emerald-500 to-teal-600',
    glow: 'rgba(16, 185, 129, 0.25)',
  },
  {
    title: 'المشتريات',
    desc: 'تسجيل فواتير الموردين',
    icon: ShoppingCart,
    to: '/purchases',
    gradient: 'from-blue-500 to-indigo-600',
    glow: 'rgba(59, 130, 246, 0.25)',
  },
  {
    title: 'المخزن',
    desc: 'إدارة الأصناف والكميات',
    icon: Package,
    to: '/inventory',
    gradient: 'from-amber-500 to-orange-600',
    glow: 'rgba(245, 158, 11, 0.25)',
  },
  {
    title: 'الفواتير',
    desc: 'سجل جميع المعاملات',
    icon: FileText,
    to: '/invoices',
    gradient: 'from-violet-500 to-purple-600',
    glow: 'rgba(139, 92, 246, 0.25)',
  },
];

export function LauncherPage() {
  const navigate = useNavigate();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'مرحباً بك! أنا مستشارك الذكي لإدارة المحلات والمخازن والتسويق والماليات. كيف يمكنني مساعدتك في تطوير تجارتك اليوم؟',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // نقطة الـ API المعرفة في مستودع Vercel الخاص بك
  const API_ENDPOINT = 'https://raqa-1zhm.vercel.app/api/chatController';

  const handleSendMessage = async (customPrompt) => {
    const messageToSend = customPrompt || inputMessage;
    if (!messageToSend.trim() || loading) return;

    const newMessages = [...messages, { role: 'user', content: messageToSend }];
    setMessages(newMessages);
    if (!customPrompt) setInputMessage('');
    setLoading(true);

    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          // يتم إرسال سياق شامل يغطي الجوانب التجارية والمالية والتسويقية
          storeData: {
            contextType: 'FULL_STORE_AUDIT_AND_ADVISORY',
            scope: ['inventory', 'sales', 'purchases', 'invoices', 'marketing', 'finance', 'management'],
          },
        }),
      });

      const data = await res.json();
      if (data.reply) {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
      } else {
        throw new Error(data.error || 'حدث خطأ أثناء الاستجابة');
      }
    } catch (err) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `عذراً، حدث خطأ أثناء الاتصال بالمستشار الذكي: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const visible = tiles;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 relative">
      {/* Top Bar with AI Button */}
      <div className="max-w-5xl mx-auto px-6 pt-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Store className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <span className="font-bold text-slate-700 dark:text-slate-200">نظام شاطر</span>
        </div>

        {/* زرار الشات الذكي الأعلى */}
        <button
          onClick={() => setIsChatOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all duration-300"
        >
          <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          <span>المستشار الذكي للتطوير والتقرير</span>
        </button>
      </div>

      {/* Header */}
      <div className="max-w-5xl mx-auto px-6 pt-6 pb-8 text-center">
        <div className="inline-flex items-center justify-center max-w-xs w-full h-auto max-h-80 rounded-2xl overflow-hidden shadow-lg shadow-indigo-500/20 mb-4 card-mount border-2 border-white dark:border-slate-800 bg-black/5 p-2">
          <img src={brandLogo} alt="شاطر" className="w-full h-full object-contain rounded-xl" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white card-mount" style={{ animationDelay: '60ms' }}>
          شاطر
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 card-mount" style={{ animationDelay: '120ms' }}>
          مرحباً — اختر القسم للبدء أو استعن بالمستشار الذكي
        </p>
      </div>

      {/* Icon grid */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {visible.map((t, i) => (
            <button
              key={t.to}
              onClick={() => navigate(t.to)}
              style={{ animationDelay: `${160 + i * 90}ms` }}
              className="group relative card p-6 text-center card-mount overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-xl active:scale-95"
            >
              {/* glow blob */}
              <div
                className="absolute -top-10 -left-10 w-28 h-28 rounded-full opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500"
                style={{ background: t.glow }}
              />
              {/* gradient accent top */}
              <div className={`absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-l ${t.gradient} opacity-50 group-hover:opacity-100 transition-opacity`} />

              <div className="relative flex flex-col items-center gap-3">
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${t.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}
                >
                  <t.icon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">{t.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{t.desc}</p>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 group-hover:gap-2 transition-all duration-300">
                  فتح <ChevronLeft className="w-3.5 h-3.5" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* AI Chat Drawer / Modal */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col justify-between border-r border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-6 h-6 text-amber-300" />
                <div>
                  <h3 className="font-bold text-base">مستشار شاطر للإدارة والماليات</h3>
                  <p className="text-xs text-indigo-100">تحليل المبيعات، المخازن، الاقتصاد والتسويق</p>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Actions Quick Request */}
            <div className="p-3 bg-indigo-50 dark:bg-slate-800/50 flex gap-2 overflow-x-auto">
              <button
                onClick={() => handleSendMessage('اعطني تقريراً شاملاً عن أداء المبيعات والمخزون والتسويق وأهم النصائح لزيادة الأرباح.')}
                className="text-xs bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-full border border-indigo-200 dark:border-slate-600 flex items-center gap-1 whitespace-nowrap hover:bg-indigo-100 transition-colors"
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                تقرير إداري ومالي شامل
              </button>
              <button
                onClick={() => handleSendMessage('كيف يمكنني تنظيم خطة تسويقية مجانية لزيادة مبيعات المحل والتخلص من البضاعة الراكدة؟')}
                className="text-xs bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-full border border-indigo-200 dark:border-slate-600 flex items-center gap-1 whitespace-nowrap hover:bg-indigo-100 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                خطة تسويق وتنشيط مبيعات
              </button>
            </div>

            {/* Chat Content */}
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
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 p-3 rounded-2xl flex items-center gap-2 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    جاري تحليل البيانات وإعداد الاستشارة المالية والتسويقية...
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
                placeholder="اسأل المستشار المالي والتسويقي هنا..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={loading || !inputMessage.trim()}
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
