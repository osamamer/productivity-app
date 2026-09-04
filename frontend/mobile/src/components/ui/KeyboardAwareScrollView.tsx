import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useRef } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  StyleProp,
  UIManager,
  ViewStyle,
  findNodeHandle,
} from 'react-native';

const INPUT_MARGIN = 16;

type FocusInput = (target: number) => void;

const KeyboardAwareFocusContext = createContext<FocusInput | null>(null);

export function useKeyboardAwareFocus(): FocusInput | null {
  return useContext(KeyboardAwareFocusContext);
}

interface Props extends ScrollViewProps {
  avoidKeyboard?: boolean;
  keyboardVerticalOffset?: number;
}

export function KeyboardAwareScrollView({
  children,
  avoidKeyboard = true,
  keyboardVerticalOffset = 0,
  onFocus,
  onScroll,
  ...props
}: PropsWithChildren<Props>) {
  const scrollRef = useRef<ScrollView>(null);
  const focusedInputRef = useRef<number | null>(null);
  const scrollOffsetRef = useRef(0);
  const keyboardTopRef = useRef<number | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealFocusedInput = useCallback(() => {
    const scrollNode = findNodeHandle(scrollRef.current);
    const inputNode = focusedInputRef.current;
    if (!scrollNode || inputNode === null) return;

    UIManager.measureInWindow(scrollNode, (_scrollX, scrollY, _scrollWidth, scrollHeight) => {
      UIManager.measureInWindow(inputNode, (_inputX, inputY, _inputWidth, inputHeight) => {
        const visibleTop = scrollY + INPUT_MARGIN;
        const keyboardTop = keyboardTopRef.current;
        const visibleBottom = Math.min(
          scrollY + scrollHeight,
          keyboardTop === null ? Number.POSITIVE_INFINITY : keyboardTop - keyboardVerticalOffset,
        ) - INPUT_MARGIN;
        const inputBottom = inputY + inputHeight;
        const adjustment = inputBottom > visibleBottom
          ? inputBottom - visibleBottom
          : inputY < visibleTop
            ? inputY - visibleTop
            : 0;

        if (adjustment !== 0) {
          scrollRef.current?.scrollTo({
            y: Math.max(0, scrollOffsetRef.current + adjustment),
            animated: true,
          });
        }
      });
    });
  }, [keyboardVerticalOffset]);

  const scheduleReveal = useCallback((keyboardTop?: number) => {
    if (keyboardTop !== undefined) keyboardTopRef.current = keyboardTop;
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      revealFocusedInput();
      revealTimerRef.current = null;
    }, 100);
  }, [revealFocusedInput]);

  const focusInput = useCallback<FocusInput>(target => {
    focusedInputRef.current = target;
    scheduleReveal();
  }, [scheduleReveal]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', event => {
      scheduleReveal(event.endCoordinates.screenY);
    });
    const frameSubscription = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillChangeFrame', event => scheduleReveal(event.endCoordinates.screenY))
      : null;
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTopRef.current = null;
    });

    return () => {
      showSubscription.remove();
      frameSubscription?.remove();
      hideSubscription.remove();
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, [scheduleReveal]);

  const scrollView = (
    <ScrollView
      {...props}
      ref={scrollRef}
      automaticallyAdjustKeyboardInsets
      onFocus={event => {
        focusInput(event.nativeEvent.target);
        onFocus?.(event);
      }}
      onScroll={event => {
        scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
      }}
      scrollEventThrottle={16}>
      {children}
    </ScrollView>
  );

  return (
    <KeyboardAwareFocusContext.Provider value={focusInput}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardVerticalOffset}>
          {scrollView}
        </KeyboardAvoidingView>
      ) : scrollView}
    </KeyboardAwareFocusContext.Provider>
  );
}

export function KeyboardAwareView({ children, keyboardVerticalOffset = 0, style }: PropsWithChildren<{ keyboardVerticalOffset?: number; style?: StyleProp<ViewStyle> }>) {
  return (
    <KeyboardAvoidingView
      style={[styles.fill, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}>
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
