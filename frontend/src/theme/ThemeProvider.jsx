import { createContext, useContext, useEffect, useState } from 'react';
import { appColors, colorSchemes } from './appColors';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('pos_theme') || 'light');
  const [colorScheme, setColorSchemeState] = useState(() => localStorage.getItem('pos_color_scheme') || 'amber'); // default amber for Glassy V2 experience
  const [isGlassy, setIsGlassyState] = useState(() => localStorage.getItem('pos_glassy') !== 'false');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('pos_theme', theme);

    if (isGlassy) {
      root.classList.add('glass-theme');
    } else {
      root.classList.remove('glass-theme');
    }
    localStorage.setItem('pos_glassy', String(isGlassy));

    root.setAttribute('data-color-scheme', colorScheme);
    localStorage.setItem('pos_color_scheme', colorScheme);

    // Synchronize CSS custom properties from current active colorScheme and mode
    const schemeObj = colorSchemes[colorScheme] || colorSchemes.blue;
    const p = theme === 'dark' ? schemeObj.dark : schemeObj.light;

    root.style.setProperty('--bg-main', p.bg);
    root.style.setProperty('--card-bg', p.card);
    root.style.setProperty('--secondary-surface', p.secondary);
    root.style.setProperty('--border-color', p.border);
    root.style.setProperty('--text-main', p.text);
    root.style.setProperty('--text-secondary', p.muted);
    root.style.setProperty('--primary-color', p.primary);
    root.style.setProperty('--primary-hover', p.primaryHover);
    root.style.setProperty('--primary-light', p.primaryLight);
    root.style.setProperty('--accent-glow', p.accentGlow);
    root.style.setProperty('--text-on-primary', p.textOnPrimary);
  }, [theme, colorScheme, isGlassy]);

  const setTheme = (t) => setThemeState(t);
  const toggleTheme = () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));

  const setColorScheme = (s) => setColorSchemeState(s);
  const toggleColorScheme = () =>
    setColorSchemeState((prev) => (prev === 'amber' ? 'blue' : 'amber'));

  const setIsGlassy = (val) => setIsGlassyState(val);
  const toggleGlassy = () => setIsGlassyState((prev) => !prev);

  const activeColors = (colorSchemes[colorScheme] || colorSchemes.blue)[theme];

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        colorScheme,
        setColorScheme,
        toggleColorScheme,
        isGlassy,
        setIsGlassy,
        toggleGlassy,
        colors: appColors,
        activeColors,
        colorSchemes,
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

export { appColors, colorSchemes };
