// Owner: Account 1. Routes only live in src/app; screen bodies live in src/features/* (see ADD_A_FEATURE.md in phase F4).
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
