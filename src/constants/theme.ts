/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';
import { useAppStore } from '../store/store';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const THEMES = {
  lotus: {
    key: 'lotus' as const,
    name: 'Lotus Pink 🌸',
    primary: '#FF2366',
    secondary: '#FF4D6D',
    bgGradient: ['#1a1015', '#121214'] as const,
    bgElement: 'rgba(30, 20, 25, 0.8)',
    bgSelected: 'rgba(255, 35, 102, 0.15)',
    text: '#ffffff',
    textSecondary: '#aaa',
    tint: '#FF2366',
  },
  emerald: {
    key: 'emerald' as const,
    name: 'Emerald Green 🌿',
    primary: '#10B981',
    secondary: '#059669',
    bgGradient: ['#071A13', '#030A08'] as const,
    bgElement: 'rgba(11, 37, 27, 0.8)',
    bgSelected: 'rgba(16, 185, 129, 0.15)',
    text: '#ffffff',
    textSecondary: '#a7f3d0',
    tint: '#10B981',
  },
  lavender: {
    key: 'lavender' as const,
    name: 'Midnight Lavender 🌌',
    primary: '#8B5CF6',
    secondary: '#7C3AED',
    bgGradient: ['#0F0C1B', '#050409'] as const,
    bgElement: 'rgba(25, 20, 44, 0.8)',
    bgSelected: 'rgba(139, 92, 246, 0.15)',
    text: '#ffffff',
    textSecondary: '#c084fc',
    tint: '#8B5CF6',
  },
  peach: {
    key: 'peach' as const,
    name: 'Sunset Peach 🍑',
    primary: '#FF7A59',
    secondary: '#EA580C',
    bgGradient: ['#1B120F', '#0D0807'] as const,
    bgElement: 'rgba(41, 28, 23, 0.8)',
    bgSelected: 'rgba(255, 122, 89, 0.15)',
    text: '#ffffff',
    textSecondary: '#fed7aa',
    tint: '#FF7A59',
  },
  gold: {
    key: 'gold' as const,
    name: 'Aura Gold ✨',
    primary: '#D4AF37',
    secondary: '#B8860B',
    bgGradient: ['#121212', '#000000'] as const,
    bgElement: 'rgba(32, 32, 32, 0.8)',
    bgSelected: 'rgba(212, 175, 55, 0.15)',
    text: '#ffffff',
    textSecondary: '#f3e5ab',
    tint: '#D4AF37',
  },
};

export type ThemeType = typeof THEMES[keyof typeof THEMES];

export function useTheme(): ThemeType {
  const themeName = useAppStore(state => state.themeName);
  return THEMES[themeName] || THEMES.lotus;
}

