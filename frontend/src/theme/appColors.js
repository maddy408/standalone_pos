/**
 * AppColors - Centralized Color Palette for Universal POS System
 * Theme: White + Soft Royal Purple
 * 
 * Single source of truth for application colors in both Light and Dark modes.
 */

export const appColors = {
  // Light Mode Colors (White dominant with Royal Purple accents)
  light: {
    bg: '#F7F5FC',
    card: '#FFFFFF',
    table: '#FFFFFF',
    form: '#FFFFFF',
    secondary: '#EDE7F7',
    primary: '#7652B5',
    primaryHover: '#5B3B91',
    text: '#282431',
    muted: '#716B7C',
    border: '#E8E3EF',
    textOnPrimary: '#FFFFFF',
  },

  // Dark Mode Colors (Deep dark surfaces with lavender-purple accents)
  dark: {
    bg: '#17151D',
    card: '#211D2A',
    table: '#211D2A',
    form: '#211D2A',
    secondary: '#2B2536',
    primary: '#A98ADB',
    primaryHover: '#C0A5EA',
    text: '#F5F2F9',
    muted: '#B8B0C4',
    border: '#393244',
    textOnPrimary: '#17151D',
  },

  // Royal Purple Scale (Brand primary)
  primary: {
    50: '#F7F5FC',
    100: '#EDE7F7',
    200: '#DDD2F0',
    300: '#C5B3E6',
    400: '#A98ADB', // Dark mode primary accent
    500: '#7652B5', // Primary Royal Purple
    600: '#5B3B91', // Hover Purple
    700: '#482D75',
    800: '#341E57',
    900: '#21133B',
    DEFAULT: '#7652B5',
  },

  // Secondary Lavender Surface Scale
  secondary: {
    50: '#F7F5FC',
    100: '#EDE7F7',
    200: '#DDD2F0',
    300: '#C5B3E6',
    400: '#A98ADB',
    500: '#7652B5',
    DEFAULT: '#EDE7F7',
  },

  // Neutral surfaces
  surface: {
    light: '#FFFFFF',
    lightBg: '#F7F5FC',
    lightSecondary: '#EDE7F7',
    lightBorder: '#E8E3EF',
    dark: '#211D2A',
    darkBg: '#17151D',
    darkSecondary: '#2B2536',
    darkBorder: '#393244',
  },

  // Typography
  text: {
    mainLight: '#282431',
    mutedLight: '#716B7C',
    mainDark: '#F5F2F9',
    mutedDark: '#B8B0C4',
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
    upi: '#7652B5',
    card: '#3b82f6',
    credit: '#f59e0b',
  },
};

export default appColors;
