import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppErrorBoundary } from '@/components/ui/AppErrorBoundary';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { NotificationProvider } from '@/providers/NotificationProvider';
import { PreferencesProvider } from '@/providers/PreferencesProvider';
import { PopupProvider } from '@/providers/PopupProvider';
import { TaskWorkspaceProvider } from '@/providers/TaskWorkspaceProvider';
import { AppThemeProvider, useAppTheme } from '@/providers/ThemeProvider';

void SplashScreen.preventAutoHideAsync();

function Navigation() {
  const [fontsLoaded] = useFonts({
    InterRegular: require('../../assets/Inter-Regular.otf'),
    InterSemiBold: require('../../assets/Inter-SemiBold.otf'),
  });
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
    if (!loading && fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded, loading]);

  if (loading || !fontsLoaded) return null;

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          orientation: 'portrait',
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="mental-threads" />
          <Stack.Screen name="mental-state" />
          <Stack.Screen name="meditation" />
          <Stack.Screen name="meditation-calendar" />
          <Stack.Screen name="notes" />
          <Stack.Screen name="notes/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="stats" />
          <Stack.Screen name="stats/[id]" options={{ orientation: 'landscape', headerShown: false }} />
          <Stack.Screen name="settings" />
        </Stack.Protected>
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView>
      <AppThemeProvider>
        <PopupProvider>
          <AppErrorBoundary>
            <AuthProvider>
              <NotificationProvider>
                <PreferencesProvider>
                  <TaskWorkspaceProvider>
                    <Navigation />
                  </TaskWorkspaceProvider>
                </PreferencesProvider>
              </NotificationProvider>
            </AuthProvider>
          </AppErrorBoundary>
        </PopupProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
