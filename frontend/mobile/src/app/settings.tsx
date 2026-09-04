import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { useAsyncData } from '@/hooks/useAsyncData';
import { reportError } from '@/lib/errors';
import { useAuth } from '@/providers/AuthProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { useAppPopup } from '@/providers/PopupProvider';
import { accentOptions, useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { showCompletedTasks, setShowCompletedTasks, soundEffectsEnabled, setSoundEffectsEnabled } = usePreferences();
  const { confirm, showError } = useAppPopup();
  const { colors, mode, accent, setMode, setAccent } = useAppTheme();
  const resource = useAsyncData(() => api.preferences.get());
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  async function updatePreference(key: 'includeUnloggedNumericDaysAsZero' | 'autoStartPomodoroSessions', value: boolean) {
    if (!resource.data) return;
    const previous = resource.data;
    resource.setData({ ...previous, [key]: value });
    try { resource.setData(await api.preferences.update({ [key]: value })); }
    catch (cause) { resource.setData(previous); void showError('Could not save setting', reportError('Could not save setting', cause)); }
  }

  async function changePassword() {
    if (!currentPassword || !newPassword) return setPasswordMessage('Fill in both password fields.');
    if (newPassword !== confirmPassword) return setPasswordMessage('New password and confirmation do not match.');
    setPasswordSaving(true); setPasswordMessage(null);
    try {
      await api.account.changePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordMessage('Password updated.');
    } catch (cause) { setPasswordMessage(reportError('Could not update password', cause)); }
    finally { setPasswordSaving(false); }
  }

  function closePasswordChange() {
    setChangePasswordOpen(false);
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordMessage(null);
  }

  const displayName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.username || 'Account';
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || user?.username?.[0]?.toUpperCase() || '?';

  async function signOut() {
    if (await confirm('Sign out?', 'You can sign back in at any time.', 'Sign out')) await logout();
  }

  return (
    <Screen title="Settings" eyebrow="Make it yours">
      <Card style={styles.section}>
        <View style={styles.sectionHeading}><Ionicons name="color-palette-outline" size={20} color={colors.textMuted} /><AppText variant="heading">Appearance</AppText></View>
        <AppText variant="label">Theme</AppText>
        <ChoiceChips value={mode} onChange={setMode} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        <AppText variant="label">Accent</AppText>
        <View style={styles.accents}>
          {accentOptions.map(option => (
            <SilentPressable
              key={option.value}
              onPress={() => setAccent(option.value)}
              style={[styles.swatchWrap, {
                backgroundColor: accent === option.value ? colors.accentSoft : 'transparent',
                borderColor: accent === option.value ? `${colors.accent}66` : colors.border,
              }]}
            >
              <View style={[styles.swatch, { backgroundColor: option.color }]} />
              <AppText variant="caption">{option.label}</AppText>
            </SilentPressable>
          ))}
        </View>
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionHeading}><Ionicons name="options-outline" size={20} color={colors.textMuted} /><AppText variant="heading">Behavior</AppText></View>
        <SettingRow label="Play sound effects" detail="Use short musical cues for completions, events, ratings, and mental threads." value={soundEffectsEnabled} onChange={setSoundEffectsEnabled} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingRow label="Count unlogged days as zero" detail="Include empty days when calculating numeric averages." value={resource.data?.includeUnloggedNumericDaysAsZero ?? false} disabled={!resource.data} onChange={value => void updatePreference('includeUnloggedNumericDaysAsZero', value)} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingRow label="Show completed tasks" detail="Keep completed tasks visible on Today and Tasks." value={showCompletedTasks} onChange={setShowCompletedTasks} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingRow label="Auto-start Pomodoro phases" detail="Move directly into the next focus or break phase." value={resource.data?.autoStartPomodoroSessions ?? true} disabled={!resource.data} onChange={value => void updatePreference('autoStartPomodoroSessions', value)} />
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionHeading}><Ionicons name="person-outline" size={20} color={colors.textMuted} /><AppText variant="heading">Account</AppText></View>
        <View style={[styles.profileSummary, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}><AppText variant="heading" style={{ color: colors.onAccent }}>{initials}</AppText></View>
          <View style={styles.grow}><AppText variant="heading">{displayName}</AppText><AppText color="muted">{user?.email}</AppText></View>
        </View>
        <View style={[styles.accountActions, { borderTopColor: colors.border }]}>
          <AppText variant="caption" color="muted">ACCOUNT ACTIONS</AppText>
          <SilentPressable
            accessibilityRole="button"
            accessibilityState={{ expanded: changePasswordOpen }}
            onPress={() => {
              if (changePasswordOpen) closePasswordChange();
              else setChangePasswordOpen(true);
            }}
            style={({ pressed }) => [styles.accountOption, { borderColor: colors.border, backgroundColor: colors.background }, pressed && { opacity: 0.72 }]}
          >
            <View style={styles.optionCopy}>
              <Ionicons name="key-outline" size={19} color={colors.textMuted} />
              <View style={styles.grow}>
                <AppText variant="label">Change password</AppText>
                <AppText color="muted">Update the password used to sign in.</AppText>
              </View>
            </View>
            <Ionicons name={changePasswordOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </SilentPressable>
          {changePasswordOpen && <View style={styles.passwordForm}>
            <AppInput label="Current password" secureTextEntry autoComplete="current-password" importantForAutofill="yes" value={currentPassword} onChangeText={setCurrentPassword} />
            <AppInput label="New password" secureTextEntry autoComplete="new-password" importantForAutofill="yes" value={newPassword} onChangeText={setNewPassword} />
            <AppInput label="Confirm new password" secureTextEntry autoComplete="new-password" importantForAutofill="yes" value={confirmPassword} onChangeText={setConfirmPassword} />
            {passwordMessage && <AppText color={passwordMessage === 'Password updated.' ? 'success' : 'danger'}>{passwordMessage}</AppText>}
            <AppButton variant="secondary" label="Update password" loading={passwordSaving} onPress={() => void changePassword()} />
          </View>}
          <SilentPressable
            accessibilityRole="button"
            onPress={() => void signOut()}
            style={({ pressed }) => [styles.accountOption, { borderColor: `${colors.danger}40`, backgroundColor: `${colors.danger}0C` }, pressed && { opacity: 0.72 }]}
          >
            <View style={styles.optionCopy}>
              <Ionicons name="log-out-outline" size={19} color={colors.danger} />
              <View style={styles.grow}>
                <AppText variant="label" color="danger">Log out</AppText>
                <AppText color="muted">End your session on this device.</AppText>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.danger} />
          </SilentPressable>
        </View>
      </Card>
    </Screen>
  );
}

function SettingRow({ label, detail, value, disabled, onChange }: { label: string; detail: string; value: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  const { colors } = useAppTheme();
  return <View style={styles.setting}><View style={styles.grow}><AppText variant="label">{label}</AppText><AppText color="muted">{detail}</AppText></View><Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: colors.accentSoft }} thumbColor={value ? colors.accent : colors.textMuted} /></View>;
}

const styles = StyleSheet.create({
  section: { gap: 16 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 }, accents: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  swatchWrap: { alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 16, padding: 8 }, swatch: { width: 34, height: 34, borderRadius: 17 },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 14 }, accountActions: { gap: 12, borderTopWidth: 1, paddingTop: 16 }, accountOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderRadius: 14, padding: 13 }, optionCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 }, passwordForm: { gap: 12 }, grow: { flex: 1, gap: 3 }, divider: { height: 1 },
  profileSummary: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderRadius: 16, padding: 14 }, avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
