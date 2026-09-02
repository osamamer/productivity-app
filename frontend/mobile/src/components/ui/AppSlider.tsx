import { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View, ViewStyle } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';
import { AppText } from './AppText';

interface AppSliderProps {
  label: string;
  value: number;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  minimumLabel?: string;
  maximumLabel?: string;
  onValueChange: (value: number) => void;
  style?: ViewStyle;
}

export function AppSlider({
  label,
  value,
  minimumValue = 1,
  maximumValue = 10,
  step = 1,
  minimumLabel,
  maximumLabel,
  onValueChange,
  style,
}: AppSliderProps) {
  const { colors } = useAppTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const range = maximumValue - minimumValue;
  const percentage = range > 0 ? ((value - minimumValue) / range) * 100 : 0;

  const updateFromLocation = useCallback((locationX: number) => {
    if (trackWidth <= 0 || range <= 0) return;
    const ratio = Math.max(0, Math.min(1, locationX / trackWidth));
    const rawValue = minimumValue + ratio * range;
    const steppedValue = minimumValue + Math.round((rawValue - minimumValue) / step) * step;
    const nextValue = Math.max(minimumValue, Math.min(maximumValue, Number(steppedValue.toFixed(10))));
    onValueChange(nextValue);
  }, [maximumValue, minimumValue, onValueChange, range, step, trackWidth]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => updateFromLocation(event.nativeEvent.locationX),
    onPanResponderMove: event => updateFromLocation(event.nativeEvent.locationX),
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: event => updateFromLocation(event.nativeEvent.locationX),
  }), [updateFromLocation]);

  function onTrackLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  function onAccessibilityAction(action: { nativeEvent: { actionName: string } }) {
    if (action.nativeEvent.actionName === 'increment') {
      onValueChange(Math.min(maximumValue, value + step));
    } else if (action.nativeEvent.actionName === 'decrement') {
      onValueChange(Math.max(minimumValue, value - step));
    }
  }

  return (
    <View style={style}>
      <View
        {...panResponder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: minimumValue, max: maximumValue, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
        onLayout={onTrackLayout}
        style={styles.touchTarget}>
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View style={[styles.filledTrack, { width: `${percentage}%`, backgroundColor: colors.accent }]} />
        </View>
        <View style={[styles.thumb, { left: `${percentage}%`, backgroundColor: colors.accent, borderColor: colors.surface }]} />
      </View>
      {(minimumLabel || maximumLabel) && (
        <View style={styles.labels}>
          <AppText variant="caption" color="muted">{minimumLabel}</AppText>
          <AppText variant="caption" color="muted">{maximumLabel}</AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  touchTarget: { height: 36, justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  filledTrack: { height: '100%', borderRadius: 3 },
  thumb: { position: 'absolute', width: 24, height: 24, borderRadius: 12, marginLeft: -12, borderWidth: 3 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
});
