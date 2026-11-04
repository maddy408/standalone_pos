/**
 * AppColors - Centralized Color Palette for Universal POS System
 * 
 * Use these constants across components, inline styles, canvas receipts,
 * charts, or configure directly into Tailwind / CSS variables.
 */

export const appColors = {
  // Primary Brand Colors (Amber / Gold theme from Finance & POS standard)
  primary: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b', // Default Amber Primary
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
    DEFAULT: '#f59e0b',
  },

  // Secondary Brand Accent (Indigo / Deep Blue)
  secondary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    DEFAULT: '#4f46e5',
  },

  // Dark & Neutral Backgrounds (Slate)
  surface: {
    light: '#ffffff',
    lightAlt: '#f8fafc',
    lightBorder: '#e2e8f0',
    dark: '#0f172a',      // slate-900
    darkAlt: '#020617',   // slate-950
    darkBorder: '#1e293b',// slate-800
    sidebar: '#0f172a',
  },

  // Typography Colors
  text: {
    mainLight: '#0f172a',   // slate-900
    mutedLight: '#64748b',  // slate-500
    subtleLight: '#94a3b8', // slate-400
    mainDark: '#f8fafc',    // slate-50
    mutedDark: '#94a3b8',   // slate-400
    subtleDark: '#64748b',  // slate-500
  },

  // Status & Transaction Colors
  status: {
    success: '#10b981',    // emerald-500
    successBg: '#ecfdf5',  // emerald-50
    successDarkBg: 'rgba(6, 78, 59, 0.4)',
    warning: '#f59e0b',    // amber-500
    warningBg: '#fffbeb',  // amber-50
    warningDarkBg: 'rgba(120, 53, 15, 0.4)',
    danger: '#ef4444',     // red-500
    dangerBg: '#fef2f2',   // red-50
    dangerDarkBg: 'rgba(127, 29, 29, 0.4)',
    info: '#3b82f6',       // blue-500
    infoBg: '#eff6ff',     // blue-50
    infoDarkBg: 'rgba(30, 58, 138, 0.4)',
  },

  // POS Payment Method Tags
  payment: {
    cash: '#10b981',   // Emerald
    upi: '#6366f1',    // Indigo
    card: '#0ea5e9',   // Sky
    credit: '#f59e0b', // Amber
  },
};

export default appColors;

