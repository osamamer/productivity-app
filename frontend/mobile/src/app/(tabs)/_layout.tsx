import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useAppTheme } from '@/providers/ThemeProvider';

const icons: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  index: { active: 'home', inactive: 'home-outline' },
  tasks: { active: 'checkmark-done', inactive: 'checkmark-done-outline' },
  calendar: { active: 'calendar', inactive: 'calendar-outline' },
  mind: { active: 'sparkles', inactive: 'sparkles-outline' },
  more: { active: 'grid', inactive: 'grid-outline' },
};

export default function TabLayout() {
  const { colors } = useAppTheme();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 72,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontFamily: 'Raleway', fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const pair = icons[route.name] ?? icons.more;
          return <Ionicons name={focused ? pair.active : pair.inactive} color={color} size={size} />;
        },
      })}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="mind" options={{ title: 'Mind' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
