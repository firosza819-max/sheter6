import { createContext, useContext, useEffect, useState } from 'react';
import { storage } from '@/services/storage';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light');

  useEffect(() => {
    (async () => {
      const saved = await storage.loadTheme();
      const t = saved === 'dark' || saved === 'light' ? saved : 'light';
      setThemeState(t);
      applyTheme(t);
    })();
  }, []);

  function applyTheme(t) {
    const root = document.documentElement;
    if (t === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }

  async function setTheme(t) {
    setThemeState(t);
    applyTheme(t);
    await storage.saveTheme(t);
  }

  return (
    <ThemeContext.Provider
      value={{ theme, toggle: () => setTheme(theme === 'light' ? 'dark' : 'light'), setTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
