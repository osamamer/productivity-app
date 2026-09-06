import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated as NativeAnimated, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Reanimated from 'react-native-reanimated';

import { formatShortDate, formatTime } from '@/lib/date';
import { taskPriorityColor } from '@/lib/taskPriority';
import { useAppTheme } from '@/providers/ThemeProvider';
import type { PomodoroStatus, Task } from '@/types/models';
import { PomodoroPanel } from '../pomodoro/PomodoroPanel';
import { AppText } from '../ui/AppText';
import { SilentPressable } from '../ui/SilentPressable';
import { DRAG_HOLD_DURATION_MS, useLongPressDrag } from './useLongPressDrag';

export interface TaskDragLayout {
  left: number;
  top: number;
  width: number;
  bottom: number;
}

function TaskRowBody({ task, onToggle, onPress, onLongPress, onSelectionToggle, selected, onDelete, onPomodoroPress, pomodoroOpen, pomodoroStatus, interactive = true }: {
  task: Task;
  onToggle: () => void;
  onPress?: () => void;
  onLongPress?: () => void;
  onSelectionToggle?: () => void;
  selected: boolean;
  onDelete?: () => void;
  onPomodoroPress?: () => void;
  pomodoroOpen?: boolean;
  pomodoroStatus?: PomodoroStatus | null;
  interactive?: boolean;
}) {
  const { colors } = useAppTheme();
  const active = Boolean(pomodoroStatus?.active);
  const content = (
    <>
      <SilentPressable
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed }}
        onPress={event => { event.stopPropagation(); onToggle(); }}>
        <View
          style={[
            styles.checkbox,
            { borderColor: taskPriorityColor(task.importance) },
            task.completed && { backgroundColor: taskPriorityColor(task.importance) },
          ]}>
          {task.completed && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
        </View>
      </SilentPressable>
      <View style={styles.copy}>
        <AppText variant="label" style={task.completed ? styles.completed : undefined} numberOfLines={2}>
          {task.name}
        </AppText>
        <AppText variant="caption" color="muted">
          {formatShortDate(task.scheduledPerformDateTime)}{formatTime(task.scheduledPerformDateTime) ? ` · ${formatTime(task.scheduledPerformDateTime)}` : ''}
        </AppText>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
      {onPomodoroPress && (
        <SilentPressable
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={pomodoroOpen ? 'Close focus timer' : 'Open focus timer'}
          onPress={event => { event.stopPropagation(); onPomodoroPress(); }}>
          <Ionicons name="timer-outline" size={21} color={active || pomodoroOpen ? colors.accent : colors.textMuted} />
        </SilentPressable>
      )}
      {onDelete && (
        <SilentPressable hitSlop={10} onPress={event => { event.stopPropagation(); onDelete(); }}>
          <Ionicons name="trash-outline" size={19} color={colors.textMuted} />
        </SilentPressable>
      )}
    </>
  );

  if (!interactive) return <View style={styles.row}>{content}</View>;
  return (
    <SilentPressable
      onPress={event => { event.stopPropagation(); (onSelectionToggle ?? onPress)?.(); }}
      onLongPress={event => { event.stopPropagation(); onLongPress?.(); }}
      delayLongPress={DRAG_HOLD_DURATION_MS}
      accessibilityState={selected ? { selected: true } : undefined}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
      {content}
    </SilentPressable>
  );
}

