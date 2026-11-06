/**
 * AppColors - Centralized Color Palette for Universal POS System
 * Primary Brand Theme: Royal Blue (#0A4174) with Crystal Clear Water Glass / Glassmorphism
 */

export const appColors = {
  // Light Mode Colors (Crystal Clear Water Glass + Royal Blue (#0A4174))
  light: {
    bg: '#F0F5FA',
    card: 'rgba(255, 255, 255, 0.75)',
    cardHover: 'rgba(255, 255, 255, 0.90)',
    table: 'rgba(255, 255, 255, 0.85)',
    form: 'rgba(255, 255, 255, 0.85)',
    secondary: '#E2EDF8',
    primary: '#0A4174',
    primaryHover: '#062E52',
    accent: '#2563EB',
    accentGlow: 'rgba(10, 65, 116, 0.28)',
    text: '#1C2736',
    muted: '#5A6B82',
    border: 'rgba(220, 229, 239, 0.85)',
    borderGlow: 'rgba(255, 255, 255, 0.95)',
    textOnPrimary: '#FFFFFF',
  },

  // Dark Mode Colors (Deep Water Glass / Obsidian Glass with Royal Blue accents)
  dark: {
    bg: '#0A121D',
    card: 'rgba(18, 30, 44, 0.70)',
    cardHover: 'rgba(18, 30, 44, 0.85)',
    table: 'rgba(18, 30, 44, 0.80)',
    form: 'rgba(18, 30, 44, 0.80)',
    secondary: '#1A2A3D',
    primary: '#4A8CD2',
    primaryHover: '#6BA3E0',
    accent: '#60A5FA',
    accentGlow: 'rgba(74, 140, 210, 0.35)',
    text: '#F1F5F9',
    muted: '#94A3B8',
    border: 'rgba(34, 53, 75, 0.80)',
    borderGlow: 'rgba(255, 255, 255, 0.10)',
    textOnPrimary: '#0B131E',
  },

  // Royal Blue Scale (Brand primary)
  primary: {
    50: '#F4F7FB',
    100: '#E2EDF8',
    200: '#C5D8ED',
    300: '#9BBFE0',
    400: '#4A8CD2',
    500: '#0A4174',
    600: '#062E52',
    700: '#052441',
    800: '#041A30',
    900: '#02101F',
    DEFAULT: '#0A4174',
  },

  secondary: {
    50: '#F4F7FB',
    100: '#E2EDF8',
    200: '#C5D8ED',
    300: '#9BBFE0',
    400: '#4A8CD2',
    500: '#0A4174',
    DEFAULT: '#E2EDF8',
  },

  surface: {
    light: '#FFFFFF',
    lightBg: '#F0F5FA',
    lightSecondary: '#E2EDF8',
    lightBorder: '#DCE5EF',
    dark: '#121E2C',
    darkBg: '#0A121D',
    darkSecondary: '#1A2A3D',
    darkBorder: '#22354B',
  },

  text: {
    mainLight: '#1C2736',
    mutedLight: '#5A6B82',
    mainDark: '#F1F5F9',
    mutedDark: '#94A3B8',
  },

  status: {
    success: '#10b981',
    successBg: '#ecfdf5',
    successBorder: '#a7f3d0',
    warning: '#f59e0b',
    warningBg: '#fffbeb',
    warningBorder: '#fde68a',
    danger: '#ef4444',
    dangerBg: '#fef2f2',
    dangerBorder: '#fecaca',
    info: '#3b82f6',
    infoBg: '#eff6ff',
    infoBorder: '#bfdbfe',
  },
};
