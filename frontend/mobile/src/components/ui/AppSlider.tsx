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
  const trackRef = useRef<View>(null);
  const trackWidthRef = useRef(0);
  const trackLeftRef = useRef(0);
  const trackMeasuredRef = useRef(false);
  const minimumValueRef = useRef(minimumValue);
  const maximumValueRef = useRef(maximumValue);
  const stepRef = useRef(step);
  const valueRef = useRef(value);
  const dragStartValueRef = useRef(value);
  const dragFromThumbRef = useRef(false);
  const onValueChangeRef = useRef(onValueChange);
  const onSlidingCompleteRef = useRef(onSlidingComplete);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    minimumValueRef.current = minimumValue;
    maximumValueRef.current = maximumValue;
    stepRef.current = step;
    valueRef.current = value;
    onValueChangeRef.current = onValueChange;
    onSlidingCompleteRef.current = onSlidingComplete;
    disabledRef.current = disabled;
  }, [disabled, maximumValue, minimumValue, onSlidingComplete, onValueChange, step, value]);

  const percentage = range > 0
    ? Math.max(0, Math.min(100, ((value - minimumValue) / range) * 100))
    : 0;

  const valueFromPageX = useCallback((pageX: number): number | null => {
    const trackWidth = trackWidthRef.current;
    const minimum = minimumValueRef.current;
    const maximum = maximumValueRef.current;
    const currentRange = maximum - minimum;
    const currentStep = stepRef.current;
    if (!trackMeasuredRef.current || trackWidth <= 0 || currentRange <= 0 || currentStep <= 0) return null;

    const locationX = pageX - trackLeftRef.current;
    const ratio = Math.max(0, Math.min(1, locationX / trackWidth));
    const rawValue = minimum + ratio * currentRange;
    const steppedValue = minimum + Math.round((rawValue - minimum) / currentStep) * currentStep;
    return Math.max(minimum, Math.min(maximum, Number(steppedValue.toFixed(10))));
  }, []);

  const valueFromDragDelta = useCallback((dx: number): number | null => {
    const trackWidth = trackWidthRef.current;
    const minimum = minimumValueRef.current;
    const maximum = maximumValueRef.current;
    const currentRange = maximum - minimum;
    const currentStep = stepRef.current;
    if (!trackMeasuredRef.current || trackWidth <= 0 || currentRange <= 0 || currentStep <= 0) return null;

    const rawValue = dragStartValueRef.current + (dx / trackWidth) * currentRange;
    const steppedValue = minimum + Math.round((rawValue - minimum) / currentStep) * currentStep;
    return Math.max(minimum, Math.min(maximum, Number(steppedValue.toFixed(10))));
  }, []);

  const isThumbTouch = useCallback((pageX: number): boolean => {
    if (!trackMeasuredRef.current || trackWidthRef.current <= 0) return false;
    const minimum = minimumValueRef.current;
    const maximum = maximumValueRef.current;
    const currentRange = maximum - minimum;
    if (currentRange <= 0) return false;

    const thumbCenter = trackLeftRef.current
      + ((valueRef.current - minimum) / currentRange) * trackWidthRef.current;
    return Math.abs(pageX - thumbCenter) <= 28;
  }, []);

  const updateFromGesture = useCallback((gesture: { pageX: number; dx: number }, complete = false) => {
    const nextValue = dragFromThumbRef.current
      ? valueFromDragDelta(gesture.dx)
      : valueFromPageX(gesture.pageX);
    if (nextValue === null) return;
    onValueChangeRef.current(nextValue);
    if (complete) onSlidingCompleteRef.current?.(nextValue);
  }, [valueFromDragDelta, valueFromPageX]);

  const [panResponder, setPanResponder] = useState<ReturnType<typeof PanResponder.create> | null>(null);
  useEffect(() => {
    setPanResponder(PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: (event, gestureState) => {
        if (disabledRef.current) return;
        dragStartValueRef.current = valueRef.current;
        dragFromThumbRef.current = isThumbTouch(event.nativeEvent.pageX || gestureState.moveX);
      },
      onPanResponderMove: (_, gestureState) => {
        if (!disabledRef.current) updateFromGesture({ pageX: gestureState.moveX, dx: gestureState.dx });
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (event, gestureState) => {
        if (!disabledRef.current) {
          updateFromGesture({ pageX: event.nativeEvent.pageX || gestureState.moveX, dx: gestureState.dx }, true);
        }
        dragFromThumbRef.current = false;
      },
      onPanResponderTerminate: () => { dragFromThumbRef.current = false; },
    }));
  }, [isThumbTouch, updateFromGesture]);

  function onTrackLayout(event: LayoutChangeEvent) {
    trackWidthRef.current = event.nativeEvent.layout.width;
    trackMeasuredRef.current = false;
    trackRef.current?.measureInWindow((x, _y, _width) => {
      trackLeftRef.current = x;
      trackMeasuredRef.current = true;
    });
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
        pointerEvents="box-only"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        accessibilityValue={{ min: minimumValue, max: maximumValue, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
        ref={trackRef}
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
