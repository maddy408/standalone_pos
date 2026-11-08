/**
 * theme.js — Centralized UI Design Tokens & Component Classes
 *
 * Use these constants across all pages and components for unified:
 * - Button styles (primary, secondary, danger, ghost, pill)
 * - Card styles (card, cardHeader, cardBody)
 * - Input & Select styles
 * - App Header, Navbar & Pill styles
 * - Brand Color Tokens
 */

export const theme = {
  // Brand Color Palette Codes
  colors: {
    primary: '#0A4174',
    primaryHover: '#062E52',
    primaryDark: '#4A8CD2',
    primaryDarkHover: '#6BA3E0',
    borderLight: '#DCE5EF',
    borderDark: '#22354B',
    surfaceLight: '#FFFFFF',
    surfaceDark: '#121E2C',
    surfaceAltLight: '#F4F7FB',
    surfaceAltDark: '#1A2A3D',
    textMainLight: '#1C2736',
    textMainDark: '#F1F5F9',
    textMutedLight: '#5A6B82',
    textMutedDark: '#94A3B8',
  },

  // 1. App Header & Navbar
  header: {
    appBar: 'h-14 water-glass-header px-4 sm:px-6 md:px-8 flex items-center justify-between gap-4 w-full flex-shrink-0 z-30',
    navBar: 'h-11 px-4 sm:px-6 md:px-8 border-b border-[#DCE5EF] dark:border-[#22354B] bg-white/70 dark:bg-[#0B131E]/60 backdrop-blur-md flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-thin z-20 flex-shrink-0',
    navItem: (isActive) =>
      `h-8 px-2.5 xl:px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 tracking-normal transition-all flex-shrink-0 whitespace-nowrap ${
        isActive
          ? 'bg-[#0A4174] text-white shadow-md font-bold dark:bg-[#4A8CD2] dark:text-[#0B131E]'
          : 'text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8]/80 dark:hover:bg-[#1A2A3D]'
      }`,
    tabPill: (isActive) =>
      `rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
        isActive
          ? 'bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] shadow-sm'
          : 'text-[#5A6B82] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D]'
      }`,
  },

  // 2. Buttons
  button: {
    primary:
      'px-3.5 py-2 rounded-xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-bold text-xs transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer',
    primarySmall:
      'px-2.5 py-1.5 rounded-lg bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-bold text-[11px] transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer',
    secondary:
      'px-3.5 py-2 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#1C2736] dark:hover:text-[#F1F5F9] hover:bg-[#F4F7FB] dark:hover:bg-[#1A2A3D] text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer',
    danger:
      'px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer',
    dangerGhost:
      'p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer',
    pill:
      'water-glass-pill px-2.5 py-1 rounded-xl text-xs font-semibold text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] transition-colors flex items-center gap-1 cursor-pointer',
    icon:
      'p-1.5 rounded-lg text-[#5A6B82] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] transition-colors cursor-pointer inline-flex items-center justify-center',
  },

  // 3. Cards & Panels
  card: {
    base: 'rounded-2xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] shadow-sm',
    glass: 'water-glass-card rounded-2xl p-4 shadow-sm',
    header: 'p-3.5 border-b border-[#DCE5EF] dark:border-[#22354B] bg-white/40 dark:bg-[#121E2C]/40 flex items-center justify-between',
    body: 'p-4 space-y-3',
    sectionBox: 'p-3 rounded-xl bg-[#F4F7FB]/70 dark:bg-[#1A2A3D]/40 border border-[#DCE5EF]/80 dark:border-[#22354B]',
  },

  // 4. Inputs & Form Controls
  input: {
    base:
      'w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-3 py-2 text-xs text-[#1C2736] dark:text-[#F1F5F9] focus:outline-none focus:ring-1 focus:ring-[#0A4174] dark:focus:ring-[#4A8CD2] placeholder-[#94A3B8] transition-colors',
    select:
      'w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-3 py-2 text-xs text-[#1C2736] dark:text-[#F1F5F9] focus:outline-none focus:ring-1 focus:ring-[#0A4174] dark:focus:ring-[#4A8CD2] transition-colors',
    label: 'block text-xs font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1',
    search:
      'w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white/90 dark:bg-[#121E2C]/90 backdrop-blur-md px-3 py-2 text-xs font-medium text-[#1C2736] dark:text-[#F1F5F9] focus:outline-none focus:ring-2 focus:ring-[#0A4174] dark:focus:ring-[#4A8CD2] shadow-xs placeholder-[#94A3B8]',
  },

  // 5. Tables & Badges
  table: {
    container: 'overflow-x-auto border border-[#DCE5EF] dark:border-[#22354B] rounded-xl',
    table: 'min-w-full text-xs text-left',
    thead: 'bg-[#F4F7FB] dark:bg-[#1A2A3D] text-[#5A6B82] dark:text-[#94A3B8] font-bold border-b border-[#DCE5EF] dark:border-[#22354B]',
    th: 'px-3 py-2.5 font-bold',
    td: 'px-3 py-2.5 border-t border-[#DCE5EF]/60 dark:border-[#22354B]/60 text-[#1C2736] dark:text-[#F1F5F9]',
  },

  badge: {
    success: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded text-[10px]',
    warning: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded text-[10px]',
    danger: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold px-2 py-0.5 rounded text-[10px]',
    info: 'bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] font-bold px-2 py-0.5 rounded text-[10px]',
  },
};

export default theme;

