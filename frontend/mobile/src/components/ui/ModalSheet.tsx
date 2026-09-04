import { PropsWithChildren, ReactNode } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/providers/ThemeProvider';
import { AppText } from './AppText';
import { SilentPressable } from './SilentPressable';
import { KeyboardAwareScrollView, KeyboardAwareView } from './KeyboardAwareScrollView';

export function ModalSheet({ visible, onClose, title, children, footer }: PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  title: string;
  footer?: ReactNode;
}>) {
  const { colors } = useAppTheme();
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <KeyboardAwareView style={styles.fill}>
        <SilentPressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.heading}>
            <AppText variant="heading">{title}</AppText>
          <SilentPressable onPress={onClose} hitSlop={12}><AppText color="accent">Close</AppText></SilentPressable>
          </View>
          <KeyboardAwareScrollView
            avoidKeyboard={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={styles.body}>
            {children}
          </KeyboardAwareScrollView>
          {footer && <View style={[styles.footer, { borderColor: colors.border }]}>{footer}</View>}
        </SafeAreaView>
      </KeyboardAwareView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { maxHeight: '92%', flexShrink: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, minHeight: 0 },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 10 },
  heading: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  body: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  footer: { padding: 16, borderTopWidth: 1 },
});
