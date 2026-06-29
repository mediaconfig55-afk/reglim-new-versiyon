import React, { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from '../store/store';
import { initDatabase } from '../database/db';
import { requestNotificationPermissions, scheduleDailyReminders, hasNotificationPermissions } from '../services/notifications';
import {
  View,
  StyleSheet,
  AppState,
  AppStateStatus,
  Image,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import * as SplashScreen from 'expo-splash-screen';

// Keep the native splash visible until we explicitly hide it
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

// ── Session helper functions ──
export function unlockSession() {
  useAppStore.getState().setSessionUnlocked(true);
}

export function lockSession() {
  useAppStore.getState().setSessionUnlocked(false);
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

function AppContent() {
  const [dbReady, setDbReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [splashOpacity] = useState(() => new Animated.Value(1));

  const router = useRouter();
  const segments = useSegments();
  const {
    loadPersistedState,
    isAuthenticated,
    pinEnabled,
    isOnboarded,
    sessionUnlocked,
  } = useAppStore();

  // 1. Initialize DB + settings, then fade out the in-app splash
  useEffect(() => {
    async function prepare() {
      try {
        initDatabase(); // now throws on failure
      } catch (dbError) {
        console.error('FATAL: Database could not be initialized. App may not function correctly.', dbError);
        // Continue loading so user can at least see an error or auth screen
      }

      try {
        await loadPersistedState();
      } catch (e) {
        console.error('Failed to initialize app core:', e);
      } finally {
        setDbReady(true);

        // Hide the native splash first
        await SplashScreen.hideAsync().catch(() => {});

        // Then smoothly fade out our in-app lotus splash
        Animated.timing(splashOpacity, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }).start(() => setShowSplash(false));
      }
    }

    prepare();
  }, []);

  // 1.5. Silently check and schedule notification reminders after load (no native prompt on startup)
  useEffect(() => {
    if (!dbReady || showSplash) return;

    async function initNotifications() {
      try {
        const granted = await hasNotificationPermissions();
        if (granted) {
          await scheduleDailyReminders();
        }
      } catch (e) {
        console.error('Failed to setup notifications after load:', e);
      }
    }

    // Delay slightly to let navigation/animation settle
    const timer = setTimeout(() => {
      initNotifications();
    }, 1000);

    return () => clearTimeout(timer);
  }, [dbReady, showSplash]);

  // 2. Keep Firebase auth + Zustand in sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      const { setUser } = useAppStore.getState();
      if (fbUser) {
        const sessionUser = {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName:
            fbUser.displayName ||
            (fbUser.isAnonymous ? 'Misafir Kullanıcı' : 'Kayıtlı Kullanıcı'),
          isAnonymous: fbUser.isAnonymous,
        };
        await AsyncStorage.setItem('user_session', JSON.stringify(sessionUser));
        setUser(sessionUser);
      } else {
        await AsyncStorage.removeItem('user_session');
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // 3. Navigation guards
  useEffect(() => {
    if (!dbReady) return;

    const seg0 = (segments as string[])[0] ?? '';
    const seg1 = (segments as string[])[1] ?? '';
    const inAuthGroup = seg0 === '(auth)';
    const inOnboardingGroup = seg0 === '(onboarding)';

    if (!isAuthenticated) {
      if (!inAuthGroup) router.replace('/(auth)/login');
    } else if (!isOnboarded) {
      if (!inOnboardingGroup) router.replace('/(onboarding)/intro');
    } else if (pinEnabled && !sessionUnlocked) {
      if (seg1 !== 'pin') router.replace('/(auth)/pin');
    } else {
      if (inAuthGroup || inOnboardingGroup || seg0 === '') {
        router.replace('/(tabs)');
      }
    }
  }, [dbReady, isAuthenticated, pinEnabled, isOnboarded, sessionUnlocked, segments]);

  // 4. Lock session when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'background') {
          lockSession();
        }
      }
    );
    return () => subscription.remove();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#121214' },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="(auth)/login"      options={{ gestureEnabled: false }} />
        <Stack.Screen name="(auth)/pin"        options={{ gestureEnabled: false }} />
        <Stack.Screen name="(onboarding)"      options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)"            options={{ gestureEnabled: false }} />
        <Stack.Screen name="pregnancy/index"   options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="log-day"           options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="admin/index"       options={{ animation: 'slide_from_right' }} />
      </Stack>

      {/* ── Full-screen lotus splash overlay ── */}
      {showSplash && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: splashOpacity }]}
          pointerEvents="none"
        >
          <Image
            source={require('../../assets/images/splash-icon.png')}
            style={styles.splashImage}
            resizeMode="contain"
          />
        </Animated.View>
      )}
    </>
  );
}



const styles = StyleSheet.create({
  splashImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
});