export function TaskRow({ task, onToggle, onPress, onLongPress, onSelectionToggle, selected = false, onDelete, onPomodoroPress, pomodoroOpen, pomodoroStatus, onPomodoroClose, onPomodoroActiveChange, onPomodoroStatusChange, dragEnabled = false, dragging = false, dragInProgress = false, dragPreviewOffset = 0, dropTarget = false, dropTargetEdge, onDragLayout, onDragViewRef, onDragStart, onDragMove, onDragEnd, onDragCancel, inGroup = false, groupLast = false }: {
  task: Task;
  onToggle: () => void;
  onPress?: () => void;
  onLongPress?: () => void;
  onSelectionToggle?: () => void;
  selected?: boolean;
  onDelete?: () => void;
  onPomodoroPress?: () => void;
  pomodoroOpen?: boolean;
  pomodoroStatus?: PomodoroStatus | null;
  onPomodoroClose?: () => void;
  onPomodoroActiveChange?: (active: boolean) => void;
  onPomodoroStatusChange?: (status: PomodoroStatus) => void;
  dragEnabled?: boolean;
  dragging?: boolean;
  dragInProgress?: boolean;
  dragPreviewOffset?: number;
  dropTarget?: boolean;
  dropTargetEdge?: 'before' | 'after';
  onDragLayout?: (taskId: string, layout: TaskDragLayout) => void;
  onDragViewRef?: (taskId: string, view: View | null) => void;
  onDragStart?: (taskId: string, startY: number) => void;
  onDragMove?: (taskId: string, moveY: number, dy: number) => void;
  onDragEnd?: (taskId: string, moveY: number) => void;
  onDragCancel?: (taskId: string) => void;
  inGroup?: boolean;
  groupLast?: boolean;
}) {
  const { colors } = useAppTheme();
  const rowRef = useRef<View>(null);
  const [animatedPreviewOffset] = useState(() => new NativeAnimated.Value(0));
  const drag = useLongPressDrag({
    id: task.taskId,
    enabled: dragEnabled,
    onStart: onDragStart,
    onMove: onDragMove,
    onEnd: onDragEnd,
    onCancel: onDragCancel,
    onHold: onLongPress ? () => onLongPress() : undefined,
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
  function measureRow() {
    if (!onDragLayout) return;
    rowRef.current?.measureInWindow((left, top, width, height) => onDragLayout(task.taskId, { left, top, width, bottom: top + height }));
  }
  const active = Boolean(pomodoroStatus?.active);
  const progress = pomodoroStatus
    ? (() => {
        const passed = Math.max(0, pomodoroStatus.secondsPassedInSession);
        const remaining = Math.max(0, pomodoroStatus.secondsUntilNextTransition);
        const total = passed + remaining;
        return total > 0 ? Math.min(1, passed / total) : 0;
      })()
    : 0;
  const resting = pomodoroStatus?.phase === 'BREAK'
    || pomodoroStatus?.phase === 'WAITING_FOR_BREAK'
    || Boolean(pomodoroStatus && !pomodoroStatus.sessionActive);
  const showDrag = dragging || drag.dragging;
  return (
    <GestureDetector gesture={drag.gesture}>
      <View
        collapsable={false}
        ref={view => {
          rowRef.current = view;
          onDragViewRef?.(task.taskId, view);
        }}
        onLayout={measureRow}
        style={showDrag && styles.dragHost}>
        <NativeAnimated.View style={{ transform: [{ translateY: animatedPreviewOffset }] }}>
          <Reanimated.View
            style={[styles.container, inGroup && styles.groupedContainer, groupLast && styles.groupedLast, {
              backgroundColor: active ? colors.accentSoft : colors.surface,
              borderColor: active ? (resting ? colors.success : colors.accent) : colors.border,
              borderBottomColor: inGroup ? colors.border : undefined,
            }, selected && (inGroup ? { backgroundColor: colors.accentSoft, borderLeftWidth: 3, borderLeftColor: colors.accent } : { borderColor: colors.accent, borderWidth: 2 }),
            drag.animatedStyle,
            showDrag && styles.dragging,
            ]}>
          <TaskRowBody
            task={task}
            onToggle={onToggle}
            onPress={onPress}
            onLongPress={() => undefined}
            onSelectionToggle={onSelectionToggle}
            selected={selected}
            onDelete={onDelete}
            onPomodoroPress={onPomodoroPress}
            pomodoroOpen={pomodoroOpen}
            pomodoroStatus={pomodoroStatus}
            interactive={!showDrag}
          />
          {dropTarget && (
            <View
              pointerEvents="none"
              style={[
                styles.dropIndicator,
                { backgroundColor: colors.accent, shadowColor: colors.accent },
                dropTargetEdge === 'after'
                  ? [styles.dropIndicatorAfter, !inGroup && styles.dropIndicatorAfterGap]
                  : [styles.dropIndicatorBefore, !inGroup && styles.dropIndicatorBeforeGap],
              ]}
            />
          )}
          {pomodoroOpen && onPomodoroActiveChange && onPomodoroStatusChange && (
            <PomodoroPanel
              taskId={task.taskId}
              initialStatus={pomodoroStatus}
              onClose={onPomodoroClose ?? (() => undefined)}
              onActiveChange={onPomodoroActiveChange}
              onStatusChange={onPomodoroStatusChange}
            />
          )}
          {active && (
            <View style={[styles.progressTrack, { backgroundColor: resting ? `${colors.success}28` : colors.accentSoft }]}>
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: resting ? colors.success : colors.accent }]} />
            </View>
          )}
          </Reanimated.View>
        </NativeAnimated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 18, borderWidth: 1, overflow: 'visible', position: 'relative' },
  groupedContainer: { borderRadius: 0, borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  groupedLast: { borderBottomLeftRadius: 18, borderBottomRightRadius: 18, borderBottomWidth: 0 },
  dragHost: { zIndex: 20 },
  dragging: { zIndex: 20, borderRadius: 18, borderWidth: 1, shadowColor: '#11111A', shadowOffset: { width: 0, height: 7 }, shadowRadius: 12, shadowOpacity: 0.24 },
  dropIndicator: { position: 'absolute', left: 12, right: 12, height: 3, borderRadius: 2, zIndex: 22, elevation: 4, shadowOpacity: 0.5, shadowRadius: 4 },
  dropIndicatorBefore: { top: -1.5 },
  dropIndicatorAfter: { bottom: -1.5 },
  dropIndicatorBeforeGap: { top: -6.5 },
  dropIndicatorAfterGap: { bottom: -6.5 },
  row: {
    minHeight: 68,
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.75,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 4 },
  completed: { textDecorationLine: 'line-through', opacity: 0.52 },
  progressTrack: { height: 3 },
  progressFill: { height: 3 },
});
