import { useEffect, useState } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLLAPSE_DURATION_MS } from '@/components/ui/Collapsible';

export function GroupChevron({ collapsed, color }: { collapsed: boolean; color: string }) {
  const [rotation] = useState(() => new Animated.Value(collapsed ? 0 : 1));

  useEffect(() => {
    const animation = Animated.timing(rotation, {
      toValue: collapsed ? 0 : 1,
      duration: COLLAPSE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [collapsed, rotation]);

  return (
    <Animated.View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }] }}>
      <Ionicons name="chevron-forward" size={20} color={color} />
    </Animated.View>
  );
}

/** The guide line under an open group's chevron, fading with the group's open and close. */
export function GroupConnector({ visible, color, style }: { visible: boolean; color: string; style: StyleProp<ViewStyle> }) {
  const [opacity] = useState(() => new Animated.Value(visible ? 1 : 0));

  useEffect(() => {
    const animation = Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: COLLAPSE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [opacity, visible]);

  return <Animated.View pointerEvents="none" style={[style, { backgroundColor: color, opacity }]} />;
}
