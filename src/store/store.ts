import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { clearPIN } from '../utils/security';

export type PremiumTier = 'free' | 'premium' | 'premium_plus';
export type ThemeMode = 'light' | 'dark' | 'system';
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

export interface ContraceptiveConfig {
  enabled: boolean;
  type: 'pill' | 'ring' | 'patch' | 'injection';
  packModel: '21_7' | '28_0' | 'custom';
  reminderTime: string; // e.g. "21:00"
  pillsInPack: number;
  startDate: string; // YYYY-MM-DD
}

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  birthDate?: string;
  avgCycleLength?: number;
  avgPeriodLength?: number;
}

interface AppState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isPremium: boolean;
  premiumTier: PremiumTier;
  isPregnancyMode: boolean;
  themeMode: ThemeMode;
  themeName: 'lotus' | 'emerald' | 'lavender' | 'peach' | 'gold';
  syncStatus: SyncStatus;
  lastSyncTime: string | null;
  pinEnabled: boolean;
  biometricsEnabled: boolean;
  isOnboarded: boolean;
  sessionUnlocked: boolean;
  
  // Birth Control & Discreet Notifications
  contraceptiveConfig: ContraceptiveConfig;
  discreetNotificationMode: 'standard' | 'water' | 'flower' | 'custom';
  customDiscreetText: string;
  
  // Actions
  setUser: (user: UserProfile | null) => void;
  setPremium: (tier: PremiumTier) => Promise<void>;
  setPregnancyMode: (active: boolean) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setThemeName: (name: 'lotus' | 'emerald' | 'lavender' | 'peach' | 'gold') => Promise<void>;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncTime: (time: string | null) => Promise<void>;
  setSecurityConfig: (pinEnabled: boolean, biometricsEnabled: boolean) => Promise<void>;
  setOnboarded: (isOnboarded: boolean) => Promise<void>;
  setSessionUnlocked: (unlocked: boolean) => void;
  setContraceptiveConfig: (config: Partial<ContraceptiveConfig>) => Promise<void>;
  setDiscreetNotificationMode: (mode: 'standard' | 'water' | 'flower' | 'custom', customText?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadPersistedState: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isPremium: false,
  premiumTier: 'free',
  isPregnancyMode: false,
  themeMode: 'dark',
  themeName: 'lotus',
  syncStatus: 'idle',
  lastSyncTime: null,
  pinEnabled: false,
  biometricsEnabled: false,
  isOnboarded: false,
  sessionUnlocked: false,
  
  // Default values
  contraceptiveConfig: {
    enabled: false,
    type: 'pill',
    packModel: '21_7',
    reminderTime: '21:00',
    pillsInPack: 21,
    startDate: '',
  },
  discreetNotificationMode: 'standard',
  customDiscreetText: '',

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setSessionUnlocked: (sessionUnlocked) => set({ sessionUnlocked }),

  setPremium: async (tier) => {
    const isPremium = tier !== 'free';
    set({ premiumTier: tier, isPremium });
    try {
      await AsyncStorage.setItem('premium_tier', tier);
    } catch (e) {
      console.error('Failed to persist premium tier state:', e);
    }
  },

  setPregnancyMode: async (active) => {
    set({ isPregnancyMode: active });
    try {
      await AsyncStorage.setItem('pregnancy_mode', active ? 'true' : 'false');
    } catch (e) {
      console.error('Failed to persist pregnancy mode state:', e);
    }
  },

  setThemeMode: async (mode) => {
    set({ themeMode: mode });
    try {
      await AsyncStorage.setItem('theme_mode', mode);
    } catch (e) {
      console.error('Failed to persist theme state:', e);
    }
  },

  setThemeName: async (name) => {
    set({ themeName: name });
    try {
      await AsyncStorage.setItem('theme_name', name);
    } catch (e) {
      console.error('Failed to persist theme name state:', e);
    }
  },

  setSyncStatus: (status) => set({ syncStatus: status }),

  setLastSyncTime: async (time) => {
    set({ lastSyncTime: time });
    try {
      if (time) {
        await AsyncStorage.setItem('last_sync_time', time);
      } else {
        await AsyncStorage.removeItem('last_sync_time');
      }
    } catch (e) {
      console.error('Failed to persist last sync time state:', e);
    }
  },

  setSecurityConfig: async (pinEnabled, biometricsEnabled) => {
    set({ pinEnabled, biometricsEnabled });
    try {
      await AsyncStorage.setItem('pin_enabled', pinEnabled ? 'true' : 'false');
      await AsyncStorage.setItem('biometrics_enabled', biometricsEnabled ? 'true' : 'false');
    } catch (e) {
      console.error('Failed to persist security configuration state:', e);
    }
  },

  setOnboarded: async (isOnboarded) => {
    set({ isOnboarded });
    try {
      await AsyncStorage.setItem('is_onboarded', isOnboarded ? 'true' : 'false');
    } catch (e) {
      console.error('Failed to persist onboarding state:', e);
    }
  },

  setContraceptiveConfig: async (config) => {
    const updated = { ...get().contraceptiveConfig, ...config };
    set({ contraceptiveConfig: updated });
    try {
      await AsyncStorage.setItem('contraceptive_config', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to persist contraceptive config:', e);
    }
  },

  setDiscreetNotificationMode: async (mode, customText) => {
    set({ discreetNotificationMode: mode, customDiscreetText: customText || '' });
    try {
      await AsyncStorage.setItem('discreet_notification_mode', mode);
      if (customText !== undefined) {
        await AsyncStorage.setItem('custom_discreet_text', customText);
      }
    } catch (e) {
      console.error('Failed to persist discreet notification mode:', e);
    }
  },

  logout: async () => {
    set({
      user: null,
      isAuthenticated: false,
      isPremium: false,
      premiumTier: 'free',
      isPregnancyMode: false,
      themeName: 'lotus',
      lastSyncTime: null,
      pinEnabled: false,
      biometricsEnabled: false,
      isOnboarded: false,
      sessionUnlocked: false,
      contraceptiveConfig: {
        enabled: false,
        type: 'pill',
        packModel: '21_7',
        reminderTime: '21:00',
        pillsInPack: 21,
        startDate: '',
      },
      discreetNotificationMode: 'standard',
      customDiscreetText: '',
    });
    try {
      await AsyncStorage.multiRemove([
        'user_session',
        'premium_tier',
        'pregnancy_mode',
        'theme_name',
        'last_sync_time',
        'pin_enabled',
        'biometrics_enabled',
        'is_onboarded',
        'contraceptive_config',
        'discreet_notification_mode',
        'custom_discreet_text',
      ]);
      await clearPIN();

      // Clear Google Sign-In session to force account chooser on next login
      if (Platform.OS !== 'web') {
        try {
          const { GoogleSignin } = require('@react-native-google-signin/google-signin');
          await GoogleSignin.signOut();
          console.log('Google Sign-In session signed out successfully.');
        } catch (e) {
          console.warn('Google Sign-In signout warning:', e);
        }
      }
    } catch (e) {
      console.error('Failed to clear user storage and PIN on logout:', e);
    }
  },

  loadPersistedState: async () => {
    try {
      const premiumTier = (await AsyncStorage.getItem('premium_tier')) as PremiumTier || 'free';
      const isPregnancyMode = (await AsyncStorage.getItem('pregnancy_mode')) === 'true';
      const themeMode = (await AsyncStorage.getItem('theme_mode')) as ThemeMode || 'dark';
      const themeName = (await AsyncStorage.getItem('theme_name')) as any || 'lotus';
      const lastSyncTime = await AsyncStorage.getItem('last_sync_time');
      const pinEnabled = (await AsyncStorage.getItem('pin_enabled')) === 'true';
      const biometricsEnabled = (await AsyncStorage.getItem('biometrics_enabled')) === 'true';
      const isOnboarded = (await AsyncStorage.getItem('is_onboarded')) === 'true';
      
      const contraceptiveStr = await AsyncStorage.getItem('contraceptive_config');
      const contraceptiveConfig = contraceptiveStr ? JSON.parse(contraceptiveStr) : {
        enabled: false,
        type: 'pill',
        packModel: '21_7',
        reminderTime: '21:00',
        pillsInPack: 21,
        startDate: '',
      };
      
      const discreetNotificationMode = (await AsyncStorage.getItem('discreet_notification_mode')) as any || 'standard';
      const customDiscreetText = (await AsyncStorage.getItem('custom_discreet_text')) || '';

      // Re-hydrate session
      const userSessionStr = await AsyncStorage.getItem('user_session');
      let user: UserProfile | null = null;
      if (userSessionStr) {
        user = JSON.parse(userSessionStr);
      }

      set({
        user,
        isAuthenticated: !!user,
        premiumTier,
        isPremium: premiumTier !== 'free',
        isPregnancyMode,
        themeMode,
        themeName,
        lastSyncTime,
        pinEnabled,
        biometricsEnabled,
        isOnboarded,
        contraceptiveConfig,
        discreetNotificationMode,
        customDiscreetText,
      });
    } catch (error) {
      console.error('Failed to load persisted Zustand state:', error);
    }
  },
}));
