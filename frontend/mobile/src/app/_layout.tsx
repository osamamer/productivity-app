import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';

import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { NotificationProvider } from '@/providers/NotificationProvider';
import { AppThemeProvider, useAppTheme } from '@/providers/ThemeProvider';

void SplashScreen.preventAutoHideAsync();

function Navigation() {
  const { loading, isAuthenticated } = useAuth();
  const { colors, dark } = useAppTheme();
  const navigationTheme = useMemo(() => ({
    ...(dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(dark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  }), [colors, dark]);

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: 'Raleway' },
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="mental-threads" options={{ title: 'Mental threads' }} />
          <Stack.Screen name="mental-state" options={{ title: 'Mental state' }} />
          <Stack.Screen name="meditation" options={{ title: 'Meditation' }} />
          <Stack.Screen name="notes" options={{ title: 'Notes' }} />
          <Stack.Screen name="stats" options={{ title: 'Statistics' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        </Stack.Protected>
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Raleway: require('../../assets/Raleway-VariableFont_wght.ttf') });
  if (!fontsLoaded) return null;

  return (
    <AppThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <Navigation />
        </NotificationProvider>
      </AuthProvider>
    </AppThemeProvider>
  );
}
