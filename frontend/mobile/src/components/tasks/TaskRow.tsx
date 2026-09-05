import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

import { formatShortDate, formatTime } from '@/lib/date';
import { taskPriorityColor } from '@/lib/taskPriority';
import { useAppTheme } from '@/providers/ThemeProvider';
import type { PomodoroStatus, Task } from '@/types/models';
import { PomodoroPanel } from '../pomodoro/PomodoroPanel';
import { AppText } from '../ui/AppText';
import { SilentPressable } from '../ui/SilentPressable';

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
      accessibilityState={selected ? { selected: true } : undefined}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
      {content}
    </SilentPressable>
  );
}

export function TaskRow({ task, onToggle, onPress, onLongPress, onSelectionToggle, selected = false, onDelete, onPomodoroPress, pomodoroOpen, pomodoroStatus, onPomodoroClose, onPomodoroActiveChange, onPomodoroStatusChange, dragEnabled = false, dragging = false, dropTarget = false, dropTargetEdge, onDragLayout, onDragStart, onDragMove, onDragEnd, onDragCancel, inGroup = false, groupLast = false }: {
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
  dropTarget?: boolean;
  dropTargetEdge?: 'before' | 'after';
  onDragLayout?: (taskId: string, layout: TaskDragLayout) => void;
  onDragStart?: (taskId: string, startY: number) => void;
  onDragMove?: (taskId: string, moveY: number, dy: number) => void;
  onDragEnd?: (taskId: string, moveY: number) => void;
  onDragCancel?: (taskId: string) => void;
  inGroup?: boolean;
  groupLast?: boolean;
}) {
  const { colors } = useAppTheme();
  const rowRef = useRef<View>(null);
  const touchStartRef = useRef(0);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const dragArmedRef = useRef(false);
  const dragArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localDragging, setLocalDragging] = useState(false);
  const [dragOffset] = useState(() => new Animated.Value(0));
  const dragEnabledRef = useRef(dragEnabled);
  const onPressRef = useRef(onPress);
  const onLongPressRef = useRef(onLongPress);
  const onSelectionToggleRef = useRef(onSelectionToggle);
  const onDragStartRef = useRef(onDragStart);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);
  const onDragCancelRef = useRef(onDragCancel);
  useEffect(() => {
    dragEnabledRef.current = dragEnabled;
    onPressRef.current = onPress;
    onLongPressRef.current = onLongPress;
    onSelectionToggleRef.current = onSelectionToggle;
    onDragStartRef.current = onDragStart;
    onDragMoveRef.current = onDragMove;
    onDragEndRef.current = onDragEnd;
    onDragCancelRef.current = onDragCancel;
  }, [dragEnabled, onDragCancel, onDragEnd, onDragMove, onDragStart, onLongPress, onPress, onSelectionToggle]);
  const [panResponder, setPanResponder] = useState<ReturnType<typeof PanResponder.create> | null>(null);
  useEffect(() => {
    setPanResponder(PanResponder.create({
      onStartShouldSetPanResponder: () => dragEnabledRef.current,
      onPanResponderGrant: () => {
        touchStartRef.current = Date.now();
        movedRef.current = false;
        dragArmedRef.current = false;
        longPressFiredRef.current = false;
        if (dragArmTimerRef.current) clearTimeout(dragArmTimerRef.current);
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        dragArmTimerRef.current = setTimeout(() => {
          dragArmTimerRef.current = null;
          if (!movedRef.current) dragArmedRef.current = true;
        }, 250);
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          if (!movedRef.current && !draggingRef.current) {
            longPressFiredRef.current = true;
            onLongPressRef.current?.();
          }
        }, 500);
        dragOffset.setValue(0);
      },
      onPanResponderMove: (_event, gestureState) => {
        const movedBeforeThisEvent = movedRef.current;
        if (Math.abs(gestureState.dx) > 7 || Math.abs(gestureState.dy) > 7) movedRef.current = true;
        if (!dragArmedRef.current && !movedBeforeThisEvent && Date.now() - touchStartRef.current >= 250) {
          dragArmedRef.current = true;
        }
        if (longPressFiredRef.current || draggingRef.current) {
          if (draggingRef.current) {
            dragOffset.setValue(gestureState.dy);
            onDragMoveRef.current?.(task.taskId, gestureState.moveY, gestureState.dy);
          }
          return;
        }
        const heldLongEnough = Date.now() - touchStartRef.current >= 250;
        if (!heldLongEnough || !dragArmedRef.current || Math.abs(gestureState.dy) <= 7) return;
        draggingRef.current = true;
        if (dragArmTimerRef.current) {
          clearTimeout(dragArmTimerRef.current);
          dragArmTimerRef.current = null;
        }
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        setLocalDragging(true);
        onDragStartRef.current?.(task.taskId, gestureState.y0);
        dragOffset.setValue(gestureState.dy);
        onDragMoveRef.current?.(task.taskId, gestureState.moveY, gestureState.dy);
      },
      onPanResponderRelease: (_event, gestureState) => {
        if (dragArmTimerRef.current) {
          clearTimeout(dragArmTimerRef.current);
          dragArmTimerRef.current = null;
        }
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (draggingRef.current) {
          onDragEndRef.current?.(task.taskId, gestureState.moveY);
        } else if (!movedRef.current && !longPressFiredRef.current) {
          (onSelectionToggleRef.current ?? onPressRef.current)?.();
        }
        draggingRef.current = false;
        setLocalDragging(false);
      },
      onPanResponderTerminate: () => {
        if (dragArmTimerRef.current) {
          clearTimeout(dragArmTimerRef.current);
          dragArmTimerRef.current = null;
        }
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (draggingRef.current) onDragCancelRef.current?.(task.taskId);
        draggingRef.current = false;
        setLocalDragging(false);
      },
      onPanResponderTerminationRequest: () => !dragArmedRef.current && !draggingRef.current,
    }));
  }, [dragOffset, task.taskId]);

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
  const showDrag = dragging || localDragging;
  return (
    <View
      ref={rowRef}
      {...(dragEnabled ? panResponder?.panHandlers ?? {} : {})}
      onTouchStart={() => { touchStartRef.current = Date.now(); }}
      onLayout={measureRow}
      style={[styles.container, inGroup && styles.groupedContainer, groupLast && styles.groupedLast, {
        backgroundColor: active ? colors.accentSoft : colors.surface,
        borderColor: active ? (resting ? colors.success : colors.accent) : colors.border,
        borderBottomColor: inGroup ? colors.border : undefined,
      }, selected && (inGroup ? { backgroundColor: colors.accentSoft, borderLeftWidth: 3, borderLeftColor: colors.accent } : { borderColor: colors.accent, borderWidth: 2 }),
      dropTarget && { backgroundColor: colors.accentSoft, borderColor: colors.accent },
      showDrag && styles.dragging,
      ]}>
      <View style={showDrag && styles.dragPlaceholder}>
        <TaskRowBody
          task={task}
          onToggle={onToggle}
          onPress={onPress}
          onLongPress={onLongPress}
          onSelectionToggle={onSelectionToggle}
          selected={selected}
          onDelete={onDelete}
          onPomodoroPress={onPomodoroPress}
          pomodoroOpen={pomodoroOpen}
          pomodoroStatus={pomodoroStatus}
          interactive={!dragEnabled}
        />
      </View>
      {showDrag && (
        <Animated.View
          pointerEvents="none"
          style={[styles.dragPreview, { backgroundColor: colors.surface, borderColor: colors.accent }, { transform: [{ translateY: dragOffset }] }]}>
          <TaskRowBody
            task={task}
            onToggle={onToggle}
            selected={selected}
            onDelete={onDelete}
            onPomodoroPress={onPomodoroPress}
            pomodoroOpen={pomodoroOpen}
            pomodoroStatus={pomodoroStatus}
            interactive={false}
          />
        </Animated.View>
      )}
      {dropTarget && (
        <View
          pointerEvents="none"
          style={[styles.dropIndicator, { backgroundColor: colors.accent }, dropTargetEdge === 'after' ? styles.dropIndicatorAfter : styles.dropIndicatorBefore]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 18, borderWidth: 1, overflow: 'visible', position: 'relative' },
  groupedContainer: { borderRadius: 0, borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  groupedLast: { borderBottomWidth: 0 },
  dragging: { zIndex: 20, elevation: 7 },
  dragPlaceholder: { opacity: 0.2 },
  dragPreview: { position: 'absolute', left: 0, right: 0, top: 0, borderRadius: 18, borderWidth: 1, overflow: 'hidden', zIndex: 21, shadowColor: '#11111A', shadowOffset: { width: 0, height: 7 }, shadowRadius: 12, shadowOpacity: 0.24, elevation: 8 },
  dropIndicator: { position: 'absolute', left: 10, right: 10, height: 2, borderRadius: 2, zIndex: 22 },
  dropIndicatorBefore: { top: 0 },
  dropIndicatorAfter: { bottom: 0 },
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
