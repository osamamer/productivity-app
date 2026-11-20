import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, Switch, View } from 'react-native';

import { PasswordPrompt } from '@/components/boundaries/PasswordPrompt';
import { SettingRow } from '@/components/boundaries/SettingRow';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { useAppPopup } from '@/providers/PopupProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { Boundaries, type EnforcementState } from '@/services/boundaries';

interface Status {
  enforcement: EnforcementState;
  ruleCount: number;
  accessibility: boolean;
  deviceAdmin: boolean;
  shizukuRunning: boolean;
  shizukuGranted: boolean;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

async function loadStatus(): Promise<Status | null> {
  if (!Boundaries) return null;
  const [enforcement, rules, accessibility, deviceAdmin, shizukuRunning, shizukuGranted] = await Promise.all([
    Boundaries.getEnforcementState(),
    Boundaries.getRules(),
    Boundaries.isAccessibilityServiceEnabled(),
    Boundaries.isDeviceAdminActive(),
    Boundaries.isShizukuRunning(),
    Boundaries.isShizukuPermissionGranted(),
  ]);
  return { enforcement, ruleCount: (JSON.parse(rules) as unknown[]).length, accessibility, deviceAdmin, shizukuRunning, shizukuGranted };
}

export default function BoundariesHome() {
  const { colors } = useAppTheme();
  const popup = useAppPopup();
  const [status, setStatus] = useState<Status | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [prompt, setPrompt] = useState<'pause' | 'master' | null>(null);
  const [enablingViaShizuku, setEnablingViaShizuku] = useState(false);

  const refresh = useCallback(() => {
    loadStatus().then(setStatus).catch(cause => console.error('Could not load Boundaries status:', cause));
  }, []);

  useFocusEffect(refresh);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => { if (next === 'active') refresh(); });
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [refresh]);

  const pausedUntil = status?.enforcement.pausedUntil ?? 0;
  useEffect(() => {
    if (pausedUntil > 0 && now >= pausedUntil) refresh();
  }, [now, pausedUntil, refresh]);

  if (!Boundaries) {
    return (
      <Screen back>
        <AppText variant="display">Boundaries</AppText>
        <AppText color="muted">{'App boundaries need Android. This device doesn\'t let apps watch or close other apps.'}</AppText>
      </Screen>
    );
  }

  const enforcement = status?.enforcement;
  const statusLabel = !enforcement
    ? 'Checking…'
    : enforcement.indefinitelyDisabled
      ? 'Off until you turn them back on'
      : enforcement.pausedUntil > now
        ? `Paused — back on in ${formatCountdown(enforcement.pausedUntil - now)}`
        : 'On';

  const turnOn = async () => {
    await Boundaries?.enable();
    refresh();
  };

  const enableViaShizuku = async () => {
    setEnablingViaShizuku(true);
    try {
      if (!(await Boundaries?.enableAccessibilityViaShizuku())) {
        await popup.showError("Couldn't turn it on with Shizuku", 'Make sure Shizuku is running and Claritard is allowed in it, then try again.');
      }
    } finally {
      setEnablingViaShizuku(false);
      refresh();
    }
  };

  return (
    <Screen back>
      <View style={styles.header}>
        <AppText variant="display">Boundaries</AppText>
        <AppText color="muted">Blocks, daily limits, open limits and schedules for the apps that pull you in.</AppText>
      </View>

      <Card style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusCopy}>
            <AppText variant="caption" color="muted">Boundaries</AppText>
            <AppText variant="title">{statusLabel}</AppText>
          </View>
          <Switch
            value={enforcement?.active ?? false}
            onValueChange={value => (value ? void turnOn() : setPrompt('pause'))}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>
        {enforcement?.indefinitelyDisabled ? (
          <AppButton label="Turn boundaries back on" onPress={() => void turnOn()} />
        ) : (
          <SilentPressable accessibilityRole="button" onPress={() => setPrompt('master')} style={styles.link}>
            <AppText variant="caption" color="danger">Master override (turn off until I turn them back on)</AppText>
          </SilentPressable>
        )}
      </Card>

      <SettingRow
        icon="apps-outline"
        title="App rules"
        subtitle={`Block, time limits, open limits, schedules · ${status?.ruleCount ?? 0} apps`}
        onPress={() => router.push('/boundaries/apps')}
      />
      <SettingRow icon="key-outline" title="Change passwords" onPress={() => router.push('/boundaries/passwords')} />

      <AppText variant="label" color="muted" style={styles.section}>Needed for boundaries to work</AppText>
      <SettingRow
        icon="accessibility-outline"
        title="Accessibility service"
        tone={status?.accessibility ? 'good' : 'attention'}
        subtitle={status?.accessibility
          ? 'On'
          : status?.shizukuGranted
            ? 'Off — if Settings says it is restricted, use Shizuku'
            : 'Off — if Settings blocks it, allow Shizuku below to turn it on from here'}
        trailing={status && !status.accessibility ? (
          <View style={styles.buttons}>
            {status.shizukuGranted && (
              <AppButton compact label="Via Shizuku" loading={enablingViaShizuku} onPress={() => void enableViaShizuku()} />
            )}
            <AppButton compact variant="secondary" label={status.shizukuGranted ? 'Settings' : 'Turn on'} onPress={() => void Boundaries?.openAccessibilitySettings()} />
          </View>
        ) : undefined}
      />
      <SettingRow
        icon="shield-checkmark-outline"
        title="Device admin"
        tone={status?.deviceAdmin ? 'good' : 'attention'}
        subtitle={status?.deviceAdmin ? 'Active' : 'Not active — uninstalling takes no extra steps yet'}
        trailing={status && !status.deviceAdmin ? <AppButton compact label="Activate" onPress={() => void Boundaries?.requestDeviceAdmin()} /> : undefined}
      />

      <AppText variant="label" color="muted" style={styles.section}>Optional</AppText>
      <SettingRow
        icon="flash-outline"
        title="Force-close with Shizuku"
        tone={status?.shizukuGranted ? 'good' : 'default'}
        subtitle={!status?.shizukuRunning
          ? 'Shizuku isn\'t running — install it and start its service (again after every reboot)'
          : status.shizukuGranted
            ? 'Allowed — apps are force-closed when blocked or out of time'
            : 'Not allowed — apps are only sent to the home screen, not closed'}
        trailing={status?.shizukuRunning && !status.shizukuGranted
          ? <AppButton compact label="Allow" onPress={() => void Boundaries?.requestShizukuPermission()} />
          : undefined}
      />

      <PasswordPrompt
        visible={prompt === 'pause'}
        title="Pause boundaries"
        message="They turn back on by themselves in 5 minutes."
        placeholder="Unlock password"
        submitLabel="Pause 5 min"
        incorrectMessage="Incorrect unlock password"
        onCancel={() => setPrompt(null)}
        verify={async password => Boolean(await Boundaries?.verifyUnlockPassword(password))}
        onConfirmed={async password => {
          await Boundaries?.pauseWithUnlockPassword(password);
          setPrompt(null);
          refresh();
        }}
      />
      <PasswordPrompt
        visible={prompt === 'master'}
        title="Master override"
        message="Turns every boundary off until you switch them back on yourself."
        placeholder="Master password"
        submitLabel="Turn off"
        incorrectMessage="Incorrect master password"
        onCancel={() => setPrompt(null)}
        verify={async password => Boolean(await Boundaries?.verifyMasterPassword(password))}
        onConfirmed={async password => {
          await Boundaries?.disableWithMasterPassword(password);
          setPrompt(null);
          refresh();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  statusCard: { gap: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusCopy: { flex: 1, gap: 2 },
  link: { paddingVertical: 4, alignItems: 'center' },
  section: { marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  buttons: { gap: 6 },
});
