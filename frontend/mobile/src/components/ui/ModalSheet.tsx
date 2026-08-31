import { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/providers/ThemeProvider';
import { AppText } from './AppText';

export function ModalSheet({ visible, onClose, title, children, footer }: PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  title: string;
  footer?: ReactNode;
}>) {
  const { colors } = useAppTheme();
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.heading}>
            <AppText variant="heading">{title}</AppText>
            <Pressable onPress={onClose} hitSlop={12}><AppText color="accent">Close</AppText></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>{children}</ScrollView>
          {footer && <View style={[styles.footer, { borderColor: colors.border }]}>{footer}</View>}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 10 },
  heading: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  body: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  footer: { padding: 16, borderTopWidth: 1 },
});
