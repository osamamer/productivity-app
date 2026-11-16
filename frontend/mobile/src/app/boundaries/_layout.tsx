import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { BoundariesGate } from '@/components/boundaries/BoundariesGate';
import { useAppTheme } from '@/providers/ThemeProvider';
import { Boundaries } from '@/services/boundaries';

export default function BoundariesLayout() {
  const { colors } = useAppTheme();

  useEffect(() => {
    // Messages from the background service are drawn natively; give them the current theme.
    void Boundaries?.setAppearance(JSON.stringify({ surface: colors.surfaceRaised, text: colors.text, accent: colors.accent }))
      .catch(cause => console.error('Could not share the theme with Boundaries:', cause));
  }, [colors]);

  return (
    <BoundariesGate>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </BoundariesGate>
  );
}
