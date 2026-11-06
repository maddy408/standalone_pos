/**
 * AppColors - Centralized Color Palette for Universal POS System
 * Themes supported:
 * 1. Royal Blue ('blue') - Elegant corporate POS
 * 2. Amber / Tangerine Glow ('amber') - Inspired by Glassy Dashboard V2 (Instagram reel)
 */

export const colorSchemes = {
  blue: {
    name: 'Royal Blue',
    light: {
      bg: '#F4F7FB',
      card: 'rgba(255, 255, 255, 0.85)',
      table: 'rgba(255, 255, 255, 0.90)',
      form: '#FFFFFF',
      secondary: '#E2EDF8',
      primary: '#0A4174',
      primaryHover: '#062E52',
      primaryLight: '#E2EDF8',
      accent: '#3B82F6',
      accentGlow: 'rgba(10, 65, 116, 0.25)',
      text: '#1C2736',
      muted: '#5A6B82',
      border: 'rgba(220, 229, 239, 0.85)',
      textOnPrimary: '#FFFFFF',
    },
    dark: {
      bg: '#0B131E',
      card: 'rgba(18, 30, 44, 0.75)',
      table: 'rgba(18, 30, 44, 0.85)',
      form: '#121E2C',
      secondary: '#1A2A3D',
      primary: '#4A8CD2',
      primaryHover: '#6BA3E0',
      primaryLight: '#1A2A3D',
      accent: '#60A5FA',
      accentGlow: 'rgba(74, 140, 210, 0.3)',
      text: '#F1F5F9',
      muted: '#94A3B8',
      border: 'rgba(34, 53, 75, 0.85)',
      textOnPrimary: '#0B131E',
    },
  },
  amber: {
    name: 'Amber Glass (Glassy V2)',
    light: {
      bg: '#FFF8F2',
      card: 'rgba(255, 255, 255, 0.82)',
      table: 'rgba(255, 255, 255, 0.90)',
      form: '#FFFFFF',
      secondary: '#FFEDD5',
      primary: '#EA580C', // Tangerine / Warm Amber
      primaryHover: '#C2410C',
      primaryLight: '#FFF1E7',
      accent: '#F97316',
      accentGlow: 'rgba(249, 115, 22, 0.35)',
      text: '#29180E',
      muted: '#7C675B',
      border: 'rgba(254, 215, 170, 0.75)',
      textOnPrimary: '#FFFFFF',
    },
    dark: {
      bg: '#140D09',
      card: 'rgba(35, 20, 14, 0.75)',
      table: 'rgba(35, 20, 14, 0.85)',
      form: '#23140E',
      secondary: '#361D12',
      primary: '#FB923C',
      primaryHover: '#FDBA74',
      primaryLight: '#361D12',
      accent: '#F97316',
      accentGlow: 'rgba(251, 146, 60, 0.35)',
      text: '#FFF7ED',
      muted: '#B09A8B',
      border: 'rgba(87, 43, 24, 0.85)',
      textOnPrimary: '#140D09',
    },
  },
};

// Default export backward compatibility
export const appColors = {
  light: colorSchemes.blue.light,
  dark: colorSchemes.blue.dark,

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
    lightBg: '#F4F7FB',
    lightSecondary: '#E2EDF8',
    lightBorder: '#DCE5EF',
    dark: '#121E2C',
    darkBg: '#0B131E',
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
