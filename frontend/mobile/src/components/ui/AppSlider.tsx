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
  onSlidingComplete?: (value: number) => void;
  activeColor?: string;
  disabled?: boolean;
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
  onSlidingComplete,
  activeColor,
  disabled = false,
  style,
}: AppSliderProps) {
  const { colors } = useAppTheme();
  const sliderColor = activeColor ?? colors.accent;
  const [trackWidth, setTrackWidth] = useState(0);
  const range = maximumValue - minimumValue;
  const percentage = range > 0 ? ((value - minimumValue) / range) * 100 : 0;

  const valueFromLocation = useCallback((locationX: number): number | null => {
    if (trackWidth <= 0 || range <= 0) return null;
    const ratio = Math.max(0, Math.min(1, locationX / trackWidth));
    const rawValue = minimumValue + ratio * range;
    const steppedValue = minimumValue + Math.round((rawValue - minimumValue) / step) * step;
    return Math.max(minimumValue, Math.min(maximumValue, Number(steppedValue.toFixed(10))));
  }, [maximumValue, minimumValue, range, step, trackWidth]);

  const updateFromLocation = useCallback((locationX: number) => {
    const nextValue = valueFromLocation(locationX);
    if (nextValue !== null) onValueChange(nextValue);
  }, [onValueChange, valueFromLocation]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: event => { if (!disabled) updateFromLocation(event.nativeEvent.locationX); },
    onPanResponderMove: event => { if (!disabled) updateFromLocation(event.nativeEvent.locationX); },
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: event => {
      if (disabled) return;
      const nextValue = valueFromLocation(event.nativeEvent.locationX);
      if (nextValue !== null) {
        onValueChange(nextValue);
        onSlidingComplete?.(nextValue);
      }
    },
  }), [disabled, onSlidingComplete, onValueChange, updateFromLocation, valueFromLocation]);

  function onTrackLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  function onAccessibilityAction(action: { nativeEvent: { actionName: string } }) {
    if (disabled) return;
    if (action.nativeEvent.actionName === 'increment') {
      const nextValue = Math.min(maximumValue, value + step);
      onValueChange(nextValue);
      onSlidingComplete?.(nextValue);
    } else if (action.nativeEvent.actionName === 'decrement') {
      const nextValue = Math.max(minimumValue, value - step);
      onValueChange(nextValue);
      onSlidingComplete?.(nextValue);
    }
  }

  return (
    <View style={style}>
      <View
        {...panResponder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        accessibilityValue={{ min: minimumValue, max: maximumValue, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
        onLayout={onTrackLayout}
        style={[styles.touchTarget, disabled && styles.disabled]}>
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View style={[styles.filledTrack, { width: `${percentage}%`, backgroundColor: sliderColor }]} />
        </View>
        <View style={[styles.thumb, { left: `${percentage}%`, backgroundColor: sliderColor, borderColor: colors.surface }]} />
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
  disabled: { opacity: 0.6 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  filledTrack: { height: '100%', borderRadius: 3 },
  thumb: { position: 'absolute', width: 24, height: 24, borderRadius: 12, marginLeft: -12, borderWidth: 3 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
});
