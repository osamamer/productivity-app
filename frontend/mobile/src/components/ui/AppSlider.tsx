import { useCallback, useEffect, useRef, useState } from 'react';
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
  const range = maximumValue - minimumValue;
  const trackWidthRef = useRef(0);
  const onValueChangeRef = useRef(onValueChange);
  const onSlidingCompleteRef = useRef(onSlidingComplete);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
    onSlidingCompleteRef.current = onSlidingComplete;
    disabledRef.current = disabled;
  }, [disabled, onSlidingComplete, onValueChange]);

  const percentage = range > 0
    ? Math.max(0, Math.min(100, ((value - minimumValue) / range) * 100))
    : 0;

  const valueFromLocation = useCallback((locationX: number): number | null => {
    const trackWidth = trackWidthRef.current;
    if (trackWidth <= 0 || range <= 0) return null;
    const ratio = Math.max(0, Math.min(1, locationX / trackWidth));
    const rawValue = minimumValue + ratio * range;
    const steppedValue = minimumValue + Math.round((rawValue - minimumValue) / step) * step;
    return Math.max(minimumValue, Math.min(maximumValue, Number(steppedValue.toFixed(10))));
  }, [maximumValue, minimumValue, range, step]);

  const updateFromLocation = useCallback((locationX: number, complete = false) => {
    const nextValue = valueFromLocation(locationX);
    if (nextValue === null) return;
    onValueChangeRef.current(nextValue);
    if (complete) onSlidingCompleteRef.current?.(nextValue);
  }, [valueFromLocation]);

  const [panResponder, setPanResponder] = useState<ReturnType<typeof PanResponder.create> | null>(null);
  useEffect(() => {
    setPanResponder(PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: event => { if (!disabledRef.current) updateFromLocation(event.nativeEvent.locationX); },
      onPanResponderMove: event => { if (!disabledRef.current) updateFromLocation(event.nativeEvent.locationX); },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: event => { if (!disabledRef.current) updateFromLocation(event.nativeEvent.locationX, true); },
    }));
  }, [updateFromLocation]);

  function onTrackLayout(event: LayoutChangeEvent) {
    trackWidthRef.current = event.nativeEvent.layout.width;
  }

  function onAccessibilityAction(action: { nativeEvent: { actionName: string } }) {
    if (disabled) return;
    if (action.nativeEvent.actionName === 'increment') {
      const nextValue = Math.min(maximumValue, value + step);
      onValueChangeRef.current(nextValue);
      onSlidingCompleteRef.current?.(nextValue);
    } else if (action.nativeEvent.actionName === 'decrement') {
      const nextValue = Math.max(minimumValue, value - step);
      onValueChangeRef.current(nextValue);
      onSlidingCompleteRef.current?.(nextValue);
    }
  }

  return (
    <View style={style}>
      <View
        {...(panResponder?.panHandlers ?? {})}
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
