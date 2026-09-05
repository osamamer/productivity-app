import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function GroupChevron({ collapsed, color }: { collapsed: boolean; color: string }) {
  const [rotation] = useState(() => new Animated.Value(collapsed ? 0 : 1));

  useEffect(() => {
    const animation = Animated.timing(rotation, {
      toValue: collapsed ? 0 : 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [collapsed, rotation]);

  return (
    <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }] }}>
      <Ionicons name="chevron-forward" size={18} color={color} />
    </Animated.View>
  );
}
