import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  FileText,
  Menu,
  X,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  Home,
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { Logo } from '@/components/Logo';

const navItems = [
  { to: '/home', label: 'الرئيسية', icon: Home, end: true },
  { to: '/admin', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
  { to: '/purchases', label: 'المشتريات', icon: ShoppingCart },
  { to: '/sales', label: 'المبيعات', icon: Receipt },
  { to: '/inventory', label: 'المخزن', icon: Package },
  { to: '/invoices', label: 'الفواتير', icon: FileText },
];

export function AppShell({ children }) {
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex fixed top-0 right-0 h-screen w-64 flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 z-30">
        <div className="px-5 py-5 border-b border-slate-200 dark:border-slate-800">
          <Logo />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <div className="px-3 py-2 mb-2 text-xs text-slate-400">نظام إدارة المتجر — كشكول</div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo />
          <div className="flex items-center gap-1">
            <button onClick={toggle} className="btn-ghost p-2">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={() => setOpen(true)} className="btn-ghost p-2">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 animate-fadein" onClick={() => setOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-72 bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-[slidein_0.2s_ease]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <Logo />
              <button onClick={() => setOpen(false)} className="btn-ghost p-2">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Desktop topbar */}
      <div className="hidden lg:flex sticky top-0 z-20 h-16 items-center justify-between px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 lg:mr-64">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {online ? (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Wifi className="w-4 h-4" /> متصل
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <WifiOff className="w-4 h-4" /> وضع عدم الاتصال
            </span>
          )}
        </div>
        <button onClick={toggle} className="btn-ghost p-2">
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      {/* Main */}
      <main className="lg:mr-64">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
