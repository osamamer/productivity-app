import { type PropsWithChildren, useEffect, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export const COLLAPSE_DURATION_MS = 300;
// Same curve as MUI's Collapse, so groups open and close like they do on the web.
const COLLAPSE_EASING = Easing.bezier(0.4, 0, 0.2, 1);

/**
 * Animates its height between zero and its content's height. The content stays mounted while
 * closing and unmounts once closed. Fully open, the height is left to layout so content that
 * grows or shrinks (a task added to a group) is never clipped, and it only clips while moving so
 * a row dragged out of it stays visible.
 */
export function Collapsible({ expanded, children }: PropsWithChildren<{ expanded: boolean }>) {
  const [mounted, setMounted] = useState(expanded);
  const [settled, setSettled] = useState(true);
  const contentHeight = useSharedValue(0);
  const progress = useSharedValue(expanded ? 1 : 0);

  const [previousExpanded, setPreviousExpanded] = useState(expanded);
  if (previousExpanded !== expanded) {
    setPreviousExpanded(expanded);
    setSettled(false);
    if (expanded) setMounted(true);
  }

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, { duration: COLLAPSE_DURATION_MS, easing: COLLAPSE_EASING }, finished => {
      if (!finished) return;
      scheduleOnRN(setSettled, true);
      if (!expanded) scheduleOnRN(setMounted, false);
    });
  }, [expanded, progress]);

  const animatedStyle = useAnimatedStyle(() => (
    progress.value >= 1
      ? { height: undefined, opacity: 1 }
      : { height: contentHeight.value * progress.value, opacity: Math.min(1, progress.value * 1.6) }
  ));

  if (!mounted) return null;
  return (
    <Reanimated.View style={[(!settled || !expanded) && styles.clip, animatedStyle]}>
      <View onLayout={(event: LayoutChangeEvent) => { contentHeight.value = event.nativeEvent.layout.height; }}>
        {children}
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
