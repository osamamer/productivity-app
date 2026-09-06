import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated as NativeAnimated, type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Reanimated from 'react-native-reanimated';

import { useLongPressDrag } from './useLongPressDrag';

interface Props {
  groupId: string;
  enabled: boolean;
  dragging: boolean;
  dragInProgress?: boolean;
  dragPreviewOffset?: number;
  header: ReactNode;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
  onViewRef?: (groupId: string, view: View | null) => void;
  onDragStart: (groupId: string, absoluteY: number) => void;
  onDragMove: (groupId: string, absoluteY: number, translationY: number) => void;
  onDragEnd: (groupId: string, absoluteY: number) => void;
  onDragCancel: (groupId: string) => void;
}

export function DraggableTaskGroup({
  children,
  header,
  groupId,
  enabled,
  dragging,
  dragInProgress = false,
  dragPreviewOffset = 0,
  style,
  onLayout,
  onViewRef,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: PropsWithChildren<Props>) {
  const viewRef = useRef<View>(null);
  const [animatedPreviewOffset] = useState(() => new NativeAnimated.Value(0));
  const drag = useLongPressDrag({
    id: groupId,
    enabled,
    onStart: onDragStart,
    onMove: onDragMove,
    onEnd: onDragEnd,
    onCancel: onDragCancel,
  });
  useEffect(() => {
    animatedPreviewOffset.stopAnimation();
    if (!dragInProgress) {
      animatedPreviewOffset.setValue(0);
      return;
    }
    NativeAnimated.spring(animatedPreviewOffset, {
      toValue: dragPreviewOffset,
      stiffness: 520,
      damping: 48,
      mass: 0.7,
      overshootClamping: true,
      useNativeDriver: true,
    }).start();
  }, [animatedPreviewOffset, dragInProgress, dragPreviewOffset]);

  const active = dragging || drag.dragging;
  return (
    <NativeAnimated.View
        ref={view => {
          const nativeView = view as View | null;
          viewRef.current = nativeView;
          onViewRef?.(groupId, nativeView);
        }}
        onLayout={onLayout}
        style={[
          { transform: [{ translateY: animatedPreviewOffset }] },
          active && { zIndex: 20 },
        ]}>
      <Reanimated.View
        style={[
          style,
          drag.animatedStyle,
          active && { zIndex: 20, opacity: 0.96 },
        ]}>
        <GestureDetector gesture={drag.gesture}>
          <View collapsable={false}>{header}</View>
        </GestureDetector>
        {children}
      </Reanimated.View>
    </NativeAnimated.View>
  );
}
