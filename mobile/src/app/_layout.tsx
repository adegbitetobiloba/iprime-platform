// Owner: Account 1. Routes only live in src/app; screen bodies live in src/features/* and src/shell.
import {
  PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppProviders } from '@/core/providers';
import { useTheme } from '@/design';

void SplashScreen.preventAutoHideAsync();

function Shell() {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, Fraunces_600SemiBold,
  });
  const [gaveUp, setGaveUp] = useState(false);
  // Never hold the splash screen for more than 4 seconds: the system font is an acceptable fallback.
  useEffect(() => { const t = setTimeout(() => setGaveUp(true), 4000); return () => clearTimeout(t); }, []);
  const ready = fontsLoaded || Boolean(fontError) || gaveUp;
  useEffect(() => { if (ready) void SplashScreen.hideAsync(); }, [ready]);
  if (!ready) return null;
  return (
    <AppProviders>
      <Shell />
    </AppProviders>
  );
}
