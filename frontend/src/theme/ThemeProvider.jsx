import { createContext, useContext, useEffect, useState } from 'react';
import { appColors } from './appColors';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('pos_theme') || 'light');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('pos_theme', theme);

    // Always apply water glass theme styling
    root.classList.add('glass-theme');

    // Synchronize CSS custom properties from centralized appColors
    const p = theme === 'dark' ? appColors.dark : appColors.light;
    root.style.setProperty('--bg-main', p.bg);
    root.style.setProperty('--card-bg', p.card);
    root.style.setProperty('--secondary-surface', p.secondary);
    root.style.setProperty('--border-color', p.border);
    root.style.setProperty('--text-main', p.text);
    root.style.setProperty('--text-secondary', p.muted);
    root.style.setProperty('--primary-color', p.primary);
    root.style.setProperty('--primary-hover', p.primaryHover);
    root.style.setProperty('--text-on-primary', p.textOnPrimary);
  }, [theme]);

  const setTheme = (t) => setThemeState(t);
  const toggleTheme = () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        colors: appColors,
      }}
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

export { appColors };
