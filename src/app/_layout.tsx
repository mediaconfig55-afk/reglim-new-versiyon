import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from '../store/store';
import { initDatabase } from '../database/db';
import { requestNotificationPermissions, scheduleDailyReminders } from '../services/notifications';
import { View, ActivityIndicator, StyleSheet, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const queryClient = new QueryClient();



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
  const router = useRouter();
  const segments = useSegments();
  const { loadPersistedState, isAuthenticated, pinEnabled, isOnboarded, sessionUnlocked, setSessionUnlocked } = useAppStore();

  // 1. Initialize DB and configuration on launch
  useEffect(() => {
    async function prepare() {
      try {
        // Initialize SQLite DB tables
        initDatabase();
        
        // Load settings from AsyncStorage to Zustand
        await loadPersistedState();
        
        // Request notifications permission and set schedule
        const granted = await requestNotificationPermissions();
        if (granted) {
          await scheduleDailyReminders();
        }
      } catch (e) {
        console.error('Failed to initialize app core:', e);
      } finally {
        setDbReady(true);
      }
    }

    prepare();
  }, []);

  // 2. Listen to Firebase auth changes to keep Zustand and AsyncStorage in sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      const { setUser } = useAppStore.getState();
      if (fbUser) {
        const sessionUser = {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || (fbUser.isAnonymous ? 'Misafir Kullanıcı' : 'Kayıtlı Kullanıcı'),
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

  // 3. Navigation Guards and lock screen flow
  useEffect(() => {
    if (!dbReady) return;

    const segs = segments as string[];
    const inAuthGroup = segs[0] === '(auth)';
    const inOnboardingGroup = segs[0] === '(onboarding)';

    if (!isAuthenticated) {
      // If user is not logged in, redirect to login
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (!isOnboarded) {
      // If not onboarded, redirect to onboarding flow
      if (!inOnboardingGroup) {
        router.replace('/(onboarding)/intro');
      }
    } else if (pinEnabled && !sessionUnlocked) {
      // If PIN is enabled and session is locked, redirect to PIN screen
      if (segs[1] !== 'pin') {
        router.replace('/(auth)/pin');
      }
    } else {
      // If logged in, onboarded, and unlocked (or PIN not enabled), redirect to dashboard
      if (inAuthGroup || inOnboardingGroup || segs.length === 0) {
        router.replace('/(tabs)');
      }
    }
  }, [dbReady, isAuthenticated, pinEnabled, isOnboarded, sessionUnlocked, segments]);

  // 4. App State Listener for security lock on backgrounding
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        lockSession();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!dbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF2366" />
      </View>
    );
  }

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
        <Stack.Screen name="(auth)/login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(auth)/pin" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(onboarding)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="pregnancy/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="log-day" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="admin/index" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}

// Global unlock helper to unlock PIN lock for this session
export function unlockSession() {
  useAppStore.getState().setSessionUnlocked(true);
}

// Global lock helper to lock PIN lock
export function lockSession() {
  useAppStore.getState().setSessionUnlocked(false);
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#121214',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
