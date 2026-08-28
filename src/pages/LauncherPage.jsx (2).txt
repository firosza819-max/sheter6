import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Receipt,
  Package,
  FileText,
  LayoutDashboard,
  ChevronLeft,
  Store,
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

  const visible = tiles;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-6 pt-12 pb-8 text-center">
        <div className="inline-flex items-center justify-center max-w-xs w-full h-auto max-h-80 rounded-2xl overflow-hidden shadow-lg shadow-indigo-500/20 mb-4 card-mount border-2 border-white dark:border-slate-800 bg-black/5 p-2">
          <img src={brandLogo} alt="شاطر" className="w-full h-full object-contain rounded-xl" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white card-mount" style={{ animationDelay: '60ms' }}>
          شاطر
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 card-mount" style={{ animationDelay: '120ms' }}>
          مرحباً — اختر القسم للبدء
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
    </div>
  );
}
