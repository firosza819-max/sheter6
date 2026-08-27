import { Store } from 'lucide-react';

export function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center shadow-md shadow-indigo-500/30">
        <Store className="w-5 h-5 text-white" />
      </div>
      <div className="leading-tight">
        <div className="text-xl font-extrabold text-slate-800 dark:text-white">شاطر</div>
        <div className="text-[10px] text-slate-400 font-medium">إدارة المتجر</div>
      </div>
    </div>
  );
}
