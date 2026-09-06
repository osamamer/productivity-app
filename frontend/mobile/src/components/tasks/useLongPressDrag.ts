import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export const DRAG_HOLD_DURATION_MS = 300;
const SCROLL_INTENT_DISTANCE = 12;

interface LongPressDragOptions {
  id: string;
  enabled: boolean;
  onStart?: (id: string, absoluteY: number) => void;
  onMove?: (id: string, absoluteY: number, translationY: number) => void;
  onEnd?: (id: string, absoluteY: number) => void;
  onCancel?: (id: string) => void;
  onHold?: (id: string) => void;
}

export function useLongPressDrag({ id, enabled, onStart, onMove, onEnd, onCancel, onHold }: LongPressDragOptions) {
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const heldRef = useRef(false);
  const movedRef = useRef(false);
  const callbacksRef = useRef({ onStart, onMove, onEnd, onCancel, onHold });

  useEffect(() => {
    callbacksRef.current = { onStart, onMove, onEnd, onCancel, onHold };
  }, [onCancel, onEnd, onHold, onMove, onStart]);

  const startOnRN = useCallback((absoluteY: number) => {
    draggingRef.current = true;
    heldRef.current = true;
    movedRef.current = false;
    setDragging(true);
    callbacksRef.current.onStart?.(id, absoluteY);
  }, [id]);

  const moveOnRN = useCallback((absoluteY: number, x: number, y: number) => {
    if (Math.abs(x) > 2 || Math.abs(y) > 2) movedRef.current = true;
    callbacksRef.current.onMove?.(id, absoluteY, y);
  }, [id]);

  const endOnRN = useCallback((absoluteY: number) => {
    if (draggingRef.current) {
      if (movedRef.current) callbacksRef.current.onEnd?.(id, absoluteY);
      else {
        callbacksRef.current.onCancel?.(id);
        if (heldRef.current) callbacksRef.current.onHold?.(id);
      }
    }
    // The parent callback queues the reorder before this reset, so the row
    // cannot be painted at its new index with the old drag translation.
    translationX.set(0);
    translationY.set(0);
    draggingRef.current = false;
    heldRef.current = false;
    movedRef.current = false;
    setDragging(false);
  }, [id, translationX, translationY]);

  const cancelOnRN = useCallback(() => {
    if (draggingRef.current) callbacksRef.current.onCancel?.(id);
    translationX.set(0);
    translationY.set(0);
    draggingRef.current = false;
    heldRef.current = false;
    movedRef.current = false;
    setDragging(false);
  }, [id, translationX, translationY]);

  /* eslint-disable react-hooks/refs -- Reanimated shared values are mutated by UI-thread gesture worklets, not during React render. */
  const gesture = useMemo(() => Gesture.Pan()
      .enabled(enabled)
      .maxPointers(1)
      .activateAfterLongPress(DRAG_HOLD_DURATION_MS)
      .failOffsetX([-SCROLL_INTENT_DISTANCE, SCROLL_INTENT_DISTANCE])
      .failOffsetY([-SCROLL_INTENT_DISTANCE, SCROLL_INTENT_DISTANCE])
      .shouldCancelWhenOutside(false)
      .onStart(event => {
        translationX.set(0);
        translationY.set(0);
        scheduleOnRN(startOnRN, event.absoluteY);
      })
      .onUpdate(event => {
        translationX.set(event.translationX);
        translationY.set(event.translationY);
        scheduleOnRN(moveOnRN, event.absoluteY, event.translationX, event.translationY);
      })
      .onEnd(event => {
        scheduleOnRN(endOnRN, event.absoluteY);
      })
      .onFinalize((_event, success) => {
        if (!success) {
          scheduleOnRN(cancelOnRN);
        }
      }), [cancelOnRN, enabled, endOnRN, moveOnRN, startOnRN, translationX, translationY]);
  /* eslint-enable react-hooks/refs */

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translationX.get() },
      { translateY: translationY.get() },
    ],
  }));

  return { animatedStyle, dragging, gesture };
}
