import { PropsWithChildren, ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/providers/ThemeProvider';
import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { SilentPressable } from './SilentPressable';

export type AppPopupKind = 'info' | 'error' | 'confirm';

interface AppPopupProps {
  visible: boolean;
  title: string;
  message?: string;
  kind?: AppPopupKind;
  showIcon?: boolean;
  onClose: () => void;
  dismissOnBackdrop?: boolean;
  footer?: ReactNode;
  scrollContent?: boolean;
}

export function AppPopup({
  visible,
  title,
  message,
  kind = 'info',
  showIcon = kind !== 'info',
  onClose,
  dismissOnBackdrop = true,
  footer,
  scrollContent = false,
  children,
}: PropsWithChildren<AppPopupProps>) {
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const icon = kind === 'error' ? '!' : kind === 'confirm' ? '?' : '•';
  const iconColor = kind === 'error' ? colors.danger : kind === 'confirm' ? colors.warning : colors.accent;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
      onRequestClose={onClose}>
      <SafeAreaView style={[styles.safeArea, isLandscape && styles.landscapeSafeArea]}>
        <SilentPressable
          accessibilityRole="button"
          accessibilityLabel="Close popup"
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={dismissOnBackdrop ? onClose : undefined} />
        <View style={[
          styles.card,
          isLandscape && styles.landscapeCard,
          { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: height - (isLandscape ? 24 : 44) },
        ]}>
          {showIcon && (
            <View style={[styles.icon, { backgroundColor: `${iconColor}20` }]}>
              <AppText variant="title" style={{ color: iconColor }}>{icon}</AppText>
            </View>
          )}
          <AppText variant="heading" style={styles.title}>{title}</AppText>
          {message ? <AppText color="muted" style={styles.message}>{message}</AppText> : null}
          {scrollContent ? (
            <ScrollView
              style={styles.scrollBody}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : children}
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
  landscapeSafeArea: { padding: 12 },
  backdrop: { ...StyleSheet.absoluteFill },
  card: { width: '100%', maxWidth: 420, minHeight: 0, flexShrink: 1, borderRadius: 24, borderWidth: 1, padding: 22, gap: 14, shadowColor: '#11111A', shadowOffset: { width: 0, height: 8 }, shadowRadius: 24, shadowOpacity: 0.2, elevation: 8 },
  landscapeCard: { padding: 14, gap: 8 },
  scrollBody: { minHeight: 0, flexShrink: 1 },
  scrollContent: { gap: 14 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 2 },
  message: { marginTop: -4 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
});
