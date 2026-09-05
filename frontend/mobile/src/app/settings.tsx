import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppPopup } from '@/components/ui/AppPopup';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { TimePicker } from '@/components/tasks/TaskScheduleField';
import { Screen } from '@/components/ui/Screen';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { useAsyncData } from '@/hooks/useAsyncData';
import { reportError } from '@/lib/errors';
import { useAuth } from '@/providers/AuthProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { useAppPopup } from '@/providers/PopupProvider';
import { useNotifications } from '@/providers/NotificationProvider';
import { accentOptions, useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';

const DEFAULT_CHECKUP_INTERVAL_MINUTES = 180;
const DEFAULT_CHECKUP_START_TIME = '09:00';
const DEFAULT_CHECKUP_TIMES_PER_DAY = 5;
const checkupIntervalOptions = [
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 120, label: '2h' },
  { value: 180, label: '3h' },
  { value: 240, label: '4h' },
  { value: 360, label: '6h' },
  { value: 720, label: '12h' },
];

function dateFromTime(value: string): Date {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  const date = new Date();
  date.setHours(match ? Number(match[1]) : 9, match ? Number(match[2]) : 0, 0, 0);
  return date;
}

function timeFromDate(value: Date): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function startMinute(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const {
    showCompletedTasks,
    setShowCompletedTasks,
    showClosedMentalThreads,
    setShowClosedMentalThreads,
    soundEffectsEnabled,
    setSoundEffectsEnabled,
  } = usePreferences();
  const { confirm, showError } = useAppPopup();
  const { syncCheckupNotifications } = useNotifications();
  const { colors, mode, accent, setMode, setAccent } = useAppTheme();
  const resource = useAsyncData(() => api.preferences.get());
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [checkupIntervalMinutes, setCheckupIntervalMinutes] = useState(DEFAULT_CHECKUP_INTERVAL_MINUTES);
  const [checkupStartTime, setCheckupStartTime] = useState(DEFAULT_CHECKUP_START_TIME);
  const [checkupTimesPerDay, setCheckupTimesPerDay] = useState(String(DEFAULT_CHECKUP_TIMES_PER_DAY));
  const [checkupScheduleEdited, setCheckupScheduleEdited] = useState(false);
  const [checkupTimePickerOpen, setCheckupTimePickerOpen] = useState(false);
  const [checkupTimeDraft, setCheckupTimeDraft] = useState(() => dateFromTime(DEFAULT_CHECKUP_START_TIME));
  const [checkupScheduleSaving, setCheckupScheduleSaving] = useState(false);

  const persistedCheckupIntervalMinutes = resource.data?.checkupIntervalMinutes || DEFAULT_CHECKUP_INTERVAL_MINUTES;
  const persistedCheckupStartTime = resource.data?.checkupStartTime?.slice(0, 5) || DEFAULT_CHECKUP_START_TIME;
  const persistedCheckupTimesPerDay = String(resource.data?.checkupTimesPerDay || DEFAULT_CHECKUP_TIMES_PER_DAY);
  const displayedCheckupIntervalMinutes = checkupScheduleEdited ? checkupIntervalMinutes : persistedCheckupIntervalMinutes;
  const displayedCheckupStartTime = checkupScheduleEdited ? checkupStartTime : persistedCheckupStartTime;
  const displayedCheckupTimesPerDay = checkupScheduleEdited ? checkupTimesPerDay : persistedCheckupTimesPerDay;
  const checkupScheduleVisible = resource.data !== null && resource.data.checkupNotificationsEnabled !== false;

  async function updatePreference(
    key: 'includeUnloggedNumericDaysAsZero' | 'autoStartPomodoroSessions' | 'checkupNotificationsEnabled',
    value: boolean,
  ) {
    if (!resource.data) return;
    const previous = resource.data;
    resource.setData({ ...previous, [key]: value });
    try {
      const updated = await api.preferences.update({ [key]: value });
      resource.setData(updated);
      if (key === 'checkupNotificationsEnabled') {
        void syncCheckupNotifications(updated).catch(cause => {
          console.error('Could not synchronize check-up notifications:', cause);
        });
      }
    }
    catch (cause) { resource.setData(previous); void showError('Could not save setting', reportError('Could not save setting', cause)); }
  }

  async function saveCheckupSchedule() {
    if (!resource.data) return;
    const timesPerDay = Number.parseInt(displayedCheckupTimesPerDay, 10);
    const firstCheckupMinute = startMinute(displayedCheckupStartTime);
    if (!Number.isInteger(timesPerDay) || timesPerDay < 1 || timesPerDay > 24) {
      void showError('Invalid schedule', 'Choose between 1 and 24 check-ups per day.');
      return;
    }
    if (firstCheckupMinute === null || firstCheckupMinute + (timesPerDay - 1) * displayedCheckupIntervalMinutes > 23 * 60 + 59) {
      void showError('Invalid schedule', 'The check-up schedule must fit within the same day.');
      return;
    }

    const previous = resource.data;
    setCheckupScheduleSaving(true);
    resource.setData({
      ...previous,
      checkupIntervalMinutes: displayedCheckupIntervalMinutes,
      checkupStartTime: displayedCheckupStartTime,
      checkupTimesPerDay: timesPerDay,
    });
    try {
      const updated = await api.preferences.update({
        checkupIntervalMinutes: displayedCheckupIntervalMinutes,
        checkupStartTime: displayedCheckupStartTime,
        checkupTimesPerDay: timesPerDay,
      });
      resource.setData(updated);
      setCheckupIntervalMinutes(updated.checkupIntervalMinutes);
      setCheckupStartTime(updated.checkupStartTime.slice(0, 5));
      setCheckupTimesPerDay(String(updated.checkupTimesPerDay));
      setCheckupScheduleEdited(false);
      void syncCheckupNotifications(updated).catch(cause => {
        console.error('Could not synchronize check-up notifications:', cause);
      });
    } catch (cause) {
      resource.setData(previous);
      void showError('Could not save schedule', reportError('Could not save check-up schedule', cause));
    } finally {
      setCheckupScheduleSaving(false);
    }
  }

  function openCheckupTimePicker() {
    setCheckupTimeDraft(dateFromTime(displayedCheckupStartTime));
    setCheckupTimePickerOpen(true);
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
    <Screen safeAreaTop={false}>
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
        <SettingRow label="Show closed threads" detail="Keep closed threads visible in the mental threads list." value={showClosedMentalThreads} onChange={setShowClosedMentalThreads} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingRow label="Auto-start Pomodoro phases" detail="Move directly into the next focus or break phase." value={resource.data?.autoStartPomodoroSessions ?? true} disabled={!resource.data} onChange={value => void updatePreference('autoStartPomodoroSessions', value)} />
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionHeading}><Ionicons name="time-outline" size={20} color={colors.textMuted} /><AppText variant="heading">Mental state check-ups</AppText></View>
        <SettingRow label="Send check-up notifications" detail="Get reminders to pause and record how you are doing." value={resource.data?.checkupNotificationsEnabled ?? true} disabled={!resource.data} onChange={value => void updatePreference('checkupNotificationsEnabled', value)} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        {checkupScheduleVisible && (
          <>
            <AppText variant="label">Repeat every</AppText>
            <ChoiceChips value={displayedCheckupIntervalMinutes} onChange={value => { setCheckupIntervalMinutes(value); setCheckupScheduleEdited(true); }} options={checkupIntervalOptions} />
            <AppText variant="label">Starting time</AppText>
            <SilentPressable
              accessibilityRole="button"
              accessibilityLabel={`Check-up starting time: ${displayedCheckupStartTime}`}
              onPress={openCheckupTimePicker}
              style={({ pressed }) => [styles.timeField, { borderColor: colors.border, backgroundColor: colors.background }, pressed && { opacity: 0.72 }]}
            >
              <Ionicons name="time-outline" size={19} color={colors.accent} />
              <AppText variant="label" style={styles.grow}>{displayedCheckupStartTime}</AppText>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </SilentPressable>
            <AppInput
              label="Times per day"
              value={displayedCheckupTimesPerDay}
              onChangeText={value => { setCheckupTimesPerDay(value); setCheckupScheduleEdited(true); }}
              keyboardType="number-pad"
              maxLength={2}
              editable={!checkupScheduleSaving}
            />
            <AppText variant="caption" color="muted">Notifications are delivered at the start time and then at each interval, within the same day.</AppText>
            <AppButton label="Save check-up schedule" variant="secondary" loading={checkupScheduleSaving} onPress={() => void saveCheckupSchedule()} />
            <AppPopup
              visible={checkupTimePickerOpen}
              title="Starting time"
              showIcon={false}
              onClose={() => setCheckupTimePickerOpen(false)}
              dismissOnBackdrop={false}
              footer={(
                <View style={styles.popupActions}>
                  <AppButton style={styles.popupAction} variant="secondary" label="Cancel" onPress={() => setCheckupTimePickerOpen(false)} />
                  <AppButton style={styles.popupAction} label="Done" onPress={() => { setCheckupStartTime(timeFromDate(checkupTimeDraft)); setCheckupScheduleEdited(true); setCheckupTimePickerOpen(false); }} />
                </View>
              )}
            >
              <TimePicker key={String(checkupTimePickerOpen)} value={checkupTimeDraft} onChange={setCheckupTimeDraft} />
            </AppPopup>
          </>
        )}
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
  setting: { flexDirection: 'row', alignItems: 'center', gap: 14 }, timeField: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14 }, accountActions: { gap: 12, borderTopWidth: 1, paddingTop: 16 }, accountOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderRadius: 14, padding: 13 }, optionCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 }, passwordForm: { gap: 12 }, grow: { flex: 1, gap: 3 }, divider: { height: 1 }, popupActions: { flexDirection: 'row', gap: 10 }, popupAction: { flex: 1 },
  profileSummary: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderRadius: 16, padding: 14 }, avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
