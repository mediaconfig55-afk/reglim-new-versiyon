import React from 'react';
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#121214' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="intro" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="permissions" />
      <Stack.Screen name="setup" />
    </Stack>
  );
}
