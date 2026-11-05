/**
 * AppColors - Centralized Color Palette for Universal POS System
 * Theme: White + Royal Blue
 * 
 * Single source of truth for application colors in both Light and Dark modes.
 */

export const appColors = {
  // Light Mode Colors (White dominant with Royal Blue (#0A4174) accents)
  light: {
    bg: '#F4F7FB',
    card: '#FFFFFF',
    table: '#FFFFFF',
    form: '#FFFFFF',
    secondary: '#E2EDF8',
    primary: '#0A4174',
    primaryHover: '#062E52',
    text: '#1C2736',
    muted: '#5A6B82',
    border: '#DCE5EF',
    textOnPrimary: '#FFFFFF',
  },

  // Dark Mode Colors (Deep dark surfaces with royal blue accents)
  dark: {
    bg: '#0B131E',
    card: '#121E2C',
    table: '#121E2C',
    form: '#121E2C',
    secondary: '#1A2A3D',
    primary: '#4A8CD2',
    primaryHover: '#6BA3E0',
    text: '#F1F5F9',
    muted: '#94A3B8',
    border: '#22354B',
    textOnPrimary: '#0B131E',
  },

  // Royal Blue Scale (Brand primary)
  primary: {
    50: '#F4F7FB',
    100: '#E2EDF8',
    200: '#C5D8ED',
    300: '#9BBFE0',
    400: '#4A8CD2', // Dark mode primary blue accent
    500: '#0A4174', // Primary Royal Blue
    600: '#062E52', // Hover Royal Blue
    700: '#052441',
    800: '#041A30',
    900: '#02101F',
    DEFAULT: '#0A4174',
  },

  // Secondary Blue Surface Scale
  secondary: {
    50: '#F4F7FB',
    100: '#E2EDF8',
    200: '#C5D8ED',
    300: '#9BBFE0',
    400: '#4A8CD2',
    500: '#0A4174',
    DEFAULT: '#E2EDF8',
  },

  // Neutral surfaces
  surface: {
    light: '#FFFFFF',
    lightBg: '#F4F7FB',
    lightSecondary: '#E2EDF8',
    lightBorder: '#DCE5EF',
    dark: '#121E2C',
    darkBg: '#0B131E',
    darkSecondary: '#1A2A3D',
    darkBorder: '#22354B',
  },

  // Typography
  text: {
    mainLight: '#1C2736',
    mutedLight: '#5A6B82',
    mainDark: '#F1F5F9',
    mutedDark: '#94A3B8',
  },

  // Semantic Status Colors (Preserved)
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

  // Payment method badge colors
  payment: {
    cash: '#10b981',
    upi: '#0A4174',
    card: '#3b82f6',
    credit: '#f59e0b',
  },
};

export default appColors;
