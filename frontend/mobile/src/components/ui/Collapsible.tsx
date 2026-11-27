import { type PropsWithChildren, useEffect, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export const COLLAPSE_DURATION_MS = 300;
// Same curve as MUI's Collapse, so groups open and close like they do on the web.
const COLLAPSE_EASING = Easing.bezier(0.4, 0, 0.2, 1);

/**
 * Animates its height between zero and its content's height. The content stays mounted while
 * closing and unmounts once closed. Opening waits for the freshly mounted content's first layout,
 * so it always animates to the real height instead of from a stale or zero one. Open, the height
 * follows the content's measured height (the content measures at its natural size even inside a
 * shorter box), and nothing is clipped once settled, so a task added to a group or a row dragged
 * out of it stays visible.
 */
export function Collapsible({ expanded, children }: PropsWithChildren<{ expanded: boolean }>) {
  const [mounted, setMounted] = useState(expanded);
  const [settled, setSettled] = useState(true);
  const [waitingForLayout, setWaitingForLayout] = useState(false);
  const contentHeight = useSharedValue(0);
  const progress = useSharedValue(expanded ? 1 : 0);

  const [previousExpanded, setPreviousExpanded] = useState(expanded);
  if (previousExpanded !== expanded) {
    setPreviousExpanded(expanded);
    setSettled(false);
    if (expanded && !mounted) {
      setMounted(true);
      setWaitingForLayout(true);
    } else {
      setWaitingForLayout(false);
    }
  }

  useEffect(() => {
    if (expanded && waitingForLayout) return;
    progress.value = withTiming(expanded ? 1 : 0, { duration: COLLAPSE_DURATION_MS, easing: COLLAPSE_EASING }, finished => {
      if (!finished) return;
      scheduleOnRN(setSettled, true);
      if (!expanded) scheduleOnRN(setMounted, false);
    });
  }, [expanded, progress, waitingForLayout]);

  const onContentLayout = (event: LayoutChangeEvent) => {
    contentHeight.value = event.nativeEvent.layout.height;
    if (waitingForLayout) setWaitingForLayout(false);
  };

  // Mounted open, nothing has been measured yet: leave the height to layout rather than show zero.
  const animatedStyle = useAnimatedStyle(() => (
    contentHeight.value === 0 && progress.value >= 1
      ? { opacity: 1 }
      : { height: contentHeight.value * progress.value, opacity: Math.min(1, progress.value * 1.6) }
  ));

  if (!mounted) return null;
  return (
    <Reanimated.View style={[(!settled || !expanded) && styles.clip, animatedStyle]}>
      <View onLayout={onContentLayout}>
        {children}
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
