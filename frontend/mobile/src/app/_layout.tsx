import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Pressable } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppErrorBoundary } from '@/components/ui/AppErrorBoundary';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { NotificationProvider } from '@/providers/NotificationProvider';
import { PreferencesProvider } from '@/providers/PreferencesProvider';
import { PopupProvider } from '@/providers/PopupProvider';
import { TaskWorkspaceProvider } from '@/providers/TaskWorkspaceProvider';
import { AppThemeProvider, useAppTheme } from '@/providers/ThemeProvider';
import { APP_FONT_FAMILY } from '@/components/ui/AppText';

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
          headerTitleStyle: { fontFamily: APP_FONT_FAMILY, fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="mental-threads" options={{ title: 'Mental threads' }} />
          <Stack.Screen name="mental-state" options={{ title: 'Mental state' }} />
          <Stack.Screen name="meditation" options={{ title: 'Meditation' }} />
          <Stack.Screen name="meditation-calendar" options={{ title: 'Meditation calendar' }} />
          <Stack.Screen name="notes" options={{ title: 'Notes' }} />
          <Stack.Screen name="notes/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="stats" options={{ title: 'Statistics' }} />
          <Stack.Screen name="settings" options={{
            title: 'Settings',
            headerLeft: () => (
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={10}
                style={{ marginRight: 12 }}
              >
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </Pressable>
            ),
          }} />
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
