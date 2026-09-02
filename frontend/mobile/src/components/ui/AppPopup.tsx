import { PropsWithChildren, ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/providers/ThemeProvider';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

export type AppPopupKind = 'info' | 'error' | 'confirm';

interface AppPopupProps {
  visible: boolean;
  title: string;
  message?: string;
  kind?: AppPopupKind;
  onClose: () => void;
  dismissOnBackdrop?: boolean;
  footer?: ReactNode;
}

export function AppPopup({
  visible,
  title,
  message,
  kind = 'info',
  onClose,
  dismissOnBackdrop = true,
  footer,
  children,
}: PropsWithChildren<AppPopupProps>) {
  const { colors } = useAppTheme();
  const icon = kind === 'error' ? '!' : kind === 'confirm' ? '?' : '•';
  const iconColor = kind === 'error' ? colors.danger : kind === 'confirm' ? colors.warning : colors.accent;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
      onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close popup"
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={dismissOnBackdrop ? onClose : undefined} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.icon, { backgroundColor: `${iconColor}20` }]}>
            <AppText variant="title" style={{ color: iconColor }}>{icon}</AppText>
          </View>
          <AppText variant="heading" style={styles.title}>{title}</AppText>
          {message ? <AppText color="muted" style={styles.message}>{message}</AppText> : null}
          {children}
          {footer ?? (
            <AppButton label="OK" onPress={onClose} />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export function PopupActions({
  cancelLabel = 'Cancel',
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  cancelLabel?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={styles.actions}>
      <AppButton style={styles.action} variant="secondary" label={cancelLabel} onPress={onCancel} />
      <AppButton style={styles.action} variant="danger" label={confirmLabel} onPress={onConfirm} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  backdrop: { ...StyleSheet.absoluteFill },
  card: { width: '100%', maxWidth: 420, borderRadius: 24, borderWidth: 1, padding: 22, gap: 14, shadowColor: '#11111A', shadowOffset: { width: 0, height: 8 }, shadowRadius: 24, shadowOpacity: 0.2, elevation: 8 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 2 },
  message: { marginTop: -4 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
});
