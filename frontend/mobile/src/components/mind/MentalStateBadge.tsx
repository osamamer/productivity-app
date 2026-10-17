import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';

interface MentalStateBadgeProps {
  state: string | null;
  size?: 'small' | 'medium';
  plain?: boolean;
}

export function MentalStateBadge({ state, size = 'medium', plain = false }: MentalStateBadgeProps) {
  const { colors, dark } = useAppTheme();
  const currentState = state?.split(' · ')[0];

  const visual = (() => {
    switch (currentState) {
      case 'Wired/Tired': return { icon: 'lightning-bolt-circle', color: colors.warning } as const;
      case 'Depleted': return { icon: 'battery-low', color: colors.danger } as const;
      case 'Stimulation-Seeking': return { icon: 'fruit-grapes', color: dark ? '#A395F2' : '#946AF5' } as const;
      case 'Scattered/Overactivated': return { icon: 'head-flash-outline', color: colors.danger } as const;
      case 'Emotionally Loaded': return { icon: 'heart-broken', color: colors.secondary } as const;
      case 'Low Mood': return { icon: 'weather-rainy', color: colors.low } as const;
      case 'Ready': return { icon: 'rocket-launch-outline', color: dark ? '#71AD82' : '#387D4E' } as const;
      case 'Almost Ready': return { icon: 'progress-clock', color: dark ? '#91B398' : '#56775C' } as const;
      case 'Engaged': return { icon: 'target', color: colors.accent } as const;
      case 'Mixed': return { icon: 'scale-balance', color: colors.secondary } as const;
      default: return { icon: 'pulse', color: colors.accent } as const;
    }
  })();
  if (plain) {
    return (
      <View accessible={false} style={styles.iconOnly}>
        <MaterialCommunityIcons name={visual.icon} size={size === 'small' ? 24 : 27} color={visual.color} />
      </View>
    );
  }

  return (
    <View
      accessible={false}
      style={[
        styles.badge,
        size === 'small' && styles.badgeSmall,
        { backgroundColor: `${visual.color}1A`, borderColor: `${visual.color}35` },
      ]}
    >
      <MaterialCommunityIcons name={visual.icon} size={size === 'small' ? 24 : 27} color={visual.color} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconOnly: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  badge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSmall: { width: 40, height: 40, borderRadius: 14 },
});
